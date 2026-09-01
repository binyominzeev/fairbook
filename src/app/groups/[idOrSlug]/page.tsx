import GroupSettingsEditor from "@/components/GroupSettingsEditor";
import CreatePostForm from "@/components/CreatePostForm";
import GroupDeleteButton from "@/components/GroupDeleteButton";
import GroupAvatarEditor from "@/components/GroupAvatarEditor";
import GroupInvitePanel from "@/components/GroupInvitePanel";
import GroupJoinRequestsPanel from "@/components/GroupJoinRequestsPanel";
import GroupJoinButton from "@/components/GroupJoinButton";
import GroupNotificationToggle from "@/components/GroupNotificationToggle";
import GroupMembersPanel from "@/components/GroupMembersPanel";
import GroupPostsInfiniteList from "@/components/GroupPostsInfiniteList";
import QuerySyncSearchInput from "@/components/QuerySyncSearchInput";
import Navbar from "@/components/Navbar";
import Avatar from "@/components/Avatar";
import AdminDevSidebar from "@/components/AdminDevSidebar";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";
import { normalizeAppLocale, t } from "@/lib/i18n";
import Link from "next/link";
import { redirect } from "next/navigation";

const PAGE_SIZE = 20;

function buildGroupHref(idOrSlug: string, showSettings: boolean, query?: string) {
  const params = new URLSearchParams();
  if (query) {
    params.set("q", query);
  }
  if (showSettings) {
    params.set("settings", "1");
  }
  const queryString = params.toString();
  return `/groups/${encodeURIComponent(idOrSlug)}${queryString ? `?${queryString}` : ""}`;
}

export default async function GroupDetailPage(props: {
  params: Promise<{ idOrSlug: string }>;
  searchParams: Promise<{ q?: string; settings?: string }>;
}) {
  const session = await getSession();
  if (!session) {
    redirect("/login");
  }
  const isAdmin = isAdminEmail(session.email);

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, slug: true, name: true, avatarUrl: true, locale: true },
  });
  if (!user) {
    redirect("/login");
  }
  const locale = normalizeAppLocale(user.locale);

  const { idOrSlug } = await props.params;
  const { q, settings } = await props.searchParams;
  const query = (q ?? "").trim();
  const showSettings = settings === "1";

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
              <div className="flex items-center gap-2">
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
                {isModerator && (
                  <Link
                    href={buildGroupHref(canonicalSlug, !showSettings, query)}
                    aria-label={showSettings ? t(locale, "profile.settingsClose") : t(locale, "profile.settingsOpen")}
                    title={showSettings ? t(locale, "profile.settingsClose") : t(locale, "profile.settingsOpen")}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${
                      showSettings
                        ? "border-slate-300 bg-slate-100 text-slate-900"
                        : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"
                    }`}
                  >
                    <svg
                      aria-hidden="true"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.8"
                      className="h-5 w-5"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M10.325 4.317a1.724 1.724 0 0 1 3.35 0 1.724 1.724 0 0 0 2.573 1.066 1.724 1.724 0 0 1 2.898 1.676 1.724 1.724 0 0 0 .824 2.43 1.724 1.724 0 0 1 0 3.022 1.724 1.724 0 0 0-.824 2.43 1.724 1.724 0 0 1-2.898 1.676 1.724 1.724 0 0 0-2.573 1.066 1.724 1.724 0 0 1-3.35 0 1.724 1.724 0 0 0-2.573-1.066 1.724 1.724 0 0 1-2.898-1.676 1.724 1.724 0 0 0-.824-2.43 1.724 1.724 0 0 1 0-3.022 1.724 1.724 0 0 0 .824-2.43 1.724 1.724 0 0 1 2.898-1.676 1.724 1.724 0 0 0 2.573-1.066Z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                      />
                    </svg>
                  </Link>
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

          {isModerator && showSettings && (
            <>
              <GroupAvatarEditor
                groupIdOrSlug={canonicalSlug}
                groupName={community.name}
                avatarUrl={community.avatarUrl}
              />
              <GroupSettingsEditor
                groupIdOrSlug={canonicalSlug}
                initialSlug={community.permalinkSlug}
                initialDescription={community.description}
                initialIsPrivate={community.isPrivate}
              />
              {isOwner && (
                <GroupDeleteButton
                  groupIdOrSlug={canonicalSlug}
                  groupName={community.name}
                />
              )}
            </>
          )}

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
          {isModerator && <GroupInvitePanel groupIdOrSlug={canonicalSlug} />}
        </aside>
      </div>
      {isAdmin && <AdminDevSidebar />}
    </>
  );
}
