import Link from "next/link";
import { redirect } from "next/navigation";
import AdminFeedManager from "@/components/AdminFeedManager";
import AdminChildSafetyArchive from "@/components/AdminChildSafetyArchive";
import FeedGroupsManager from "@/components/FeedGroupsManager";
import Avatar from "@/components/Avatar";
import FollowButton from "@/components/FollowButton";
import Navbar from "@/components/Navbar";
import { isAdminEmail } from "@/lib/admin";
import { getSession } from "@/lib/auth";
import { getFeedGroupsForUser, getUserFeedSubscriptions } from "@/lib/feed-groups";
import { buildProfilePath } from "@/lib/profile-path";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  q?: string;
  tab?: string;
};

export default async function PagesPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { q, tab } = await props.searchParams;
  const query = q?.trim() ?? "";
  const activeTab = tab === "following" ? "following" : "discover";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
  });
  if (!user) redirect("/login");

  const followingPageRows = await prisma.connection.findMany({
    where: {
      followerId: session.userId,
      following: { isPage: true },
    },
    select: { followingId: true },
  });
  const followingPageIds = followingPageRows.map((row) => row.followingId);
  const followingPageSet = new Set(followingPageIds);

  const [feedGroups, feedSubscriptions] = await Promise.all([
    getFeedGroupsForUser(session.userId),
    getUserFeedSubscriptions(session.userId),
  ]);

  const pages = await prisma.user.findMany({
    where: {
      isPage: true,
      ...(activeTab === "following" ? { id: { in: followingPageIds.length ? followingPageIds : ["__none__"] } } : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { bio: { contains: query } },
              { feedSource: { is: { title: { contains: query } } } },
            ],
          }
        : {}),
    },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      avatarUrl: true,
      _count: { select: { followers: true, posts: true } },
      feedSource: {
        select: {
          id: true,
          title: true,
          description: true,
          siteUrl: true,
          imageUrl: true,
          isActive: true,
          lastFetchedAt: true,
        },
      },
    },
  });

  const feedCount = await prisma.connection.count({
    where: {
      followerId: session.userId,
      following: { isPage: true },
    },
  });

  const adminFeeds = isAdminEmail(user.email)
    ? await prisma.feedSource.findMany({
        orderBy: { createdAt: "desc" },
        include: {
          page: {
            select: { id: true, slug: true, name: true, bio: true },
          },
          _count: { select: { posts: true } },
        },
      })
    : [];

  const adminHandledChildSafetyReports = isAdminEmail(user.email)
    ? await prisma.childSafetyReport.findMany({
        where: { status: { not: "open" } },
        orderBy: [{ createdAt: "desc" }],
        take: 50,
        select: {
          id: true,
          reason: true,
          details: true,
          targetUrl: true,
          postId: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
        },
      })
    : [];

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900">Pages</h1>
              <p className="text-sm text-slate-500 mt-1">
                Follow RSS-powered pages and their articles will show up in your feed like any other post.
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-3 py-2 text-left sm:text-right">
              <p className="text-xs text-slate-400">Following pages</p>
              <p className="text-lg font-semibold text-slate-900">{feedCount}</p>
            </div>
          </div>

          <div className="flex w-full rounded-lg bg-slate-100 p-1 text-sm sm:w-fit">
            <Link
              href={query ? `/pages?tab=discover&q=${encodeURIComponent(query)}` : "/pages?tab=discover"}
              className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                activeTab === "discover"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Discover
            </Link>
            <Link
              href={query ? `/pages?tab=following&q=${encodeURIComponent(query)}` : "/pages?tab=following"}
              className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                activeTab === "following"
                  ? "bg-white text-slate-900 shadow-sm"
                  : "text-slate-500 hover:text-slate-800"
              }`}
            >
              Following
            </Link>
          </div>

          <form action="/pages" method="GET" className="flex flex-col gap-2 sm:flex-row">
            <input type="hidden" name="tab" value={activeTab} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search pages or publishers"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              Search
            </button>
          </form>

          {pages.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
              {activeTab === "following"
                ? "You are not following any pages yet."
                : query
                ? `No pages found for \"${query}\".`
                : "No pages are available yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {pages.map((page) => (
                <li
                  key={page.id}
                  className="rounded-xl border border-slate-200 p-4 space-y-3"
                >
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="min-w-0 flex items-start gap-3">
                      <Avatar
                        name={page.name}
                        avatarUrl={page.avatarUrl ?? page.feedSource?.imageUrl}
                        sizeClassName="h-11 w-11"
                        textClassName="text-sm font-semibold"
                      />
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <Link
                            href={buildProfilePath(page)}
                            className="text-sm font-semibold text-slate-900 hover:underline"
                          >
                            {page.name}
                          </Link>
                          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700">
                            Page
                          </span>
                        </div>
                        {page.bio && (
                          <p className="text-sm text-slate-500 mt-1 line-clamp-2">{page.bio}</p>
                        )}
                        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                          <span>{page._count.posts} articles</span>
                          <span>{page._count.followers} followers</span>
                          {page.feedSource?.lastFetchedAt && (
                            <span>Synced {new Date(page.feedSource.lastFetchedAt).toLocaleString()}</span>
                          )}
                          {page.feedSource?.siteUrl && (
                            <a
                              href={page.feedSource.siteUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 hover:underline"
                            >
                              Source site
                            </a>
                          )}
                        </div>
                      </div>
                    </div>
                    <FollowButton
                      targetUserId={page.id}
                      initialIsFollowing={followingPageSet.has(page.id)}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}

          <FeedGroupsManager
            initialGroups={feedGroups}
            initialSources={feedSubscriptions}
          />
        </section>

        {isAdminEmail(user.email) && (
          <>
            <AdminFeedManager
              feeds={adminFeeds.map((feed) => ({
                ...feed,
                lastFetchedAt: feed.lastFetchedAt?.toISOString() ?? null,
              }))}
            />
            <AdminChildSafetyArchive
              initialReports={adminHandledChildSafetyReports.map((report) => ({
                ...report,
                createdAt: report.createdAt.toISOString(),
                reviewedAt: report.reviewedAt?.toISOString() ?? null,
              }))}
            />
          </>
        )}
      </div>
    </>
  );
}