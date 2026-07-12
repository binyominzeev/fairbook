"use client";

import { useCallback, useEffect, useState } from "react";

type Member = {
  id: string;
  role: string;
  user: {
    id: string;
    name: string;
    email: string;
  };
};

type JoinRequest = {
  id: string;
  createdAt: string;
  requester: {
    id: string;
    name: string;
    email: string;
  };
};

export default function GroupMemberSearch({
  groupIdOrSlug,
  canModerate,
}: {
  groupIdOrSlug: string;
  canModerate: boolean;
}) {
  const [query, setQuery] = useState("");
  const [members, setMembers] = useState<Member[]>([]);
  const [joinRequests, setJoinRequests] = useState<JoinRequest[]>([]);
  const [requestActionId, setRequestActionId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadJoinRequests = useCallback(async () => {
    if (!canModerate) {
      return;
    }

    const response = await fetch(
      `/api/communities/${encodeURIComponent(groupIdOrSlug)}/join-requests`
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Could not load join requests.");
      return;
    }

    setJoinRequests(Array.isArray(data.requests) ? data.requests : []);
  }, [canModerate, groupIdOrSlug]);

  useEffect(() => {
    if (!canModerate) {
      return;
    }

    const timerId = window.setTimeout(() => {
      void loadJoinRequests();
    }, 0);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [canModerate, loadJoinRequests]);

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

  const removeMember = async (memberId: string) => {
    setError(null);

    const response = await fetch(
      `/api/communities/${encodeURIComponent(groupIdOrSlug)}/members/${encodeURIComponent(memberId)}`,
      { method: "DELETE" }
    );
    const data = await response.json();

    if (!response.ok) {
      setError(data.error ?? "Failed to remove member.");
      return;
    }

    setMembers((prev) => prev.filter((member) => member.id !== memberId));
  };

  const runSearch = async () => {
    setLoading(true);
    setError(null);

    try {
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/members?q=${encodeURIComponent(query.trim())}`
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Search failed.");
        return;
      }

      setMembers(Array.isArray(data.members) ? data.members : []);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Member search</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Search members by name or email"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
        <button
          type="button"
          onClick={runSearch}
          disabled={loading}
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 disabled:bg-slate-100"
        >
          {loading ? "Searching..." : "Find"}
        </button>
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}

      {canModerate && (
        <div className="mt-3 rounded-lg border border-slate-200 bg-slate-50 p-3">
          <div className="mb-2 flex items-center justify-between">
            <p className="text-xs font-medium text-slate-700">Pending join requests</p>
            <button
              type="button"
              onClick={() => void loadJoinRequests()}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 hover:bg-slate-100"
            >
              Refresh
            </button>
          </div>

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
      )}

      {members.length > 0 && (
        <ul className="mt-3 space-y-2">
          {members.map((member) => (
            <li key={member.id} className="rounded-lg border border-slate-200 px-3 py-2">
              <p className="text-sm font-medium text-slate-900">{member.user.name}</p>
              <p className="text-xs text-slate-500">{member.user.email}</p>
              <p className="mt-1 text-xs text-slate-600">Role: {member.role}</p>
              {canModerate && (member.role === "member" || member.role === "moderator") && (
                <button
                  type="button"
                  onClick={() => void removeMember(member.id)}
                  className="mt-2 rounded-md border border-red-200 px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                >
                  Remove member
                </button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
