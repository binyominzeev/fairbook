"use client";

import { useState } from "react";

interface Props {
  targetUserId: string;
  initialIsFollowing: boolean;
}

export default function FollowButton({ targetUserId, initialIsFollowing }: Props) {
  const [isFollowing, setIsFollowing] = useState(initialIsFollowing);
  const [loading, setLoading] = useState(false);

  const toggle = async () => {
    setLoading(true);
    try {
      const method = isFollowing ? "DELETE" : "POST";
      const res = await fetch(`/api/connections/${targetUserId}`, { method });
      if (res.ok) {
        setIsFollowing(!isFollowing);
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`text-sm px-4 py-1.5 rounded-lg font-medium transition-colors ${
        isFollowing
          ? "bg-slate-100 text-slate-700 hover:bg-slate-200"
          : "bg-blue-600 text-white hover:bg-blue-700"
      } disabled:opacity-50`}
    >
      {loading ? "…" : isFollowing ? "Following" : "Follow"}
    </button>
  );
}
