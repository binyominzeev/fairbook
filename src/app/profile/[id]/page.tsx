import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import FollowButton from "@/components/FollowButton";
import Link from "next/link";

export default async function ProfilePage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) redirect("/login");

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
  if (!currentUser) redirect("/login");

  const profileUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      name: true,
      bio: true,
      avatarUrl: true,
      isPage: true,
      createdAt: true,
      _count: {
        select: { followers: true, following: true, posts: true },
      },
    },
  });
  if (!profileUser) notFound();

  const isFollowing = !!(await prisma.connection.findUnique({
    where: {
      followerId_followingId: {
        followerId: session.userId,
        followingId: id,
      },
    },
  }));

  const posts = await prisma.post.findMany({
    where: { authorId: id },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      community: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
    },
  });

  const isOwnProfile = id === session.userId;

  return (
    <>
      <Navbar user={currentUser} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Profile header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <div className="w-14 h-14 rounded-full bg-slate-200 flex items-center justify-center text-2xl font-bold text-slate-600">
                {profileUser.name[0]?.toUpperCase()}
              </div>
              <div className="min-w-0">
                <h1 className="truncate text-lg font-bold text-slate-900">
                  {profileUser.name}
                </h1>
                {profileUser.isPage && (
                  <span className="inline-flex rounded-full bg-blue-50 px-2 py-0.5 text-[11px] font-medium text-blue-700 mt-1">
                    Page
                  </span>
                )}
                {profileUser.bio && (
                  <p className="mt-0.5 text-sm text-slate-500">
                    {profileUser.bio}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-slate-500">
                  <span>
                    <strong className="text-slate-900">
                      {profileUser._count.posts}
                    </strong>{" "}
                    posts
                  </span>
                  {isOwnProfile ? (
                    <Link href="/connections?tab=followers" className="hover:text-slate-700">
                      <strong className="text-slate-900">
                        {profileUser._count.followers}
                      </strong>{" "}
                      followers
                    </Link>
                  ) : (
                    <span>
                      <strong className="text-slate-900">
                        {profileUser._count.followers}
                      </strong>{" "}
                      followers
                    </span>
                  )}
                  {isOwnProfile ? (
                    <Link href="/connections?tab=following" className="hover:text-slate-700">
                      <strong className="text-slate-900">
                        {profileUser._count.following}
                      </strong>{" "}
                      following
                    </Link>
                  ) : (
                    <span>
                      <strong className="text-slate-900">
                        {profileUser._count.following}
                      </strong>{" "}
                      following
                    </span>
                  )}
                </div>
              </div>
            </div>
            {!isOwnProfile && (
              <FollowButton
                targetUserId={id}
                initialIsFollowing={isFollowing}
              />
            )}
          </div>
        </div>

        {/* Posts */}
        <h2 className="text-sm font-semibold text-slate-700 px-1">Posts</h2>
        {posts.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-8">
            No posts yet.
          </p>
        )}
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={{ ...post, createdAt: post.createdAt.toISOString() }}
            currentUserId={currentUser.id}
            showDelete={isOwnProfile}
          />
        ))}
      </div>
    </>
  );
}
