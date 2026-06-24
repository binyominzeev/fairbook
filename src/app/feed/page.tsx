import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import FeedInfiniteList from "@/components/FeedInfiniteList";
import Navbar from "@/components/Navbar";
import CreatePostForm from "@/components/CreatePostForm";
import AdminChildSafetyInbox from "@/components/AdminChildSafetyInbox";
import { isAdminEmail } from "@/lib/admin";
import { getFeedGroupsForUser } from "@/lib/feed-groups";
import { getFeedPage } from "@/lib/feed-posts";
import { getSuggestedPeople } from "@/lib/people-suggestions";
import { buildProfilePath } from "@/lib/profile-path";
import Link from "next/link";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";

type FeedMode = "all" | "following" | "group";

export default async function FeedPage(props: {
  searchParams: Promise<{
    notice?: string;
    noticeKind?: string;
    mode?: string;
    group?: string;
    q?: string;
  }>;
}) {
  const { notice, noticeKind, mode, group, q } = await props.searchParams;
  const requestedGroupId = typeof group === "string" ? group : null;
  const query = q?.trim() ?? "";
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      avatarUrl: true,
      hideViolentFeed: true,
    },
  });
  if (!user) redirect("/login");

  const feedGroups = await getFeedGroupsForUser(session.userId);
  const activeGroup = requestedGroupId
    ? feedGroups.find((feedGroup) => feedGroup.id === requestedGroupId) ?? null
    : null;
  const activeMode: FeedMode = activeGroup
    ? "group"
    : mode === "following"
      ? "following"
      : "all";

  const initialFeedPage = await getFeedPage({
    viewerId: session.userId,
    hideViolentFeed: user.hideViolentFeed,
    viewMode: activeMode,
    feedSourceIds: activeGroup?.feedSourceIds,
    query,
  });

  const querySuffix = query ? `&q=${encodeURIComponent(query)}` : "";

  const followingPeopleCount = await prisma.connection.count({
    where: {
      followerId: session.userId,
      following: { isPage: false },
    },
  });

  const suggestedUsers = await getSuggestedPeople(session.userId, 5);
  const adminOpenChildSafetyReports = isAdminEmail(user.email)
    ? await prisma.childSafetyReport.findMany({
        where: { status: "open" },
        orderBy: [{ createdAt: "desc" }],
        take: 10,
        select: {
          id: true,
          reason: true,
          details: true,
          targetUrl: true,
          postId: true,
          createdAt: true,
        },
      })
    : [];

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="space-y-4">
          {notice && (
            <div
              className={`rounded-xl border px-4 py-3 text-sm ${noticeKind === "warning" ? "border-amber-200 bg-amber-50 text-amber-900" : "border-emerald-200 bg-emerald-50 text-emerald-800"}`}
            >
              {notice}
            </div>
          )}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex w-full rounded-lg bg-slate-100 p-1 text-sm sm:w-fit">
              <Link
                href={`/feed?mode=all${querySuffix}`}
                className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                  activeMode === "all"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                All
              </Link>
              <Link
                href={`/feed?mode=following${querySuffix}`}
                className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                  activeMode === "following"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Friends
              </Link>
              {feedGroups.map((feedGroup) => (
                <Link
                  key={feedGroup.id}
                  href={`/feed?group=${encodeURIComponent(feedGroup.id)}${querySuffix}`}
                  className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                    activeMode === "group" && activeGroup?.id === feedGroup.id
                      ? "bg-white text-slate-900 shadow-sm"
                      : "text-slate-500 hover:text-slate-800"
                  }`}
                >
                  {feedGroup.name}
                </Link>
              ))}
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-left sm:text-right">
              <p className="text-xs text-slate-400">Following people</p>
              <p className="text-sm font-semibold text-slate-900">{followingPeopleCount}</p>
            </div>
          </div>

          <form action="/feed" method="GET" className="flex flex-col gap-2 sm:flex-row">
            {activeMode === "following" && <input type="hidden" name="mode" value="following" />}
            {activeMode === "group" && activeGroup?.id && (
              <input type="hidden" name="group" value={activeGroup.id} />
            )}
            <QuerySyncSearchInput
              initialValue={query}
              placeholder="Filter posts by text, source, author or tag"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              Search
            </button>
          </form>

          {isAdminEmail(user.email) && (
            <AdminChildSafetyInbox
              initialReports={adminOpenChildSafetyReports.map((report) => ({
                ...report,
                createdAt: report.createdAt.toISOString(),
              }))}
            />
          )}

          <CreatePostForm />

          <FeedInfiniteList
            key={`${activeMode}:${activeGroup?.id ?? "none"}:${query}:${initialFeedPage.posts[0]?.id ?? "empty"}:${initialFeedPage.nextCursor ?? "end"}`}
            initialPosts={initialFeedPage.posts}
            initialNextCursor={initialFeedPage.nextCursor}
            currentUserId={user.id}
            mode={activeMode}
            groupId={activeGroup?.id ?? null}
            query={query}
          />
        </div>

        {suggestedUsers.length > 0 && initialFeedPage.posts.length === 0 && activeMode !== "group" && (
          <div className="mt-6 bg-white rounded-xl border border-slate-200 p-4">
            <h2 className="text-sm font-semibold text-slate-700 mb-3">
              People you might follow
            </h2>
            <ul className="space-y-3">
              {suggestedUsers.map((u) => (
                <li key={u.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Avatar
                      name={u.name}
                      avatarUrl={u.avatarUrl}
                      sizeClassName="h-8 w-8"
                      textClassName="text-sm font-semibold"
                    />
                    <div>
                      <p className="text-sm font-medium text-slate-900">
                        {u.name}
                      </p>
                      {u.bio && (
                        <p className="text-xs text-slate-500 truncate max-w-[200px]">
                          {u.bio}
                        </p>
                      )}
                    </div>
                  </div>
                  <a
                    href={buildProfilePath(u)}
                    className="text-xs text-blue-600 hover:underline"
                  >
                    View
                  </a>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </>
  );
}
