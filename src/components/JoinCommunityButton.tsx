"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface Props {
  communityId: string;
  isMember: boolean;
  isOwner: boolean;
}

export default function JoinCommunityButton({ communityId, isMember, isOwner }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (isOwner) {
    return (
      <span className="rounded-lg bg-slate-50 px-3 py-1.5 text-center text-xs text-slate-400">
        Owner
      </span>
    );
  }

  const toggle = async () => {
    setLoading(true);
    try {
      const method = isMember ? "DELETE" : "POST";
      const res = await fetch(`/api/communities/${communityId}/join`, { method });
      if (res.ok) router.refresh();
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-full whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors sm:w-auto ${
        isMember
          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      } disabled:opacity-50`}
    >
      {loading ? "…" : isMember ? "Joined" : "Join"}
    </button>
  );
}
