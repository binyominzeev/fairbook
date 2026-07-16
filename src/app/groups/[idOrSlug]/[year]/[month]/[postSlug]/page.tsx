import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import PublicNavbar from "@/components/PublicNavbar";
import PostCard from "@/components/PostCard";
import CommentCard from "@/components/CommentCard";
import CommentHashScroller from "@/components/CommentHashScroller";
import ThreadReflection from "@/components/ThreadReflection";
import GenerateReflectionButton from "@/components/GenerateReflectionButton";
import CommentForm from "@/components/CommentForm";
import AdminDevSidebar from "@/components/AdminDevSidebar";
import type { DiscourseSignal } from "@/lib/ai";
import { isAdminEmail } from "@/lib/admin";
import { canViewerAccessCommunity } from "@/lib/community-visibility";
import { buildPostPermalinkPath } from "@/lib/post-permalink";
import { getCommentInsightsEnabled } from "@/lib/app-config";

export default async function GroupPostPermalinkPage(props: {
  params: Promise<{ idOrSlug: string; year: string; month: string; postSlug: string }>;
}) {
  const { idOrSlug, year, month, postSlug } = await props.params;
  const session = await getSession();
  const viewerId = session?.userId ?? "__guest__";

  const user = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: { id: true, slug: true, name: true, email: true, avatarUrl: true },
      })
    : null;
  const isLoggedIn = Boolean(user);
  const isAdmin = user ? isAdminEmail(user.email) : false;
  const commentInsightsEnabled = await getCommentInsightsEnabled();

  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }],
    },
    select: {
      id: true,
      permalinkSlug: true,
      isPrivate: true,
      members: {
        where: { userId: viewerId },
        select: { role: true, userId: true },
        take: 1,
      },
    },
  });
  if (!community) notFound();
  if (!canViewerAccessCommunity(community)) notFound();

  const parsedYear = Number(year);
  const parsedMonth = Number(month);
  if (
    !Number.isInteger(parsedYear) ||
    !Number.isInteger(parsedMonth) ||
    parsedYear < 1970 ||
    parsedYear > 3000 ||
    parsedMonth < 1 ||
    parsedMonth > 12
  ) {
    notFound();
  }

  const monthStart = new Date(Date.UTC(parsedYear, parsedMonth - 1, 1));
  const nextMonthStart = new Date(Date.UTC(parsedYear, parsedMonth, 1));

  const post = await prisma.post.findFirst({
    where: {
      communityId: community.id,
      createdAt: {
        gte: monthStart,
        lt: nextMonthStart,
      },
      OR: [{ permalinkSlug: postSlug }, { id: postSlug }],
    },
    include: {
      author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
      sharedPost: {
        select: {
          id: true,
          permalinkSlug: true,
          content: true,
          isTextCard: true,
          feedSourceId: true,
          sharedUrl: true,
          sharedTitle: true,
          sharedDescription: true,
          sharedSource: true,
          sharedImageUrl: true,
          imageUrls: true,
          createdAt: true,
          author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
          community: { select: { id: true, permalinkSlug: true, name: true } },
        },
      },
      likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
      bookmarkedBy: {
        where: { userId: viewerId },
        select: { id: true },
        take: 1,
      },
      sharedBy: {
        where: { authorId: viewerId },
        select: { id: true },
        take: 1,
      },
      notificationPreferences: {
        where: { userId: viewerId },
        select: { isSubscribed: true },
        take: 1,
      },
      community: {
        select: {
          id: true,
          name: true,
          permalinkSlug: true,
          isPrivate: true,
          members: {
            where: { userId: viewerId },
            select: { role: true, userId: true },
            take: 1,
          },
        },
      },
      _count: { select: { comments: true, likes: true, sharedBy: true } },
      reflections: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!post) notFound();
  if (post.moderationStatus === "author_only" && post.author.id !== viewerId) {
    notFound();
  }
  if (!canViewerAccessCommunity(post.community)) {
    notFound();
  }

  const canonicalPath = buildPostPermalinkPath({
    author: post.author,
    community: post.community,
    createdAt: post.createdAt,
    slug: post.permalinkSlug,
    postId: post.id,
  });
  const requestedPath = `/groups/${idOrSlug}/${year}/${month}/${postSlug}`;
  if (requestedPath !== canonicalPath) {
    redirect(canonicalPath);
  }

  const rawComments = isLoggedIn
    ? await prisma.comment.findMany({
        where: {
          postId: post.id,
          OR: [{ moderationStatus: "visible" }, { authorId: viewerId }],
        },
        orderBy: { createdAt: "asc" },
        include: {
          author: { select: { id: true, slug: true, name: true, avatarUrl: true } },
          analysis: true,
          likes: { where: { userId: viewerId }, select: { id: true }, take: 1 },
          _count: { select: { likes: true } },
        },
      })
    : [];

  const parseAnalysis = (a: {
    positiveSignals: string;
    negativeSignals: string;
    neutralSignals: string;
    explanation: string;
  } | null) => {
    if (!commentInsightsEnabled) return null;
    if (!a) return null;
    return {
      positiveSignals: JSON.parse(a.positiveSignals) as DiscourseSignal[],
      negativeSignals: JSON.parse(a.negativeSignals) as DiscourseSignal[],
      neutralSignals: JSON.parse(a.neutralSignals) as DiscourseSignal[],
      explanation: a.explanation,
    };
  };

  type RawReply = {
    id: string;
    parentId: string | null;
    content: string;
    moderationStatus: string;
    moderationReason: string | null;
    moderationExplanation: string | null;
    createdAt: Date;
    author: { id: string; slug: string | null; name: string; avatarUrl: string | null };
    analysis: {
      positiveSignals: string;
      negativeSignals: string;
      neutralSignals: string;
      explanation: string;
    } | null;
    likes: { id: string }[];
    _count: { likes: number };
  };

  const commentsByParentId = new Map<string | null, RawReply[]>();
  for (const comment of rawComments as RawReply[]) {
    const siblings = commentsByParentId.get(comment.parentId) ?? [];
    siblings.push(comment);
    commentsByParentId.set(comment.parentId, siblings);
  }

  const commentIds = new Set((rawComments as RawReply[]).map((comment) => comment.id));
  const topLevel = (rawComments as RawReply[]).filter(
    (comment) => comment.parentId === null || !commentIds.has(comment.parentId)
  );

  const mapComment = (c: RawReply): object => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    analysis: parseAnalysis(c.analysis),
    likedByCurrentUser: c.likes.length > 0,
    likeCount: c._count.likes,
    replies: (commentsByParentId.get(c.id) ?? []).map(mapComment),
  });

  const comments = topLevel.map(mapComment);

  const latestReflection = post.reflections[0]
    ? {
        ...post.reflections[0],
        createdAt: post.reflections[0].createdAt.toISOString(),
        agreementAreas: JSON.parse(post.reflections[0].agreementAreas),
        disagreementAreas: JSON.parse(post.reflections[0].disagreementAreas),
        unresolvedQuestions: JSON.parse(post.reflections[0].unresolvedQuestions),
        qualityObservations: JSON.parse(post.reflections[0].qualityObservations),
      }
    : null;

  const parseImageUrls = (value: string | null) => {
    if (!value) return [];
    try {
      const parsed = JSON.parse(value);
      if (!Array.isArray(parsed)) return [];
      return parsed.filter((item): item is string => typeof item === "string");
    } catch {
      return [];
    }
  };

  const postForCard = {
    ...post,
    permalinkPath: canonicalPath,
    imageUrls: parseImageUrls(post.imageUrls),
    feedSourceId: post.feedSourceId,
    createdAt: post.createdAt.toISOString(),
    likedByCurrentUser: post.likes.length > 0,
    bookmarkedByCurrentUser: post.bookmarkedBy.length > 0,
    sharedByCurrentUser: post.sharedBy.length > 0,
    notificationsSubscribedByCurrentUser:
      post.notificationPreferences[0]?.isSubscribed !== false,
    sharedPost: post.sharedPost
      ? {
          ...post.sharedPost,
          permalinkPath: buildPostPermalinkPath({
            author: post.sharedPost.author,
            community: post.sharedPost.community,
            createdAt: post.sharedPost.createdAt,
            slug: post.sharedPost.permalinkSlug,
            postId: post.sharedPost.id,
          }),
          imageUrls: parseImageUrls(post.sharedPost.imageUrls),
          createdAt: post.sharedPost.createdAt.toISOString(),
        }
      : null,
  };

  const commentCount = isLoggedIn ? rawComments.length : post._count.comments;

  return (
    <>
      {user ? <Navbar user={user} /> : <PublicNavbar />}
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <PostCard
          post={postForCard}
          currentUserId={user?.id ?? ""}
          showDelete
          showPermalinkEditor={isLoggedIn}
          defaultShareCommunityId={post.community?.members.length ? post.community.id : null}
          shareRedirectPath={
            post.community?.members.length
              ? `/groups/${encodeURIComponent(post.community.permalinkSlug ?? post.community.id)}`
              : null
          }
          requireAuthForInteractions={!isLoggedIn}
        />

        {isLoggedIn ? (
          <>
            {commentInsightsEnabled &&
              (latestReflection ? (
                <ThreadReflection reflection={latestReflection} />
              ) : (
                commentCount >= 5 && <GenerateReflectionButton postId={post.id} />
              ))}

            <div className="bg-white rounded-xl border border-slate-200 p-4">
              <CommentHashScroller />
              <h2 className="text-sm font-semibold text-slate-700 mb-4">
                Discussion ({commentCount})
              </h2>

              <CommentForm postId={post.id} />

              <div className="mt-4 divide-y divide-slate-50">
                {comments.length === 0 && (
                  <p className="text-sm text-slate-400 py-4 text-center">
                    No comments yet. Start the discussion.
                  </p>
                )}
                {(comments as Parameters<typeof CommentCard>[0]["comment"][]).map((comment) => (
                  <CommentCard
                    key={(comment as { id: string }).id}
                    comment={comment as Parameters<typeof CommentCard>[0]["comment"]}
                    postId={post.id}
                    currentUserId={user?.id ?? ""}
                    currentUserIsAdmin={isAdmin}
                    currentUserCanModerateGroup={
                      isAdmin ||
                      post.community?.members.some(
                        (member) => member.role === "admin" || member.role === "moderator"
                      ) === true
                    }
                    commentInsightsEnabled={commentInsightsEnabled}
                  />
                ))}
              </div>
            </div>
          </>
        ) : null}

        {isAdmin && <AdminDevSidebar />}
      </div>
    </>
  );
}