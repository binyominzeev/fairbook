import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import FollowButton from "@/components/FollowButton";
import ProfileAvatarEditor from "@/components/ProfileAvatarEditor";
import Link from "next/link";

export default async function ProfilePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string }>;
}) {
  const { id } = await props.params;
  const { tab } = await props.searchParams;
  const session = await getSession();
  if (!session) redirect("/login");

  const activeTab = tab === "likes" || tab === "comments" ? tab : "posts";

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true, avatarUrl: true },
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

  const postInclude = {
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
  } as const;

  const serializePost = <T extends {
    createdAt: Date;
    likes: { id: string }[];
    sharedBy: { id: string }[];
    sharedPost: null | {
      createdAt: Date;
      author: { id: string; name: string; avatarUrl: string | null };
      id: string;
      content: string | null;
      sharedUrl: string | null;
      sharedTitle: string | null;
      sharedDescription: string | null;
      sharedSource: string | null;
      sharedImageUrl: string | null;
    };
  }>(post: T) => ({
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
  });

  const posts = await prisma.post.findMany({
    where:
      id === session.userId
        ? { authorId: id }
        : { authorId: id, moderationStatus: "visible" },
    orderBy: { createdAt: "desc" },
    take: 20,
    include: postInclude,
  });

  const isOwnProfile = id === session.userId;

  const likedPosts = isOwnProfile
    ? (
        await prisma.postLike.findMany({
          where: { userId: id },
          orderBy: { createdAt: "desc" },
          take: 20,
          select: {
            post: {
              include: postInclude,
            },
          },
        })
      ).map((like) => like.post)
    : [];

  const comments = isOwnProfile
    ? await prisma.comment.findMany({
        where: { authorId: id },
        orderBy: { createdAt: "desc" },
        take: 30,
        include: {
          post: {
            select: {
              id: true,
              content: true,
              sharedTitle: true,
              sharedSource: true,
              author: { select: { id: true, name: true, avatarUrl: true } },
            },
          },
        },
      })
    : [];

  return (
    <>
      <Navbar user={currentUser} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        {/* Profile header */}
        <div className="bg-white rounded-xl border border-slate-200 p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex min-w-0 items-center gap-4">
              <Avatar
                name={profileUser.name}
                avatarUrl={profileUser.avatarUrl}
                sizeClassName="h-14 w-14"
                textClassName="text-2xl font-bold"
              />
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
          {isOwnProfile && !profileUser.isPage && (
            <ProfileAvatarEditor
              userId={profileUser.id}
              name={profileUser.name}
              avatarUrl={profileUser.avatarUrl}
            />
          )}
        </div>

        {isOwnProfile && !profileUser.isPage ? (
          <>
            <div className="flex items-center gap-2 px-1 text-sm">
              <Link
                href={`/profile/${id}`}
                className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "posts" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                Posts
              </Link>
              <Link
                href={`/profile/${id}?tab=likes`}
                className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "likes" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                Likes
              </Link>
              <Link
                href={`/profile/${id}?tab=comments`}
                className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "comments" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                Comments
              </Link>
            </div>

            {activeTab === "posts" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Posts</h2>
                {posts.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    No posts yet.
                  </p>
                )}
                {posts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={serializePost(post)}
                    currentUserId={currentUser.id}
                    showDelete={isOwnProfile}
                  />
                ))}
              </>
            )}

            {activeTab === "likes" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Liked posts</h2>
                {likedPosts.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    You have not liked any posts yet.
                  </p>
                )}
                {likedPosts.map((post) => (
                  <PostCard
                    key={post.id}
                    post={serializePost(post)}
                    currentUserId={currentUser.id}
                    showDelete={post.author.id === currentUser.id}
                  />
                ))}
              </>
            )}

            {activeTab === "comments" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Recent comments</h2>
                {comments.length === 0 && (
                  <p className="py-8 text-center text-sm text-slate-400">
                    You have not commented yet.
                  </p>
                )}
                <div className="space-y-3">
                  {comments.map((comment) => (
                    <article
                      key={comment.id}
                      className="rounded-xl border border-slate-200 bg-white p-4"
                    >
                      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-400">
                        <span>{comment.createdAt.toLocaleString()}</span>
                        <span>·</span>
                        <span>
                          On
                        </span>
                        <Link
                          href={`/post/${comment.post.id}`}
                          className="font-medium text-blue-600 hover:underline"
                        >
                          {comment.post.sharedTitle ?? comment.post.content?.slice(0, 80) ?? "Untitled post"}
                        </Link>
                        <span>by {comment.post.author.name}</span>
                        {comment.post.sharedSource && <span>· {comment.post.sharedSource}</span>}
                      </div>
                      <p className="mt-2 whitespace-pre-wrap text-sm text-slate-800">
                        {comment.content}
                      </p>
                      {comment.moderationStatus === "author_only" && (
                        <div className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                          <p className="font-medium">
                            Filtered{comment.moderationReason ? ` · ${comment.moderationReason}` : ""}
                          </p>
                          <p className="mt-1 text-amber-800">
                            {comment.moderationExplanation ?? "Only you can see this comment."}
                          </p>
                        </div>
                      )}
                      <div className="mt-3">
                        <Link
                          href={`/post/${comment.post.id}`}
                          className="text-xs text-slate-500 hover:text-blue-600"
                        >
                          Open discussion →
                        </Link>
                      </div>
                    </article>
                  ))}
                </div>
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="px-1 text-sm font-semibold text-slate-700">Posts</h2>
            {posts.length === 0 && (
              <p className="py-8 text-center text-sm text-slate-400">
                No posts yet.
              </p>
            )}
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={serializePost(post)}
                currentUserId={currentUser.id}
                showDelete={isOwnProfile}
              />
            ))}
          </>
        )}
      </div>
    </>
  );
}
