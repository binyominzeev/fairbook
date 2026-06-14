import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import CreatePostForm from "@/components/CreatePostForm";

export default async function FeedPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
  });
  if (!user) redirect("/login");

  const following = await prisma.connection.findMany({
    where: { followerId: session.userId },
    select: { followingId: true },
  });
  const authorIds = [
    session.userId,
    ...following.map((c) => c.followingId),
  ];

  const posts = await prisma.post.findMany({
    where: {
      authorId: { in: authorIds },
      OR: [{ feedSourceId: null }, { isFeedVisible: true }],
    },
    orderBy: [{ score: "desc" }, { createdAt: "desc" }],
    take: 30,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          content: true,
          sharedUrl: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedImageUrl: true,
          createdAt: true,
          author: { select: { id: true, name: true, avatarUrl: true } },
        },
      },
      likes: { where: { userId: session.userId }, select: { id: true }, take: 1 },
      sharedBy: {
        where: { authorId: session.userId },
        select: { id: true },
        take: 1,
      },
      _count: { select: { comments: true, likes: true, sharedBy: true } },
    },
  });

  // Suggest users to follow
  const suggestedUsers = await prisma.user.findMany({
    where: {
      isPage: false,
      id: { notIn: [...authorIds] },
    },
    select: { id: true, name: true, avatarUrl: true, bio: true },
    take: 5,
  });

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6">
        <div className="space-y-4">
          <CreatePostForm />

          {posts.length === 0 && (
            <div className="text-center py-16 text-slate-400">
              <p className="text-2xl mb-3">👋</p>
              <p className="font-medium text-slate-600">Your feed is empty.</p>
              <p className="text-sm mt-1">
                Follow people or pages to see posts here.
              </p>
            </div>
          )}

          {posts.map((post) => (
            <PostCard
              key={post.id}
              post={{
                ...post,
                createdAt: post.createdAt.toISOString(),
                likedByCurrentUser: post.likes.length > 0,
                sharedByCurrentUser: post.sharedBy.length > 0,
                sharedPost: post.sharedPost
                  ? {
                      ...post.sharedPost,
                      createdAt: post.sharedPost.createdAt.toISOString(),
                    }
                  : null,
              }}
              currentUserId={user.id}
              showDelete
            />
          ))}
        </div>

        {suggestedUsers.length > 0 && posts.length === 0 && (
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
                    href={`/profile/${u.id}`}
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
