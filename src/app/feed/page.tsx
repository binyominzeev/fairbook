import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import FeedInfiniteList from "@/components/FeedInfiniteList";
import Navbar from "@/components/Navbar";
import CreatePostForm from "@/components/CreatePostForm";
import AdminChildSafetyInbox from "@/components/AdminChildSafetyInbox";
import AdminDevSidebar from "@/components/AdminDevSidebar";
import FeedSortSelect from "@/components/FeedSortSelect";
import { isAdminEmail } from "@/lib/admin";
import { getFeedGroupsForUser } from "@/lib/feed-groups";
import { getFeedPage, normalizeFeedSortMode, type FeedSortMode } from "@/lib/feed-posts";
import { getSuggestedPeople } from "@/lib/people-suggestions";
import { buildProfilePath } from "@/lib/profile-path";
import Link from "next/link";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";
import { buildGlobalTopicPath } from "@/lib/topic-path";
import { getTopicSlugLookupCandidates, normalizeTopicKey } from "@/lib/topics";
import { getRequestLocale } from "@/lib/request-locale";
import { t } from "@/lib/i18n";

type FeedMode = "all" | "following" | "group";

export default async function FeedPage(props: {
  searchParams: Promise<{
    notice?: string;
    noticeKind?: string;
    mode?: string;
    group?: string;
    q?: string;
    sort?: string;
    topic?: string;
    topicSlug?: string;
  }>;
}) {
  const locale = await getRequestLocale();
  const { notice, noticeKind, mode, group, q, sort, topic, topicSlug } = await props.searchParams;
  const requestedGroupId = typeof group === "string" ? group : null;
  const query = q?.trim() ?? "";
  const requestedTopicId = typeof topic === "string" && topic.trim() ? topic.trim() : null;
  const requestedTopicSlug = typeof topicSlug === "string" && topicSlug.trim() ? topicSlug.trim() : null;
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
      feedSortMode: true,
    },
  });
  if (!user) redirect("/login");

  const activeSort: FeedSortMode = sort
    ? normalizeFeedSortMode(sort)
    : normalizeFeedSortMode(user.feedSortMode);

  const topics = await prisma.topic.findMany({
    include: {
      _count: {
        select: {
          posts: true,
        },
      },
    },
    orderBy: [{ posts: { _count: "desc" } }, { name: "asc" }],
  });
  const topicById = new Map(topics.map((candidate) => [candidate.id, candidate]));
  const activeTopic = requestedTopicSlug
    ? topics.find((candidate) =>
        getTopicSlugLookupCandidates(requestedTopicSlug).includes(candidate.normalizedName)
      ) ?? null
    : requestedTopicId
      ? topics.find((candidate) => candidate.id === requestedTopicId) ?? null
      : null;
  if (requestedTopicSlug && !activeTopic) {
    notFound();
  }
  const topicId = activeTopic?.id ?? null;

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
    topicId: topicId ?? undefined,
    sortMode: activeSort,
  });

  function buildFeedHref(
    nextMode: FeedMode,
    nextGroupId: string | null = activeGroup?.id ?? null,
    nextTopicId: string | null = topicId
  ) {
    const params = new URLSearchParams();

    if (nextMode === "following") {
      params.set("mode", "following");
    }

    if (nextMode === "group" && nextGroupId) {
      params.set("group", nextGroupId);
    }

    if (query) {
      params.set("q", query);
    }

    if (activeSort !== "current") {
      params.set("sort", activeSort);
    }

    const search = params.toString();
    if (!nextTopicId) {
      return search ? `/feed?${search}` : "/feed";
    }

    const topicForHref = topicById.get(nextTopicId);
    if (!topicForHref) {
      return search ? `/feed?${search}` : "/feed";
    }

    const topicPath = buildGlobalTopicPath(normalizeTopicKey(topicForHref.name));
    return search ? `${topicPath}?${search}` : topicPath;
  }

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
                href={buildFeedHref("all")}
                className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                  activeMode === "all"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t(locale, "feed.tab.all")}
              </Link>
              <Link
                href={buildFeedHref("following")}
                className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                  activeMode === "following"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {t(locale, "feed.tab.friends")}
              </Link>
              {feedGroups.map((feedGroup) => (
                <Link
                  key={feedGroup.id}
                  href={buildFeedHref("group", feedGroup.id)}
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
            <div className="flex flex-col items-end gap-2 sm:flex-row sm:items-center sm:gap-4">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-left sm:text-right">
                <p className="text-xs text-slate-400">{t(locale, "feed.followingPeople")}</p>
                <p className="text-sm font-semibold text-slate-900">{followingPeopleCount}</p>
              </div>
              <FeedSortSelect
                key={`${activeMode}:${activeGroup?.id ?? "none"}:${activeSort}:${query}:${topicId ?? "all"}`}
                initialSort={activeSort}
                mode={activeMode}
                groupId={activeGroup?.id ?? null}
                query={query}
                topicSlug={activeTopic ? normalizeTopicKey(activeTopic.name) : null}
              />
            </div>
          </div>

          {topics.length > 0 ? (
            <div className="rounded-xl border border-slate-200 bg-white p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Témák</p>
                {activeTopic ? (
                  <Link
                    href={buildFeedHref(activeMode, activeGroup?.id ?? null, null)}
                    className="text-xs font-medium text-blue-600 hover:underline"
                  >
                    Szűrő törlése
                  </Link>
                ) : null}
              </div>
              <div className="flex flex-wrap gap-2">
                {topics.map((item) => {
                  const isActive = item.id === topicId;
                  return (
                    <Link
                      key={item.id}
                      href={buildFeedHref(activeMode, activeGroup?.id ?? null, item.id)}
                      className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-medium transition-colors ${
                        isActive
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
                      }`}
                    >
                      <span>{item.name}</span>
                      <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-white/20 text-white" : "bg-slate-200 text-slate-600"}`}>
                        {item._count.posts}
                      </span>
                    </Link>
                  );
                })}
              </div>
            </div>
          ) : null}

          <form
            action={activeTopic ? buildGlobalTopicPath(normalizeTopicKey(activeTopic.name)) : "/feed"}
            method="GET"
            className="flex flex-col gap-2 sm:flex-row"
          >
            {activeMode === "following" && <input type="hidden" name="mode" value="following" />}
            {activeMode === "group" && activeGroup?.id && (
              <input type="hidden" name="group" value={activeGroup.id} />
            )}
            <input type="hidden" name="sort" value={activeSort} />
            <QuerySyncSearchInput
              initialValue={query}
              placeholder={t(locale, "feed.searchPlaceholder")}
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              {t(locale, "feed.searchButton")}
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
            key={`${activeMode}:${activeGroup?.id ?? "none"}:${activeSort}:${query}:${topicId ?? "all"}:${initialFeedPage.posts[0]?.id ?? "empty"}:${initialFeedPage.nextCursor ?? "end"}`}
            initialPosts={initialFeedPage.posts}
            initialNextCursor={initialFeedPage.nextCursor}
            currentUserId={user.id}
            mode={activeMode}
            groupId={activeGroup?.id ?? null}
            query={query}
            topicId={topicId}
            sort={activeSort}
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
      {isAdminEmail(user.email) && <AdminDevSidebar />}
    </>
  );
}
