"use client";

import { useState } from "react";

interface Props {
  targetUserId: string;
  initialIsFollowing: boolean;
  onChange?: (nextIsFollowing: boolean) => void;
}

export default function FollowButton({
  targetUserId,
  initialIsFollowing,
  onChange,
}: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/connections/${targetUserId}`, { method });
      if (res.ok) {
        const nextIsFollowing = !isFollowing;
        setIsFollowing(nextIsFollowing);
        onChange?.(nextIsFollowing);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`w-full whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-medium transition-colors sm:w-auto ${
        isFollowing
          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      } disabled:opacity-50`}
    >
      {loading ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}
