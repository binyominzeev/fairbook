import Parser from "rss-parser";
import { prisma } from "@/lib/prisma";

type ParsedFeed = {
  title?: string;
  description?: string;
  link?: string;
  image?: {
    url?: string;
    title?: string;
  };
  items?: ParsedItem[];
};

type ParsedItem = {
  title?: string;
  link?: string;
  guid?: string;
  isoDate?: string;
  pubDate?: string;
  content?: string;
  contentSnippet?: string;
  creator?: string;
  enclosure?: { url?: string };
  "media:content"?: Array<{ $?: { url?: string } }>;
  "media:thumbnail"?: Array<{ $?: { url?: string } }>;
  "itunes:image"?: { $?: { href?: string } };
};

const parser = new Parser<ParsedFeed, ParsedItem>({
  customFields: {
    item: [
      ["media:content", "media:content", { keepArray: true }],
      ["media:thumbnail", "media:thumbnail", { keepArray: true }],
      ["itunes:image", "itunes:image"],
    ],
  },
});

type UrlMetadata = {
  title?: string | null;
  description?: string | null;
  imageUrl?: string | null;
};

function stripHtml(input: string | null | undefined) {
  if (!input) return null;
  return input.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim() || null;
}

function extractMetaTag(html: string, property: string) {
  const patterns = [
    new RegExp(`<meta[^>]+property=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+property=["']${property}["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+name=["']${property}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+name=["']${property}["'][^>]*>`, "i"),
  ];

  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return match[1].trim();
  }

  return null;
}

function extractTitleTag(html: string) {
  const match = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  return match?.[1]?.trim() ?? null;
}

async function fetchUrlMetadata(url: string): Promise<UrlMetadata> {
  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "fairbook-rss-bot/1.0",
        Accept: "text/html,application/xhtml+xml",
      },
      cache: "no-store",
    });
    if (!response.ok) return {};

    const html = await response.text();
    const title =
      extractMetaTag(html, "og:title") ??
      extractMetaTag(html, "twitter:title") ??
      extractTitleTag(html);
    const description =
      extractMetaTag(html, "og:description") ??
      extractMetaTag(html, "description") ??
      extractMetaTag(html, "twitter:description");
    const imageUrl =
      extractMetaTag(html, "og:image") ??
      extractMetaTag(html, "twitter:image");

    return { title, description, imageUrl };
  } catch {
    return {};
  }
}

function getItemImage(item: ParsedItem) {
  return (
    item.enclosure?.url ??
    item["media:content"]?.[0]?.$?.url ??
    item["media:thumbnail"]?.[0]?.$?.url ??
    item["itunes:image"]?.$?.href ??
    null
  );
}

function getItemExternalId(item: ParsedItem) {
  const fallback = [item.title, item.pubDate].filter(Boolean).join("::");
  return item.guid ?? item.link ?? (fallback || null);
}

function parsePublishedAt(item: ParsedItem) {
  const value = item.isoDate ?? item.pubDate;
  if (!value) return undefined;
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

export async function previewFeed(rssUrl: string) {
  const feed = await parser.parseURL(rssUrl);
  return {
    title: feed.title?.trim() || rssUrl,
    description: feed.description?.trim() || null,
    siteUrl: feed.link?.trim() || null,
    imageUrl: feed.image?.url?.trim() || null,
  };
}

export async function importFeedPosts(feedSourceId: string) {
  const feedSource = await prisma.feedSource.findUnique({
    where: { id: feedSourceId },
    include: { page: true },
  });

  if (!feedSource) {
    throw new Error("Feed source not found.");
  }

  const feed = await parser.parseURL(feedSource.rssUrl);
  const items = (feed.items ?? []).slice(0, 25);
  let importedCount = 0;

  for (const item of items) {
    const externalId = getItemExternalId(item);
    const link = item.link?.trim() || null;

    if (!externalId || !link) {
      continue;
    }

    const existing = await prisma.post.findUnique({
      where: {
        feedSourceId_externalId: {
          feedSourceId: feedSource.id,
          externalId,
        },
      },
      select: { id: true },
    });

    if (existing) {
      continue;
    }

    const meta = await fetchUrlMetadata(link);
    const description =
      stripHtml(item.contentSnippet) ??
      stripHtml(item.content) ??
      meta.description ??
      null;

    await prisma.post.create({
      data: {
        authorId: feedSource.pageId,
        feedSourceId: feedSource.id,
        externalId,
        content: description,
        sharedUrl: link,
        sharedTitle: item.title?.trim() || meta.title || feedSource.title,
        sharedDescription: description,
        sharedSource: feed.title?.trim() || feedSource.title,
        sharedImageUrl: getItemImage(item) ?? meta.imageUrl ?? feedSource.imageUrl,
        createdAt: parsePublishedAt(item),
      },
    });
    importedCount += 1;
  }

  await prisma.feedSource.update({
    where: { id: feedSource.id },
    data: {
      title: feed.title?.trim() || feedSource.title,
      description: feed.description?.trim() || feedSource.description,
      siteUrl: feed.link?.trim() || feedSource.siteUrl,
      imageUrl: feed.image?.url?.trim() || feedSource.imageUrl,
      lastFetchedAt: new Date(),
    },
  });

  return { importedCount };
}