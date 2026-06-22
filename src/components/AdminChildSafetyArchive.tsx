"use client";

import { useState } from "react";

type ArchiveItem = {
  id: string;
  reason: string;
  details: string;
  targetUrl: string | null;
  postId: string | null;
  status: string;
  createdAt: string;
  reviewedAt: string | null;
};

export default function AdminChildSafetyArchive({
  initialReports,
}: {
  initialReports: ArchiveItem[];
}) {
  const [reports, setReports] = useState(initialReports);
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    setPendingId(id);
    setError(null);

    try {
      const response = await fetch(`/api/child-safety-reports/${id}`, {
        method: "DELETE",
      });
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to delete report.");
        return;
      }

      setReports((current) => current.filter((report) => report.id !== id));
    } catch {
      setError("Failed to delete report.");
    } finally {
      setPendingId(null);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 space-y-3">
      <h2 className="text-sm font-semibold text-slate-700">Child safety reports (handled)</h2>

      {reports.length === 0 ? (
        <p className="text-sm text-slate-500">No handled reports yet.</p>
      ) : (
        <ul className="space-y-2">
          {reports.map((report) => (
            <li
              key={report.id}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-semibold uppercase text-slate-700">{report.reason}</span>
                <span>·</span>
                <span>Status: {report.status}</span>
                <span>·</span>
                <span>{new Date(report.createdAt).toLocaleString()}</span>
                {report.reviewedAt && (
                  <>
                    <span>·</span>
                    <span>Reviewed {new Date(report.reviewedAt).toLocaleString()}</span>
                  </>
                )}
              </div>

              <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">{report.details}</p>

              {report.targetUrl && (
                <p className="mt-2 break-all">
                  Target: {" "}
                  <a href={report.targetUrl} className="text-blue-600 hover:underline">
                    {report.targetUrl}
                  </a>
                </p>
              )}

              {!report.targetUrl && report.postId && <p className="mt-2">Post ID: {report.postId}</p>}

              <button
                type="button"
                onClick={() => void handleDelete(report.id)}
                disabled={pendingId !== null}
                className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-1.5 text-xs font-medium text-red-700 transition-colors hover:bg-red-100 disabled:opacity-60"
              >
                {pendingId === report.id ? "Deleting..." : "Delete permanently"}
              </button>
            </li>
          ))}
        </ul>
      )}

      {error && <p className="text-xs text-red-600">{error}</p>}
    </section>
  );
}
