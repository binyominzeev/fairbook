"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

export default function GroupJoinButton({
  groupIdOrSlug,
  initiallyMember,
  isPrivate,
  initiallyInvited,
  initiallyRequested,
}: {
  groupIdOrSlug: string;
  initiallyMember: boolean;
  isPrivate?: boolean;
  initiallyInvited?: boolean;
  initiallyRequested?: boolean;
}) {
  const router = useRouter();
  const [membershipState, setMembershipState] = useState<
    "member" | "invited" | "requested" | "none"
  >(
    initiallyMember
      ? "member"
      : initiallyInvited
        ? "invited"
        : initiallyRequested
          ? "requested"
          : "none"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (membershipState === "requested") {
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

      if (membershipState === "member") {
        setMembershipState("none");
      } else if (data?.state === "requested") {
        setMembershipState("requested");
      } else {
        setMembershipState("member");
      }

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
        : membershipState === "requested"
          ? "Requested"
          : isPrivate
            ? "Request"
            : "Join";

  const buttonClassName =
    membershipState === "member"
      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      : membershipState === "requested"
        ? "border border-slate-200 bg-slate-100 text-slate-500"
        : "bg-blue-600 text-white hover:bg-blue-700";

  const disabled = loading || membershipState === "requested";

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
