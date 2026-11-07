"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { t } from "@/lib/i18n";

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
  const locale = useAppLocale();
  const [membershipState, setMembershipState] = useState<"member" | "invited" | "pending" | "none">(
    initiallyMember ? "member" : initiallyInvited ? "invited" : initiallyRequested ? "pending" : "none"
  );
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleJoin = async () => {
    if (membershipState === "pending") {
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const endpoint = membershipState === "member" ? "leave" :
        isPrivate && membershipState === "none" ? "join-requests" : "join";
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/${endpoint}`,
        { method: "POST" }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not update membership.");
        return;
      }

      setMembershipState(membershipState === "member" ? "none" : data.membership === "pending" ? "pending" : "member");

      router.refresh();
    } catch {
      setError(t(locale, "groups.join.error"));
    } finally {
      setLoading(false);
    }
  };

  const buttonLabel = loading
    ? t(locale, "groups.join.working")
    : membershipState === "member"
      ? t(locale, "groups.join.leave")
      : membershipState === "invited"
        ? t(locale, "groups.join.acceptInvite")
        : membershipState === "pending"
          ? t(locale, "groups.join.pending")
          : isPrivate
            ? t(locale, "groups.join.request")
            : t(locale, "groups.join.join");

  const buttonClassName =
    membershipState === "member"
      ? "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50"
      : membershipState === "pending"
        ? "border border-slate-200 bg-slate-100 text-slate-500"
        : "bg-blue-600 text-white hover:bg-blue-700";

  const disabled = loading || membershipState === "pending";

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
