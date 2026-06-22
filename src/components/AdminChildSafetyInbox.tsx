"use client";

import { useState } from "react";

type ReportItem = {
  id: string;
  reason: string;
  details: string;
  targetUrl: string | null;
  postId: string | null;
  createdAt: string;
};

export default function AdminChildSafetyInbox({
  initialReports,
}: {
  initialReports: ReportItem[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleMarkHandled = async (id: string) => {
    setPendingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/child-safety-reports/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ handled: true }),
      });

      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "Failed to update report.");
        return;
      }

      setReports((current) => current.filter((report) => report.id !== id));
    } catch {
      setError("Failed to update report.");
    } finally {
      setPendingId(null);
    }
  };

  if (reports.length === 0) {
    return null;
  }

  return (
    <section className="rounded-xl border border-amber-200 bg-amber-50 p-4 sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <h2 className="text-sm font-semibold text-amber-900">
          Open child safety reports ({reports.length})
        </h2>
      </div>

      <ul className="space-y-3">
        {reports.map((report) => (
          <li
            key={report.id}
            className="rounded-lg border border-amber-200 bg-white px-3 py-3 text-xs text-slate-700"
          >
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-semibold uppercase text-slate-900">{report.reason}</span>
              <span>·</span>
              <span>{new Date(report.createdAt).toLocaleString()}</span>
            </div>

            <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{report.details}</p>

            {report.targetUrl && (
              <p className="mt-2 break-all">
                Target: {" "}
                <a
                  href={report.targetUrl}
                  className="text-blue-600 hover:underline"
                >
                  {report.targetUrl}
                </a>
              </p>
            )}

            {!report.targetUrl && report.postId && (
              <p className="mt-2">Post ID: {report.postId}</p>
            )}

            <button
              type="button"
              onClick={() => void handleMarkHandled(report.id)}
              disabled={pendingId !== null}
              className="mt-3 inline-flex items-center gap-2 rounded-md border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-xs font-medium text-emerald-900 transition-colors hover:bg-emerald-100 disabled:opacity-60"
            >
              <span>✓</span>
              <span>{pendingId === report.id ? "Saving..." : "Handled"}</span>
            </button>
          </li>
        ))}
      </ul>

      {error && <p className="mt-3 text-xs text-red-600">{error}</p>}
    </section>
  );
}
