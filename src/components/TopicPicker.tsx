"use client";

import { useEffect, useState } from "react";
import { t } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";

export type TopicPickerItem = {
  id: string;
  name: string;
  defaultColor?: string | null;
  buttonColor?: string | null;
  postCount?: number;
};

interface TopicPickerProps {
  selectedTopicId: string;
  onSelectTopicId: (topicId: string) => void;
  newTopicName: string;
  onChangeNewTopicName: (name: string) => void;
  topics?: TopicPickerItem[];
  loading?: boolean;
  label?: string;
  helpText?: string;
  className?: string;
}

export default function TopicPicker({
  selectedTopicId,
  onSelectTopicId,
  newTopicName,
  onChangeNewTopicName,
  topics: externalTopics,
  loading: externalLoading,
  label,
  helpText,
  className = "",
}: TopicPickerProps) {
  const locale = useAppLocale();
  const [internalTopics, setInternalTopics] = useState<TopicPickerItem[]>([]);
  const [internalLoading, setInternalLoading] = useState(false);

  const isSelfFetching = externalTopics === undefined;
  const topics = externalTopics ?? internalTopics;
  const loading = externalLoading ?? (isSelfFetching ? internalLoading : false);

  useEffect(() => {
    if (!isSelfFetching) return;

    let cancelled = false;

    void (async () => {
      setInternalLoading(true);
      try {
        const response = await fetch("/api/topics");
        if (!response.ok) return;

        const data = (await response.json()) as {
          topics?: TopicPickerItem[];
        };
        if (cancelled) return;

        setInternalTopics(Array.isArray(data.topics) ? data.topics : []);
      } finally {
        if (!cancelled) {
          setInternalLoading(false);
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isSelfFetching]);

  return (
    <div className={`rounded-xl border border-slate-200 bg-slate-50 p-3 ${className}`}>
      <label className="mb-1 block text-xs font-medium text-slate-600">
        {label ?? t(locale, "composer.topicLabel")}
      </label>
      {helpText ? <p className="mb-2 text-xs text-slate-500">{helpText}</p> : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => onSelectTopicId("")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedTopicId === ""
              ? "border-slate-900 bg-slate-900 text-white"
              : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
          }`}
        >
          {t(locale, "composer.topicNone")}
        </button>

        {topics.map((topic) => {
          const chipColor = topic.buttonColor ?? topic.defaultColor ?? "#64748B";
          const isSelected = selectedTopicId === topic.id;

          return (
            <button
              key={topic.id}
              type="button"
              onClick={() => onSelectTopicId(topic.id)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold text-white transition-all ${
                isSelected
                  ? "border-slate-900 ring-2 ring-slate-900 ring-offset-1"
                  : "border-transparent opacity-90 hover:opacity-100"
              }`}
              style={{
                backgroundColor: chipColor,
              }}
            >
              {topic.name}
              {typeof topic.postCount === "number" ? ` (${topic.postCount})` : ""}
            </button>
          );
        })}

        <button
          type="button"
          onClick={() => onSelectTopicId("__new__")}
          className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
            selectedTopicId === "__new__"
              ? "border-blue-700 bg-blue-700 text-white"
              : "border-blue-200 bg-blue-50 text-blue-700 hover:border-blue-300"
          }`}
        >
          {t(locale, "composer.topicCreateNew")}
        </button>
      </div>

      {selectedTopicId === "__new__" ? (
        <input
          type="text"
          value={newTopicName}
          onChange={(event) => onChangeNewTopicName(event.target.value)}
          maxLength={40}
          placeholder={t(locale, "composer.topicNamePlaceholder")}
          className="mt-2 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
        />
      ) : null}

      {loading ? (
        <p className="mt-2 text-xs text-slate-500">{t(locale, "composer.topicsLoading")}</p>
      ) : null}
    </div>
  );
}
