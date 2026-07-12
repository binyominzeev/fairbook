"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GroupJoinButton({
  groupIdOrSlug,
  initiallyMember,
}: {
  groupIdOrSlug: string;
  initiallyMember: boolean;
}) {
  const router = useRouter();
  const [isMember, setIsMember] = useState(initiallyMember);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    setLoading(true);
    setError(null);

    try {
      const endpoint = isMember ? "leave" : "join";
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/${endpoint}`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not update membership.");
        return;
      }

      setIsMember(!isMember);
      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleJoin}
        disabled={loading}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
          isMember
            ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
            : "bg-blue-600 text-white hover:bg-blue-700"
        }`}
      >
        {loading ? "Working..." : isMember ? "Leave" : "Join"}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
