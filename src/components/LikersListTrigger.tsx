"use client";

import Avatar from "@/components/Avatar";
import { buildProfilePath } from "@/lib/profile-path";
import Link from "next/link";
import { useCallback, useMemo, useState } from "react";

type LikeUser = {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
};

type LikeItem = {
  id: string;
  createdAt: string;
  user: LikeUser;
};

type LikeResponse = {
  likes: LikeItem[];
  nextCursor: string | null;
  totalCount: number;
};

function timeAgo(dateIso: string) {
  const diff = Date.now() - new Date(dateIso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export default function LikersListTrigger({
  kind,
  targetId,
  likeCount,
}: {
  kind: "post" | "comment";
  targetId: string;
  likeCount: number;
}) {
  const [hoverOpen, setHoverOpen] = useState(false);
  const [hoverLoading, setHoverLoading] = useState(false);
  const [hoverData, setHoverData] = useState<LikeResponse | null>(null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogLoading, setDialogLoading] = useState(false);
  const [dialogItems, setDialogItems] = useState<LikeItem[]>([]);
  const [dialogNextCursor, setDialogNextCursor] = useState<string | null>(null);
  const [dialogTotalCount, setDialogTotalCount] = useState(0);

  const endpointBase = kind === "post" ? `/api/posts/${targetId}/likes` : `/api/comments/${targetId}/likes`;

  const hasLikes = likeCount > 0;

  const remainingInHover = useMemo(() => {
    if (!hoverData) return 0;
    return Math.max(0, hoverData.totalCount - hoverData.likes.length);
  }, [hoverData]);

  const loadHover = useCallback(async () => {
    if (!hasLikes || hoverData || hoverLoading) return;

    setHoverLoading(true);
    try {
      const response = await fetch(`${endpointBase}?take=5`);
      const data = (await response.json()) as LikeResponse;
      if (!response.ok) return;
      setHoverData(data);
    } finally {
      setHoverLoading(false);
    }
  }, [endpointBase, hasLikes, hoverData, hoverLoading]);

  const openDialog = useCallback(async () => {
    if (!hasLikes || dialogLoading) return;

    setDialogOpen(true);
    if (dialogItems.length > 0) return;

    setDialogLoading(true);
    try {
      const response = await fetch(`${endpointBase}?take=30`);
      const data = (await response.json()) as LikeResponse;
      if (!response.ok) return;
      setDialogItems(data.likes ?? []);
      setDialogNextCursor(data.nextCursor ?? null);
      setDialogTotalCount(Number(data.totalCount ?? data.likes?.length ?? 0));
    } finally {
      setDialogLoading(false);
    }
  }, [dialogItems.length, dialogLoading, endpointBase, hasLikes]);

  const loadMore = useCallback(async () => {
    if (!dialogNextCursor || dialogLoading) return;

    setDialogLoading(true);
    try {
      const response = await fetch(
        `${endpointBase}?take=30&cursor=${encodeURIComponent(dialogNextCursor)}`
      );
      const data = (await response.json()) as LikeResponse;
      if (!response.ok) return;
      setDialogItems((current) => [...current, ...(data.likes ?? [])]);
      setDialogNextCursor(data.nextCursor ?? null);
      setDialogTotalCount(Number(data.totalCount ?? dialogTotalCount));
    } finally {
      setDialogLoading(false);
    }
  }, [dialogLoading, dialogNextCursor, dialogTotalCount, endpointBase]);

  return (
    <div className="relative">
      <button
        type="button"
        onMouseEnter={() => {
          setHoverOpen(true);
          void loadHover();
        }}
        onMouseLeave={() => setHoverOpen(false)}
        onClick={() => {
          void openDialog();
        }}
        className="text-xs text-slate-500 transition-colors hover:text-blue-600"
      >
        {likeCount} like{likeCount !== 1 ? "s" : ""}
      </button>

      {hoverOpen && hasLikes && (
        <div
          className="absolute bottom-full left-0 z-30 mb-2 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg"
          onMouseEnter={() => setHoverOpen(true)}
          onMouseLeave={() => setHoverOpen(false)}
        >
          <p className="mb-2 text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Likes
          </p>

          {hoverLoading && <p className="text-xs text-slate-400">Loading...</p>}

          {!hoverLoading && hoverData && hoverData.likes.length === 0 && (
            <p className="text-xs text-slate-400">No likes yet.</p>
          )}

          {!hoverLoading && hoverData && hoverData.likes.length > 0 && (
            <div className="space-y-2">
              {hoverData.likes.map((item) => (
                <Link
                  key={item.id}
                  href={buildProfilePath(item.user)}
                  className="flex items-center gap-2 rounded-lg px-1 py-1 transition-colors hover:bg-slate-50"
                >
                  <Avatar
                    name={item.user.name}
                    avatarUrl={item.user.avatarUrl}
                    sizeClassName="h-6 w-6"
                    textClassName="text-[10px] font-semibold"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-xs font-medium text-slate-800">{item.user.name}</p>
                    <p className="text-[10px] text-slate-400">{timeAgo(item.createdAt)}</p>
                  </div>
                </Link>
              ))}
              {remainingInHover > 0 && (
                <p className="pt-1 text-[11px] text-slate-500">
                  ...es meg tovabbi {remainingInHover} felhasznalo.
                </p>
              )}
            </div>
          )}
        </div>
      )}

      {dialogOpen && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/60 px-3"
          onClick={() => setDialogOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-4 shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-semibold text-slate-900">
                Likes ({dialogTotalCount || likeCount})
              </h3>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                className="rounded-md px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-800"
              >
                Close
              </button>
            </div>

            <div className="max-h-[60vh] space-y-1 overflow-y-auto pr-1">
              {dialogItems.map((item) => (
                <Link
                  key={item.id}
                  href={buildProfilePath(item.user)}
                  className="flex items-center gap-2 rounded-lg px-2 py-2 transition-colors hover:bg-slate-50"
                >
                  <Avatar
                    name={item.user.name}
                    avatarUrl={item.user.avatarUrl}
                    sizeClassName="h-8 w-8"
                    textClassName="text-xs font-semibold"
                  />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-slate-900">{item.user.name}</p>
                    <p className="text-xs text-slate-400">{timeAgo(item.createdAt)}</p>
                  </div>
                </Link>
              ))}

              {dialogLoading && <p className="py-2 text-center text-xs text-slate-400">Loading...</p>}
            </div>

            {dialogNextCursor && (
              <div className="mt-3 text-center">
                <button
                  type="button"
                  onClick={() => {
                    void loadMore();
                  }}
                  disabled={dialogLoading}
                  className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-600 transition-colors hover:bg-slate-50 disabled:text-slate-300"
                >
                  {dialogLoading ? "Loading..." : "Load more"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
