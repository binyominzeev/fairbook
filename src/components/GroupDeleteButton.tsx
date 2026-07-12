"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export default function GroupDeleteButton({
  groupIdOrSlug,
  groupName,
}: {
  groupIdOrSlug: string;
  groupName: string;
}) {
  const router = useRouter();
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async () => {
    if (deleting) {
      return;
    }

    const confirmMessage = `Delete group \"${groupName}\"? This cannot be undone.`;
    if (!window.confirm(confirmMessage)) {
      return;
    }

    setDeleting(true);
    setError(null);

    try {
      const response = await fetch(`/api/communities/${encodeURIComponent(groupIdOrSlug)}`, {
        method: "DELETE",
      });

      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "Failed to delete group.");
        return;
      }

      router.replace("/groups");
      router.refresh();
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="rounded-xl border border-red-200 bg-red-50 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-red-700">Danger zone</p>
      <p className="mt-1 text-xs text-red-800">Only the owner can permanently delete this group.</p>
      <button
        type="button"
        onClick={handleDelete}
        disabled={deleting}
        className="mt-3 rounded-lg bg-red-600 px-3 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:bg-red-300"
      >
        {deleting ? "Deleting..." : "Delete group"}
      </button>
      {error && <p className="mt-2 text-xs text-red-700">{error}</p>}
    </div>
  );
}
