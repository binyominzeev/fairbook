import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import PostCard from "@/components/PostCard";
import CommentCard from "@/components/CommentCard";
import SteelmanSection from "@/components/SteelmanSection";
import ThreadReflection from "@/components/ThreadReflection";
import GenerateReflectionButton from "@/components/GenerateReflectionButton";
import CommentForm from "@/components/CommentForm";
import type { DiscourseSignal } from "@/lib/ai";

export default async function PostPage(props: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await props.params;
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  const post = await prisma.post.findUnique({
    where: { id },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      community: { select: { id: true, name: true } },
      _count: { select: { comments: true } },
      reflections: { orderBy: { createdAt: "desc" }, take: 1 },
    },
  });
  if (!post) notFound();

  const rawComments = await prisma.comment.findMany({
    where: { postId: id },
    orderBy: { createdAt: "asc" },
    include: {
      author: { select: { id: true, name: true, avatarUrl: true } },
      analysis: true,
      replies: {
        include: {
          author: { select: { id: true, name: true, avatarUrl: true } },
          analysis: true,
          replies: {
            include: {
              author: { select: { id: true, name: true, avatarUrl: true } },
              analysis: true,
            },
            orderBy: { createdAt: "asc" },
          },
        },
        orderBy: { createdAt: "asc" },
      },
    },
  });

  const topLevel = rawComments.filter((c) => c.parentId === null);

  // Parse analysis signals
  const parseAnalysis = (a: {
    positiveSignals: string;
    negativeSignals: string;
    neutralSignals: string;
    explanation: string;
  } | null) => {
    if (!a) return null;
    return {
      positiveSignals: JSON.parse(a.positiveSignals) as DiscourseSignal[],
      negativeSignals: JSON.parse(a.negativeSignals) as DiscourseSignal[],
      neutralSignals: JSON.parse(a.neutralSignals) as DiscourseSignal[],
      explanation: a.explanation,
    };
  };

  // Recursive comment mapper
  type RawReply = {
    id: string;
    content: string;
    createdAt: Date;
    author: { id: string; name: string; avatarUrl: string | null };
    analysis: {
      positiveSignals: string;
      negativeSignals: string;
      neutralSignals: string;
      explanation: string;
    } | null;
    replies?: RawReply[];
  };

  const mapComment = (c: RawReply): object => ({
    ...c,
    createdAt: c.createdAt.toISOString(),
    analysis: parseAnalysis(c.analysis),
    replies: c.replies?.map(mapComment) ?? [],
  });

  const comments = topLevel.map(mapComment);

  // Steelmans for this post
  const steelmanRows = await prisma.steelmanRequest.findMany({
    where: { postId: id },
    include: {
      requester: { select: { id: true, name: true } },
    },
    orderBy: { createdAt: "desc" },
  });

  const steelmans = steelmanRows.map((s) => ({
    id: s.id,
    summary: s.summary,
    status: s.status,
    requester: s.requester,
  }));

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

  const postForCard = {
    ...post,
    createdAt: post.createdAt.toISOString(),
  };

  const commentCount = rawComments.length;

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <PostCard post={postForCard} currentUserId={user.id} showDelete />

        {/* Steelman section for post author */}
        <SteelmanSection
          postId={id}
          targetId={post.author.id}
          targetName={post.author.name}
          currentUserId={user.id}
          existingSteelmans={steelmans}
        />

        {/* Thread reflection */}
        {latestReflection ? (
          <ThreadReflection reflection={latestReflection} />
        ) : (
          commentCount >= 5 && (
            <GenerateReflectionButton postId={id} />
          )
        )}

        {/* Comments section */}
        <div className="bg-white rounded-xl border border-slate-200 p-4">
          <h2 className="text-sm font-semibold text-slate-700 mb-4">
            Discussion ({commentCount})
          </h2>

          <CommentForm postId={id} />

          <div className="mt-4 divide-y divide-slate-50">
            {comments.length === 0 && (
              <p className="text-sm text-slate-400 py-4 text-center">
                No comments yet. Start the discussion.
              </p>
            )}
            {(comments as Parameters<typeof CommentCard>[0]["comment"][]).map(
              (comment) => (
                <CommentCard
                  key={(comment as { id: string }).id}
                  comment={comment as Parameters<typeof CommentCard>[0]["comment"]}
                  postId={id}
                  currentUserId={user.id}
                />
              )
            )}
          </div>
        </div>
      </div>
    </>
  );
}
