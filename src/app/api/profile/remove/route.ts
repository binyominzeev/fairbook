import bcrypt from "bcryptjs";
import { Prisma } from "@/generated/prisma/client";
import { getSession } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

const CONFIRMATION_TEXT = "TORLOM";

function expiredSessionCookie() {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  return `fairbook_token=; HttpOnly; Path=/; Max-Age=0; SameSite=lax${secure}`;
}

async function deleteSingleUserData(
  tx: Prisma.TransactionClient,
  userId: string,
  visitedUserIds = new Set<string>()
) {
  if (visitedUserIds.has(userId)) {
    return;
  }
  visitedUserIds.add(userId);

  const managedPages = await tx.user.findMany({
    where: { managedById: userId },
    select: { id: true },
  });

  for (const page of managedPages) {
    await deleteSingleUserData(tx, page.id, visitedUserIds);
  }

  const ownedCommunities = await tx.community.findMany({
    where: { ownerId: userId },
    select: { id: true },
  });
  const ownedCommunityIds = ownedCommunities.map((community) => community.id);

  if (ownedCommunityIds.length > 0) {
    await tx.post.updateMany({
      where: { communityId: { in: ownedCommunityIds } },
      data: { communityId: null },
    });
    await tx.communityMember.deleteMany({
      where: { communityId: { in: ownedCommunityIds } },
    });
    await tx.community.deleteMany({
      where: { id: { in: ownedCommunityIds } },
    });
  }

  await tx.commentAnalysis.deleteMany({
    where: {
      OR: [{ comment: { authorId: userId } }, { comment: { post: { authorId: userId } } }],
    },
  });

  await tx.steelmanRequest.deleteMany({
    where: {
      OR: [{ requesterId: userId }, { targetId: userId }, { post: { authorId: userId } }],
    },
  });

  await tx.postLike.deleteMany({
    where: {
      OR: [{ userId }, { post: { authorId: userId } }],
    },
  });

  await tx.hiddenPost.deleteMany({
    where: {
      OR: [{ userId }, { post: { authorId: userId } }],
    },
  });

  await tx.threadReflection.deleteMany({
    where: { post: { authorId: userId } },
  });

  await tx.postTag.deleteMany({
    where: { post: { authorId: userId } },
  });

  await tx.comment.updateMany({
    where: { parent: { authorId: userId } },
    data: { parentId: null },
  });

  await tx.comment.deleteMany({
    where: {
      OR: [{ authorId: userId }, { post: { authorId: userId } }],
    },
  });

  await tx.post.deleteMany({
    where: { authorId: userId },
  });

  await tx.feedSource.deleteMany({
    where: { pageId: userId },
  });

  await tx.communityMember.deleteMany({
    where: { userId },
  });

  await tx.connection.deleteMany({
    where: {
      OR: [{ followerId: userId }, { followingId: userId }],
    },
  });

  await tx.user.updateMany({
    where: { managedById: userId },
    data: { managedById: null },
  });

  await tx.user.delete({
    where: { id: userId },
  });
}

export async function POST(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { id: true, passwordHash: true },
  });
  if (!user) {
    const response = Response.json({ error: "Not authenticated." }, { status: 401 });
    response.headers.append("Set-Cookie", expiredSessionCookie());
    return response;
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: "Invalid request body." }, { status: 400 });
  }

  const password =
    typeof body === "object" && body !== null && "password" in body
      ? (body as { password?: unknown }).password
      : undefined;
  const confirmation =
    typeof body === "object" && body !== null && "confirmation" in body
      ? (body as { confirmation?: unknown }).confirmation
      : undefined;

  if (typeof password !== "string" || password.trim().length === 0) {
    return Response.json({ error: "Password is required." }, { status: 400 });
  }

  if (
    typeof confirmation !== "string" ||
    confirmation.trim().toUpperCase() !== CONFIRMATION_TEXT
  ) {
    return Response.json(
      { error: `Type ${CONFIRMATION_TEXT} to confirm deletion.` },
      { status: 400 }
    );
  }

  const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
  if (!isPasswordValid) {
    return Response.json({ error: "Invalid password." }, { status: 403 });
  }

  await prisma.$transaction(async (tx) => {
    await deleteSingleUserData(tx, user.id);
  });

  const response = Response.json({ success: true });
  response.headers.append("Set-Cookie", expiredSessionCookie());
  return response;
}