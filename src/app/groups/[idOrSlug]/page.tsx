import CreatePostForm from "@/components/CreatePostForm";
import GroupDeleteButton from "@/components/GroupDeleteButton";
import GroupAvatarEditor from "@/components/GroupAvatarEditor";
import GroupInvitePanel from "@/components/GroupInvitePanel";
import GroupJoinRequestsPanel from "@/components/GroupJoinRequestsPanel";
import GroupJoinButton from "@/components/GroupJoinButton";
import GroupNotificationToggle from "@/components/GroupNotificationToggle";
import GroupMembersPanel from "@/components/GroupMembersPanel";
import GroupPermalinkEditor from "@/components/GroupPermalinkEditor";
import GroupPostsInfiniteList from "@/components/GroupPostsInfiniteList";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";
import Navbar from "@/components/Navbar";
import Avatar from "@/components/Avatar";
import { getSession } from "@/lib/auth";
import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";
import Link from "next/link";
import { redirect } from "next/navigation";

const PAGE_SIZE = 20;

export default async function GroupDetailPage(props: {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<{ q?: string }>;
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

  const { idOrSlug } = await props.params;
  const { q } = await props.searchParams;
  const query = (q ?? "").trim();

  const community = await prisma.community.findFirst({
    where: {
      OR: [{ id: idOrSlug }, { permalinkSlug: idOrSlug }],
    },
    include: {
      owner: {
        select: { id: true, slug: true, name: true, avatarUrl: true },
      },
      members: {
        where: { userId: session.userId },
        select: { role: true },
        take: 1,
      },
      invites: {
        where: {
          inviteeId: session.userId,
          status: "pending",
        },
        select: { id: true },
        take: 1,
      },
      _count: { select: { members: true, posts: true } },
    },
  });

  if (!community) {
    redirect("/groups");
  }

  const membershipRole = community.members[0]?.role ?? null;
  const isMember = Boolean(membershipRole);
  const hasPendingInvite = community.invites.length > 0;
  const canViewPosts = !community.isPrivate || isMember;
  const isModerator = membershipRole === "admin" || membershipRole === "moderator";
  const isOwner = community.owner.id === session.userId;

  const notificationPreference = isMember
    ? await prisma.communityNotificationPreference.findUnique({
        where: {
          communityId_userId: {
            communityId: community.id,
            userId: session.userId,
          },
        },
        select: { isSubscribed: true },
      })
    : null;
  const notificationsSubscribed = notificationPreference?.isSubscribed !== false;

  if (query && !isMember) {
    redirect(`/groups/${encodeURIComponent(community.permalinkSlug ?? community.id)}`);
  }

  let initialItems: ReturnType<typeof serializePost>[] = [];
  let initialNextCursor: string | null = null;

  if (canViewPosts) {
    const initialPostRows = await prisma.post.findMany({
      where: {
        communityId: community.id,
        ...(query
          ? {
              OR: [
                { content: { contains: query } },
                { sharedTitle: { contains: query } },
                { sharedDescription: { contains: query } },
                { sharedSource: { contains: query } },
                { author: { name: { contains: query } } },
              ],
            }
          : {}),
        OR: [{ moderationStatus: "visible" }, { authorId: session.userId }],
        hiddenBy: { none: { userId: session.userId } },
      },
      orderBy: [{ createdAt: "desc" }, { id: "desc" }],
      include: buildPostInclude(session.userId),
      take: PAGE_SIZE + 1,
    });

    const hasMore = initialPostRows.length > PAGE_SIZE;
    const pageRows = hasMore ? initialPostRows.slice(0, PAGE_SIZE) : initialPostRows;
    initialItems = pageRows.map((row) => serializePost(row));
    initialNextCursor = hasMore ? pageRows[pageRows.length - 1]?.id ?? null : null;
  }

  const sidebarMemberRows = isMember
    ? await prisma.communityMember.findMany({
        where: { communityId: community.id },
        orderBy: [{ joinedAt: "desc" }],
        select: {
          id: true,
          user: {
            select: {
              id: true,
              slug: true,
              name: true,
              avatarUrl: true,
            },
          },
        },
        take: 20,
      })
    : [];

  const canonicalSlug = community.permalinkSlug ?? community.id;

  return (
    <>
      <Navbar user={user} />
      <div className="mx-auto max-w-5xl gap-4 px-4 py-6 md:grid md:grid-cols-[2fr_1fr]">
        <div className="space-y-4">
          <section className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3">
                <Avatar
                  name={community.name}
                  avatarUrl={community.avatarUrl}
                  sizeClassName="h-12 w-12"
                  textClassName="text-base font-semibold"
                />
                <div>
                  <h1 className="text-lg font-semibold text-slate-900">{community.name}</h1>
                  <p className="mt-1 text-xs text-slate-500">
                    {community.isPrivate ? "Closed" : "Public"} · {community._count.members} members · {community._count.posts} posts
                  </p>
                </div>
              </div>
              <div className="flex flex-col items-end gap-2">
                <GroupJoinButton
                  groupIdOrSlug={canonicalSlug}
                  initiallyMember={isMember}
                  isPrivate={community.isPrivate}
                  initiallyInvited={hasPendingInvite}
                />
                {isMember && (
                  <GroupNotificationToggle
                    groupIdOrSlug={canonicalSlug}
                    initiallySubscribed={notificationsSubscribed}
                  />
                )}
              </div>
            </div>
            {community.description && (
              <p className="mt-3 whitespace-pre-wrap text-sm text-slate-700">{community.description}</p>
            )}
            {isMember ? (
              <form action={`/groups/${encodeURIComponent(canonicalSlug)}`} method="GET" className="mt-4 flex gap-2">
                <QuerySyncSearchInput
                  initialValue={query}
                  placeholder="Search inside group"
                  className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm outline-none focus:border-blue-500"
                />
                <button
                  type="submit"
                  className="rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700"
                >
                  Search
                </button>
              </form>
            ) : community.isPrivate ? (
              <p className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                This group is closed. You can join only with an invite.
              </p>
            ) : (
              <p className="mt-4 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
                Join to search inside this group.
              </p>
            )}
          </section>

          {isMember && (
            <CreatePostForm
              communityId={community.id}
              returnToPath={`/groups/${encodeURIComponent(canonicalSlug)}`}
            />
          )}

          {canViewPosts ? (
            <GroupPostsInfiniteList
              currentUserId={user.id}
              groupIdOrSlug={canonicalSlug}
              groupId={community.id}
              groupPath={`/groups/${encodeURIComponent(canonicalSlug)}`}
              query={query}
              initialPosts={initialItems}
              initialNextCursor={initialNextCursor}
            />
          ) : (
            <section className="rounded-xl border border-slate-200 bg-white p-6 text-center text-sm text-slate-600">
              Posts are visible after your membership is approved.
            </section>
          )}
        </div>

        <aside className="mt-4 min-w-0 space-y-3 md:mt-0">
          <div className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
            <p>
              Owner:{" "}
              <Link
                href={community.owner.slug ? `/profile/${community.owner.slug}` : `/profile/${community.owner.id}`}
                className="font-medium text-blue-700 hover:underline"
              >
                {community.owner.name}
              </Link>
            </p>
          </div>

          {isMember && (
            <GroupMembersPanel
              members={sidebarMemberRows.map((member) => member.user)}
              totalCount={community._count.members}
            />
          )}
          {isModerator && <GroupJoinRequestsPanel groupIdOrSlug={canonicalSlug} />}
          {isModerator && (
            <GroupAvatarEditor
              groupIdOrSlug={canonicalSlug}
              groupName={community.name}
              avatarUrl={community.avatarUrl}
            />
          )}
          {isModerator && <GroupPermalinkEditor groupIdOrSlug={canonicalSlug} initialSlug={community.permalinkSlug} />}
          {isModerator && <GroupInvitePanel groupIdOrSlug={canonicalSlug} />}
          {isOwner && <GroupDeleteButton groupIdOrSlug={canonicalSlug} groupName={community.name} />}
        </aside>
      </div>
    </>
  );
}
