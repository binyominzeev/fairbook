"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GroupJoinButton({
  groupIdOrSlug,
  initiallyMember,
  isPrivate,
  initiallyInvited,
}: {
  groupIdOrSlug: string;
  initiallyMember: boolean;
  isPrivate?: boolean;
  initiallyInvited?: boolean;
}) {
  const router = useRouter();
  const [membershipState, setMembershipState] = useState<"member" | "invited" | "none">(
    initiallyMember ? "member" : initiallyInvited ? "invited" : "none"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isInviteOnlyLocked = Boolean(isPrivate) && membershipState === "none";

  const handleJoin = async () => {
    if (isInviteOnlyLocked) {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = membershipState === "member" ? "leave" : "join";
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/${endpoint}`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not update membership.");
        return;
      }

      setMembershipState(membershipState === "member" ? "none" : "member");

      router.refresh();
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = loading
    ? "Working..."
    : membershipState === "member"
      ? "Leave"
      : membershipState === "invited"
        ? "Accept invite"
        : isPrivate
          ? "Invite only"
          : "Join";

  const buttonClassName =
    membershipState === "member"
      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      : isInviteOnlyLocked
        ? "border border-slate-200 bg-slate-100 text-slate-500"
        : "bg-blue-600 text-white hover:bg-blue-700";

  const disabled = loading || isInviteOnlyLocked;

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={handleJoin}
        disabled={disabled}
        className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors disabled:cursor-not-allowed ${buttonClassName}`}
      >
        {buttonLabel}
      </button>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  );
}
