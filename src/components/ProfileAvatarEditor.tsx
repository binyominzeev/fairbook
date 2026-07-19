"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Avatar from "@/components/Avatar";
import { buildProfilePath } from "@/lib/profile-path";

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
  userId: string;
  slug?: string | null;
  name: string;
  email: string;
  avatarUrl?: string | null;
  hideViolentFeed: boolean;
  isAdmin: boolean;
  commentInsightsEnabled: boolean;
}

export default function ProfileAvatarEditor({
  userId,
  slug,
  name,
  email,
  avatarUrl,
  hideViolentFeed,
  isAdmin,
  commentInsightsEnabled,
}: Props) {
  const router = useRouter();
  const [draftSlug, setDraftSlug] = useState(slug ?? "");
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(avatarUrl ?? null);
  const [pendingAvatarFile, setPendingAvatarFile] = useState<File | null>(null);
  const [draftHideViolentFeed, setDraftHideViolentFeed] = useState(hideViolentFeed);
  const [draftCommentInsightsEnabled, setDraftCommentInsightsEnabled] =
    useState(commentInsightsEnabled);
  const [isSaving, setIsSaving] = useState(false);
  const [fileError, setFileError] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const hasChanges =
    draftSlug.trim() !== (slug ?? "") ||
    (draftAvatarUrl ?? null) !== (avatarUrl ?? null) ||
    draftHideViolentFeed !== hideViolentFeed ||
    (isAdmin && draftCommentInsightsEnabled !== commentInsightsEnabled);

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";

    if (!file) return;

    setFileError("");
    setSaveError("");
    setSaveSuccess("");

    if (!file.type.startsWith("image/")) {
      setFileError("Csak képfájl tölthető fel.");
      return;
    }

    try {
      const compressedFile = await compressAvatarImage(file);
      const dataUrl = await readFileAsDataUrl(compressedFile);
      setDraftAvatarUrl(dataUrl);
      setPendingAvatarFile(compressedFile);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "A kép beolvasása sikertelen volt.");
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
      throw new Error(data?.error ?? "A profilkép feltöltése sikertelen volt.");
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

      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          slug: draftSlug,
          avatarUrl: resolvedAvatarUrl,
          hideViolentFeed: draftHideViolentFeed,
          ...(isAdmin ? { commentInsightsEnabled: draftCommentInsightsEnabled } : {}),
        }),
      });
      const data = await readJsonSafe(response);

      if (!response.ok) {
        setSaveError(data.error ?? "A profilkép mentése sikertelen volt.");
        return;
      }

      setDraftAvatarUrl(data.user.avatarUrl ?? null);
      setPendingAvatarFile(null);
      setDraftSlug(data.user.slug ?? "");
      setDraftHideViolentFeed(Boolean(data.user.hideViolentFeed));
      if (isAdmin && data.appConfig) {
        setDraftCommentInsightsEnabled(Boolean(data.appConfig.commentInsightsEnabled));
      }
      setSaveSuccess("Beállítások mentve.");
      startTransition(() => {
        router.push(buildProfilePath({ id: data.user.id, slug: data.user.slug }));
        router.refresh();
      });
    } catch (error) {
      setSaveError(
        error instanceof Error ? error.message : "A profilkép mentése sikertelen volt."
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-6">
      <div className="space-y-5">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Saját beállítások</h2>
          <p className="mt-1 text-sm text-slate-500">
            A fiókod adatai és a személyes feed szűrései itt kezelhetők.
          </p>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-900">Felhasználónév</span>
            <input
              type="text"
              value={name}
              disabled
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-900">Slug</span>
            <input
              type="text"
              value={draftSlug}
              onChange={(event) => {
                setDraftSlug(event.target.value);
                setSaveError("");
                setSaveSuccess("");
              }}
              autoCapitalize="none"
              autoCorrect="off"
              spellCheck={false}
              className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
          </label>
          <label className="space-y-1.5">
            <span className="text-sm font-medium text-slate-900">Email</span>
            <input
              type="email"
              value={email}
              disabled
              readOnly
              className="w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500"
            />
          </label>
        </div>

        <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
            <Avatar
              name={name}
              avatarUrl={draftAvatarUrl}
              sizeClassName="h-16 w-16"
              textClassName="text-xl font-bold"
            />
            <div className="min-w-0 flex-1 space-y-2">
              <div>
                <p className="text-sm font-medium text-slate-900">Profilkép</p>
                <p className="text-xs text-slate-500">
                  JPG, PNG, WebP vagy GIF. A böngésző feltöltés előtt tömöríti,
                  ugyanazzal a folyamattal, mint a posztképeknél.
                </p>
              </div>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/gif"
                onChange={handleFileChange}
                className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-white file:px-3 file:py-2 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-100"
              />
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => saveAvatar(draftAvatarUrl)}
                  disabled={isSaving || !hasChanges}
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
                >
                  {isSaving ? "Mentés..." : "Mentés"}
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
                  Eltávolítás
                </button>
              </div>
            </div>
          </div>
        </div>

        <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <div className="space-y-1">
            <span className="block text-sm font-medium text-slate-900">
              Erőszakos hírek szűrése a feedből
            </span>
            <span className="block text-xs leading-5 text-slate-500">
              Elrejti az RSS-forrásokból érkező olyan híreket, amelyek címe vagy leírása
              alapján erőszakos eseményről, halálesetről vagy súlyos támadásról szólhatnak.
            </span>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={draftHideViolentFeed}
            onClick={() => {
              setDraftHideViolentFeed((current) => !current);
              setSaveError("");
              setSaveSuccess("");
            }}
            disabled={isSaving}
            className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors ${draftHideViolentFeed ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-300"} ${isSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
          >
            <span
              className={`inline-block h-5 w-5 translate-y-[3px] rounded-full bg-white transition-transform ${draftHideViolentFeed ? "translate-x-6" : "translate-x-1"}`}
            />
          </button>
        </label>

        {isAdmin && (
          <label className="flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
            <div className="space-y-1">
              <span className="block text-sm font-medium text-slate-900">
                Reflection funkció a kommentfolyamnál
              </span>
              <span className="block text-xs leading-5 text-slate-500">
                Kikapcsolva eltűnik a thread reflection panel és nem készül új reflection.
                A komment &quot;Test&quot; funkció továbbra is működik.
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={draftCommentInsightsEnabled}
              onClick={() => {
                setDraftCommentInsightsEnabled((current) => !current);
                setSaveError("");
                setSaveSuccess("");
              }}
              disabled={isSaving}
              className={`relative inline-flex h-7 w-12 shrink-0 rounded-full border transition-colors ${draftCommentInsightsEnabled ? "border-blue-600 bg-blue-600" : "border-slate-300 bg-slate-300"} ${isSaving ? "cursor-not-allowed opacity-60" : "cursor-pointer"}`}
            >
              <span
                className={`inline-block h-5 w-5 translate-y-[3px] rounded-full bg-white transition-transform ${draftCommentInsightsEnabled ? "translate-x-6" : "translate-x-1"}`}
              />
            </button>
          </label>
        )}

        <div className="space-y-1">
          {fileError && <p className="text-xs text-red-600">{fileError}</p>}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          {saveSuccess && <p className="text-xs text-emerald-600">{saveSuccess}</p>}
        </div>

        <div className="rounded-xl border border-red-200 bg-red-50 p-4">
          <h3 className="text-sm font-semibold text-red-900">Profil törlése</h3>
          <p className="mt-1 text-xs leading-5 text-red-700">
            A profil törlése végleges. A művelet minden felhasználói adatot eltávolít,
            és nem vonható vissza.
          </p>
          <Link
            href="/profile/remove"
            className="mt-3 inline-flex rounded-lg border border-red-300 px-3 py-2 text-sm font-medium text-red-700 transition-colors hover:border-red-400 hover:bg-red-100"
          >
            Profil törlése
          </Link>
        </div>
      </div>
    </section>
  );
}