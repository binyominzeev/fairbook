import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import IconNavLink from "@/components/IconNavLink";
import Navbar from "@/components/Navbar";
import FollowButton from "@/components/FollowButton";
import ProfileActivitySection from "@/components/ProfileActivitySection";
import ProfileAvatarEditor from "@/components/ProfileAvatarEditor";
import ProfileActivityViewModeSelect from "@/components/ProfileActivityViewModeSelect";
import {
  getProfileActivityAccess,
  getProfileCommentsPage,
  getProfileBookmarkedPostsPage,
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
import { Bookmark, EyeOff, Grid2x2, Heart, MessageSquare } from "lucide-react";

export default async function ProfilePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; settings?: string; q?: string }>;
}) {
  const { id } = await props.params;
  const { tab, settings, q } = await props.searchParams;
  const query = q?.trim() ?? "";
  const session = await getSession();
  if (!session) redirect("/login");

  const requestedTab =
    tab === "likes" || tab === "bookmarks" || tab === "comments" || tab === "hidden"
      ? tab
      : "posts";
  const showSettings = settings === "1";

  const currentUser = await prisma.user.findUnique({
    where: { id: session.userId },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      avatarUrl: true,
      hideViolentFeed: true,
      profileActivityViewMode: true,
    },
  });
  if (!currentUser) redirect("/login");
  const isAdmin = isAdminEmail(currentUser.email);
  const commentInsightsEnabled = isAdmin ? await getCommentInsightsEnabled() : true;

  const profileActivityViewMode: ProfileActivityViewMode =
    currentUser.profileActivityViewMode === "reels" ? "reels" : "normal";

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
  if (id !== profileUser.id && id !== profileUser.slug) {
    const params = new URLSearchParams();
    if (tab) params.set("tab", tab);
    if (settings) params.set("settings", settings);
    if (query) params.set("q", query);
    const queryString = params.toString();
    redirect(queryString ? `${canonicalProfilePath}?${queryString}` : canonicalProfilePath);
  }

  const { isOwnProfile, isFollowing, canViewActivity } =
    await getProfileActivityAccess({
      viewerId: session.userId,
      profileId: profileUser.id,
      isPage: profileUser.isPage,
    });
  const canUseHiddenTab = isOwnProfile;
  const canUseBookmarksTab = isOwnProfile;
  const activeTab =
    canViewActivity &&
    requestedTab !== "posts" &&
    (requestedTab !== "hidden" || canUseHiddenTab) &&
    (requestedTab !== "bookmarks" || canUseBookmarksTab)
      ? requestedTab
      : "posts";

  function buildProfileHref(
    nextTab?: "posts" | "likes" | "bookmarks" | "comments" | "hidden",
    nextShowSettings = showSettings
  ) {
    const params = new URLSearchParams();

    const requestedNextTab = nextTab ?? activeTab;
    const resolvedTab =
      canViewActivity &&
      (requestedNextTab !== "hidden" || canUseHiddenTab) &&
      (requestedNextTab !== "bookmarks" || canUseBookmarksTab)
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
    return queryString ? `${canonicalProfilePath}?${queryString}` : canonicalProfilePath;
  }

  const initialPostsPage =
    activeTab === "likes"
      ? await getProfileLikedPostsPage({
          viewerId: session.userId,
          profileId: profileUser.id,
          isOwnProfile,
          canViewActivity,
          query,
        })
      : activeTab === "bookmarks"
        ? await getProfileBookmarkedPostsPage({
            viewerId: session.userId,
            profileId: profileUser.id,
            isOwnProfile,
            query,
          })
      : activeTab === "hidden"
        ? await getProfileHiddenPostsPage({
            viewerId: session.userId,
            profileId: profileUser.id,
            isOwnProfile,
            query,
          })
      : await getProfilePostsPage({
          viewerId: session.userId,
          profileId: profileUser.id,
          isOwnProfile,
          query,
        });
  const initialCommentsPage =
    activeTab === "comments"
      ? await getProfileCommentsPage({
          viewerId: session.userId,
          profileId: profileUser.id,
          isOwnProfile,
          canViewActivity,
          query,
        })
      : { comments: [], nextCursor: null };
  const initialNextCursor =
    activeTab === "comments" ? initialCommentsPage.nextCursor : initialPostsPage.nextCursor;

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
            {isOwnProfile ? (
              <Link
                href={buildProfileHref(activeTab, !showSettings)}
                aria-label={showSettings ? "Beállítások bezárása" : "Beállítások megnyitása"}
                title={showSettings ? "Beállítások bezárása" : "Beállítások megnyitása"}
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
              <FollowButton
                targetUserId={profileUser.id}
                initialIsFollowing={isFollowing}
              />
            )}
          </div>
        </div>

        {canViewActivity ? (
          <>
            {isOwnProfile && showSettings && (
              <ProfileAvatarEditor
                userId={profileUser.id}
                slug={profileUser.slug}
                name={currentUser.name}
                email={currentUser.email}
                avatarUrl={profileUser.avatarUrl}
                hideViolentFeed={currentUser.hideViolentFeed}
                isAdmin={isAdmin}
                commentInsightsEnabled={commentInsightsEnabled}
              />
            )}

            <div className="flex items-start justify-between gap-3 px-1 text-sm">
              <div className="flex flex-wrap items-center gap-2">
                <IconNavLink
                  href={buildProfileHref("posts")}
                  label="Posts"
                  icon={Grid2x2}
                  active={activeTab === "posts"}
                />
                <IconNavLink
                  href={buildProfileHref("likes")}
                  label="Likes"
                  icon={Heart}
                  active={activeTab === "likes"}
                />
                <IconNavLink
                  href={buildProfileHref("comments")}
                  label="Comments"
                  icon={MessageSquare}
                  active={activeTab === "comments"}
                />
                {isOwnProfile && (
                  <IconNavLink
                    href={buildProfileHref("bookmarks")}
                    label="Bookmarks"
                    icon={Bookmark}
                    active={activeTab === "bookmarks"}
                  />
                )}
                {isOwnProfile && (
                  <IconNavLink
                    href={buildProfileHref("hidden")}
                    label="Hidden"
                    icon={EyeOff}
                    active={activeTab === "hidden"}
                  />
                )}
              </div>
              <ProfileActivityViewModeSelect initialMode={profileActivityViewMode} />
            </div>

            {activeTab === "posts" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Posts</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                  query={query}
                />
              </>
            )}

            {activeTab === "likes" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Liked posts</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                  query={query}
                />
              </>
            )}

            {activeTab === "bookmarks" && isOwnProfile && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Bookmarked posts</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                  query={query}
                />
              </>
            )}

            {activeTab === "comments" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Recent comments</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                  query={query}
                />
              </>
            )}

            {activeTab === "hidden" && isOwnProfile && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Hidden posts</h2>
                <ProfileActivitySection
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  profileViewMode={profileActivityViewMode}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                  query={query}
                />
              </>
            )}
          </>
        ) : (
          <>
            <div className="flex items-start justify-between gap-3 px-1">
              <h2 className="text-sm font-semibold text-slate-700">Posts</h2>
              <ProfileActivityViewModeSelect initialMode={profileActivityViewMode} />
            </div>
            <ProfileActivitySection
              profileId={profileUser.id}
              activeTab="posts"
              profileViewMode={profileActivityViewMode}
              initialPosts={initialPostsPage.posts}
              initialComments={initialCommentsPage.comments}
              initialNextCursor={initialNextCursor}
              currentUserId={currentUser.id}
              isOwnProfile={isOwnProfile}
              query={query}
            />
          </>
        )}
      </div>
    </>
  );
}
