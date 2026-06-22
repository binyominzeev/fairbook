import { getSession } from "@/lib/auth";
import { redirect, notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import Avatar from "@/components/Avatar";
import Navbar from "@/components/Navbar";
import FollowButton from "@/components/FollowButton";
import ProfileActivitySection from "@/components/ProfileActivitySection";
import ProfileAvatarEditor from "@/components/ProfileAvatarEditor";
import {
  getProfileActivityAccess,
  getProfileCommentsPage,
  getProfileBookmarkedPostsPage,
  getProfileHiddenPostsPage,
  getProfileLikedPostsPage,
  getProfilePostsPage,
} from "@/lib/profile-activity";
import Link from "next/link";
import { buildProfilePath } from "@/lib/profile-path";
import { resolveUserByProfileIdentifier } from "@/lib/user-slugs";

export default async function ProfilePage(props: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tab?: string; settings?: string }>;
}) {
  const { id } = await props.params;
  const { tab, settings } = await props.searchParams;
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
    },
  });
  if (!currentUser) redirect("/login");

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
    const query = params.toString();
    redirect(query ? `${canonicalProfilePath}?${query}` : canonicalProfilePath);
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

    const query = params.toString();
    return query ? `${canonicalProfilePath}?${query}` : canonicalProfilePath;
  }

  const initialPostsPage =
    activeTab === "likes"
      ? await getProfileLikedPostsPage({
          viewerId: session.userId,
          profileId: profileUser.id,
          isOwnProfile,
          canViewActivity,
        })
      : activeTab === "bookmarks"
        ? await getProfileBookmarkedPostsPage({
            viewerId: session.userId,
            profileId: profileUser.id,
            isOwnProfile,
          })
      : activeTab === "hidden"
        ? await getProfileHiddenPostsPage({
            viewerId: session.userId,
            profileId: profileUser.id,
            isOwnProfile,
          })
      : await getProfilePostsPage({
          viewerId: session.userId,
          profileId: profileUser.id,
          isOwnProfile,
        });
  const initialCommentsPage =
    activeTab === "comments"
      ? await getProfileCommentsPage({
          viewerId: session.userId,
          profileId: profileUser.id,
          isOwnProfile,
          canViewActivity,
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
              />
            )}

            <div className="flex items-center gap-2 px-1 text-sm">
              <Link
                href={buildProfileHref("posts")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "posts" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                Posts
              </Link>
              <Link
                href={buildProfileHref("likes")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "likes" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                Likes
              </Link>
              <Link
                href={buildProfileHref("comments")}
                className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "comments" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
              >
                Comments
              </Link>
              {isOwnProfile && (
                <Link
                  href={buildProfileHref("bookmarks")}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "bookmarks" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  Bookmarks
                </Link>
              )}
              {isOwnProfile && (
                <Link
                  href={buildProfileHref("hidden")}
                  className={`rounded-lg px-3 py-1.5 transition-colors ${activeTab === "hidden" ? "bg-slate-100 font-medium text-slate-900" : "text-slate-500 hover:bg-slate-50 hover:text-slate-900"}`}
                >
                  Hidden
                </Link>
              )}
            </div>

            {activeTab === "posts" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Posts</h2>
                <ProfileActivitySection
                  key={`${activeTab}:${initialNextCursor ?? "end"}:${initialPostsPage.posts[0]?.id ?? initialCommentsPage.comments[0]?.id ?? "empty"}`}
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                />
              </>
            )}

            {activeTab === "likes" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Liked posts</h2>
                <ProfileActivitySection
                  key={`${activeTab}:${initialNextCursor ?? "end"}:${initialPostsPage.posts[0]?.id ?? initialCommentsPage.comments[0]?.id ?? "empty"}`}
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                />
              </>
            )}

            {activeTab === "bookmarks" && isOwnProfile && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Bookmarked posts</h2>
                <ProfileActivitySection
                  key={`${activeTab}:${initialNextCursor ?? "end"}:${initialPostsPage.posts[0]?.id ?? initialCommentsPage.comments[0]?.id ?? "empty"}`}
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                />
              </>
            )}

            {activeTab === "comments" && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Recent comments</h2>
                <ProfileActivitySection
                  key={`${activeTab}:${initialNextCursor ?? "end"}:${initialPostsPage.posts[0]?.id ?? initialCommentsPage.comments[0]?.id ?? "empty"}`}
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                />
              </>
            )}

            {activeTab === "hidden" && isOwnProfile && (
              <>
                <h2 className="px-1 text-sm font-semibold text-slate-700">Hidden posts</h2>
                <ProfileActivitySection
                  key={`${activeTab}:${initialNextCursor ?? "end"}:${initialPostsPage.posts[0]?.id ?? initialCommentsPage.comments[0]?.id ?? "empty"}`}
                  profileId={profileUser.id}
                  activeTab={activeTab}
                  initialPosts={initialPostsPage.posts}
                  initialComments={initialCommentsPage.comments}
                  initialNextCursor={initialNextCursor}
                  currentUserId={currentUser.id}
                  isOwnProfile={isOwnProfile}
                />
              </>
            )}
          </>
        ) : (
          <>
            <h2 className="px-1 text-sm font-semibold text-slate-700">Posts</h2>
            <ProfileActivitySection
              key={`${initialNextCursor ?? "end"}:${initialPostsPage.posts[0]?.id ?? "empty"}`}
              profileId={profileUser.id}
              activeTab="posts"
              initialPosts={initialPostsPage.posts}
              initialComments={initialCommentsPage.comments}
              initialNextCursor={initialNextCursor}
              currentUserId={currentUser.id}
              isOwnProfile={isOwnProfile}
            />
          </>
        )}
      </div>
    </>
  );
}
