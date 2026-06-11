"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

interface SteelmanData {
  id: string;
  summary: string | null;
  status: string;
  requester: { id: string; name: string };
}

interface Props {
  postId: string;
  targetId: string;
  targetName: string;
  currentUserId: string;
  existingSteelmans: SteelmanData[];
}

export default function SteelmanSection({
  postId,
  targetId,
  targetName,
  currentUserId,
  existingSteelmans,
}: Props) {
  const router = useRouter();
  const [requesting, setRequesting] = useState(false);
  const [error, setError] = useState("");

  const approved = existingSteelmans.filter((s) => s.status === "approved");
  const pending = existingSteelmans.filter((s) => s.status === "pending");
  const myPending = pending.filter((s) => s.requester.id === currentUserId);
  const targetIsMe = targetId === currentUserId;

  const requestSteelman = async () => {
    setRequesting(true);
    setError("");
    try {
      const res = await fetch("/api/steelman", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ targetId, postId }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Failed to request steelman.");
      } else {
        router.refresh();
      }
    } finally {
      setRequesting(false);
    }
  };

  const respond = async (id: string, action: "approve" | "reject") => {
    const res = await fetch(`/api/steelman/${id}/${action}`, { method: "POST" });
    if (res.ok) router.refresh();
  };

  return (
    <div className="mt-4 border-t border-slate-100 pt-4">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">
        🎯 Steelman
      </h3>

      {/* Approved steelmans */}
      {approved.map((s) => (
        <div
          key={s.id}
          className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-3"
        >
          <div className="flex items-center gap-2 mb-2">
            <span className="text-xs font-semibold text-emerald-700 bg-emerald-100 px-2 py-0.5 rounded-full">
              ✓ Accurate representation approved by {targetName}
            </span>
          </div>
          <p className="text-sm text-slate-800 italic">&ldquo;{s.summary}&rdquo;</p>
          <p className="text-xs text-slate-400 mt-2">
            Requested by {s.requester.name}
          </p>
        </div>
      ))}

      {/* Pending steelmans visible to target */}
      {targetIsMe &&
        pending.map((s) => (
          <div
            key={s.id}
            className="bg-amber-50 border border-amber-200 rounded-xl p-4 mb-3"
          >
            <p className="text-xs text-amber-700 font-semibold mb-2">
              {s.requester.name} requested a steelman of your position
            </p>
            <p className="text-sm text-slate-800 italic mb-3">
              &ldquo;{s.summary}&rdquo;
            </p>
            <p className="text-xs text-slate-500 mb-3">
              Does this accurately represent your view? If you approve, it will
              display a badge showing the other person understood you fairly.
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => respond(s.id, "approve")}
                className="text-xs px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg font-medium transition-colors"
              >
                ✓ Approve — this is fair
              </button>
              <button
                onClick={() => respond(s.id, "reject")}
                className="text-xs px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-lg transition-colors"
              >
                ✗ Reject — not accurate
              </button>
            </div>
          </div>
        ))}

      {/* Request button */}
      {!targetIsMe && myPending.length === 0 && (
        <div>
          <button
            onClick={requestSteelman}
            disabled={requesting}
            className="text-xs px-3 py-1.5 border border-slate-200 hover:border-blue-300 hover:text-blue-700 text-slate-600 rounded-lg transition-colors disabled:opacity-50"
          >
            {requesting
              ? "Generating…"
              : `Request AI steelman of ${targetName}'s position`}
          </button>
          <p className="text-xs text-slate-400 mt-1.5">
            An AI summary of their view will be generated and sent for their
            approval. The highest-status signal on this platform.
          </p>
          {error && <p className="text-xs text-red-600 mt-1">{error}</p>}
        </div>
      )}

      {myPending.length > 0 && !targetIsMe && (
        <p className="text-xs text-amber-600">
          ⏳ Awaiting {targetName}&apos;s approval of your steelman request
        </p>
      )}
    </div>
  );
}
