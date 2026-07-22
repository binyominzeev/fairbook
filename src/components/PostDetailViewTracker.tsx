"use client";

import { useEffect } from "react";

const trackedDetailViewsBySession = new Set<string>();

type Props = {
  postId: string;
  enabled?: boolean;
};

export default function PostDetailViewTracker({ postId, enabled = true }: Props) {
  useEffect(() => {
    if (!enabled) {
      return;
    }

    const normalizedPostId = postId.trim();
    if (!normalizedPostId) {
      return;
    }

    if (trackedDetailViewsBySession.has(normalizedPostId)) {
      return;
    }

    trackedDetailViewsBySession.add(normalizedPostId);

    void fetch("/api/posts/views/track", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      keepalive: true,
      body: JSON.stringify({
        source: "post_detail",
        postIds: [normalizedPostId],
      }),
    }).catch(() => {
      // Ignore transient tracking failures.
    });
  }, [enabled, postId]);

  return null;
}
