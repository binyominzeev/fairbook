import Parser from "rss-parser";
import { Prisma } from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { classifyFeedArticlesForViolence } from "@/lib/ai";
import {
  calculatePostScore,
  hashFeedValue,
  normalizeUrl,
  recomputePostsForFeedSource,
  refreshVisibleFeedPosts,
} from "@/lib/feed-ranking";

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

function resolveBatchSize(activeFeedCount: number) {
  if (activeFeedCount <= 0) return 0;

  const configured = Number.parseInt(process.env.RSS_SYNC_BATCH_SIZE ?? "", 10);
  if (Number.isFinite(configured)) {
    return Math.min(4, Math.max(2, configured));
  }

  return Math.min(4, Math.max(2, Math.round(activeFeedCount / 4)));
}

async function fetchFeed(feedSource: {
  rssUrl: string;
  etag: string | null;
  lastModified: string | null;
}) {
  const response = await fetch(feedSource.rssUrl, {
    headers: {
      "User-Agent": "fairbook-rss-bot/1.0",
      Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.1",
      ...(feedSource.etag ? { "If-None-Match": feedSource.etag } : {}),
      ...(feedSource.lastModified ? { "If-Modified-Since": feedSource.lastModified } : {}),
    },
    cache: "no-store",
  });

  return {
    response,
    body: response.status === 304 ? null : await response.text(),
    etag: response.headers.get("etag"),
    lastModified: response.headers.get("last-modified"),
  };
}

async function findExistingImportedPost(params: {
  feedSourceId: string;
  externalId: string;
  urlHash: string | null;
  titleHash: string | null;
}) {
  const duplicateClauses: Prisma.PostWhereInput[] = [];

  if (params.urlHash) {
    duplicateClauses.push({ urlHash: params.urlHash, feedSourceId: { not: null } });
  }

  if (params.titleHash) {
    duplicateClauses.push({ titleHash: params.titleHash, feedSourceId: { not: null } });
  }

  return prisma.post.findFirst({
    where: {
      OR: [
        {
          feedSourceId: params.feedSourceId,
          externalId: params.externalId,
        },
        ...duplicateClauses,
      ],
    },
    select: { id: true },
  });
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

  const fetchedAt = new Date();

  let fetchedFeed;
  try {
    fetchedFeed = await fetchFeed(feedSource);
  } catch {
    await prisma.feedSource.update({
      where: { id: feedSource.id },
      data: {
        lastFetchedAt: fetchedAt,
        fetchErrorCount: { increment: 1 },
      },
    });
    throw new Error("Could not fetch feed.");
  }

  if (fetchedFeed.response.status === 304) {
    await prisma.feedSource.update({
      where: { id: feedSource.id },
      data: {
        etag: fetchedFeed.etag ?? feedSource.etag,
        lastModified: fetchedFeed.lastModified ?? feedSource.lastModified,
        lastFetchedAt: fetchedAt,
        lastSuccessAt: fetchedAt,
        fetchErrorCount: 0,
        lastStatusCode: 304,
      },
    });

    return { importedCount: 0, skippedCount: 0, notModified: true };
  }

  if (!fetchedFeed.response.ok || !fetchedFeed.body) {
    await prisma.feedSource.update({
      where: { id: feedSource.id },
      data: {
        lastFetchedAt: fetchedAt,
        fetchErrorCount: { increment: 1 },
        lastStatusCode: fetchedFeed.response.status,
      },
    });
    throw new Error(`Feed fetch failed with status ${fetchedFeed.response.status}.`);
  }

  const feed = await parser.parseString(fetchedFeed.body);
  const items = (feed.items ?? []).slice(0, 25);
  let importedCount = 0;
  let skippedCount = 0;
  const pendingPosts: Array<{
    batchId: string;
    data: {
      authorId: string;
      feedSourceId: string;
      externalId: string;
      urlHash: string | null;
      titleHash: string | null;
      content: string | null;
      sharedUrl: string;
      sharedTitle: string;
      sharedDescription: string | null;
      sharedSource: string;
      sharedImageUrl: string | null;
      createdAt: Date;
      fetchedAt: Date;
      score: number;
      freshnessScore: number;
      sourceScore: number;
      engagementScore: number;
      lastScoredAt: Date;
    };
  }> = [];

  for (const item of items) {
    const externalId = getItemExternalId(item);
    const link = item.link?.trim() || null;

    if (!externalId || !link) {
      continue;
    }

    const normalizedUrl = normalizeUrl(link);
    const titleHash = hashFeedValue(item.title?.trim());
    const existing = await findExistingImportedPost({
      feedSourceId: feedSource.id,
      externalId,
      urlHash: hashFeedValue(normalizedUrl),
      titleHash,
    });

    if (existing) {
      skippedCount += 1;
      continue;
    }

    const meta = await fetchUrlMetadata(link);
    const description =
      stripHtml(item.contentSnippet) ??
      stripHtml(item.content) ??
      meta.description ??
      null;

    const createdAt = parsePublishedAt(item) ?? fetchedAt;
    const nextScore = calculatePostScore({
      createdAt,
      freshnessDate: fetchedAt,
      sourceWeight: feedSource.sourceWeight,
      commentCount: 0,
    });

    const sharedTitle = item.title?.trim() || meta.title || feedSource.title;
    const sharedSource = feed.title?.trim() || feedSource.title;

    pendingPosts.push({
      batchId: `article-${pendingPosts.length + 1}`,
      data: {
        authorId: feedSource.pageId,
        feedSourceId: feedSource.id,
        externalId,
        urlHash: hashFeedValue(normalizedUrl),
        titleHash,
        content: description,
        sharedUrl: normalizedUrl ?? link,
        sharedTitle,
        sharedDescription: description,
        sharedSource,
        sharedImageUrl: getItemImage(item) ?? meta.imageUrl ?? feedSource.imageUrl,
        createdAt,
        fetchedAt,
        ...nextScore,
        lastScoredAt: fetchedAt,
      },
    });
  }

  const violenceResults = await classifyFeedArticlesForViolence(
    pendingPosts.map((post) => ({
      id: post.batchId,
      title: post.data.sharedTitle,
      description: post.data.sharedDescription,
      source: post.data.sharedSource,
      url: post.data.sharedUrl,
    }))
  );
  const violentIds = new Set(
    violenceResults
      .filter((result) => result.mayContainViolence)
      .map((result) => result.id)
  );

  for (const post of pendingPosts) {
    await prisma.post.create({
      data: {
        ...post.data,
        mayContainViolence: violentIds.has(post.batchId),
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
      etag: fetchedFeed.etag ?? feedSource.etag,
      lastModified: fetchedFeed.lastModified ?? feedSource.lastModified,
      lastFetchedAt: new Date(),
      lastSuccessAt: fetchedAt,
      fetchErrorCount: 0,
      lastStatusCode: fetchedFeed.response.status,
    },
  });

  await recomputePostsForFeedSource(feedSource.id);
  await refreshVisibleFeedPosts();

  return { importedCount, skippedCount, notModified: false };
}

export async function syncFeedBatch() {
  const activeFeeds = await prisma.feedSource.findMany({
    where: { isActive: true },
    orderBy: [{ createdAt: "asc" }, { id: "asc" }],
    select: { id: true },
  });

  if (activeFeeds.length === 0) {
    return {
      processedFeedCount: 0,
      importedCount: 0,
      skippedCount: 0,
      notModifiedCount: 0,
      processedFeedIds: [] as string[],
    };
  }

  const state = await prisma.feedSyncState.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default" },
  });

  const batchSize = Math.min(resolveBatchSize(activeFeeds.length), activeFeeds.length);
  const startIndex = state.nextCursor % activeFeeds.length;
  const selectedFeeds = Array.from({ length: batchSize }, (_, offset) => {
    const index = (startIndex + offset) % activeFeeds.length;
    return activeFeeds[index];
  });

  await prisma.feedSyncState.update({
    where: { id: state.id },
    data: {
      nextCursor: (startIndex + batchSize) % activeFeeds.length,
    },
  });

  let importedCount = 0;
  let skippedCount = 0;
  let notModifiedCount = 0;

  for (const feed of selectedFeeds) {
    try {
      const result = await importFeedPosts(feed.id);
      importedCount += result.importedCount;
      skippedCount += result.skippedCount;
      notModifiedCount += result.notModified ? 1 : 0;
    } catch {
      continue;
    }
  }

  return {
    processedFeedCount: selectedFeeds.length,
    importedCount,
    skippedCount,
    notModifiedCount,
    processedFeedIds: selectedFeeds.map((feed) => feed.id),
  };
}