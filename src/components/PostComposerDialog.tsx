"use client";

import { useEffect, useRef, useState } from "react";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import type { SerializedPost } from "@/lib/post-presentation";

type LocalComposerImage = {
  id: string;
  kind: "local";
  file: File;
  previewUrl: string;
};

type RemoteComposerImage = {
  id: string;
  kind: "remote";
  url: string;
};

type ComposerImage = LocalComposerImage | RemoteComposerImage;

type ModerationResult = {
  moderation?: {
    status?: string;
    explanation?: string;
  };
};

type CreatePostPayload = {
  content: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  communityId?: string | null;
  imageUrls: string[];
  isTextCard?: boolean;
  preModeration?: {
    content: string;
    moderation: ModerationResult["moderation"];
  };
};

type PostComposerDialogProps = {
  onClose: () => void;
  onSuccess: (result: PostComposerSuccessResult) => void;
  initialContent?: string;
  initialSharedUrl?: string;
  initialSharedTitle?: string;
  initialSharedDescription?: string;
  initialSharedSource?: string;
  initialImageUrls?: string[];
  initialShowLinkFields?: boolean;
  onOpenTextCardCreator?: (content: string) => void;
  title?: string;
  submitLabel?: string;
  textCardImageUrl?: string | null;
  communityId?: string | null;
};

const MAX_IMAGES = 4;
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;
export const NEW_VISIBLE_POST_EVENT = "fairbook:new-visible-post";

export type PostComposerSuccessResult = {
  post?: SerializedPost;
  moderation?: { status?: string; explanation?: string };
  message?: string;
};

function buildImageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function revokeLocalPreviewUrls(images: ComposerImage[]) {
  for (const image of images) {
    if (image.kind === "local") {
      URL.revokeObjectURL(image.previewUrl);
    }
  }
}

async function compressImage(file: File) {
  const bitmap = await createImageBitmap(file);
  const width = bitmap.width;
  const height = bitmap.height;

  let targetWidth = width;
  let targetHeight = height;
  const largestSide = Math.max(width, height);
  if (largestSide > MAX_DIMENSION) {
    const ratio = MAX_DIMENSION / largestSide;
    targetWidth = Math.round(width * ratio);
    targetHeight = Math.round(height * ratio);
  }

  const canvas = document.createElement("canvas");
  canvas.width = targetWidth;
  canvas.height = targetHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    bitmap.close();
    throw new Error("Failed to process image.");
  }

  ctx.drawImage(bitmap, 0, 0, targetWidth, targetHeight);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob(resolve, "image/webp", WEBP_QUALITY);
  });

  if (!blob) {
    throw new Error("Failed to compress image.");
  }

  const normalizedName = file.name.replace(/\.[^.]+$/, "") || "image";
  return new File([blob], `${normalizedName}.webp`, { type: "image/webp" });
}

function buildRemoteImages(imageUrls: string[]) {
  return imageUrls.map<RemoteComposerImage>((url, index) => ({
    id: `remote-${index}-${url}`,
    kind: "remote",
    url,
  }));
}

export default function PostComposerDialog({
  onClose,
  onSuccess,
  initialContent = "",
  initialSharedUrl = "",
  initialSharedTitle = "",
  initialSharedDescription = "",
  initialSharedSource = "",
  initialImageUrls = [],
  initialShowLinkFields = false,
  onOpenTextCardCreator,
  title = "Create post",
  submitLabel = "Post",
  textCardImageUrl = null,
  communityId = null,
}: PostComposerDialogProps) {
  const [content, setContent] = useState(initialContent);
  const [sharedUrl, setSharedUrl] = useState(initialSharedUrl);
  const [sharedTitle, setSharedTitle] = useState(initialSharedTitle);
  const [sharedSource, setSharedSource] = useState(initialSharedSource);
  const [sharedDescription, setSharedDescription] = useState(initialSharedDescription);
  const [showLinkFields, setShowLinkFields] = useState(initialShowLinkFields);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [lastTestKey, setLastTestKey] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<ModerationResult | null>(null);
  const [images, setImages] = useState<ComposerImage[]>(() => buildRemoteImages(initialImageUrls));
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<ComposerImage[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      revokeLocalPreviewUrls(imagesRef.current);
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape" && !submitting && !testing) {
        onClose();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [onClose, submitting, testing]);

  const addFilesToComposer = async (incomingFiles: FileList | File[]) => {
    const rawFiles = Array.from(incomingFiles);
    const imageFiles = rawFiles.filter((file) => file.type.startsWith("image/"));
    if (imageFiles.length === 0) return;

    const remainingSlots = MAX_IMAGES - images.length;
    if (remainingSlots <= 0) {
      setError(`You can attach at most ${MAX_IMAGES} images.`);
      return;
    }

    const filesToProcess = imageFiles.slice(0, remainingSlots);
    setError("");

    try {
      const compressedFiles = await Promise.all(filesToProcess.map(compressImage));
      const newImages: LocalComposerImage[] = compressedFiles.map((file) => ({
        id: buildImageId(),
        kind: "local",
        file,
        previewUrl: URL.createObjectURL(file),
      }));

      setImages((current) => [...current, ...newImages]);
    } catch {
      setError("One or more images could not be processed.");
    }
  };

  const removeImage = (id: string) => {
    setImages((current) => {
      const item = current.find((image) => image.id === id);
      if (item?.kind === "local") {
        URL.revokeObjectURL(item.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  };

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!content.trim() && !sharedUrl.trim() && images.length === 0) {
      setError("Add some content, images, or a link.");
      return;
    }

    setError("");
    setNotice(null);
    setSubmitting(true);

    try {
      const localImages = images.filter(
        (image): image is LocalComposerImage => image.kind === "local"
      );
      const remoteImageUrls = images
        .filter((image): image is RemoteComposerImage => image.kind === "remote")
        .map((image) => image.url);

      let uploadedImageUrls: string[] = [];
      if (localImages.length > 0) {
        const uploadPayload = new FormData();
        for (const image of localImages) {
          uploadPayload.append("files", image.file);
        }

        const uploadRes = await fetch("/api/uploads/images", {
          method: "POST",
          body: uploadPayload,
        });
        const uploadData = await uploadRes.json();
        if (!uploadRes.ok) {
          setError(uploadData.error ?? "Failed to upload images.");
          return;
        }
        uploadedImageUrls = Array.isArray(uploadData.urls) ? uploadData.urls : [];
      }

      const finalImageUrls = [...remoteImageUrls, ...uploadedImageUrls];
      const body: CreatePostPayload = {
        content: content.trim() || null,
        sharedUrl: sharedUrl.trim() || null,
        sharedTitle: sharedTitle.trim() || null,
        sharedDescription: sharedDescription.trim() || null,
        sharedSource: sharedSource.trim() || null,
        communityId,
        imageUrls: finalImageUrls,
        isTextCard: Boolean(textCardImageUrl && finalImageUrls.includes(textCardImageUrl)),
      };

      const key = `${content.trim()}||${sharedUrl.trim()}`;
      if (lastTestKey === key && lastTestResult) {
        body.preModeration = { content: lastTestKey, moderation: lastTestResult.moderation };
      }

      const res = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        post?: SerializedPost;
        moderation?: { status?: string; explanation?: string };
        message?: string;
        error?: string;
      };

      if (!res.ok) {
        setError(data.error ?? "Failed to post.");
        return;
      }

      if (data.moderation?.status === "visible" && data.post) {
        window.dispatchEvent(
          new CustomEvent<SerializedPost>(NEW_VISIBLE_POST_EVENT, {
            detail: data.post,
          })
        );
      }

      onSuccess({
        post: data.post,
        moderation: data.moderation,
        message: data.message,
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleTest = async () => {
    if (!content.trim() && !sharedUrl.trim()) return;

    setTesting(true);
    setError("");
    setNotice(null);

    try {
      const res = await fetch("/api/posts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: content.trim() || null,
          sharedUrl: sharedUrl.trim() || null,
          sharedTitle: sharedTitle.trim() || null,
          sharedDescription: sharedDescription.trim() || null,
          sharedSource: sharedSource.trim() || null,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        const key = `${content.trim()}||${sharedUrl.trim()}`;
        setLastTestKey(key);
        setLastTestResult(data);
        setNotice({
          kind: data.moderation?.status === "author_only" ? "warning" : "success",
          message: data.moderation?.explanation ?? "Test completed.",
        });
      } else {
        setError(data.error ?? "Test failed.");
      }
    } finally {
      setTesting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 py-8 sm:items-center"
      role="dialog"
      aria-modal="true"
      onMouseDown={() => {
        if (!submitting && !testing) {
          onClose();
        }
      }}
    >
      <form
        onSubmit={handleSubmit}
        onMouseDown={(event) => event.stopPropagation()}
        className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
      >
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-slate-800">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting || testing}
            className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
          >
            Close
          </button>
        </div>

        <AutoResizeTextarea
          value={content}
          onChange={(event) => setContent(event.target.value)}
          placeholder="Share a thought, start a discussion..."
          minRows={3}
          className="w-full resize-y text-sm text-slate-800 placeholder-slate-400 focus:outline-none"
        />

        <div className="mt-3">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            multiple
            className="hidden"
            onChange={(event) => {
              if (event.target.files) {
                void addFilesToComposer(event.target.files);
                event.target.value = "";
              }
            }}
          />

          <div
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDraggingImages(true);
            }}
            onDragOver={(event) => {
              event.preventDefault();
              setIsDraggingImages(true);
            }}
            onDragLeave={(event) => {
              event.preventDefault();
              const relatedTarget = event.relatedTarget as Node | null;
              if (!relatedTarget || !event.currentTarget.contains(relatedTarget)) {
                setIsDraggingImages(false);
              }
            }}
            onDrop={(event) => {
              event.preventDefault();
              setIsDraggingImages(false);
              void addFilesToComposer(event.dataTransfer.files);
            }}
            className={`rounded-lg border border-dashed px-4 py-3 transition-colors ${
              isDraggingImages
                ? "border-blue-400 bg-blue-50"
                : "border-slate-300 bg-slate-50"
            }`}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <p className="text-xs text-slate-600">
                Drag and drop images here, or pick files. Up to {MAX_IMAGES} images.
              </p>
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-100"
              >
                Add photos
              </button>
            </div>
          </div>

          {images.length > 0 && (
            <div className="mt-3 grid grid-cols-2 gap-2 sm:grid-cols-4">
              {images.map((image) => {
                const src = image.kind === "local" ? image.previewUrl : image.url;
                return (
                  <div
                    key={image.id}
                    className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={src}
                      alt="Selected upload"
                      className="h-24 w-full object-cover"
                    />
                    <button
                      type="button"
                      onClick={() => removeImage(image.id)}
                      className="absolute right-1 top-1 rounded bg-slate-900/70 px-1.5 py-0.5 text-[10px] text-white"
                    >
                      Remove
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {showLinkFields && (
          <div className="mt-3 space-y-2 border-t border-slate-100 pt-3">
            <p className="text-xs font-medium text-slate-500">Share a link</p>
            <input
              type="url"
              placeholder="https://..."
              value={sharedUrl}
              onChange={(event) => setSharedUrl(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Headline / title"
              value={sharedTitle}
              onChange={(event) => setSharedTitle(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <input
              type="text"
              placeholder="Source (e.g. Reuters, The Atlantic)"
              value={sharedSource}
              onChange={(event) => setSharedSource(event.target.value)}
              className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <textarea
              placeholder="Brief description (optional)"
              value={sharedDescription}
              onChange={(event) => setSharedDescription(event.target.value)}
              rows={2}
              className="w-full resize-none rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        )}

        {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
        {notice && (
          <p className={`mt-2 text-xs ${notice.kind === "warning" ? "text-amber-700" : "text-emerald-700"}`}>
            {notice.message}
          </p>
        )}

        <div className="mt-3 flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
          <button
            type="button"
            onClick={() => setShowLinkFields((value) => !value)}
            className="text-left text-xs text-slate-500 transition-colors hover:text-blue-600"
          >
            {showLinkFields ? "Hide link fields" : "Add a link"}
          </button>
          <div className={`grid w-full grid-cols-1 gap-2 sm:w-auto ${onOpenTextCardCreator ? "sm:grid-cols-3" : "sm:grid-cols-2"}`}>
            {onOpenTextCardCreator && (
              <button
                type="button"
                onClick={() => onOpenTextCardCreator(content)}
                className="w-full rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
              >
                Text Card Creator
              </button>
            )}
            <button
              type="button"
              onClick={handleTest}
              disabled={testing}
              className="w-full rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:bg-slate-100 sm:w-auto"
            >
              {testing ? "Testing..." : "Test"}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-lg bg-blue-600 px-4 py-1.5 text-sm font-medium text-white transition-colors hover:bg-blue-700 disabled:bg-slate-200 disabled:text-slate-400 sm:w-auto"
            >
              {submitting ? "Posting..." : submitLabel}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}