"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import type { ProfileActivityViewMode } from "@/lib/profile-activity";

const MODE_LABELS: Record<ProfileActivityViewMode, string> = {
  normal: "Normal",
  reels: "Reels",
};

export default function ProfileActivityViewModeSelect({
  initialMode,
}: {
  initialMode: ProfileActivityViewMode;
}) {
  const router = useRouter();
  const [mode, setMode] = useState<ProfileActivityViewMode>(initialMode);
  const [error, setError] = useState<string | null>(null);
  const [isSaving, startTransition] = useTransition();

  const saveMode = (nextMode: ProfileActivityViewMode) => {
    setMode(nextMode);
    setError(null);

    startTransition(async () => {
      try {
        const response = await fetch("/api/users/profile-activity-view", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ mode: nextMode }),
        });

        if (!response.ok) {
          throw new Error("Could not save profile view mode.");
        }

        router.refresh();
      } catch {
        setMode(initialMode);
        setError("Nem sikerult menteni a nezetet.");
      }
    });
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <label className="sr-only" htmlFor="profile-activity-view-mode">
        Activity view mode
      </label>
      <div className="relative">
        <select
          id="profile-activity-view-mode"
          value={mode}
          onChange={(event) => saveMode(event.target.value as ProfileActivityViewMode)}
          disabled={isSaving}
          className="min-w-32 appearance-none rounded-lg border border-slate-300 bg-white px-3 py-1.5 pr-8 text-xs font-medium text-slate-700 outline-none transition-colors hover:border-slate-400 focus:border-blue-500 disabled:cursor-not-allowed disabled:opacity-70"
          aria-label="Profil nezetmod"
        >
          <option value="normal">{mode === "normal" ? "✓ " : ""}{MODE_LABELS.normal}</option>
          <option value="reels">{mode === "reels" ? "✓ " : ""}{MODE_LABELS.reels}</option>
        </select>
        <span className="pointer-events-none absolute inset-y-0 right-2 flex items-center text-slate-400">
          <svg aria-hidden="true" viewBox="0 0 20 20" fill="currentColor" className="h-4 w-4">
            <path
              fillRule="evenodd"
              d="M5.23 7.21a.75.75 0 0 1 1.06.02L10 11.094l3.71-3.864a.75.75 0 1 1 1.08 1.04l-4.25 4.425a.75.75 0 0 1-1.08 0L5.21 8.27a.75.75 0 0 1 .02-1.06Z"
              clipRule="evenodd"
            />
          </svg>
        </span>
      </div>
      {error && <p className="text-[11px] text-red-600">{error}</p>}
    </div>
  );
}
