import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { importFeedPosts, previewFeed } from "@/lib/rss";

export async function PATCH(
  request: NextRequest,
  ctx: RouteContext<"/api/feed-sources/[id]">
) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!isAdminEmail(session.email)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const { id } = await ctx.params;
    const body = await request.json();

    const feedSource = await prisma.feedSource.findUnique({
      where: { id },
      include: { page: true },
    });
    if (!feedSource) {
      return Response.json({ error: "Feed source not found." }, { status: 404 });
    }

    const nextRssUrl = body.rssUrl?.trim() || feedSource.rssUrl;
    const nextPreview = body.rssUrl?.trim() ? await previewFeed(nextRssUrl) : null;

    await prisma.user.update({
      where: { id: feedSource.pageId },
      data: {
        name: body.name?.trim() || feedSource.page.name,
        bio: body.bio?.trim() || feedSource.page.bio,
        avatarUrl: body.avatarUrl?.trim() || feedSource.page.avatarUrl,
      },
    });

    const updatedFeedSource = await prisma.feedSource.update({
      where: { id },
      data: {
        rssUrl: nextRssUrl,
        isActive: typeof body.isActive === "boolean" ? body.isActive : feedSource.isActive,
        title: nextPreview?.title || feedSource.title,
        description: nextPreview?.description || feedSource.description,
        siteUrl: nextPreview?.siteUrl || feedSource.siteUrl,
        imageUrl: nextPreview?.imageUrl || feedSource.imageUrl,
      },
    });

    let importedCount = 0;
    if (body.action === "refresh" && updatedFeedSource.isActive) {
      const result = await importFeedPosts(updatedFeedSource.id);
      importedCount = result.importedCount;
    }

    return Response.json({ feedSource: updatedFeedSource, importedCount });
  } catch {
    return Response.json({ error: "Could not update that RSS feed." }, { status: 400 });
  }
}