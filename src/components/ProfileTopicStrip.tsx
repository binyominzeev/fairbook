"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { SwatchesPicker, type ColorResult } from "react-color";
import { useMemo, useState, useTransition } from "react";
import { buildProfileTopicPath } from "@/lib/topic-path";

type ProfileTopicStripItem = {
  id: string;
  name: string;
  slug: string;
  postCount: number;
  defaultColor: string;
  buttonColor: string | null;
};

export default function ProfileTopicStrip({
  topics,
  profilePath,
  activeTab,
  showSettings,
  query,
  activeTopicId,
  isOwnProfile,
}: {
  topics: ProfileTopicStripItem[];
  profilePath: string;
  activeTab: "posts" | "likes" | "bookmarks" | "comments" | "hidden";
  showSettings: boolean;
  query: string;
  activeTopicId: string | null;
  isOwnProfile: boolean;
}) {
  const router = useRouter();
  const [isSaving, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [openPickerTopicId, setOpenPickerTopicId] = useState<string | null>(null);
  const [colorByTopic, setColorByTopic] = useState<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const topic of topics) {
      map[topic.id] = topic.buttonColor ?? topic.defaultColor;
    }
    return map;
  });

  const hrefByTopic = useMemo(() => {
    const buildQueryString = () => {
      const params = new URLSearchParams();

      if (activeTab !== "posts") {
        params.set("tab", activeTab);
      }

      if (showSettings) {
        params.set("settings", "1");
      }

      if (query) {
        params.set("q", query);
      }

      return params.toString();
    };

    const queryString = buildQueryString();
    const withQuery = (path: string) => (queryString ? `${path}?${queryString}` : path);

    return {
      all: withQuery(profilePath),
      byTopic: new Map(
        topics.map((topic) => [topic.id, withQuery(buildProfileTopicPath(profilePath, topic.slug))])
      ),
    };
  }, [activeTab, profilePath, query, showSettings, topics]);

  const saveColor = (topicId: string, buttonColor: string) => {
    setError(null);

    startTransition(async () => {
      const response = await fetch("/api/users/topic-preferences", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ topicId, buttonColor }),
      });

      if (!response.ok) {
        setError("Nem sikerult menteni a tema szinet.");
        return;
      }

      router.refresh();
    });
  };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3">
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Témák</p>
        {activeTopicId ? (
          <Link href={hrefByTopic.all} className="text-xs font-medium text-blue-600 hover:underline">
            Szűrő törlése
          </Link>
        ) : null}
      </div>

      <div className="flex flex-wrap gap-2">
        {topics.map((topic) => {
          const isActive = topic.id === activeTopicId;
          const chipColor = colorByTopic[topic.id] ?? topic.defaultColor;

          return (
            <div key={topic.id} className="relative inline-flex items-center gap-1.5">
              <Link
                href={hrefByTopic.byTopic.get(topic.id) ?? hrefByTopic.all}
                className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold transition-opacity ${
                  isActive ? "border-slate-900 text-white" : "border-slate-200 text-white"
                }`}
                style={{ backgroundColor: chipColor, opacity: isActive ? 1 : 0.92 }}
              >
                <span>{topic.name}</span>
              </Link>

              {isOwnProfile ? (
                <>
                  <button
                    type="button"
                    aria-label={`${topic.name} téma színe`}
                    onClick={() =>
                      setOpenPickerTopicId((current) =>
                        current === topic.id ? null : topic.id
                      )
                    }
                    className="inline-flex h-6 w-6 items-center justify-center rounded-full border border-slate-200 bg-white shadow-sm transition-colors hover:border-slate-300"
                  >
                    <span
                      className="h-3.5 w-3.5 rounded-full border border-slate-200"
                      style={{ backgroundColor: chipColor }}
                    />
                  </button>

                  {openPickerTopicId === topic.id ? (
                    <div className="absolute left-0 top-8 z-20 rounded-lg border border-slate-200 bg-white p-2 shadow-xl">
                      <SwatchesPicker
                        color={chipColor}
                        onChangeComplete={(result: ColorResult) => {
                          const nextColor = result.hex;
                          setColorByTopic((current) => ({
                            ...current,
                            [topic.id]: nextColor,
                          }));
                          saveColor(topic.id, nextColor);
                          setOpenPickerTopicId(null);
                        }}
                      />
                    </div>
                  ) : null}
                </>
              ) : null}
            </div>
          );
        })}
      </div>

      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}
      {isSaving ? <p className="mt-2 text-xs text-slate-500">Mentés...</p> : null}
    </div>
  );
}