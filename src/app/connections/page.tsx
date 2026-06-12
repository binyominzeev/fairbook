import Link from "next/link";
import { redirect } from "next/navigation";
import Navbar from "@/components/Navbar";
import FollowButton from "@/components/FollowButton";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

type SearchParams = {
  q?: string;
  tab?: string;
};

export default async function ConnectionsPage(props: {
  searchParams: Promise<SearchParams>;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const { q, tab } = await props.searchParams;
  const activeTab = tab === "followers" ? "followers" : "following";
  const query = q?.trim() ?? "";

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      name: true,
      email: true,
      _count: { select: { followers: true, following: true } },
    },
  });
  if (!user) redirect("/login");

  const followingRows = await prisma.connection.findMany({
    where: { followerId: session.userId },
    select: { followingId: true },
  });
  const followingIds = new Set(followingRows.map((row) => row.followingId));

  const searchResults = query
    ? await prisma.user.findMany({
        where: {
          id: { not: session.userId },
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
          ],
        },
        select: { id: true, name: true, email: true, bio: true, avatarUrl: true },
        take: 20,
        orderBy: { name: "asc" },
      })
    : [];

  const connections =
    activeTab === "followers"
      ? (
          await prisma.connection.findMany({
            where: { followingId: session.userId },
            include: {
              follower: {
                select: { id: true, name: true, bio: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        ).map((row) => row.follower)
      : (
          await prisma.connection.findMany({
            where: { followerId: session.userId },
            include: {
              following: {
                select: { id: true, name: true, bio: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        ).map((row) => row.following);

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">People</h1>
            <p className="text-sm text-slate-500 mt-1">
              Search for people by name or email, then open their profile or follow them directly.
            </p>
          </div>

          <form action="/connections" method="GET" className="flex gap-2">
            <input type="hidden" name="tab" value={activeTab} />
            <input
              type="search"
              name="q"
              defaultValue={query}
              placeholder="Search by name or email"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500"
            />
            <button
              type="submit"
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
            >
              Search
            </button>
          </form>

          {query ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Search results</h2>
                <span className="text-xs text-slate-400">{searchResults.length} result(s)</span>
              </div>

              {searchResults.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No users found for "{query}".
                </p>
              ) : (
                <ul className="space-y-3">
                  {searchResults.map((person) => (
                    <li
                      key={person.id}
                      className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                          {person.name[0]?.toUpperCase()}
                        </div>
                        <div className="min-w-0">
                          <Link
                            href={`/profile/${person.id}`}
                            className="block text-sm font-medium text-slate-900 hover:underline"
                          >
                            {person.name}
                          </Link>
                          <p className="truncate text-xs text-slate-500">{person.email}</p>
                          {person.bio && (
                            <p className="truncate text-xs text-slate-400 mt-0.5">{person.bio}</p>
                          )}
                        </div>
                      </div>
                      <FollowButton
                        targetUserId={person.id}
                        initialIsFollowing={followingIds.has(person.id)}
                      />
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ) : (
            <p className="text-sm text-slate-400">
              Start with a name or email address to find people.
            </p>
          )}
        </section>

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Your connections</h2>
              <p className="text-xs text-slate-500 mt-1">
                {user._count.following} following, {user._count.followers} followers
              </p>
            </div>
            <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
              <Link
                href={query ? `/connections?tab=following&q=${encodeURIComponent(query)}` : "/connections?tab=following"}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  activeTab === "following"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Following
              </Link>
              <Link
                href={query ? `/connections?tab=followers&q=${encodeURIComponent(query)}` : "/connections?tab=followers"}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  activeTab === "followers"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Followers
              </Link>
            </div>
          </div>

          {connections.length === 0 ? (
            <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
              {activeTab === "following"
                ? "You are not following anyone yet."
                : "You do not have followers yet."}
            </p>
          ) : (
            <ul className="space-y-3">
              {connections.map((person) => {
                const isFollowing = followingIds.has(person.id);

                return (
                  <li
                    key={person.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-slate-200 px-3 py-3"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <div className="h-10 w-10 rounded-full bg-slate-200 flex items-center justify-center text-sm font-semibold text-slate-600">
                        {person.name[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/profile/${person.id}`}
                          className="block text-sm font-medium text-slate-900 hover:underline"
                        >
                          {person.name}
                        </Link>
                        {person.bio && (
                          <p className="truncate text-xs text-slate-500 mt-0.5">{person.bio}</p>
                        )}
                      </div>
                    </div>
                    {person.id === user.id ? null : (
                      <FollowButton
                        targetUserId={person.id}
                        initialIsFollowing={isFollowing}
                      />
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}