import type { Metadata } from "next";

type PostMetadataInput = {
  canonicalPath: string;
  isVisible: boolean;
  isUserGenerated: boolean;
  post: {
    sharedTitle: string | null;
    sharedDescription: string | null;
    content: string | null;
    imageUrls: string | null;
    sharedImageUrl: string | null;
    isTextCard: boolean;
    createdAt: Date;
    author: {
      name: string;
    };
  };
};

function getBaseUrl(): string {
  const configured = process.env.APP_BASE_URL?.trim();
  if (configured) {
    return configured.replace(/\/$/, "");
  }
  return process.env.NODE_ENV === "production"
    ? "https://fairbook.hu"
    : "http://localhost:3000";
}

function toAbsoluteUrl(value: string): string {
  if (/^https?:\/\//i.test(value)) {
    return value;
  }

  const baseUrl = getBaseUrl();
  const normalizedPath = value.startsWith("/") ? value : `/${value}`;
  return `${baseUrl}${normalizedPath}`;
}

function parseImageUrls(value: string | null): string[] {
  if (!value) return [];

  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((item): item is string => typeof item === "string" && item.trim().length > 0);
  } catch {
    return [];
  }
}

function normalizeText(value: string | null | undefined): string {
  if (!value) return "";
  return value.replace(/\s+/g, " ").trim();
}

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pickPreviewImage(post: PostMetadataInput["post"]): string | null {
  const parsedImages = parseImageUrls(post.imageUrls);
  if (post.isTextCard && parsedImages.length > 0) {
    return parsedImages[0];
  }

  if (parsedImages.length > 0) {
    return parsedImages[0];
  }

  const sharedImage = normalizeText(post.sharedImageUrl);
  return sharedImage || null;
}

export function buildPostPermalinkMetadata(input: PostMetadataInput): Metadata {
  const canonicalUrl = toAbsoluteUrl(input.canonicalPath);

  if (!input.isVisible || !input.isUserGenerated) {
    return {
      title: "fairbook",
      alternates: { canonical: canonicalUrl },
      robots: { index: false, follow: false },
    };
  }

  const normalizedTitleCandidate =
    normalizeText(input.post.sharedTitle) ||
    normalizeText(input.post.content) ||
    `${input.post.author.name} on fairbook`;
  const normalizedDescriptionCandidate =
    normalizeText(input.post.sharedDescription) ||
    normalizeText(input.post.content) ||
    "A post shared on fairbook.";

  const title = truncate(normalizedTitleCandidate, 80);
  const description = truncate(normalizedDescriptionCandidate, 180);
  const previewImage = pickPreviewImage(input.post);
  const imageUrl = previewImage ? toAbsoluteUrl(previewImage) : null;

  return {
    title,
    description,
    alternates: { canonical: canonicalUrl },
    robots: { index: true, follow: true },
    openGraph: {
      type: "article",
      url: canonicalUrl,
      title,
      description,
      siteName: "fairbook",
      locale: "en_US",
      publishedTime: input.post.createdAt.toISOString(),
      images: imageUrl
        ? [
            {
              url: imageUrl,
              width: 1200,
              height: 630,
            },
          ]
        : undefined,
    },
    twitter: {
      card: imageUrl ? "summary_large_image" : "summary",
      title,
      description,
      images: imageUrl ? [imageUrl] : undefined,
    },
  };
}