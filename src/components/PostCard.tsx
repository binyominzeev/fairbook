"use client";

import Avatar from "@/components/Avatar";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import HighlightedText from "@/components/HighlightedText";
import LikersListTrigger from "@/components/LikersListTrigger";
import { buildProfilePath } from "@/lib/profile-path";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

const URL_PATTERN = /(https?:\/\/[^\s]+)/g;

interface Author {
  id: string;
  slug?: string | null;
  name: string;
  avatarUrl?: string | null;
}

interface Community {
  id: string;
  permalinkSlug?: string | null;
  name: string;
}

interface SharedPostData {
  id: string;
  permalinkPath: string;
  content?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  imageUrls?: string[];
  isTextCard: boolean;
  createdAt: string;
  author: Author;
}

type ShareTestResult = {
  moderation?: {
    status: string;
    explanation?: string | null;
  };
};

type ShareDestination = {
  id: string;
  name: string;
};

type LocalEditImage = {
  id: string;
  kind: "local";
  file: File;
  previewUrl: string;
};

type RemoteEditImage = {
  id: string;
  kind: "remote";
  url: string;
};

type EditComposerImage = LocalEditImage | RemoteEditImage;

interface PostData {
  id: string;
  permalinkSlug?: string | null;
  permalinkPath: string;
  content?: string | null;
  feedSourceId?: string | null;
  moderationStatus: string;
  moderationReason?: string | null;
  moderationExplanation?: string | null;
  sharedUrl?: string | null;
  sharedTitle?: string | null;
  sharedDescription?: string | null;
  sharedSource?: string | null;
  sharedImageUrl?: string | null;
  imageUrls?: string[];
  isTextCard: boolean;
  sharedPost?: SharedPostData | null;
  createdAt: string;
  author: Author;
  likedByCurrentUser: boolean;
  bookmarkedByCurrentUser: boolean;
  sharedByCurrentUser: boolean;
  notificationsSubscribedByCurrentUser: boolean;
  canDeleteByViewer?: boolean;
  community?: Community | null;
  _count: { comments: number; likes: number; sharedBy: number };
  tags?: { id: string; name: string; color: string }[];
  commentPreviews?: Array<{
    id: string;
    content: string;
    createdAt: string;
    author: Author;
  }>;
}

interface Props {
  post: PostData;
  currentUserId: string;
  showDelete?: boolean;
  showPermalinkEditor?: boolean;
  initiallyHidden?: boolean;
  highlightQuery?: string;
  defaultShareCommunityId?: string | null;
  shareRedirectPath?: string | null;
  showCommunityHeader?: boolean;
}

const MAX_EDIT_IMAGES = 4;
const MAX_EDIT_IMAGE_DIMENSION = 1600;
const EDIT_WEBP_QUALITY = 0.82;

function buildEditImageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function revokeLocalEditPreviewUrls(images: EditComposerImage[]) {
  for (const image of images) {
    if (image.kind === "local") {
      URL.revokeObjectURL(image.previewUrl);
    }
  }
}

async function compressEditImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  let targetWidth = width;
  let targetHeight = height;
  const largestSide = Math.max(width, height);
  if (largestSide > MAX_EDIT_IMAGE_DIMENSION) {
    const ratio = MAX_EDIT_IMAGE_DIMENSION / largestSide;
    targetWidth = Math.round(width * ratio);
    targetHeight = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    throw new Error("Failed to process image.");
  }

  context.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", EDIT_WEBP_QUALITY);
  });

  if (!blob) {
    throw new Error("Failed to compress image.");
  }

  const normalizedName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${normalizedName}.webp`, { type: "image/webp" });
}

function buildRemoteEditImages(imageUrls: string[]) {
  return imageUrls.map<RemoteEditImage>((url, index) => ({
    id: `remote-${index}-${url}`,
    kind: "remote",
    url,
  }));
}

function renderTextWithLinks(text: string, className: string, query?: string) {
  return (
    <p className={className}>
      {text.split("\n").map((line, lineIndex) => (
        <span key={`${lineIndex}:${line}`}>
          {lineIndex > 0 && <br />}
          {line.split(URL_PATTERN).map((part, partIndex) =>
            /^https?:\/\/\S+$/i.test(part) ? (
              <a
                key={`${lineIndex}:${partIndex}:${part}`}
                href={part}
                target="_blank"
                rel="noopener noreferrer"
                className="break-all text-blue-600 hover:underline"
              >
                {part}
              </a>
            ) : (
              <span key={`${lineIndex}:${partIndex}`}>
                <HighlightedText text={part} query={query} />
              </span>
            )
          )}
        </span>
      ))}
    </p>
  );
}

function SinglePostImage({
  src,
  alt,
  isTextCard,
  canOpenLightbox,
  onOpen,
}: {
  src: string;
  alt: string;
  isTextCard: boolean;
  canOpenLightbox: boolean;
  onOpen: () => void;
}) {
  const [isNearSquare, setIsNearSquare] = useState(false);
  const imageClass =
    isTextCard || isNearSquare
      ? "w-full h-auto object-contain"
      : "h-80 w-full object-cover";

  const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
    const image = event.currentTarget;
    if (!image.naturalWidth || !image.naturalHeight) {
      setIsNearSquare(false);
      return;
    }

    const ratio = image.naturalWidth / image.naturalHeight;
    setIsNearSquare(ratio >= 0.9 && ratio <= 1.1);
  };

  if (!canOpenLightbox) {
    return (
      <div className="block h-full w-full">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={src} alt={alt} className={imageClass} onLoad={handleLoad} />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={onOpen}
      className="block h-full w-full"
    >
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt={alt} className={imageClass} onLoad={handleLoad} />
    </button>
  );
}

export default function PostCard({
  post,
  currentUserId,
  showDelete,
  showPermalinkEditor,
  initiallyHidden = false,
  highlightQuery,
  defaultShareCommunityId = null,
  shareRedirectPath = null,
  showCommunityHeader = true,
}: Props) {
  const router = useRouter();
  const [deleted, setDeleted] = useState(false);
  const [hidden, setHidden] = useState(initiallyHidden);
  const [now, setNow] = useState(() => Date.now());
  const [liked, setLiked] = useState(post.likedByCurrentUser);
  const [bookmarked, setBookmarked] = useState(post.bookmarkedByCurrentUser);
  const [likeCount, setLikeCount] = useState(post._count.likes);
  const [shared, setShared] = useState(post.sharedByCurrentUser);
  const [shareCount, setShareCount] = useState(post._count.sharedBy);
  const [postNotificationsSubscribed, setPostNotificationsSubscribed] = useState(
    post.notificationsSubscribedByCurrentUser
  );
  const [updatingPostNotifications, setUpdatingPostNotifications] = useState(false);
  const [shareContent, setShareContent] = useState("");
  const [shareComposerOpen, setShareComposerOpen] = useState(false);
  const [shareDestinations, setShareDestinations] = useState<ShareDestination[]>([]);
  const [loadingShareDestinations, setLoadingShareDestinations] = useState(false);
  const [shareCommunityId, setShareCommunityId] = useState<string>(defaultShareCommunityId ?? "");
  const [pendingAction, setPendingAction] = useState<"like" | "bookmark" | "share" | null>(null);
  const [shareTesting, setShareTesting] = useState(false);
  const [lastShareTestContent, setLastShareTestContent] = useState<string | null>(null);
  const [lastShareTestResult, setLastShareTestResult] = useState<ShareTestResult | null>(null);
  const [actionError, setActionError] = useState("");
  const [actionNotice, setActionNotice] = useState<{
    kind: "success" | "warning" | "error";
    message: string;
  } | null>(null);
  const [lightbox, setLightbox] = useState<{ urls: string[]; index: number } | null>(null);
  const [permalinkDraft, setPermalinkDraft] = useState(post.permalinkSlug ?? "");
  const [permalinkSaving, setPermalinkSaving] = useState(false);
  const [permalinkMessage, setPermalinkMessage] = useState<string | null>(null);
  const [editComposerOpen, setEditComposerOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [editContent, setEditContent] = useState(post.content ?? "");
  const [editSharedUrl, setEditSharedUrl] = useState(post.sharedUrl ?? "");
  const [editSharedTitle, setEditSharedTitle] = useState(post.sharedTitle ?? "");
  const [editSharedDescription, setEditSharedDescription] = useState(post.sharedDescription ?? "");
  const [editSharedSource, setEditSharedSource] = useState(post.sharedSource ?? "");
  const [editShowLinkFields, setEditShowLinkFields] = useState(
    Boolean(post.sharedUrl || post.sharedTitle || post.sharedDescription || post.sharedSource)
  );
  const [savingEdit, setSavingEdit] = useState(false);
  const [editTesting, setEditTesting] = useState(false);
  const [lastEditTestKey, setLastEditTestKey] = useState<string | null>(null);
  const [lastEditTestResult, setLastEditTestResult] = useState<ShareTestResult | null>(null);
  const [editImages, setEditImages] = useState<EditComposerImage[]>(() =>
    buildRemoteEditImages(post.imageUrls ?? [])
  );
  const menuRef = useRef<HTMLDetailsElement | null>(null);
  const editImageInputRef = useRef<HTMLInputElement | null>(null);
  const editImagesRef = useRef<EditComposerImage[]>(editImages);

  const canEditPermalink = Boolean(showPermalinkEditor && post.author.id === currentUserId);
  const canEditPost = post.author.id === currentUserId;
  const reportHref = `/child-safety/report?postId=${encodeURIComponent(post.id)}&targetUrl=${encodeURIComponent(post.permalinkPath)}`;
  const communityHref = post.community
    ? `/groups/${encodeURIComponent(post.community.permalinkSlug ?? post.community.id)}`
    : null;

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      setNow(Date.now());
    }, 60000);

    return () => window.clearInterval(intervalId);
  }, []);

  useEffect(() => {
    editImagesRef.current = editImages;
  }, [editImages]);

  useEffect(() => {
    return () => {
      revokeLocalEditPreviewUrls(editImagesRef.current);
    };
  }, []);

  useEffect(() => {
    if (!lightbox) return;

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setLightbox(null);
        return;
      }

      if (event.key === "ArrowLeft") {
        setLightbox((current) => {
          if (!current) return current;
          const prevIndex =
            (current.index - 1 + current.urls.length) % current.urls.length;
          return { ...current, index: prevIndex };
        });
      }

      if (event.key === "ArrowRight") {
        setLightbox((current) => {
          if (!current) return current;
          const nextIndex = (current.index + 1) % current.urls.length;
          return { ...current, index: nextIndex };
        });
      }
    };

    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [lightbox]);

  useEffect(() => {
    if (!isMenuOpen) return;

    const handlePointerDown = (event: PointerEvent) => {
      const menu = menuRef.current;
      if (!menu) return;

      const target = event.target;
      if (!(target instanceof Node)) return;
      if (menu.contains(target)) return;

      menu.removeAttribute("open");
      setIsMenuOpen(false);
    };

    const handleKeydown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      menuRef.current?.removeAttribute("open");
      setIsMenuOpen(false);
    };

    document.addEventListener("pointerdown", handlePointerDown);
    window.addEventListener("keydown", handleKeydown);
    return () => {
      document.removeEventListener("pointerdown", handlePointerDown);
      window.removeEventListener("keydown", handleKeydown);
    };
  }, [isMenuOpen]);

  const timeAgo = (date: string) => {
    const diff = now - new Date(date).getTime();
    const mins = Math.floor(diff / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const handleDelete = async () => {
    if (!confirm("Delete this post?")) return;
    const res = await fetch(`/api/posts/${post.id}`, { method: "DELETE" });
    if (res.ok) {
      setDeleted(true);
      router.refresh();
    }
  };

  const handleLike = async () => {
    setPendingAction("like");
    setActionError("");
    setActionNotice(null);

    try {
      const res = await fetch(`/api/posts/${post.id}/like`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update like.");
        return;
      }

      setLiked(Boolean(data.liked));
      setLikeCount(Number(data.likeCount ?? likeCount));
    } finally {
      setPendingAction(null);
    }
  };

  const handleHide = async () => {
    setActionError("");
    setActionNotice(null);

    try {
      const res = await fetch(`/api/posts/${post.id}/hide`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to hide post.");
        return;
      }

      setHidden(Boolean(data.hidden));
      router.refresh();
    } catch {
      setActionError("Failed to hide post.");
    }
  };

  const handleBookmark = async () => {
    setPendingAction("bookmark");
    setActionError("");
    setActionNotice(null);

    try {
      const res = await fetch(`/api/posts/${post.id}/bookmark`, { method: "POST" });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update bookmark.");
        return;
      }

      setBookmarked(Boolean(data.bookmarked));
    } catch {
      setActionError("Failed to update bookmark.");
    } finally {
      setPendingAction(null);
    }
  };

  const handlePostNotificationToggle = async () => {
    if (updatingPostNotifications) return;

    const nextSubscribed = !postNotificationsSubscribed;
    setUpdatingPostNotifications(true);
    setActionError("");
    setActionNotice(null);

    try {
      const res = await fetch(`/api/posts/${post.id}/notifications`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ subscribed: nextSubscribed }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to update post notifications.");
        return;
      }

      const subscribed = Boolean(data.subscribed);
      setPostNotificationsSubscribed(subscribed);
      setActionNotice({
        kind: "success",
        message: subscribed
          ? "Post notifications enabled."
          : "Post notifications disabled.",
      });
    } catch {
      setActionError("Failed to update post notifications.");
    } finally {
      setUpdatingPostNotifications(false);
    }
  };

  const handleShareSubmit = async () => {
    setPendingAction("share");
    setActionError("");
    setActionNotice(null);

    try {
      const body: Record<string, unknown> = { content: shareContent };
      if (shareCommunityId) {
        body.communityId = shareCommunityId;
      }
      if (lastShareTestContent === shareContent && lastShareTestResult) {
        body.preModeration = {
          content: lastShareTestContent,
          moderation: lastShareTestResult.moderation,
        };
      }

      const res = await fetch(`/api/posts/${post.id}/share`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to share post.");
        return;
      }

      setShared(true);
      setShareCount(Number(data.shareCount ?? shareCount));
      setShareComposerOpen(false);
      setShareContent("");
      const params = new URLSearchParams();
      if (typeof data.message === "string" && data.message.length > 0) {
        params.set("notice", data.message);
      }
      params.set(
        "noticeKind",
        data.moderation?.status === "author_only" ? "warning" : "success"
      );
      const redirectBase =
        shareRedirectPath && shareRedirectPath.startsWith("/") ? shareRedirectPath : "/feed";
      router.push(`${redirectBase}?${params.toString()}`);
    } finally {
      setPendingAction(null);
    }
  };

  const openShareComposer = async () => {
    setActionError("");
    setShareComposerOpen(true);
    setLoadingShareDestinations(true);

    try {
      const response = await fetch("/api/communities?scope=joined");
      const data = await response.json();
      if (!response.ok) {
        return;
      }

      const destinations: ShareDestination[] = Array.isArray(data.communities)
        ? data.communities
            .map((community: { id?: unknown; name?: unknown }) => {
              if (typeof community.id !== "string" || typeof community.name !== "string") {
                return null;
              }
              return { id: community.id, name: community.name };
            })
            .filter((item: ShareDestination | null): item is ShareDestination => Boolean(item))
        : [];

      setShareDestinations(destinations);
      if (
        defaultShareCommunityId &&
        destinations.some((destination) => destination.id === defaultShareCommunityId)
      ) {
        setShareCommunityId(defaultShareCommunityId);
      }
    } finally {
      setLoadingShareDestinations(false);
    }
  };

  const handleShareTest = async () => {
    if (!shareContent.trim() || !post.feedSourceId) return;

    setShareTesting(true);
    setActionError("");
    setActionNotice(null);

    try {
      const res = await fetch("/api/posts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: shareContent,
          sharedContent: post.content,
          sharedUrl: post.sharedUrl,
          sharedTitle: post.sharedTitle,
          sharedDescription: post.sharedDescription,
          sharedSource: post.sharedSource,
        }),
      });
      const data = await res.json();

      if (!res.ok) {
        setActionError(data.error ?? "Failed to test share.");
        return;
      }

      setLastShareTestContent(shareContent);
      setLastShareTestResult(data);
    } finally {
      setShareTesting(false);
    }
  };

  const handlePermalinkSave = async () => {
    if (!canEditPermalink) return;

    setPermalinkSaving(true);
    setPermalinkMessage(null);

    try {
      const response = await fetch(`/api/posts/${post.id}/permalink`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ slug: permalinkDraft }),
      });
      const data = await response.json();

      if (!response.ok) {
        setPermalinkMessage(data.error ?? "Failed to update permalink.");
        return;
      }

      setPermalinkDraft(String(data.permalinkSlug ?? permalinkDraft));
      setPermalinkMessage("Permalink updated.");
      if (typeof data.permalinkPath === "string" && data.permalinkPath.length > 0) {
        router.push(data.permalinkPath);
      } else {
        router.refresh();
      }
    } finally {
      setPermalinkSaving(false);
    }
  };

  const openLightbox = (urls: string[], index: number) => {
    setLightbox({ urls, index });
  };

  const buildEditTestKey = (input: {
    content: string;
    sharedUrl: string;
    sharedTitle: string;
    sharedDescription: string;
    sharedSource: string;
  }) => {
    return [
      input.content,
      input.sharedUrl,
      input.sharedTitle,
      input.sharedDescription,
      input.sharedSource,
    ].join("||");
  };

  const openEditComposer = () => {
    setEditContent(post.content ?? "");
    setEditSharedUrl(post.sharedUrl ?? "");
    setEditSharedTitle(post.sharedTitle ?? "");
    setEditSharedDescription(post.sharedDescription ?? "");
    setEditSharedSource(post.sharedSource ?? "");
    setEditShowLinkFields(
      Boolean(post.sharedUrl || post.sharedTitle || post.sharedDescription || post.sharedSource)
    );
    setEditImages((current) => {
      revokeLocalEditPreviewUrls(current);
      return buildRemoteEditImages(post.imageUrls ?? []);
    });
    setLastEditTestKey(null);
    setLastEditTestResult(null);
    setActionError("");
    setActionNotice(null);
    setEditComposerOpen(true);
    menuRef.current?.removeAttribute("open");
    setIsMenuOpen(false);
  };

  const closeEditComposer = () => {
    setEditImages((current) => {
      revokeLocalEditPreviewUrls(current);
      return buildRemoteEditImages(post.imageUrls ?? []);
    });
    setEditComposerOpen(false);
  };

  const addFilesToEditComposer = async (incomingFiles: FileList | File[]) => {
    const rawFiles = Array.from(incomingFiles);
    const imageFiles = rawFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const remainingSlots = MAX_EDIT_IMAGES - editImages.length;
    if (remainingSlots <= 0) {
      setActionNotice({
        kind: "error",
        message: `You can attach at most ${MAX_EDIT_IMAGES} images.`,
      });
      return;
    }

    const filesToProcess = imageFiles.slice(0, remainingSlots);
    setActionNotice(null);

    try {
      const compressedFiles = await Promise.all(filesToProcess.map(compressEditImage));
      const newImages: LocalEditImage[] = compressedFiles.map((file) => ({
        id: buildEditImageId(),
        kind: "local",
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setEditImages((current) => [...current, ...newImages]);
    } catch {
      setActionNotice({
        kind: "error",
        message: "One or more images could not be processed.",
      });
    }
  };

  const removeEditImage = (id: string) => {
    setEditImages((current) => {
      const removedImage = current.find((image) => image.id === id);
      if (removedImage?.kind === "local") {
        URL.revokeObjectURL(removedImage.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  };

  const handleEditTest = async () => {
    const normalizedContent = editContent.trim();
    const normalizedSharedUrl = editSharedUrl.trim();
    const normalizedSharedTitle = editSharedTitle.trim();
    const normalizedSharedDescription = editSharedDescription.trim();
    const normalizedSharedSource = editSharedSource.trim();

    if (!normalizedContent && !normalizedSharedUrl) return;

    setEditTesting(true);
    setActionError("");
    setActionNotice(null);

    const combinedSharedContent = [
      normalizedSharedTitle,
      normalizedSharedDescription,
      normalizedSharedSource,
      normalizedSharedUrl,
      post.sharedPost?.content,
      post.sharedPost?.sharedTitle,
      post.sharedPost?.sharedDescription,
      post.sharedPost?.sharedSource,
      post.sharedPost?.sharedUrl,
    ]
      .filter(Boolean)
      .join("\n");

    try {
      const response = await fetch("/api/posts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: normalizedContent || null,
          sharedUrl: normalizedSharedUrl || null,
          sharedTitle: normalizedSharedTitle || null,
          sharedDescription: normalizedSharedDescription || null,
          sharedSource: normalizedSharedSource || null,
          sharedContent: combinedSharedContent || null,
        }),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionNotice({
          kind: "error",
          message: data.error ?? "Test failed.",
        });
        return;
      }

      const key = buildEditTestKey({
        content: normalizedContent,
        sharedUrl: normalizedSharedUrl,
        sharedTitle: normalizedSharedTitle,
        sharedDescription: normalizedSharedDescription,
        sharedSource: normalizedSharedSource,
      });
      setLastEditTestKey(key);
      setLastEditTestResult(data);
      setActionNotice({
        kind: data.moderation?.status === "author_only" ? "warning" : "success",
        message: data.moderation?.explanation ?? "Test completed.",
      });
    } finally {
      setEditTesting(false);
    }
  };

  const handleEditSubmit = async () => {
    const normalizedContent = editContent.trim();
    const normalizedSharedUrl = editSharedUrl.trim();
    const normalizedSharedTitle = editSharedTitle.trim();
    const normalizedSharedDescription = editSharedDescription.trim();
    const normalizedSharedSource = editSharedSource.trim();

    const hasLinkFields =
      normalizedSharedUrl || normalizedSharedTitle || normalizedSharedDescription || normalizedSharedSource;
    const hasStaticContent = editImages.length > 0 || Boolean(post.sharedPost);

    if (!normalizedContent && !normalizedSharedUrl && !hasStaticContent) {
      setActionNotice({
        kind: "error",
        message: "Post must have content, images, or a shared URL.",
      });
      return;
    }

    const contentUnchanged = normalizedContent === (post.content ?? "").trim();
    const sharedUrlUnchanged = normalizedSharedUrl === (post.sharedUrl ?? "").trim();
    const sharedTitleUnchanged = normalizedSharedTitle === (post.sharedTitle ?? "").trim();
    const sharedDescriptionUnchanged =
      normalizedSharedDescription === (post.sharedDescription ?? "").trim();
    const sharedSourceUnchanged = normalizedSharedSource === (post.sharedSource ?? "").trim();
    const remoteImageUrls = editImages
      .filter((image): image is RemoteEditImage => image.kind === "remote")
      .map((image) => image.url);
    const localImages = editImages.filter(
      (image): image is LocalEditImage => image.kind === "local"
    );
    const existingImageUrls = post.imageUrls ?? [];
    const imageOrderUnchanged =
      localImages.length === 0 &&
      existingImageUrls.length === remoteImageUrls.length &&
      existingImageUrls.every((url, index) => url === remoteImageUrls[index]);

    if (
      contentUnchanged &&
      sharedUrlUnchanged &&
      sharedTitleUnchanged &&
      sharedDescriptionUnchanged &&
      sharedSourceUnchanged &&
      imageOrderUnchanged
    ) {
      closeEditComposer();
      return;
    }

    setSavingEdit(true);
    setActionError("");
    setActionNotice(null);

    try {
      let uploadedImageUrls: string[] = [];
      if (localImages.length > 0) {
        const uploadPayload = new FormData();
        for (const image of localImages) {
          uploadPayload.append("files", image.file);
        }

        const uploadResponse = await fetch("/api/uploads/images", {
          method: "POST",
          body: uploadPayload,
        });
        const uploadData = await uploadResponse.json();
        if (!uploadResponse.ok) {
          setActionNotice({
            kind: "error",
            message: uploadData.error ?? "Failed to upload images.",
          });
          return;
        }

        uploadedImageUrls = Array.isArray(uploadData.urls) ? uploadData.urls : [];
      }

      const finalImageUrls = [...remoteImageUrls, ...uploadedImageUrls];
      const body: Record<string, unknown> = {
        content: normalizedContent || null,
        sharedUrl: normalizedSharedUrl || null,
        sharedTitle: hasLinkFields ? normalizedSharedTitle || null : null,
        sharedDescription: hasLinkFields ? normalizedSharedDescription || null : null,
        sharedSource: hasLinkFields ? normalizedSharedSource || null : null,
        imageUrls: finalImageUrls,
      };

      const key = buildEditTestKey({
        content: normalizedContent,
        sharedUrl: normalizedSharedUrl,
        sharedTitle: hasLinkFields ? normalizedSharedTitle : "",
        sharedDescription: hasLinkFields ? normalizedSharedDescription : "",
        sharedSource: hasLinkFields ? normalizedSharedSource : "",
      });

      if (lastEditTestKey === key && lastEditTestResult) {
        body.preModeration = {
          content: lastEditTestKey,
          moderation: lastEditTestResult.moderation,
        };
      }

      const response = await fetch(`/api/posts/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json();

      if (!response.ok) {
        setActionNotice({
          kind: "error",
          message: data.error ?? "Failed to update post.",
        });
        return;
      }

      setActionNotice({
        kind: data.moderation?.status === "author_only" ? "warning" : "success",
        message: data.message ?? "Post updated.",
      });
      setEditImages((current) => {
        revokeLocalEditPreviewUrls(current);
        return buildRemoteEditImages(
          Array.isArray(data.post?.imageUrls) ? data.post.imageUrls : finalImageUrls
        );
      });
      setEditComposerOpen(false);
      setEditContent(data.post?.content ?? normalizedContent);
      setEditSharedUrl(data.post?.sharedUrl ?? normalizedSharedUrl);
      setEditSharedTitle(data.post?.sharedTitle ?? normalizedSharedTitle);
      setEditSharedDescription(data.post?.sharedDescription ?? normalizedSharedDescription);
      setEditSharedSource(data.post?.sharedSource ?? normalizedSharedSource);
      router.refresh();
    } finally {
      setSavingEdit(false);
    }
  };

  const shiftLightbox = (direction: -1 | 1) => {
    setLightbox((current) => {
      if (!current) return current;
      const nextIndex =
        (current.index + direction + current.urls.length) % current.urls.length;
      return { ...current, index: nextIndex };
    });
  };

  const renderImageGallery = (imageUrls: string[], options?: { isTextCard?: boolean }) => {
    if (imageUrls.length === 0) return null;

    const isTextCard = options?.isTextCard === true;
    const canOpenLightbox = !isTextCard || imageUrls.length > 1;

    const renderImage = (url: string, index: number, className: string) => {
      if (!canOpenLightbox) {
        return (
          <div className="block h-full w-full">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={url} alt={`Post image ${index + 1}`} className={className} />
          </div>
        );
      }

      return (
        <button
          type="button"
          onClick={() => openLightbox(imageUrls, index)}
          className="block h-full w-full"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={url} alt={`Post image ${index + 1}`} className={className} />
        </button>
      );
    };

    if (imageUrls.length === 1) {
      return (
        <div className="mb-3 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
          <SinglePostImage
            src={imageUrls[0]}
            alt="Post image 1"
            isTextCard={isTextCard}
            canOpenLightbox={canOpenLightbox}
            onOpen={() => openLightbox(imageUrls, 0)}
          />
        </div>
      );
    }

    if (imageUrls.length === 2) {
      return (
        <div className="mb-3 grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
          {imageUrls.map((url, index) => (
            <div key={`${url}:${index}`} className="border border-slate-200 bg-slate-100">
              {renderImage(url, index, "h-56 w-full object-cover")}
            </div>
          ))}
        </div>
      );
    }

    const visibleImages = imageUrls.slice(0, 4);
    const remainingCount = imageUrls.length - visibleImages.length;

    return (
      <div className="mb-3 grid grid-cols-2 gap-1.5 overflow-hidden rounded-xl">
        {visibleImages.map((url, index) => {
          const shouldShowOverlay = index === 3 && remainingCount > 0;
          return (
            <div key={`${url}:${index}`} className="relative border border-slate-200 bg-slate-100">
              {renderImage(url, index, "h-44 w-full object-cover sm:h-48")}
              {canOpenLightbox && shouldShowOverlay && (
                <button
                  type="button"
                  onClick={() => openLightbox(imageUrls, index)}
                  className="absolute inset-0 flex items-center justify-center bg-slate-950/45 text-xl font-semibold text-white"
                >
                  +{remainingCount}
                </button>
              )}
            </div>
          );
        })}
      </div>
    );
  };

  if (deleted) return null;

  return (
    <>
      {lightbox && (
        <div
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/85 px-3"
          onClick={() => setLightbox(null)}
        >
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              shiftLightbox(-1);
            }}
            className="mr-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            aria-label="Previous image"
          >
            ←
          </button>

          <div className="max-h-[90vh] max-w-5xl" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightbox.urls[lightbox.index]}
              alt={`Expanded image ${lightbox.index + 1}`}
              className="max-h-[90vh] w-auto max-w-full rounded-lg object-contain"
            />
            <p className="mt-2 text-center text-xs text-slate-200">
              {lightbox.index + 1} / {lightbox.urls.length}
            </p>
          </div>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              shiftLightbox(1);
            }}
            className="ml-2 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            aria-label="Next image"
          >
            →
          </button>

          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setLightbox(null);
            }}
            className="absolute right-3 top-3 rounded-full bg-white/15 px-3 py-2 text-sm font-semibold text-white backdrop-blur hover:bg-white/25"
            aria-label="Close lightbox"
          >
            ✕
          </button>
        </div>
      )}

      {shareComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/40 px-4">
          <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Share to your feed</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Add your own note above the shared post.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (pendingAction === null) {
                    setShareComposerOpen(false);
                  }
                }}
                className="text-sm text-slate-400 transition-colors hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <textarea
                value={shareContent}
                onChange={(e) => setShareContent(e.target.value)}
                placeholder="Say something about this…"
                rows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">
                  Share destination
                </p>
                <select
                  value={shareCommunityId}
                  onChange={(event) => setShareCommunityId(event.target.value)}
                  className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                >
                  <option value="">My personal feed</option>
                  {shareDestinations.map((destination) => (
                    <option key={destination.id} value={destination.id}>
                      Group: {destination.name}
                    </option>
                  ))}
                </select>
                {loadingShareDestinations && (
                  <p className="mt-2 text-xs text-slate-500">Loading groups...</p>
                )}
              </div>

              {post.feedSourceId && (
                <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                  <p>
                    Test the moderation result before sharing this RSS article with your note.
                  </p>
                  <button
                    type="button"
                    onClick={handleShareTest}
                    disabled={shareTesting || !shareContent.trim()}
                    className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:border-amber-100 disabled:text-amber-300"
                  >
                    {shareTesting ? "Testing…" : "Test"}
                  </button>
                </div>
              )}

              {lastShareTestResult?.moderation?.explanation && lastShareTestContent === shareContent && (
                <p
                  className={`text-xs ${lastShareTestResult.moderation.status === "author_only" ? "text-amber-700" : "text-emerald-700"}`}
                >
                  {lastShareTestResult.moderation.explanation}
                </p>
              )}

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                  <span>Sharing from</span>
                      <span className="font-medium text-slate-600">
                        <HighlightedText text={post.author.name} query={highlightQuery} />
                      </span>
                  <span>·</span>
                  <span>{timeAgo(post.createdAt)}</span>
                </div>

                {post.content && (
                  renderTextWithLinks(post.content, "whitespace-pre-wrap text-sm text-slate-800", highlightQuery)
                )}

                {post.imageUrls &&
                  post.imageUrls.length > 0 &&
                  renderImageGallery(post.imageUrls, { isTextCard: post.isTextCard })}

                {post.sharedUrl && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                    {post.sharedSource && (
                      <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                        <HighlightedText text={post.sharedSource} query={highlightQuery} /> · External source
                      </p>
                    )}
                    {post.sharedTitle && (
                      <p className="text-sm font-semibold text-slate-900 leading-snug">
                        <HighlightedText text={post.sharedTitle} query={highlightQuery} />
                      </p>
                    )}
                    {post.sharedDescription && (
                      <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                        <HighlightedText text={post.sharedDescription} query={highlightQuery} />
                      </p>
                    )}
                    <p className="mt-1.5 break-all text-xs text-blue-600">{post.sharedUrl}</p>
                  </div>
                )}

                {post.sharedPost && (
                  <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
                    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
                      <span>Includes a shared post from</span>
                      <span className="font-medium text-slate-600">
                        <HighlightedText text={post.sharedPost.author.name} query={highlightQuery} />
                      </span>
                    </div>

                    {post.sharedPost.content && (
                      renderTextWithLinks(
                        post.sharedPost.content,
                        "whitespace-pre-wrap text-sm text-slate-800",
                        highlightQuery
                      )
                    )}

                    {post.sharedPost.imageUrls &&
                      post.sharedPost.imageUrls.length > 0 &&
                      renderImageGallery(post.sharedPost.imageUrls, {
                        isTextCard: post.sharedPost.isTextCard,
                      })}

                    {post.sharedPost.sharedUrl && (
                      <div className="mt-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                        {post.sharedPost.sharedSource && (
                          <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                            <HighlightedText text={post.sharedPost.sharedSource} query={highlightQuery} /> · External source
                          </p>
                        )}
                        {post.sharedPost.sharedTitle && (
                          <p className="text-sm font-semibold text-slate-900 leading-snug">
                            <HighlightedText text={post.sharedPost.sharedTitle} query={highlightQuery} />
                          </p>
                        )}
                        {post.sharedPost.sharedDescription && (
                          <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                            <HighlightedText text={post.sharedPost.sharedDescription} query={highlightQuery} />
                          </p>
                        )}
                        <p className="mt-1.5 break-all text-xs text-blue-600">
                          {post.sharedPost.sharedUrl}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>

            {actionError && <p className="mt-3 text-xs text-red-600">{actionError}</p>}

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={() => setShareComposerOpen(false)}
                disabled={pendingAction !== null}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:border-slate-100 disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleShareSubmit}
                disabled={pendingAction !== null}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {pendingAction === "share" ? "Sharing…" : "Share"}
              </button>
            </div>
          </div>
        </div>
      )}

      {editComposerOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 py-8 sm:items-center">
          <div className="w-full max-w-2xl rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Edit post</h2>
                <p className="mt-1 text-sm text-slate-500">
                  Saving runs moderation again and republishes if the update passes.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  if (!savingEdit) {
                    closeEditComposer();
                  }
                }}
                className="text-sm text-slate-400 transition-colors hover:text-slate-600"
              >
                Close
              </button>
            </div>

            <div className="mt-4 space-y-3">
              <input
                ref={editImageInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={(event) => {
                  if (event.target.files) {
                    void addFilesToEditComposer(event.target.files);
                    event.target.value = "";
                  }
                }}
              />

              <AutoResizeTextarea
                value={editContent}
                onChange={(e) => setEditContent(e.target.value)}
                placeholder="Say something..."
                minRows={4}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
              />

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Attached link</p>
                    <p className="text-xs text-slate-500">
                      Update or remove the external link metadata used during moderation.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setEditShowLinkFields((value) => !value);
                    }}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    {editShowLinkFields ? "Hide link fields" : "Edit link fields"}
                  </button>
                </div>

                {editShowLinkFields && (
                  <div className="mt-3 space-y-2">
                    <input
                      value={editSharedUrl}
                      onChange={(e) => setEditSharedUrl(e.target.value)}
                      placeholder="https://example.com/article"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={editSharedTitle}
                      onChange={(e) => setEditSharedTitle(e.target.value)}
                      placeholder="Link title"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <input
                      value={editSharedSource}
                      onChange={(e) => setEditSharedSource(e.target.value)}
                      placeholder="Source"
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <textarea
                      value={editSharedDescription}
                      onChange={(e) => setEditSharedDescription(e.target.value)}
                      placeholder="Link description"
                      rows={3}
                      className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                )}
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-sm font-medium text-slate-800">Images</p>
                    <p className="text-xs text-slate-500">
                      Add new images or remove existing ones. Up to {MAX_EDIT_IMAGES} images.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => editImageInputRef.current?.click()}
                    className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-100"
                  >
                    Add photos
                  </button>
                </div>

                {editImages.length > 0 ? (
                  <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {editImages.map((image) => {
                      const src = image.kind === "local" ? image.previewUrl : image.url;
                      return (
                        <div
                          key={image.id}
                          className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                        >
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={src} alt="Post image" className="h-24 w-full object-cover" />
                          <button
                            type="button"
                            onClick={() => removeEditImage(image.id)}
                            className="absolute right-1 top-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white"
                          >
                            Remove
                          </button>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  <p className="mt-3 text-xs text-slate-500">No images attached.</p>
                )}
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
                <p>Test moderation before saving this update.</p>
                <button
                  type="button"
                  onClick={handleEditTest}
                  disabled={editTesting || (!editContent.trim() && !editSharedUrl.trim())}
                  className="shrink-0 rounded-lg border border-amber-300 bg-white px-3 py-1.5 font-medium text-amber-900 transition-colors hover:bg-amber-100 disabled:border-amber-100 disabled:text-amber-300"
                >
                  {editTesting ? "Testing…" : "Test"}
                </button>
              </div>

              {lastEditTestResult?.moderation?.explanation &&
                lastEditTestKey ===
                  buildEditTestKey({
                    content: editContent.trim(),
                    sharedUrl: editSharedUrl.trim(),
                    sharedTitle: editShowLinkFields ? editSharedTitle.trim() : "",
                    sharedDescription: editShowLinkFields ? editSharedDescription.trim() : "",
                    sharedSource: editShowLinkFields ? editSharedSource.trim() : "",
                  }) && (
                  <p
                    className={`text-xs ${
                      lastEditTestResult.moderation.status === "author_only"
                        ? "text-amber-700"
                        : "text-emerald-700"
                    }`}
                  >
                    {lastEditTestResult.moderation.explanation}
                  </p>
                )}

              {post.sharedPost && (
                <p className="text-xs text-slate-500">
                  The shared post stays attached; only your own note can be changed here.
                </p>
              )}

              {actionNotice && (
                <p
                  className={`text-xs ${
                    actionNotice.kind === "error"
                      ? "text-red-600"
                      : actionNotice.kind === "warning"
                        ? "text-amber-700"
                        : "text-emerald-700"
                  }`}
                >
                  {actionNotice.message}
                </p>
              )}
            </div>

            <div className="mt-4 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
              <button
                type="button"
                onClick={closeEditComposer}
                disabled={savingEdit || editTesting}
                className="rounded-lg border border-slate-200 px-4 py-2 text-sm text-slate-600 transition-colors hover:bg-slate-50 disabled:border-slate-100 disabled:text-slate-300"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleEditSubmit}
                disabled={savingEdit || editTesting}
                className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400"
              >
                {savingEdit ? "Saving…" : "Save changes"}
              </button>
            </div>
          </div>
        </div>
      )}

      <article className="relative bg-white rounded-xl border border-slate-200 p-4 w-full min-w-0 overflow-visible">
        {/* Author row */}
        <div className="mb-3 flex items-start justify-between gap-3">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar
              name={post.author.name}
              avatarUrl={post.author.avatarUrl}
              sizeClassName="h-9 w-9"
              textClassName="text-sm font-semibold"
            />
            <div className="min-w-0">
              {post.community && communityHref && showCommunityHeader ? (
                <>
                  <Link
                    href={communityHref}
                    className="block truncate text-sm font-semibold text-slate-900 hover:underline"
                  >
                    <HighlightedText text={post.community.name} query={highlightQuery} />
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-[11px] text-slate-500">
                    <span>by</span>
                    <Link
                      href={buildProfilePath(post.author)}
                      className="truncate font-medium text-slate-600 hover:underline"
                    >
                      <HighlightedText text={post.author.name} query={highlightQuery} />
                    </Link>
                    <span>·</span>
                    <Link href={post.permalinkPath} className="hover:text-slate-700 hover:underline">
                      {timeAgo(post.createdAt)}
                    </Link>
                  </div>
                </>
              ) : (
                <>
                  <Link
                    href={buildProfilePath(post.author)}
                    className="block truncate text-sm font-semibold text-slate-900 hover:underline"
                  >
                    <HighlightedText text={post.author.name} query={highlightQuery} />
                  </Link>
                  <div className="flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs text-slate-400">
                    <Link href={post.permalinkPath} className="hover:text-slate-600 hover:underline">
                      {timeAgo(post.createdAt)}
                    </Link>
                  </div>
                </>
              )}
            </div>
          </div>
          <details
            ref={menuRef}
            className="relative z-10 open:z-50"
            onToggle={(event) => {
              setIsMenuOpen(event.currentTarget.open);
            }}
          >
            <summary className="cursor-pointer list-none rounded-lg px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-slate-700">
              More ▾
            </summary>
            <div className="absolute right-0 z-50 mt-1 w-48 rounded-lg border border-slate-200 bg-white p-1.5 shadow-lg">
              {canEditPost && (
                <button
                  type="button"
                  onClick={openEditComposer}
                  className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50"
                >
                  Edit
                </button>
              )}
              <button
                type="button"
                onClick={handleHide}
                className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50"
              >
                {hidden ? "Unhide post" : "Hide post"}
              </button>
              <button
                type="button"
                onClick={() => {
                  void handlePostNotificationToggle();
                }}
                disabled={updatingPostNotifications}
                className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50 disabled:text-slate-400"
              >
                {updatingPostNotifications
                  ? "Updating..."
                  : postNotificationsSubscribed
                    ? "Unsubscribe from post notifications"
                    : "Subscribe to post notifications"}
              </button>
              <Link
                href={reportHref}
                className="block rounded-md px-2.5 py-2 text-left text-xs text-slate-700 transition-colors hover:bg-slate-50"
              >
                Report child safety concern
              </Link>
              {showDelete && (post.author.id === currentUserId || post.canDeleteByViewer) && (
                <button
                  type="button"
                  onClick={handleDelete}
                  className="block w-full rounded-md px-2.5 py-2 text-left text-xs text-red-600 transition-colors hover:bg-red-50"
                >
                  Delete
                </button>
              )}
            </div>
          </details>
        </div>

        {/* Post body */}
        {post.content &&
          renderTextWithLinks(
            post.content,
            "mb-3 whitespace-pre-wrap text-sm text-slate-800",
            highlightQuery
          )}

        {post.imageUrls &&
          post.imageUrls.length > 0 &&
          renderImageGallery(post.imageUrls, { isTextCard: post.isTextCard })}

        {actionNotice && !editComposerOpen && (
          <p
            className={`mb-3 text-xs ${
              actionNotice.kind === "error"
                ? "text-red-600"
                : actionNotice.kind === "warning"
                  ? "text-amber-700"
                  : "text-emerald-700"
            }`}
          >
            {actionNotice.message}
          </p>
        )}

        {post.moderationStatus === "author_only" && post.author.id === currentUserId && (
          <div className="mb-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <p className="font-medium">
              Filtered{post.moderationReason ? ` · ${post.moderationReason}` : ""}
            </p>
            <p className="mt-1 text-amber-800">
              {post.moderationExplanation ?? "Only you can see this post."}
            </p>
          </div>
        )}

      {/* Shared link card */}
      {post.sharedUrl && (
        <a
          href={post.sharedUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="block border border-slate-200 rounded-xl overflow-hidden hover:border-slate-300 transition-colors mb-3"
        >
          {post.sharedImageUrl && (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={post.sharedImageUrl}
              alt={post.sharedTitle ?? ""}
              className="w-full h-40 object-cover"
            />
          )}
          <div className="p-3">
            {post.sharedSource && (
              <p className="text-xs text-slate-400 uppercase tracking-wide mb-1">
                <HighlightedText text={post.sharedSource} query={highlightQuery} /> · External source
              </p>
            )}
            {post.sharedTitle && (
              <p className="text-sm font-semibold text-slate-900 leading-snug">
                <HighlightedText text={post.sharedTitle} query={highlightQuery} />
              </p>
            )}
            {post.sharedDescription && (
              <p className="text-xs text-slate-500 mt-1 line-clamp-2">
                <HighlightedText text={post.sharedDescription} query={highlightQuery} />
              </p>
            )}
            <p className="text-xs text-blue-600 mt-1.5 break-all hover:underline">
              {post.sharedUrl}
            </p>
          </div>
        </a>
      )}

      {post.sharedPost && (
        <div className="mb-3 rounded-xl border border-slate-200 bg-slate-50 p-3 transition-colors hover:border-slate-300">
          <div className="mb-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-400">
            <span>Shared from</span>
            <span className="font-medium text-slate-600">
              <HighlightedText text={post.sharedPost.author.name} query={highlightQuery} />
            </span>
            <span>·</span>
            <span>{timeAgo(post.sharedPost.createdAt)}</span>
          </div>

          {post.sharedPost.content && (
            renderTextWithLinks(
              post.sharedPost.content,
              "whitespace-pre-wrap text-sm text-slate-800",
              highlightQuery
            )
          )}

          {post.sharedPost.imageUrls &&
            post.sharedPost.imageUrls.length > 0 &&
            renderImageGallery(post.sharedPost.imageUrls, {
              isTextCard: post.sharedPost.isTextCard,
            })}

          {post.sharedPost.sharedUrl && (
            <div className="mt-2 rounded-lg border border-slate-200 bg-white p-3">
              {post.sharedPost.sharedImageUrl && (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={post.sharedPost.sharedImageUrl}
                  alt={post.sharedPost.sharedTitle ?? ""}
                  className="mb-3 h-40 w-full rounded-lg object-cover"
                />
              )}
              {post.sharedPost.sharedSource && (
                <p className="mb-1 text-xs uppercase tracking-wide text-slate-400">
                  <HighlightedText text={post.sharedPost.sharedSource} query={highlightQuery} /> · External source
                </p>
              )}
              {post.sharedPost.sharedTitle && (
                <p className="text-sm font-semibold text-slate-900 leading-snug">
                  <HighlightedText text={post.sharedPost.sharedTitle} query={highlightQuery} />
                </p>
              )}
              {post.sharedPost.sharedDescription && (
                <p className="mt-1 text-xs text-slate-500 line-clamp-2">
                  <HighlightedText text={post.sharedPost.sharedDescription} query={highlightQuery} />
                </p>
              )}
              <p className="mt-1.5 break-all text-xs text-blue-600">
                {post.sharedPost.sharedUrl}
              </p>
            </div>
          )}

          <div className="mt-2">
            <Link
              href={post.sharedPost.permalinkPath}
              className="inline-flex text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
            >
              Open original post →
            </Link>
          </div>
        </div>
      )}

      {canEditPermalink && (
        <div className="mb-2 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5">
          <p className="text-[11px] font-medium uppercase tracking-wide text-slate-500">
            Permalink slug
          </p>
          <div className="mt-1.5 flex flex-col gap-2 sm:flex-row sm:items-center">
            <input
              value={permalinkDraft}
              onChange={(e) => setPermalinkDraft(e.target.value)}
              placeholder="pl. a-bejegyzes-cime"
              className="w-full rounded-md border border-slate-300 bg-white px-2.5 py-1.5 text-xs text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="button"
              onClick={handlePermalinkSave}
              disabled={permalinkSaving}
              className="rounded-md border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-100 disabled:text-slate-400"
            >
              {permalinkSaving ? "Saving…" : "Save"}
            </button>
          </div>
          {permalinkMessage && (
            <p className="mt-1.5 text-[11px] text-slate-500">{permalinkMessage}</p>
          )}
        </div>
      )}

      {/* Actions */}
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-2 border-t border-slate-100 pt-1">
        <Link
          href={post.permalinkPath}
          className="inline-flex items-center gap-1 rounded-full px-2 py-1 text-xs text-slate-500 transition-colors hover:bg-slate-100 hover:text-blue-600"
          aria-label="Open comments"
        >
          <span className="text-sm leading-none" aria-hidden="true">💬</span>
          <span>{post._count.comments}</span>
        </Link>
        <button
          type="button"
          onClick={handleLike}
          disabled={pendingAction !== null}
          className={`group relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${liked ? "text-blue-600 hover:bg-blue-50" : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"} disabled:text-slate-300`}
          aria-label={liked ? "Unlike" : "Like"}
        >
          <span className="text-base leading-none" aria-hidden="true">
            {liked ? "♥" : "♡"}
          </span>
          <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            {liked ? "Unlike" : "Like"}
          </span>
        </button>
        <LikersListTrigger kind="post" targetId={post.id} likeCount={likeCount} />
        <button
          type="button"
          onClick={() => {
            void openShareComposer();
          }}
          disabled={pendingAction !== null || shared}
          className={`text-xs transition-colors ${shared ? "text-blue-600" : "text-slate-500 hover:text-blue-600"} disabled:text-slate-300`}
        >
          ↻ {shareCount} share{shareCount !== 1 ? "s" : ""}
          {shared ? "d" : ""}
        </button>
        <button
          type="button"
          onClick={handleBookmark}
          disabled={pendingAction !== null}
          className={`group relative inline-flex h-8 w-8 items-center justify-center rounded-full transition-colors ${bookmarked ? "text-blue-600 hover:bg-blue-50" : "text-slate-500 hover:bg-slate-100 hover:text-blue-600"} disabled:text-slate-300`}
          aria-label={bookmarked ? "Remove bookmark" : "Bookmark"}
        >
          <span className="text-base leading-none" aria-hidden="true">
            {bookmarked ? "★" : "☆"}
          </span>
          <span className="pointer-events-none absolute bottom-full left-1/2 z-40 mb-1 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-[11px] font-medium text-white opacity-0 shadow-sm transition-opacity duration-150 group-hover:opacity-100 group-focus-visible:opacity-100">
            {bookmarked ? "Remove bookmark" : "Bookmark"}
          </span>
        </button>
      </div>
      {actionError && (
        <p className="mt-2 text-xs text-red-600">{actionError}</p>
      )}

      {post.commentPreviews && post.commentPreviews.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
          {post.commentPreviews.map((preview) => (
            <Link
              key={preview.id}
              href={post.permalinkPath}
              className="block rounded-lg bg-slate-50 px-3 py-2 transition-colors hover:bg-slate-100"
            >
              <p className="text-[11px] text-slate-500">
                <span className="font-medium text-slate-700">{preview.author.name}</span> · {timeAgo(preview.createdAt)}
              </p>
              <p className="mt-0.5 line-clamp-2 whitespace-pre-wrap text-xs text-slate-700">
                {preview.content}
              </p>
            </Link>
          ))}
          <Link
            href={post.permalinkPath}
            className="inline-flex text-xs font-medium text-blue-600 transition-colors hover:text-blue-700"
          >
            Open discussion →
          </Link>
        </div>
      )}
      </article>
    </>
  );
}
