import { getSession } from "@/lib/auth";
import { notFound, redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import IconNavLink from "@/components/IconNavLink";
import Navbar from "@/components/Navbar";
import PublicNavbar from "@/components/PublicNavbar";
import FollowButton from "@/components/FollowButton";
import ProfileActivitySection from "@/components/ProfileActivitySection";
import ProfileAvatarEditor from "@/components/ProfileAvatarEditor";
import ProfileActivityViewModeSelect from "@/components/ProfileActivityViewModeSelect";
import AdminDevSidebar from "@/components/AdminDevSidebar";
import { buildVisibleCommunityPostWhere } from "@/lib/community-visibility";
import {
  getProfileActivityAccess,
  getProfileCommentsPage,
  getProfileHiddenPostsPage,
  getProfileLikedPostsPage,
  getProfilePostsPage,
  type ProfileActivityViewMode,
} from "@/lib/profile-activity";
import Link from "next/link";
import { buildProfilePath } from "@/lib/profile-path";
import { resolveUserByProfileIdentifier } from "@/lib/user-slugs";
import { isAdminEmail } from "@/lib/admin";
import { getCommentInsightsEnabled } from "@/lib/app-config";
import { EyeOff, Grid2x2, Heart, MessageSquare } from "lucide-react";
import ProfileTopicStrip from "@/components/ProfileTopicStrip";
import { buildProfileTopicPath } from "@/lib/topic-path";
import { getTopicSlugLookupCandidates, normalizeTopicKey } from "@/lib/topics";
import { normalizeAppLocale, t } from "@/lib/i18n";
import { getRequestLocale } from "@/lib/request-locale";

export default async function ProfilePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; settings?: string; q?: string; topic?: string; topicSlug?: string }>;
}) {
  const { id } = await props.params;
  const { tab, settings, q, topic, topicSlug } = await props.searchParams;
  const locale = await getRequestLocale();
  const query = q?.trim() ?? "";
  const requestedTopicId = typeof topic === "string" && topic.trim() ? topic.trim() : null;
  const requestedTopicSlug =
    typeof topicSlug === "string" && topicSlug.trim() ? topicSlug.trim() : null;
  const session = await getSession();
  const viewerId = session?.userId ?? "__guest__";

  const requestedTab =
    tab === "likes" || tab === "comments" || tab === "hidden"
      ? tab
      : "posts";
  const showSettings = settings === "1";

  const currentUser = session
    ? await prisma.user.findUnique({
        where: { id: session.userId },
        select: {
          id: true,
          slug: true,
          name: true,
          email: true,
          avatarUrl: true,
          hideViolentFeed: true,
          profileActivityViewMode: true,
          locale: true,
        },
      })
    : null;
  const isLoggedIn = Boolean(currentUser);
  const isAdmin = currentUser ? isAdminEmail(currentUser.email) : false;
  const commentInsightsEnabled = isAdmin ? await getCommentInsightsEnabled() : true;

  const profileActivityViewMode: ProfileActivityViewMode =
    currentUser?.profileActivityViewMode === "reels" ? "reels" : "normal";

  const profileUser = await resolveUserByProfileIdentifier(id, {
    id: true,
    slug: true,
    name: true,
    bio: true,
    avatarUrl: true,
    isPage: true,
    createdAt: true,
    _count: {
      select: { followers: true, following: true, posts: true },
    },
  });
  if (!profileUser) notFound();

  const canonicalProfilePath = buildProfilePath(profileUser);

  const selectedTopicFromSlug = requestedTopicSlug
    ? await prisma.topic.findFirst({
        where: {
          normalizedName: { in: getTopicSlugLookupCandidates(requestedTopicSlug) },
        },
        select: {
          id: true,
          name: true,
          normalizedName: true,
        },
      })
    : null;
  const selectedTopicFromId =
    !selectedTopicFromSlug && requestedTopicId
      ? await prisma.topic.findUnique({
          where: { id: requestedTopicId },
          select: {
            id: true,
            name: true,
            normalizedName: true,
          },
        })
      : null;
  if (requestedTopicSlug && !selectedTopicFromSlug) {
    notFound();
  }
  const selectedTopic = selectedTopicFromSlug ?? selectedTopicFromId;
  const topicId = selectedTopic?.id ?? null;
  const activeTopicSlug = selectedTopic ? normalizeTopicKey(selectedTopic.name) : null;

  if (id !== profileUser.id && id !== profileUser.slug) {
    const params = new URLSearchParams();
    if (tab) params.set("tab", tab);
    if (settings) params.set("settings", settings);
    if (query) params.set("q", query);
    const queryString = params.toString();
    const basePath = activeTopicSlug
      ? buildProfileTopicPath(canonicalProfilePath, activeTopicSlug)
      : canonicalProfilePath;
    redirect(queryString ? `${basePath}?${queryString}` : basePath);
  }

  const { isOwnProfile, isFollowing, canViewActivity } =
    await getProfileActivityAccess({
      viewerId,
      profileId: profileUser.id,
      isPage: profileUser.isPage,
    });
  if (isOwnProfile && tab === "bookmarks") {
    const params = new URLSearchParams();
    params.set("mode", "bookmarks");
    if (query) {
      params.set("q", query);
    }
    if (topicId) {
      params.set("topic", topicId);
    }

    const queryString = params.toString();
    redirect(queryString ? `/feed?${queryString}` : "/feed?mode=bookmarks");
  }

  const visiblePostCount = isOwnProfile
    ? profileUser._count.posts
    : await prisma.post.count({
        where: {
          authorId: profileUser.id,
          moderationStatus: "visible",
          ...buildVisibleCommunityPostWhere(viewerId),
        },
      });
  const canUseHiddenTab = isOwnProfile;
  const activeTab =
    canViewActivity &&
    requestedTab !== "posts" &&
    (requestedTab !== "hidden" || canUseHiddenTab)
      ? requestedTab
      : "posts";

  function buildProfileHref(
    nextTab?: "posts" | "likes" | "comments" | "hidden",
    nextShowSettings = showSettings,
    nextTopicId: string | null = topicId
  ) {
    const params = new URLSearchParams();

    const requestedNextTab = nextTab ?? activeTab;
    const resolvedTab =
      canViewActivity &&
      (requestedNextTab !== "hidden" || canUseHiddenTab)
        ? requestedNextTab
        : "posts";

    if (resolvedTab !== "posts") {
      params.set("tab", resolvedTab);
    }

    if (nextShowSettings) {
      params.set("settings", "1");
    }

    if (query) {
      params.set("q", query);
    }

    const queryString = params.toString();
    if (!nextTopicId) {
      return queryString ? `${canonicalProfilePath}?${queryString}` : canonicalProfilePath;
    }

    const topicForHref = profileTopicsById.get(nextTopicId);
    if (!topicForHref) {
      return queryString ? `${canonicalProfilePath}?${queryString}` : canonicalProfilePath;
    }

    const topicPath = buildProfileTopicPath(canonicalProfilePath, topicForHref.slug);
    return queryString ? `${topicPath}?${queryString}` : topicPath;
  }

  const initialPostsPage =
    activeTab === "likes"
      ? await getProfileLikedPostsPage({
          viewerId,
          profileId: profileUser.id,
          isOwnProfile,
          canViewActivity,
          query,
          topicId,
        })
      : activeTab === "hidden"
        ? await getProfileHiddenPostsPage({
          viewerId,
            profileId: profileUser.id,
            isOwnProfile,
            query,
            topicId,
          })
      : await getProfilePostsPage({
          viewerId,
          profileId: profileUser.id,
          isOwnProfile,
          query,
          topicId,
        });
  const initialCommentsPage =
    activeTab === "comments"
      ? await getProfileCommentsPage({
          viewerId,
          profileId: profileUser.id,
          isOwnProfile,
          canViewActivity,
          query,
          topicId,
        })
      : { comments: [], nextCursor: null };

  const topicUsage = await prisma.post.groupBy({
    by: ["topicId"],
    where: {
      authorId: profileUser.id,
      topicId: { not: null },
      ...(isOwnProfile ? {} : { moderationStatus: "visible" }),
      ...(isOwnProfile ? {} : buildVisibleCommunityPostWhere(viewerId)),
    },
    _count: { _all: true },
    orderBy: { _count: { topicId: "desc" } },
  });
  const profileTopicIds = topicUsage
    .map((row) => row.topicId)
    .filter((value): value is string => typeof value === "string");
  const [topicRows, topicPreferences] = await Promise.all([
    profileTopicIds.length
      ? prisma.topic.findMany({
          where: { id: { in: profileTopicIds } },
          select: { id: true, name: true, normalizedName: true, defaultColor: true },
        })
      : Promise.resolve([]),
    profileTopicIds.length
      ? prisma.userTopicPreference.findMany({
          where: {
            userId: profileUser.id,
            topicId: { in: profileTopicIds },
          },
          select: {
            topicId: true,
            buttonColor: true,
          },
        })
      : Promise.resolve([]),
  ]);
  const topicById = new Map(topicRows.map((row) => [row.id, row]));
  const preferenceByTopicId = new Map(topicPreferences.map((row) => [row.topicId, row.buttonColor]));
  const profileTopics = topicUsage
    .map((usage) => {
      if (!usage.topicId) return null;
      const topicRow = topicById.get(usage.topicId);
      if (!topicRow) return null;

      return {
        id: topicRow.id,
        name: topicRow.name,
        slug: normalizeTopicKey(topicRow.name),
        postCount: usage._count._all,
        defaultColor: topicRow.defaultColor,
        buttonColor: preferenceByTopicId.get(topicRow.id) ?? null,
      };
    })
    .filter((value): value is { id: string; name: string; slug: string; postCount: number; defaultColor: string; buttonColor: string | null } => Boolean(value));
  const profileTopicsById = new Map(profileTopics.map((topic) => [topic.id, topic]));
  const initialNextCursor =
    activeTab === "comments" ? initialCommentsPage.nextCursor : initialPostsPage.nextCursor;

  return (
    <>
      {currentUser ? <Navbar user={currentUser} /> : <PublicNavbar />}
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
                    {t(locale, "profile.pageBadge")}
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
                      {visiblePostCount}
                    </strong>{" "}
                    {t(locale, "profile.stats.posts")}
                  </span>
                  {isOwnProfile ? (
                    <Link href="/connections?tab=followers" className="hover:text-slate-700">
                      <strong className="text-slate-900">
                        {profileUser._count.followers}
                      </strong>{" "}
                      {t(locale, "profile.stats.followers")}
                    </Link>
                  ) : (
                    <span>
                      <strong className="text-slate-900">
                        {profileUser._count.followers}
                      </strong>{" "}
                      {t(locale, "profile.stats.followers")}
                    </span>
                  )}
                  {isOwnProfile ? (
                    <Link href="/connections?tab=following" className="hover:text-slate-700">
                      <strong className="text-slate-900">
                        {profileUser._count.following}
                      </strong>{" "}
                      {t(locale, "profile.stats.following")}
                    </Link>
                  ) : (
                    <span>
                      <strong className="text-slate-900">
                        {profileUser._count.following}
                      </strong>{" "}
                      {t(locale, "profile.stats.following")}
                    </span>
                  )}
                </div>
              </div>
            </div>
            {isOwnProfile && currentUser ? (
              <Link
                href={buildProfileHref(activeTab, !showSettings)}
                aria-label={showSettings ? t(locale, "profile.settingsClose") : t(locale, "profile.settingsOpen")}
                title={showSettings ? t(locale, "profile.settingsClose") : t(locale, "profile.settingsOpen")}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition-colors ${showSettings ? "border-slate-300 bg-slate-100 text-slate-900" : "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900"}`}
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
            ) : (
              <>
                {currentUser ? (
                  <FollowButton
                    targetUserId={profileUser.id}
                    initialIsFollowing={isFollowing}
                  />
                ) : (
                  <Link
                    href="/login?mode=register"
                    className="inline-flex rounded-full bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700"
                  >
                    {t(locale, "profile.registerToFollow")}
                  </Link>
                )}
              </>
            )}
          </div>
        </div>

        {profileTopics.length > 0 ? (
          <ProfileTopicStrip
            topics={profileTopics}
            profilePath={canonicalProfilePath}
            activeTab={activeTab}
            showSettings={showSettings}
            query={query}
            activeTopicId={topicId}
            isOwnProfile={isOwnProfile}
          />
        ) : null}

        {canViewActivity ? (
          <>
            {isOwnProfile && showSettings && currentUser && (
              <ProfileAvatarEditor
                userId={profileUser.id}
                slug={profileUser.slug}
                name={currentUser.name}
                email={currentUser.email}
                avatarUrl={profileUser.avatarUrl}
                hideViolentFeed={currentUser.hideViolentFeed}
                localePreference={normalizeAppLocale(currentUser.locale)}
                isAdmin={isAdmin}
                commentInsightsEnabled={commentInsightsEnabled}
              />
            )}

            <div className="flex items-start justify-between gap-3 px-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <IconNavLink
                  href={buildProfileHref("posts")}
                  label={t(locale, "profile.tab.posts")}
                  icon={Grid2x2}
                  active={activeTab === "posts"}
                />
                <IconNavLink
                  href={buildProfileHref("likes")}
                  label={t(locale, "profile.tab.likes")}
                  icon={Heart}
                  active={activeTab === "likes"}
                />
                <IconNavLink
                  href={buildProfileHref("comments")}
                  label={t(locale, "profile.tab.comments")}
                  icon={MessageSquare}
                  active={activeTab === "comments"}
                />
                {isOwnProfile && (
                  <IconNavLink
                    href={buildProfileHref("hidden")}
                    label={t(locale, "profile.tab.hidden")}
                    icon={EyeOff}
                    active={activeTab === "hidden"}
                  />
                )}
              </div>
              {isOwnProfile && currentUser ? (
                <ProfileActivityViewModeSelect initialMode={profileActivityViewMode} />
              ) : null}
            </div>

            {activeTab === "posts" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">{t(locale, "profile.heading.posts")}</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser?.id ?? ""}
                  isOwnProfile={isOwnProfile}
                  requireAuthForInteractions={!isLoggedIn}
                  query={query}
                  topicId={topicId}
                  topicBaseProfilePath={canonicalProfilePath}
                />
              </>
            )}

            {activeTab === "likes" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">{t(locale, "profile.heading.likedPosts")}</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser?.id ?? ""}
                  isOwnProfile={isOwnProfile}
                  requireAuthForInteractions={!isLoggedIn}
                  query={query}
                  topicId={topicId}
                  topicBaseProfilePath={canonicalProfilePath}
                />
              </>
            )}

            {activeTab === "comments" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">{t(locale, "profile.heading.recentComments")}</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser?.id ?? ""}
                  isOwnProfile={isOwnProfile}
                  requireAuthForInteractions={!isLoggedIn}
                  query={query}
                  topicId={topicId}
                  topicBaseProfilePath={canonicalProfilePath}
                />
              </>
            )}

            {activeTab === "hidden" && isOwnProfile && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">{t(locale, "profile.heading.hiddenPosts")}</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser?.id ?? ""}
                  isOwnProfile={isOwnProfile}
                  requireAuthForInteractions={!isLoggedIn}
                  query={query}
                  topicId={topicId}
                  topicBaseProfilePath={canonicalProfilePath}
                />
              </>
            )}
          </>
        ) : (
          <>
            <div className="px-1">
              <h2 className="text-sm font-semibold text-slate-700">{t(locale, "profile.heading.posts")}</h2>
            </div>
            <ProfileActivitySection
              profileId={profileUser.id}
              activeTab="posts"
              profileViewMode={profileActivityViewMode}
              initialPosts={initialPostsPage.posts}
              initialComments={initialCommentsPage.comments}
              initialNextCursor={initialNextCursor}
              currentUserId={currentUser?.id ?? ""}
              isOwnProfile={isOwnProfile}
              requireAuthForInteractions={!isLoggedIn}
              query={query}
              topicId={topicId}
              topicBaseProfilePath={canonicalProfilePath}
            />
          </>
        )}
      </div>
      {isAdmin && <AdminDevSidebar />}
    </>
  );
}
