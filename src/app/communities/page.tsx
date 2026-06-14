import { getSession } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Navbar from "@/components/Navbar";
import CreateCommunityForm from "@/components/CreateCommunityForm";
import JoinCommunityButton from "@/components/JoinCommunityButton";

export default async function CommunitiesPage() {
  const session = await getSession();
  if (!session) redirect("/login");

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, name: true, email: true },
  });
  if (!user) redirect("/login");

  const communities = await prisma.community.findMany({
    where: { isPrivate: false },
    orderBy: { createdAt: "desc" },
    include: {
      owner: { select: { id: true, name: true } },
      _count: { select: { members: true, posts: true } },
    },
  });

  const myMemberships = await prisma.communityMember.findMany({
    where: { userId: session.userId },
    select: { communityId: true },
  });
  const memberOf = new Set(myMemberships.map((m) => m.communityId));

  return (
    <>
      <Navbar user={user} />
      <div className="max-w-2xl mx-auto px-4 py-6 space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-lg font-bold text-slate-900">Communities</h1>
        </div>

        <CreateCommunityForm />

        {communities.length === 0 && (
          <p className="text-sm text-slate-400 text-center py-10">
            No communities yet. Create one above.
          </p>
        )}

        {communities.map((community) => (
          <div
            key={community.id}
            className="bg-white rounded-xl border border-slate-200 p-4"
          >
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <h2 className="font-semibold text-slate-900">
                  {community.name}
                </h2>
                {community.description && (
                  <p className="text-sm text-slate-500 mt-0.5">
                    {community.description}
                  </p>
                )}
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-400">
                  <span>{community._count.members} members</span>
                  <span>{community._count.posts} posts</span>
                  <span>Created by {community.owner.name}</span>
                </div>
              </div>
              <JoinCommunityButton
                communityId={community.id}
                isMember={memberOf.has(community.id)}
                isOwner={community.owner.id === session.userId}
              />
            </div>
          </div>
        ))}
      </div>
    </>
  );
}
