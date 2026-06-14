"use client";

import { startTransition, useState } from "react";
import { useRouter } from "next/navigation";
import Avatar from "@/components/Avatar";

const MAX_FILE_SIZE = 1024 * 1024;

function readFileAsDataUrl(file: File) {
  return new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ""));
    reader.onerror = () => reject(new Error("Failed to read the selected image."));
    reader.readAsDataURL(file);
  });
}

interface Props {
  userId: string;
  name: string;
  avatarUrl?: string | null;
}

export default function ProfileAvatarEditor({ userId, name, avatarUrl }: Props) {
  const router = useRouter();
  const [draftAvatarUrl, setDraftAvatarUrl] = useState(avatarUrl ?? null);
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
      setFileError("Csak képfájl tölthető fel.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      setFileError("A profilkép legfeljebb 1 MB lehet.");
      return;
    }

    try {
      const dataUrl = await readFileAsDataUrl(file);
      setDraftAvatarUrl(dataUrl);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "A kép beolvasása sikertelen volt.");
    }
  };

  const saveAvatar = async (nextAvatarUrl: string | null) => {
    setIsSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      const response = await fetch(`/api/users/${userId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatarUrl: nextAvatarUrl }),
      });
      const data = await response.json();

      if (!response.ok) {
        setSaveError(data.error ?? "A profilkép mentése sikertelen volt.");
        return;
      }

      setDraftAvatarUrl(data.user.avatarUrl ?? null);
      setSaveSuccess("Profilkép frissítve.");
      startTransition(() => {
        router.refresh();
      });
    } catch {
      setSaveError("A profilkép mentése sikertelen volt.");
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="mt-4 rounded-xl border border-slate-200 bg-slate-50 p-4">
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
              JPG, PNG, WebP vagy GIF, maximum 1 MB.
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
          {fileError && <p className="text-xs text-red-600">{fileError}</p>}
          {saveError && <p className="text-xs text-red-600">{saveError}</p>}
          {saveSuccess && <p className="text-xs text-emerald-600">{saveSuccess}</p>}
        </div>
      </div>
    </div>
  );
}