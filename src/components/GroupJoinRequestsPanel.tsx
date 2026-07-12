"use client";

import { useCallback, useEffect, useState } from "react";

type JoinRequest = {
  id: string;
  createdAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
};

export default function GroupJoinRequestsPanel({ groupIdOrSlug }: { groupIdOrSlug: string }) {
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadJoinRequests = useCallback(async () => {
    const response = await fetch(
      `/api/communities/${encodeURIComponent(groupIdOrSlug)}/join-requests`
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not load join requests.");
      return;
    }

    setJoinRequests(Array.isArray(data.requests) ? data.requests : []);
  }, [groupIdOrSlug]);

  useEffect(() => {
    const timerId = window.setTimeout(() => {
      void loadJoinRequests();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [loadJoinRequests]);

  const handleJoinRequest = async (requestId: string, action: "approve" | "reject") => {
    setRequestActionId(requestId);
    setError(null);

    try {
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/join-requests/${encodeURIComponent(requestId)}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Failed to update join request.");
        return;
      }

      setJoinRequests((previous) => previous.filter((request) => request.id !== requestId));
    } finally {
      setRequestActionId(null);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Pending join requests</p>
        <button
          type="button"
          onClick={() => void loadJoinRequests()}
          className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
        >
          Refresh
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {joinRequests.length === 0 ? (
        <p className="text-xs text-slate-500">No pending requests.</p>
      ) : (
        <ul className="space-y-2">
          {joinRequests.map((request) => (
            <li key={request.id} className="rounded-md border border-slate-200 bg-white px-3 py-2">
              <p className="text-sm font-medium text-slate-900">{request.requester.name}</p>
              <p className="text-xs text-slate-500">{request.requester.email}</p>
              <p className="text-xs text-slate-500">
                Requested: {new Date(request.createdAt).toLocaleString()}
              </p>
              <div className="mt-2 flex gap-2">
                <button
                  type="button"
                  disabled={requestActionId === request.id}
                  onClick={() => void handleJoinRequest(request.id, "approve")}
                  className="rounded-md border border-emerald-200 px-2 py-1 text-xs text-emerald-700 hover:bg-emerald-50 disabled:opacity-60"
                >
                  Approve
                </button>
                <button
                  type="button"
                  disabled={requestActionId === request.id}
                  onClick={() => void handleJoinRequest(request.id, "reject")}
                  className="rounded-md border border-red-200 px-2 py-1 text-xs text-red-700 hover:bg-red-50 disabled:opacity-60"
                >
                  Reject
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
