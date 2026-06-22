"use client";

import { useState } from "react";

const REASON_OPTIONS = [
  { value: "csam", label: "CSAM" },
  { value: "child-exploitation", label: "Child exploitation" },
  { value: "grooming", label: "Grooming" },
  { value: "minor-sexualization", label: "Sexualization of a minor" },
  { value: "other", label: "Other" },
] as const;

export default function ChildSafetyReportForm({
  initialPostId,
  initialTargetUrl,
}: {
  initialPostId?: string;
  initialTargetUrl?: string;
}) {
  const [reason, setReason] = useState<(typeof REASON_OPTIONS)[number]["value"]>("other");
  const [details, setDetails] = useState("");
  const [postId, setPostId] = useState(initialPostId ?? "");
  const [targetUrl, setTargetUrl] = useState(initialTargetUrl ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [notice, setNotice] = useState<{ kind: "success" | "error"; message: string } | null>(null);

  const submit = async () => {
    setIsSubmitting(true);
    setNotice(null);

    try {
      const response = await fetch("/api/child-safety-reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason,
          details,
          postId: postId.trim() || undefined,
          targetUrl: targetUrl.trim() || undefined,
        }),
      });

      const data = await response.json();
      if (!response.ok) {
        setNotice({ kind: "error", message: data.error ?? "Failed to submit report." });
        return;
      }

      setDetails("");
      setNotice({
        kind: "success",
        message: "Report submitted. Thank you for helping keep the community safe.",
      });
    } catch {
      setNotice({ kind: "error", message: "Failed to submit report." });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-base font-semibold text-slate-900">Report Child Safety Concern</h2>
      <p className="mt-1 text-sm text-slate-500">
        Provide as much context as you can. This form is available without reporting comments individually.
      </p>

      <div className="mt-4 space-y-3">
        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Reason</span>
          <select
            value={reason}
            onChange={(e) => setReason(e.target.value as (typeof REASON_OPTIONS)[number]["value"])}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {REASON_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Details</span>
          <textarea
            value={details}
            onChange={(e) => setDetails(e.target.value)}
            rows={6}
            placeholder="Describe what you saw and where."
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Post ID (optional)</span>
          <input
            value={postId}
            onChange={(e) => setPostId(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>

        <label className="block space-y-1">
          <span className="text-xs font-medium uppercase tracking-wide text-slate-500">Target URL (optional)</span>
          <input
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </label>
      </div>

      {notice && (
        <p
          className={`mt-3 text-xs ${notice.kind === "error" ? "text-red-600" : "text-emerald-700"}`}
        >
          {notice.message}
        </p>
      )}

      <button
        type="button"
        onClick={submit}
        disabled={isSubmitting || details.trim().length < 10}
        className="mt-4 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
      >
        {isSubmitting ? "Submitting…" : "Submit report"}
      </button>
    </div>
  );
}
