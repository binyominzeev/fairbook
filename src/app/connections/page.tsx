import Link from "next/link";
import { redirect } from "next/navigation";
import Avatar from "@/components/Avatar";
import Navbar from "@/components/Navbar";
import FollowButton from "@/components/FollowButton";
import { getSession } from "@/lib/auth";
import { getSuggestedPeople } from "@/lib/people-suggestions";
import { buildProfilePath } from "@/lib/profile-path";
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
      slug: true,
      name: true,
      email: true,
      avatarUrl: true,
    },
  });
  if (!user) redirect("/login");

  const [followingCount, followersCount] = await Promise.all([
    prisma.connection.count({
      where: { followerId: session.userId, following: { isPage: false } },
    }),
    prisma.connection.count({
      where: { followingId: session.userId, follower: { isPage: false } },
    }),
  ]);

  const followingRows = await prisma.connection.findMany({
    where: { followerId: session.userId },
    select: { followingId: true },
  });
  const followingIds = new Set(followingRows.map((row) => row.followingId));

  const searchResults = query
    ? await prisma.user.findMany({
        where: {
          isPage: false,
          id: { not: session.userId },
          OR: [
            { name: { contains: query } },
            { email: { contains: query } },
          ],
        },
        select: { id: true, slug: true, name: true, email: true, bio: true, avatarUrl: true },
        take: 20,
        orderBy: { name: "asc" },
      })
    : [];

  const suggestedPeople = await getSuggestedPeople(session.userId);

  const connections =
    activeTab === "followers"
      ? (
          await prisma.connection.findMany({
            where: { followingId: session.userId, follower: { isPage: false } },
            include: {
              follower: {
                select: { id: true, slug: true, name: true, bio: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        ).map((row) => row.follower)
      : (
          await prisma.connection.findMany({
            where: { followerId: session.userId, following: { isPage: false } },
            include: {
              following: {
                select: { id: true, slug: true, name: true, bio: true, avatarUrl: true },
              },
            },
            orderBy: { createdAt: "desc" },
          })
        ).map((row) => row.following);

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4">
          <div>
            <h1 className="text-lg font-bold text-slate-900">People</h1>
            <p className="text-sm text-slate-500 mt-1">
              Search for people by name or email, then open their profile or follow them directly.
            </p>
          </div>

          <div className="space-y-3">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Kit ismerhetek?</h2>
              <p className="text-xs text-slate-500 mt-1">
                Regisztrált felhasználók, akiket még nem követsz.
              </p>
            </div>

            {suggestedPeople.length === 0 ? (
              <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                Jelenleg nincs új javaslat. Próbáld meg a keresőt név vagy email alapján.
              </p>
            ) : (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4">
                {suggestedPeople.map((person) => (
                  <Link
                    key={person.id}
                    href={buildProfilePath(person)}
                    className="group rounded-xl border border-slate-200 bg-slate-50 px-4 py-5 text-center transition-colors hover:border-slate-300 hover:bg-white"
                  >
                    <Avatar
                      name={person.name}
                      avatarUrl={person.avatarUrl}
                      sizeClassName="h-16 w-16"
                      textClassName="text-lg font-semibold"
                      className="mx-auto"
                    />
                    <p className="mt-3 line-clamp-2 text-sm font-medium text-slate-900 group-hover:text-blue-700">
                      {person.name}
                    </p>
                    {person.followsViewer && (
                      <p className="mt-1 text-[11px] font-medium text-emerald-700">
                        Követ téged
                      </p>
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>

          <form action="/connections" method="GET" className="flex flex-col gap-2 sm:flex-row">
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
              className="w-full rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 sm:w-auto"
            >
              Search
            </button>
          </form>

          {query ? (
            <div className="space-y-3">
              <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                <h2 className="text-sm font-semibold text-slate-700">Search results</h2>
                <span className="text-xs text-slate-400">{searchResults.length} result(s)</span>
              </div>

              {searchResults.length === 0 ? (
                <p className="rounded-lg bg-slate-50 px-3 py-4 text-sm text-slate-500">
                  No users found for &quot;{query}&quot;.
                </p>
              ) : (
                <ul className="space-y-3">
                  {searchResults.map((person) => (
                    <li
                      key={person.id}
                      className="flex flex-col gap-3 rounded-lg border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                    >
                      <div className="min-w-0 flex items-center gap-3">
                        <Avatar
                          name={person.name}
                          avatarUrl={person.avatarUrl}
                          sizeClassName="h-10 w-10"
                          textClassName="text-sm font-semibold"
                        />
                        <div className="min-w-0">
                          <Link
                            href={buildProfilePath(person)}
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

        <section className="bg-white rounded-xl border border-slate-200 p-5 space-y-4 max-w-2xl">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-sm font-semibold text-slate-700">Your connections</h2>
              <p className="text-xs text-slate-500 mt-1">
                {followingCount} following, {followersCount} followers
              </p>
            </div>
            <div className="flex w-full rounded-lg bg-slate-100 p-1 text-sm sm:w-auto">
              <Link
                href={query ? `/connections?tab=following&q=${encodeURIComponent(query)}` : "/connections?tab=following"}
                className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
                  activeTab === "following"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                Following
              </Link>
              <Link
                href={query ? `/connections?tab=followers&q=${encodeURIComponent(query)}` : "/connections?tab=followers"}
                className={`flex-1 rounded-md px-3 py-1.5 text-center transition-colors ${
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
                    className="flex flex-col gap-3 rounded-lg border border-slate-200 px-3 py-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <div className="min-w-0 flex items-center gap-3">
                      <Avatar
                        name={person.name}
                        avatarUrl={person.avatarUrl}
                        sizeClassName="h-10 w-10"
                        textClassName="text-sm font-semibold"
                      />
                      <div className="min-w-0">
                        <Link
                          href={buildProfilePath(person)}
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