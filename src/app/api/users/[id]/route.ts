import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getCommentInsightsEnabled, setCommentInsightsEnabled } from "@/lib/app-config";
import { normalizeAndOptimizeAvatarUrl } from "@/lib/avatar-image";
import { prisma } from "@/lib/prisma";
import { claimRequestedUserSlug } from "@/lib/user-slugs";

export async function GET(
  _req: Request,
  ctx: RouteContext<"/api/users/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const user = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      slug: true,
      name: true,
      bio: true,
      avatarUrl: true,
      createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
    },
  });

  if (!user) {
    return Response.json({ error: "User not found." }, { status: 404 });
  }

  const isFollowing = await prisma.connection.findUnique({
    where: { followerId_followingId: { followerId: session.userId, followingId: id } },
  });

  return Response.json({ user, isFollowing: !!isFollowing });
}

export async function PATCH(
  request: Request,
  ctx: RouteContext<"/api/users/[id]">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  if (session.userId !== id) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const isAdmin = isAdminEmail(session.email);
  const shouldUpdateAvatar = Object.hasOwn(body, "avatarUrl");
  const shouldUpdateSlug = Object.hasOwn(body, "slug");
  const hideViolentFeed =
    typeof body.hideViolentFeed === "boolean" ? body.hideViolentFeed : undefined;
  const commentInsightsEnabled =
    isAdmin && typeof body.commentInsightsEnabled === "boolean"
      ? body.commentInsightsEnabled
      : undefined;

  let avatarUrl: string | null | undefined;
  let slug: string | undefined;
  if (shouldUpdateAvatar) {
    try {
      avatarUrl = await normalizeAndOptimizeAvatarUrl(body.avatarUrl);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid avatar." },
        { status: 400 }
      );
    }
  }

  if (shouldUpdateSlug) {
    try {
      slug = await claimRequestedUserSlug(body.slug, id);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid slug." },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(shouldUpdateAvatar ? { avatarUrl } : {}),
      ...(shouldUpdateSlug ? { slug } : {}),
      ...(hideViolentFeed === undefined ? {} : { hideViolentFeed }),
    },
    select: {
      id: true,
      slug: true,
      name: true,
      email: true,
      bio: true,
      avatarUrl: true,
      hideViolentFeed: true,
      createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
    },
  });

  const resolvedCommentInsightsEnabled =
    commentInsightsEnabled === undefined
      ? await getCommentInsightsEnabled()
      : await setCommentInsightsEnabled(commentInsightsEnabled);

  return Response.json({
    user,
    appConfig: {
      commentInsightsEnabled: resolvedCommentInsightsEnabled,
    },
  });
}
