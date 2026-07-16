import { getSession } from "@/lib/auth";
import {
  getProfileActivityAccess,
  getProfileCommentsPage,
  getProfileBookmarkedPostsPage,
  getProfileHiddenPostsPage,
  getProfileLikedPostsPage,
  getProfilePostsPage,
  type ProfileActivityTab,
} from "@/lib/profile-activity";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: Request,
  ctx: RouteContext<"/api/users/[id]/activity">
) {
  const session = await getSession();
  const viewerId = session?.userId ?? "__guest__";

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");
  const cursor = searchParams.get("cursor");
  const query = (searchParams.get("q") ?? "").trim();

  const activeTab: ProfileActivityTab =
    tab === "likes" || tab === "bookmarks" || tab === "comments" || tab === "hidden"
      ? tab
      : "posts";

  if (!session && activeTab !== "posts") {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const profileUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isPage: true },
  });

  if (!profileUser) {
    return Response.json({ error: "Profile not found." }, { status: 404 });
  }

  const access = await getProfileActivityAccess({
    viewerId,
    profileId: id,
    isPage: profileUser.isPage,
  });

  if (activeTab === "comments") {
    const page = await getProfileCommentsPage({
      viewerId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      canViewActivity: access.canViewActivity,
      cursor,
      query,
    });

    return Response.json({ items: page.comments, nextCursor: page.nextCursor });
  }

  if (activeTab === "likes") {
    const page = await getProfileLikedPostsPage({
      viewerId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      canViewActivity: access.canViewActivity,
      cursor,
      query,
    });

    return Response.json({ items: page.posts, nextCursor: page.nextCursor });
  }

  if (activeTab === "hidden") {
    const page = await getProfileHiddenPostsPage({
      viewerId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      cursor,
      query,
    });

    return Response.json({ items: page.posts, nextCursor: page.nextCursor });
  }

  if (activeTab === "bookmarks") {
    const page = await getProfileBookmarkedPostsPage({
      viewerId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      cursor,
      query,
    });

    return Response.json({ items: page.posts, nextCursor: page.nextCursor });
  }

  const page = await getProfilePostsPage({
    viewerId,
    profileId: id,
    isOwnProfile: access.isOwnProfile,
    cursor,
    query,
  });

  return Response.json({ items: page.posts, nextCursor: page.nextCursor });
}