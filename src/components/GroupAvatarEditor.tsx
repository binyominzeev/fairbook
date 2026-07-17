"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

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
      const dataUrl = await readFileAsDataUrl(file);
      setDraftAvatarUrl(dataUrl);
      setPendingAvatarFile(file);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "Failed to read image.");
    }
  };

  const uploadPendingAvatar = async (file: File) => {
    const formData = new FormData();
    formData.set("file", file);

    const response = await fetch("/api/uploads/avatars", {
      method: "POST",
      body: formData,
    });

    const data = await readJsonSafe(response);
    if (!response.ok || typeof data?.url !== "string") {
      throw new Error(data?.error ?? "Failed to upload group avatar.");
    }

    return data.url;
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
    } catch {
      setSaveError("Failed to save group avatar.");
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
            JPG, PNG, WebP or GIF. The server optimizes uploaded avatars to stay under
            1 MB.
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
