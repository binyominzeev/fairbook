"use client";

import { useState } from "react";
import PostComposerDialog from "./PostComposerDialog";
import { useRouter } from "next/navigation";

export default function CreatePostForm() {
  const router = useRouter();
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [notice, setNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);

  const openTextCardCreator = (content: string) => {
    const params = new URLSearchParams();
    if (content.trim().length > 0) {
      params.set("text", content);
    }
    setIsComposerOpen(false);
    router.push(params.toString() ? `/feed/text-cards?${params.toString()}` : "/feed/text-cards");
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
      {notice && (
        <p className={`mt-2 text-xs ${notice.kind === "warning" ? "text-amber-700" : "text-emerald-700"}`}>
          {notice.message}
        </p>
      )}

      {isComposerOpen && (
        <PostComposerDialog
          onClose={() => setIsComposerOpen(false)}
          onOpenTextCardCreator={openTextCardCreator}
          onSuccess={(result) => {
            setNotice({
              kind: result.moderation?.status === "author_only" ? "warning" : "success",
              message: result.message ?? "Post accepted.",
            });
            setIsComposerOpen(false);
          }}
        />
      )}
    </div>
  );
}
