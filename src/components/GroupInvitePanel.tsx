"use client";

import Avatar from "@/components/Avatar";
import { buildProfilePath } from "@/lib/profile-path";
import Link from "next/link";
import { useEffect } from "react";
import { useState } from "react";

type FollowedUser = {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
};

type PendingInvite = {
  invitee?: {
    id?: string;
  };
};

export default function GroupInvitePanel({ groupIdOrSlug }: { groupIdOrSlug: string }) {
  const [query, setQuery] = useState("");
  const [followedUsers, setFollowedUsers] = useState<FollowedUser[]>([]);
  const [loadingFollowedUsers, setLoadingFollowedUsers] = useState(false);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [invitedIds, setInvitedIds] = useState<string[]>([]);

  useEffect(() => {
    const loadData = async () => {
      setLoadingFollowedUsers(true);
      setError(null);

      try {
        const [connectionsResponse, invitesResponse] = await Promise.all([
          fetch("/api/connections?type=following"),
          fetch(`/api/communities/${encodeURIComponent(groupIdOrSlug)}/invites`),
        ]);

        const connectionsData = await connectionsResponse.json();
        const invitesData = await invitesResponse.json();

        if (!connectionsResponse.ok) {
          setError(connectionsData.error ?? "Could not load followed users.");
          return;
        }

        if (!invitesResponse.ok) {
          setError(invitesData.error ?? "Could not load pending invites.");
          return;
        }

        setFollowedUsers(Array.isArray(connectionsData.users) ? connectionsData.users : []);
        const pendingInviteeIds = Array.isArray(invitesData.invites)
          ? (invitesData.invites as PendingInvite[])
              .map((invite) => invite.invitee?.id)
              .filter((id): id is string => typeof id === "string" && id.length > 0)
          : [];
        setInvitedIds(pendingInviteeIds);
      } finally {
        setLoadingFollowedUsers(false);
      }
    };

    void loadData();
  }, [groupIdOrSlug]);

  const sendInvite = async (inviteeId: string) => {
    setLoading(true);
    setError(null);
    setMessage(null);

    try {
      const response = await fetch(
        `/api/communities/${encodeURIComponent(groupIdOrSlug)}/invites`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ inviteeId }),
        }
      );
      const data = await response.json();

      if (!response.ok) {
        setError(data.error ?? "Could not send invite.");
        return;
      }

      setInvitedIds((previous) => (previous.includes(inviteeId) ? previous : [...previous, inviteeId]));
      setMessage("Invite sent.");
    } finally {
      setLoading(false);
    }
  };

  const filteredUsers = query.trim()
    ? followedUsers.filter((user) =>
        user.name.toLowerCase().includes(query.trim().toLowerCase())
      )
    : followedUsers;

  return (
    <div className="w-full max-w-full rounded-xl border border-slate-200 bg-white p-4 md:max-w-[22rem]">
      <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Invite members</p>
      <div className="mt-2 flex gap-2">
        <input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter followed people"
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
        />
      </div>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {message && <p className="mt-2 text-xs text-emerald-700">{message}</p>}

      {loadingFollowedUsers ? (
        <p className="mt-3 text-xs text-slate-500">Loading your followed people...</p>
      ) : filteredUsers.length === 0 ? (
        <p className="mt-3 text-xs text-slate-500">No followed people found for invite.</p>
      ) : (
        <div className="mt-3 max-w-full overflow-x-auto pb-2">
          <div className="flex min-w-max gap-3">
            {filteredUsers.map((user) => (
              <div
                key={user.id}
                className="w-40 shrink-0 rounded-xl border border-slate-200 bg-slate-50 p-3"
              >
                <div className="mb-2 flex justify-center">
                  <Avatar
                    name={user.name}
                    avatarUrl={user.avatarUrl}
                    sizeClassName="h-14 w-14"
                    textClassName="text-lg font-semibold"
                  />
                </div>
                <Link
                  href={buildProfilePath(user)}
                  className="block truncate text-center text-sm font-medium text-slate-900 hover:underline"
                >
                  {user.name}
                </Link>
              <button
                type="button"
                  onClick={() => void sendInvite(user.id)}
                  disabled={loading || invitedIds.includes(user.id)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 hover:bg-slate-100 disabled:border-slate-200 disabled:text-slate-400"
              >
                  {invitedIds.includes(user.id) ? "Invited" : loading ? "Sending..." : "Invite"}
              </button>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
