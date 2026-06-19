import { getSession } from "@/lib/auth";
import { ensureUniquePostSlug, slugifyPostText } from "@/lib/post-permalink";
import { prisma } from "@/lib/prisma";

export async function PATCH(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }

  const { id } = await ctx.params;
  const post = await prisma.post.findUnique({
    where: { id },
    select: { id: true, authorId: true, permalinkSlug: true },
  });

  if (!post) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  if (post.authorId !== session.userId) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const payload = await req.json().catch(() => ({}));
  const requestedSlugRaw = typeof payload?.slug === "string" ? payload.slug : "";
  const requestedSlug = slugifyPostText(requestedSlugRaw);

  if (!requestedSlug) {
    return Response.json(
      { error: "Permalink slug must contain letters or numbers." },
      { status: 400 }
    );
  }

  const uniqueSlug = await ensureUniquePostSlug(requestedSlug, async (candidate) => {
    const existing = await prisma.post.findFirst({
      where: {
        authorId: session.userId,
        permalinkSlug: candidate,
        NOT: { id: post.id },
      },
      select: { id: true },
    });
    return Boolean(existing);
  });

  const updated = await prisma.post.update({
    where: { id: post.id },
    data: { permalinkSlug: uniqueSlug },
    select: { id: true, permalinkSlug: true },
  });

  return Response.json({
    postId: updated.id,
    permalinkSlug: updated.permalinkSlug,
  });
}
