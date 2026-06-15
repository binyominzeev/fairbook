import { randomUUID } from "crypto";
import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";
import { importFeedPosts, previewFeed } from "@/lib/rss";
import { claimRequestedUserSlug, generateUniqueUserSlug } from "@/lib/user-slugs";

export async function POST(request: NextRequest) {
  try {
    const session = await getSession();
    if (!session) {
      return Response.json({ error: "Not authenticated." }, { status: 401 });
    }
    if (!isAdminEmail(session.email)) {
      return Response.json({ error: "Forbidden." }, { status: 403 });
    }

    const { rssUrl, name, bio, avatarUrl, sourceWeight, slug } = await request.json();
    if (!rssUrl?.trim()) {
      return Response.json({ error: "RSS URL is required." }, { status: 400 });
    }

    const existing = await prisma.feedSource.findUnique({
      where: { rssUrl: rssUrl.trim() },
      select: { id: true },
    });
    if (existing) {
      return Response.json({ error: "That feed is already connected." }, { status: 409 });
    }

    const adminUser = await prisma.user.findUnique({ where: { id: session.userId } });
    if (!adminUser) {
      return Response.json({ error: "Admin user not found." }, { status: 404 });
    }

    const preview = await previewFeed(rssUrl.trim());
    const pageName = name?.trim() || preview.title;
    const pageSlug = slug ? await claimRequestedUserSlug(slug) : await generateUniqueUserSlug(pageName);

    const page = await prisma.user.create({
      data: {
        name: pageName,
        slug: pageSlug,
        email: `page+${randomUUID()}@fairbook.local`,
        passwordHash: "!page-account!",
        bio: bio?.trim() || preview.description,
        avatarUrl: avatarUrl?.trim() || preview.imageUrl,
        isPage: true,
        managedById: adminUser.id,
      },
    });

    const feedSource = await prisma.feedSource.create({
      data: {
        pageId: page.id,
        rssUrl: rssUrl.trim(),
        title: preview.title,
        description: preview.description,
        siteUrl: preview.siteUrl,
        imageUrl: preview.imageUrl,
        sourceWeight:
          typeof sourceWeight === "number" && Number.isFinite(sourceWeight)
            ? Math.max(0.25, Math.min(5, sourceWeight))
            : 1,
      },
    });

    const { importedCount } = await importFeedPosts(feedSource.id);

    return Response.json({ page, feedSource, importedCount }, { status: 201 });
  } catch {
    return Response.json({ error: "Could not fetch or import that RSS feed." }, { status: 400 });
  }
}