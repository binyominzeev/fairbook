import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import FeedInfiniteList from "@/components/FeedInfiniteList";
import Navbar from "@/components/Navbar";
import CreatePostForm from "@/components/CreatePostForm";
import { getFeedPage } from "@/lib/feed-posts";
import { getSuggestedPeople } from "@/lib/people-suggestions";
import { buildProfilePath } from "@/lib/profile-path";

export default async function FeedPage(props: {
  searchParams: Promise<{ notice?: string; noticeKind?: string }>;
}) {
  const { notice, noticeKind } = await props.searchParams;
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

  const initialFeedPage = await getFeedPage({
    viewerId: session.userId,
    hideViolentFeed: user.hideViolentFeed,
  });

  const suggestedUsers = await getSuggestedPeople(session.userId, 5);

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

          <CreatePostForm />

          <FeedInfiniteList
            key={`${initialFeedPage.posts[0]?.id ?? "empty"}:${initialFeedPage.nextCursor ?? "end"}`}
            initialPosts={initialFeedPage.posts}
            initialNextCursor={initialFeedPage.nextCursor}
            currentUserId={user.id}
          />
        </div>

        {suggestedUsers.length > 0 && initialFeedPage.posts.length === 0 && (
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
