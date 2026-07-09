"use client";

import { useEffect, useRef, useState } from "react";
import AutoResizeTextarea from "@/components/AutoResizeTextarea";
import type { SerializedPost } from "@/lib/post-presentation";
import { useRouter } from "next/navigation";

type ComposerImage = {
  id: string;
  file: File;
  previewUrl: string;
};

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
  imageUrls: string[];
  preModeration?: {
    content: string;
    moderation: ModerationResult["moderation"];
  };
};

const MAX_IMAGES = 4;
const MAX_DIMENSION = 1600;
const WEBP_QUALITY = 0.82;
const NEW_VISIBLE_POST_EVENT = "fairbook:new-visible-post";

function buildImageId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
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

export default function CreatePostForm() {
  const router = useRouter();
  const [content, setContent] = useState("");
  const [sharedUrl, setSharedUrl] = useState("");
  const [sharedTitle, setSharedTitle] = useState("");
  const [sharedSource, setSharedSource] = useState("");
  const [sharedDescription, setSharedDescription] = useState("");
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [showLinkFields, setShowLinkFields] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);
  const [testing, setTesting] = useState(false);
  const [lastTestKey, setLastTestKey] = useState<string | null>(null);
  const [lastTestResult, setLastTestResult] = useState<ModerationResult | null>(null);
  const [images, setImages] = useState<ComposerImage[]>([]);
  const [isDraggingImages, setIsDraggingImages] = useState(false);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imagesRef = useRef<ComposerImage[]>([]);

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    return () => {
      for (const image of imagesRef.current) {
        URL.revokeObjectURL(image.previewUrl);
      }
    };
  }, []);

  useEffect(() => {
    if (!isComposerOpen) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setIsComposerOpen(false);
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isComposerOpen]);

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
      const newImages: ComposerImage[] = compressedFiles.map((file) => ({
        id: buildImageId(),
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
      if (item) {
        URL.revokeObjectURL(item.previewUrl);
      }
      return current.filter((image) => image.id !== id);
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() && !sharedUrl.trim() && images.length === 0) {
      setError("Add some content, images, or a link.");
      return;
    }
    setError("");
    setNotice(null);
    setSubmitting(true);
    try {
      let uploadedImageUrls: string[] = [];
      if (images.length > 0) {
        const uploadPayload = new FormData();
        for (const image of images) {
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

      const body: CreatePostPayload = {
        content: content.trim() || null,
        sharedUrl: sharedUrl.trim() || null,
        sharedTitle: sharedTitle.trim() || null,
        sharedDescription: sharedDescription.trim() || null,
        sharedSource: sharedSource.trim() || null,
        imageUrls: uploadedImageUrls,
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
        moderation?: { status?: string };
        message?: string;
        error?: string;
      };
      if (res.ok) {
        const createdPost = data.post;
        const isVisiblePost = data.moderation?.status === "visible";

        setContent("");
        setSharedUrl("");
        setSharedTitle("");
        setSharedSource("");
        setSharedDescription("");
        setImages((current) => {
          for (const image of current) {
            URL.revokeObjectURL(image.previewUrl);
          }
          return [];
        });
        setShowLinkFields(false);
        setNotice({
          kind: data.moderation?.status === "author_only" ? "warning" : "success",
          message: data.message ?? "Post accepted.",
        });
        setIsComposerOpen(false);

        if (isVisiblePost && createdPost) {
          window.dispatchEvent(
            new CustomEvent<SerializedPost>(NEW_VISIBLE_POST_EVENT, {
              detail: createdPost,
            })
          );
        }
      } else {
        setError(data.error ?? "Failed to post.");
      }
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
        setNotice({ kind: data.moderation?.status === "author_only" ? "warning" : "success", message: data.moderation?.explanation ?? "Test completed." });
      } else {
        setError(data.error ?? "Test failed.");
      }
    } finally {
      setTesting(false);
    }
  };

  const openTextCardCreator = () => {
    const params = new URLSearchParams();
    if (content.trim().length > 0) {
      params.set("text", content);
    }

    const query = params.toString();
    setIsComposerOpen(false);
    router.push(query ? `/feed/text-cards?${query}` : "/feed/text-cards");
  };

  return (
    <div>
      <button
        type="button"
        onClick={() => setIsComposerOpen(true)}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-left transition-colors hover:border-slate-300"
      >
        <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Create post</p>
        <p className="mt-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-sm text-slate-500">
          Share a thought, start a discussion...
        </p>
      </button>

      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
      {notice && (
        <p className={`mt-2 text-xs ${notice.kind === "warning" ? "text-amber-700" : "text-emerald-700"}`}>
          {notice.message}
        </p>
      )}

      {isComposerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 py-8 sm:items-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => {
            if (!submitting && !testing) {
              setIsComposerOpen(false);
            }
          }}
        >
          <form
            onSubmit={handleSubmit}
            onMouseDown={(event) => event.stopPropagation()}
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl border border-slate-200 bg-white p-4 shadow-2xl"
          >
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-slate-800">Create post</h2>
              <button
                type="button"
                onClick={() => setIsComposerOpen(false)}
                disabled={submitting || testing}
                className="rounded-md border border-slate-200 px-2 py-1 text-xs text-slate-600 transition-colors hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Close
              </button>
            </div>

            <AutoResizeTextarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
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
                onChange={(e) => {
                  if (e.target.files) {
                    void addFilesToComposer(e.target.files);
                    e.target.value = "";
                  }
                }}
              />

              <div
                onDragEnter={(e) => {
                  e.preventDefault();
                  setIsDraggingImages(true);
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDraggingImages(true);
                }}
                onDragLeave={(e) => {
                  e.preventDefault();
                  const relatedTarget = e.relatedTarget as Node | null;
                  if (!relatedTarget || !e.currentTarget.contains(relatedTarget)) {
                    setIsDraggingImages(false);
                  }
                }}
                onDrop={(e) => {
                  e.preventDefault();
                  setIsDraggingImages(false);
                  void addFilesToComposer(e.dataTransfer.files);
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
                  {images.map((image) => (
                    <div
                      key={image.id}
                      className="relative overflow-hidden rounded-lg border border-slate-200 bg-slate-100"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={image.previewUrl}
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
                  ))}
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
                  onChange={(e) => setSharedUrl(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Headline / title"
                  value={sharedTitle}
                  onChange={(e) => setSharedTitle(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <input
                  type="text"
                  placeholder="Source (e.g. Reuters, The Atlantic)"
                  value={sharedSource}
                  onChange={(e) => setSharedSource(e.target.value)}
                  className="w-full rounded-lg border border-slate-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <textarea
                  placeholder="Brief description (optional)"
                  value={sharedDescription}
                  onChange={(e) => setSharedDescription(e.target.value)}
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
                onClick={() => setShowLinkFields((v) => !v)}
                className="text-left text-xs text-slate-500 transition-colors hover:text-blue-600"
              >
                {showLinkFields ? "Hide link fields" : "Add a link"}
              </button>
              <div className="grid w-full grid-cols-1 gap-2 sm:w-auto sm:grid-cols-3">
                <button
                  type="button"
                  onClick={openTextCardCreator}
                  className="w-full rounded-lg border border-slate-200 bg-white px-4 py-1.5 text-sm text-slate-700 transition-colors hover:bg-slate-50 sm:w-auto"
                >
                  Text Card Creator
                </button>
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
                  {submitting ? "Posting..." : "Post"}
                </button>
              </div>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
