import { getSession } from "@/lib/auth";
import {
  getProfileActivityAccess,
  getProfileCommentsPage,
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
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const { searchParams } = new URL(request.url);
  const tab = searchParams.get("tab");
  const cursor = searchParams.get("cursor");

  const activeTab: ProfileActivityTab =
    tab === "likes" || tab === "comments" || tab === "hidden" ? tab : "posts";

  const profileUser = await prisma.user.findUnique({
    where: { id },
    select: { id: true, isPage: true },
  });

  if (!profileUser) {
    return Response.json({ error: "Profile not found." }, { status: 404 });
  }

  const access = await getProfileActivityAccess({
    viewerId: session.userId,
    profileId: id,
    isPage: profileUser.isPage,
  });

  if (activeTab === "comments") {
    const page = await getProfileCommentsPage({
      viewerId: session.userId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      canViewActivity: access.canViewActivity,
      cursor,
    });

    return Response.json({ items: page.comments, nextCursor: page.nextCursor });
  }

  if (activeTab === "likes") {
    const page = await getProfileLikedPostsPage({
      viewerId: session.userId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      canViewActivity: access.canViewActivity,
      cursor,
    });

    return Response.json({ items: page.posts, nextCursor: page.nextCursor });
  }

  if (activeTab === "hidden") {
    const page = await getProfileHiddenPostsPage({
      viewerId: session.userId,
      profileId: id,
      isOwnProfile: access.isOwnProfile,
      cursor,
    });

    return Response.json({ items: page.posts, nextCursor: page.nextCursor });
  }

  const page = await getProfilePostsPage({
    viewerId: session.userId,
    profileId: id,
    isOwnProfile: access.isOwnProfile,
    cursor,
  });

  return Response.json({ items: page.posts, nextCursor: page.nextCursor });
}