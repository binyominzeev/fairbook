"use client";

import { useEffect } from "react";

const MAX_ATTEMPTS = 20;
const RETRY_DELAY_MS = 120;

function getCommentTargetId() {
  if (typeof window === "undefined") return null;

  const hash = window.location.hash;
  if (!hash.startsWith("#comment-")) return null;

  return decodeURIComponent(hash.slice(1));
}

export default function CommentHashScroller() {
  useEffect(() => {
    let timeoutId: number | null = null;

    const scrollToHashTarget = () => {
      const targetId = getCommentTargetId();
      if (!targetId) return;

      let attempts = 0;

      const tryScroll = () => {
        const target = document.getElementById(targetId);
        if (!target) {
          if (attempts < MAX_ATTEMPTS) {
            attempts += 1;
            timeoutId = window.setTimeout(tryScroll, RETRY_DELAY_MS);
          }
          return;
        }

        const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        target.scrollIntoView({
          behavior: reduceMotion ? "auto" : "smooth",
          block: "start",
        });
      };

      tryScroll();
    };

    scrollToHashTarget();
    window.addEventListener("hashchange", scrollToHashTarget);

    return () => {
      window.removeEventListener("hashchange", scrollToHashTarget);
      if (timeoutId !== null) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  return null;
}