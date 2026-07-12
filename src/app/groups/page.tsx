import GroupCreateForm from "@/components/GroupCreateForm";
import GroupJoinButton from "@/components/GroupJoinButton";
import Navbar from "@/components/Navbar";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function GroupsPage(props: {
  searchParams: Promise<{ q?: string; scope?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, avatarUrl: true },
  });
  if (!user) {
    redirect("/login");
  }

  const { q, scope } = await props.searchParams;
  const query = (q ?? "").trim();
  const mode = scope === "joined" ? "joined" : "all";

  const communities = await prisma.community.findMany({
    where: {
      ...(mode === "joined"
        ? {
            members: {
              some: { userId: session.userId },
            },
          }
        : {}),
      ...(query
        ? {
            OR: [
              { name: { contains: query } },
              { description: { contains: query } },
            ],
          }
        : {}),
    },
    orderBy: [{ createdAt: "desc" }],
    include: {
      members: {
        where: { userId: session.userId },
        select: { role: true },
        take: 1,
      },
      _count: { select: { members: true, posts: true } },
    },
    take: 100,
  });

  const buildHref = (nextScope: "all" | "joined") => {
    const params = new URLSearchParams();
    if (nextScope === "joined") {
      params.set("scope", "joined");
    }
    if (query) {
      params.set("q", query);
    }
    const raw = params.toString();
    return raw ? `/groups?${raw}` : "/groups";
  };

  return (
    <>
      <Navbar user={user} />
      <div className="mx-auto grid max-w-5xl gap-4 px-4 py-6 md:grid-cols-[1.2fr_2fr]">
        <GroupCreateForm />

        <section className="space-y-3">
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex rounded-lg bg-slate-100 p-1 text-sm">
              <Link
                href={buildHref("all")}
                className={`rounded-md px-3 py-1.5 ${
                  mode === "all" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                All Groups
              </Link>
              <Link
                href={buildHref("joined")}
                className={`rounded-md px-3 py-1.5 ${
                  mode === "joined" ? "bg-white text-slate-900 shadow-sm" : "text-slate-500"
                }`}
              >
                Joined
              </Link>
            </div>
            <form action="/groups" method="GET" className="flex gap-2">
              {mode === "joined" && <input type="hidden" name="scope" value="joined" />}
              <QuerySyncSearchInput
                initialValue={query}
                placeholder="Search groups"
                className="rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
              />
              <button
                type="submit"
                className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
              >
                Search
              </button>
            </form>
          </div>

          {communities.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-300 bg-white px-4 py-8 text-center text-sm text-slate-500">
              No groups found.
            </div>
          ) : (
            <ul className="space-y-3">
              {communities.map((community) => {
                const slug = community.permalinkSlug ?? community.id;
                const isMember = community.members.length > 0;

                return (
                  <li key={community.id} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <Link
                          href={`/groups/${encodeURIComponent(slug)}`}
                          className="text-sm font-semibold text-slate-900 hover:underline"
                        >
                          {community.name}
                        </Link>
                        <p className="mt-1 text-xs text-slate-500">
                          {community.isPrivate ? "Closed" : "Public"} · {community._count.members} members · {community._count.posts} posts
                        </p>
                        {community.description && (
                          <p className="mt-2 line-clamp-3 text-sm text-slate-700">{community.description}</p>
                        )}
                      </div>
                      <GroupJoinButton groupIdOrSlug={slug} initiallyMember={isMember} />
                    </div>
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
