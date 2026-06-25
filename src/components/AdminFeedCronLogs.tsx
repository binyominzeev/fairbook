type FeedCronRunEntry = {
  id: string;
  feedSourceId: string | null;
  feedTitle: string;
  addedCount: number;
  removedCount: number;
  skippedCount: number;
  totalCount: number;
  visibleCount: number;
  notModified: boolean;
  status: string;
  message: string | null;
  createdAt: Date;
};

type FeedCronRun = {
  id: string;
  kind: string;
  status: string;
  startedAt: Date;
  finishedAt: Date;
  processedFeedCount: number;
  importedCount: number;
  skippedCount: number;
  notModifiedCount: number;
  deletedCount: number;
  visibleCount: number;
  hiddenCount: number;
  failedCount: number;
  entries: FeedCronRunEntry[];
};

function formatRunKind(kind: string) {
  return kind === "cleanup" ? "Cleanup" : "Sync";
}

function formatRunStatus(status: string) {
  if (status === "partial") return "Partial";
  if (status === "failed") return "Failed";
  return "Success";
}

export default function AdminFeedCronLogs({ runs }: { runs: FeedCronRun[] }) {
  if (runs.length === 0) {
    return (
      <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
        No cron logs yet.
      </p>
    );
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">Cron logs</h2>
        <p className="text-xs text-slate-500 mt-1">
          Recent sync and cleanup runs. Open a row for the full per-feed log.
        </p>
      </div>

      {runs.map((run) => (
        <details
          key={run.id}
          className="rounded-xl border border-slate-200 bg-white px-4 py-3"
        >
          <summary className="cursor-pointer list-none">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-slate-900">
                    {formatRunKind(run.kind)}
                  </span>
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] font-medium text-slate-600">
                    {formatRunStatus(run.status)}
                  </span>
                  <span className="text-xs text-slate-400">
                    {new Date(run.finishedAt).toLocaleString()}
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Processed {run.processedFeedCount} feeds
                  {run.kind === "sync"
                    ? ` · +${run.importedCount} imported · ${run.skippedCount} skipped · ${run.notModifiedCount} not modified`
                    : ` · -${run.deletedCount} deleted · ${run.visibleCount} visible · ${run.hiddenCount} hidden`}
                  {run.failedCount > 0 ? ` · ${run.failedCount} failed` : ""}
                </p>
              </div>
              <span className="text-xs text-blue-600">Show full log</span>
            </div>
          </summary>

          <div className="mt-4 overflow-x-auto">
            <table className="min-w-full text-left text-xs text-slate-600">
              <thead>
                <tr className="border-b border-slate-200 text-slate-500">
                  <th className="px-2 py-2 font-medium">Feed</th>
                  <th className="px-2 py-2 font-medium">Added</th>
                  <th className="px-2 py-2 font-medium">Removed</th>
                  <th className="px-2 py-2 font-medium">Skipped</th>
                  <th className="px-2 py-2 font-medium">Visible</th>
                  <th className="px-2 py-2 font-medium">Total</th>
                  <th className="px-2 py-2 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {run.entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-slate-100 align-top last:border-b-0">
                    <td className="px-2 py-2">
                      <div className="font-medium text-slate-800">{entry.feedTitle}</div>
                      {entry.message && (
                        <div className="mt-0.5 max-w-md text-[11px] text-red-600">
                          {entry.message}
                        </div>
                      )}
                    </td>
                    <td className="px-2 py-2">{entry.addedCount}</td>
                    <td className="px-2 py-2">{entry.removedCount}</td>
                    <td className="px-2 py-2">{entry.skippedCount}</td>
                    <td className="px-2 py-2">{entry.visibleCount}</td>
                    <td className="px-2 py-2">{entry.totalCount}</td>
                    <td className="px-2 py-2">
                      {entry.status === "not_modified" ? "Not modified" : entry.status}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ))}
    </div>
  );
}