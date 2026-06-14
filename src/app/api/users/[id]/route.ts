import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

function normalizeAvatarUrl(value: unknown) {
  if (typeof value !== "string") return null;

  const trimmed = value.trim();
  if (!trimmed) return null;

  if (/^data:image\/(png|jpeg|jpg|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(trimmed)) {
    if (trimmed.length > 1_500_000) {
      throw new Error("Avatar image is too large.");
    }
    return trimmed;
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("Avatar must be a valid image URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Avatar must use http or https.");
  }

  return parsedUrl.toString();
}

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
  const shouldUpdateAvatar = Object.hasOwn(body, "avatarUrl");
  const hideViolentFeed =
    typeof body.hideViolentFeed === "boolean" ? body.hideViolentFeed : undefined;

  let avatarUrl: string | null | undefined;
  if (shouldUpdateAvatar) {
    try {
      avatarUrl = normalizeAvatarUrl(body.avatarUrl);
    } catch (error) {
      return Response.json(
        { error: error instanceof Error ? error.message : "Invalid avatar." },
        { status: 400 }
      );
    }
  }

  const user = await prisma.user.update({
    where: { id },
    data: {
      ...(shouldUpdateAvatar ? { avatarUrl } : {}),
      ...(hideViolentFeed === undefined ? {} : { hideViolentFeed }),
    },
    select: {
      id: true,
      name: true,
      email: true,
      bio: true,
      avatarUrl: true,
      hideViolentFeed: true,
      createdAt: true,
      _count: { select: { followers: true, following: true, posts: true } },
    },
  });

  return Response.json({ user });
}
