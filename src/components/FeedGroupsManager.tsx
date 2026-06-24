"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

type FeedGroup = {
  id: string;
  name: string;
  feedSourceIds: string[];
};

type FeedSubscription = {
  id: string;
  title: string;
  pageName: string;
  pageSlug: string | null;
};

function asSortedUnique(values: string[]) {
  return Array.from(new Set(values)).sort((left, right) => left.localeCompare(right));
}

async function parseApiBody(response: Response): Promise<{ error?: string } | null> {
  const raw = await response.text();
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as { error?: string };
  } catch {
    return null;
  }
}

export default function FeedGroupsManager({
  initialGroups,
  initialSources,
}: {
  initialGroups: FeedGroup[];
  initialSources: FeedSubscription[];
}) {
  const router = useRouter();
  const [groups, setGroups] = useState<FeedGroup[]>(initialGroups);
  const [newGroupName, setNewGroupName] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const updateGroupSelection = (groupId: string, sourceId: string, checked: boolean) => {
    setGroups((current) =>
      current.map((group) => {
        if (group.id !== groupId) {
          return group;
        }

        const next = new Set(group.feedSourceIds);
        if (checked) {
          next.add(sourceId);
        } else {
          next.delete(sourceId);
        }

        return {
          ...group,
          feedSourceIds: asSortedUnique(Array.from(next)),
        };
      })
    );
  };

  const refreshGroups = async () => {
    const response = await fetch("/api/feed-groups", { cache: "no-store" });
    if (!response.ok) {
      return;
    }

    const data = (await response.json()) as { groups?: FeedGroup[] };
    if (Array.isArray(data.groups)) {
      setGroups(data.groups);
    }
  };

  const createGroup = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = newGroupName.trim();
    if (!name) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch("/api/feed-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name }),
      });
      const data = await parseApiBody(response);

      if (!response.ok) {
        setMessage(data?.error ?? "Could not create feed group.");
        return;
      }

      setNewGroupName("");
      setMessage("Group created.");
      await refreshGroups();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const renameGroup = async (groupId: string, currentName: string) => {
    const nextName = prompt("New group name:", currentName)?.trim();
    if (!nextName || nextName === currentName) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/feed-groups/${groupId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nextName }),
      });
      const data = await parseApiBody(response);

      if (!response.ok) {
        setMessage(data?.error ?? "Could not rename feed group.");
        return;
      }

      setMessage("Group renamed.");
      await refreshGroups();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const deleteGroup = async (groupId: string) => {
    if (!confirm("Delete this group?")) {
      return;
    }

    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/feed-groups/${groupId}`, {
        method: "DELETE",
      });
      const data = await parseApiBody(response);

      if (!response.ok) {
        setMessage(data?.error ?? "Could not delete feed group.");
        return;
      }

      setMessage("Group deleted.");
      await refreshGroups();
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  const saveGroupSources = async (groupId: string, feedSourceIds: string[]) => {
    setIsSaving(true);
    setMessage(null);
    try {
      const response = await fetch(`/api/feed-groups/${groupId}/sources`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ feedSourceIds }),
      });
      const data = await parseApiBody(response);

      if (!response.ok) {
        setMessage(data?.error ?? "Could not save group sources.");
        return;
      }

      setMessage("Group subscriptions updated.");
      router.refresh();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-4 space-y-4">
      <div>
        <h2 className="text-sm font-semibold text-slate-700">RSS feed groups</h2>
        <p className="text-xs text-slate-500 mt-1">
          Create your own RSS source groups, then select them as feed tabs.
        </p>
      </div>

      <form onSubmit={createGroup} className="flex flex-col gap-2 sm:flex-row">
        <input
          value={newGroupName}
          onChange={(event) => setNewGroupName(event.target.value)}
          placeholder="New group name"
          maxLength={64}
          className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
        />
        <button
          type="submit"
          disabled={isSaving || newGroupName.trim().length === 0}
          className="rounded-lg bg-blue-600 px-3 py-2 text-xs font-medium text-white transition-colors hover:bg-blue-700 disabled:opacity-50"
        >
          Add group
        </button>
      </form>

      {message && <p className="text-xs text-slate-600">{message}</p>}

      {groups.length === 0 ? (
        <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
          No custom RSS groups yet.
        </p>
      ) : (
        <ul className="space-y-3">
          {groups.map((group) => (
            <li key={group.id} className="rounded-lg border border-slate-200 p-3 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => void renameGroup(group.id, group.name)}
                    disabled={isSaving}
                    className="rounded-lg border border-slate-300 px-2 py-1 text-xs text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                  >
                    Rename
                  </button>
                  <button
                    onClick={() => void deleteGroup(group.id)}
                    disabled={isSaving}
                    className="rounded-lg border border-red-300 px-2 py-1 text-xs text-red-600 hover:bg-red-50 disabled:opacity-50"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {initialSources.length === 0 ? (
                <p className="text-xs text-slate-500">
                  Follow RSS pages first, then you can assign them to this group.
                </p>
              ) : (
                <div className="space-y-2">
                  <div className="max-h-40 overflow-auto rounded-md border border-slate-200 p-2">
                    <ul className="space-y-1.5">
                      {initialSources.map((source) => {
                        const checked = group.feedSourceIds.includes(source.id);
                        return (
                          <li key={source.id}>
                            <label className="flex cursor-pointer items-start gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={checked}
                                onChange={(event) =>
                                  updateGroupSelection(group.id, source.id, event.target.checked)
                                }
                                className="mt-0.5"
                              />
                              <span>
                                <span className="font-medium text-slate-900">{source.title}</span>
                                <span className="ml-1 text-slate-500">({source.pageName})</span>
                              </span>
                            </label>
                          </li>
                        );
                      })}
                    </ul>
                  </div>

                  <div className="flex items-center justify-between">
                    <p className="text-xs text-slate-500">
                      {group.feedSourceIds.length} selected source
                      {group.feedSourceIds.length === 1 ? "" : "s"}
                    </p>
                    <button
                      onClick={() => void saveGroupSources(group.id, group.feedSourceIds)}
                      disabled={isSaving}
                      className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
                    >
                      Save sources
                    </button>
                  </div>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}

      {initialSources.length > 0 && (
        <div className="rounded-lg bg-slate-50 px-3 py-2 text-xs text-slate-500">
          {initialSources.length} followed RSS source
          {initialSources.length === 1 ? "" : "s"} available.
        </div>
      )}
    </section>
  );
}
