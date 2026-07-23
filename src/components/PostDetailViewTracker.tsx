"use client";

import { useEffect, useMemo } from "react";
import {
  createAnonymousPostViewTracker,
  createRegisteredPostViewTracker,
} from "@/components/post-view-tracking";

type Props = {
  postId: string;
  currentUserId?: string;
  enabled?: boolean;
};

export default function PostDetailViewTracker({ postId, currentUserId = "", enabled = true }: Props) {
  const tracker = useMemo(
    () =>
      currentUserId
        ? createRegisteredPostViewTracker("post_detail")
        : createAnonymousPostViewTracker(),
    [currentUserId]
  );

  useEffect(() => {
    if (!enabled) {
      return;
    }

    const normalizedPostId = postId.trim();
    if (!normalizedPostId) {
      return;
    }

    tracker.queue(normalizedPostId);

    return () => tracker.dispose();
  }, [enabled, postId, tracker]);

  return null;
}
