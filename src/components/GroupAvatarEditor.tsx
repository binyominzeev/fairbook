"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

const MAX_AVATAR_DIMENSION = 1600;
const AVATAR_MAX_BYTES = 1024 * 1024;
const AVATAR_QUALITY_STEPS = [0.82, 0.74, 0.66, 0.58, 0.5, 0.42, 0.34];
const AVATAR_SCALE_STEPS = [1, 0.9, 0.8, 0.7, 0.6, 0.5, 0.4];
const PASSTHROUGH_IMAGE_TYPES = new Set(["image/webp", "image/jpeg", "image/png"]);

async function readJsonSafe(response: Response) {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }

  const text = await response.text();
  return { error: text || `Request failed (${response.status}).` };
}

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}

async function compressAvatarImage(file: File) {
  if (file.size <= AVATAR_MAX_BYTES && PASSTHROUGH_IMAGE_TYPES.has(file.type)) {
    return file;
  }

  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  const baseLargestSide = Math.max(width, height);
  const normalizedName = file.name.replace(/\.[^.]+$/, "") || "avatar";
  const maxAllowedBytes = Math.min(file.size, AVATAR_MAX_BYTES);

  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Failed to process image.");
  }

  let smallestBlob: Blob | null = null;

  for (const scale of AVATAR_SCALE_STEPS) {
    const scaledLargestSide = Math.min(MAX_AVATAR_DIMENSION, Math.round(baseLargestSide * scale));
    const ratio = Math.min(1, scaledLargestSide / baseLargestSide);
    const targetWidth = Math.max(1, Math.round(width * ratio));
    const targetHeight = Math.max(1, Math.round(height * ratio));

    canvas.width = targetWidth;
    canvas.height = targetHeight;
    context.clearRect(0, 0, targetWidth, targetHeight);
    context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);

    for (const quality of AVATAR_QUALITY_STEPS) {
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", quality);
      });

      if (!blob) {
        continue;
      }

      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob;
      }

      if (blob.size <= maxAllowedBytes) {
        bitmap.close();
        return new File([blob], `${normalizedName}.webp`, { type: "image/webp" });
      }
    }
  }

  bitmap.close();

  if (smallestBlob && smallestBlob.size <= AVATAR_MAX_BYTES) {
    return new File([smallestBlob], `${normalizedName}.webp`, { type: "image/webp" });
  }

  throw new Error("A kép túl nagy. Válassz kisebb felbontású képet.");
}

interface Props {
  groupIdOrSlug: string;
  groupName: string;
  avatarUrl?: string | null;
}

export default function GroupAvatarEditor({ groupIdOrSlug, groupName, avatarUrl }: Props) {
  const router = useRouter();
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(avatarUrl ?? null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [fileError, setFileError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const hasChanges = (draftAvatarUrl ?? null) !== (avatarUrl ?? null);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setFileError("");
    setSaveError("");
    setSaveSuccess("");

    if (!file.type.startsWith("image/")) {
      setFileError("Only image files are allowed.");
      return;
    }

    try {
      const compressedFile = await compressAvatarImage(file);
      const dataUrl = await readFileAsDataUrl(compressedFile);
      setDraftAvatarUrl(dataUrl);
      setPendingAvatarFile(compressedFile);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Failed to read image.");
    }
  };

  const uploadPendingAvatar = async (file: File) => {
    const formData = new FormData();
    formData.append("files", file);

    const response = await fetch("/api/uploads/images", {
      method: "POST",
      body: formData,
    });

    if (response.status === 413) {
      throw new Error(
        "A kép túl nagy a szerver feltöltési limitjéhez (413). Növeld az nginx client_max_body_size értékét."
      );
    }

    const data = await readJsonSafe(response);
    if (!response.ok || !Array.isArray(data?.urls) || typeof data.urls[0] !== "string") {
      throw new Error(data?.error ?? "Failed to upload group avatar.");
    }

    return data.urls[0];
  };

  const saveAvatar = async (nextAvatarUrl: string | null) => {
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const resolvedAvatarUrl = pendingAvatarFile
        ? await uploadPendingAvatar(pendingAvatarFile)
        : nextAvatarUrl;

      const response = await fetch(`/api/communities/${encodeURIComponent(groupIdOrSlug)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          avatarUrl: resolvedAvatarUrl,
        }),
      });
      const data = await readJsonSafe(response);

      if (!response.ok) {
        setSaveError(data.error ?? "Failed to save group avatar.");
        return;
      }

      setDraftAvatarUrl(data.community?.avatarUrl ?? null);
      setPendingAvatarFile(null);
      setSaveSuccess("Group avatar saved.");
      startTransition(() => {
        router.refresh();
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "Failed to save group avatar."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="space-y-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900">Group avatar</h2>
          <p className="mt-1 text-xs text-slate-500">
            JPG, PNG, WebP or GIF. The browser compresses before upload using the same
            flow as post images.
          </p>
        </div>

        <div className="flex items-start gap-3">
          <Avatar
            name={groupName}
            avatarUrl={draftAvatarUrl}
            sizeClassName="h-14 w-14"
            textClassName="text-lg font-semibold"
          />
          <div className="min-w-0 flex-1 space-y-2">
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp,image/gif"
              onChange={handleFileChange}
              className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-slate-100 file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
            />
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => saveAvatar(draftAvatarUrl)}
                disabled={isSaving || !hasChanges}
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {isSaving ? "Saving..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setDraftAvatarUrl(null);
                  setPendingAvatarFile(null);
                  setFileError("");
                  setSaveError("");
                  setSaveSuccess("");
                }}
                disabled={isSaving || !draftAvatarUrl}
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 transition-colors hover:border-slate-400 hover:text-slate-950 disabled:border-slate-200 disabled:text-slate-300"
              >
                Remove
              </button>
            </div>
          </div>
        </div>

        {fileError && <p className="text-xs text-red-600">{fileError}</p>}
        {saveError && <p className="text-xs text-red-600">{saveError}</p>}
        {saveSuccess && <p className="text-xs text-emerald-700">{saveSuccess}</p>}
      </div>
    </section>
  );
}
