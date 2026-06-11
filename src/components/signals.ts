import type { DiscourseSignal } from "@/lib/ai";

export const SIGNAL_ICONS: Record<DiscourseSignal, string> = {
  answered_question: "✅",
  acknowledged_valid_point: "🤝",
  accurately_represented_opponent: "🎯",
  constructive_contribution: "💡",
  partially_answered_question: "⚠️",
  off_topic: "↩️",
  personal_attack: "🚫",
  strawman_argument: "🎪",
  motive_attribution: "🔮",
  topic_derailment: "🌀",
  escalatory_language: "🔥",
};

export const SIGNAL_LABELS: Record<DiscourseSignal, string> = {
  answered_question: "Answered a question directly",
  acknowledged_valid_point: "Acknowledged a valid point",
  accurately_represented_opponent: "Accurately represented the opposing view",
  constructive_contribution: "Made a constructive contribution",
  partially_answered_question: "Partially answered a question",
  off_topic: "Off-topic",
  personal_attack: "Personal attack",
  strawman_argument: "Strawman argument",
  motive_attribution: "Attributed motives without evidence",
  topic_derailment: "Derailed the topic",
  escalatory_language: "Used escalatory language",
};

export const SIGNAL_CATEGORY: Record<
  DiscourseSignal,
  "positive" | "neutral" | "negative"
> = {
  answered_question: "positive",
  acknowledged_valid_point: "positive",
  accurately_represented_opponent: "positive",
  constructive_contribution: "positive",
  partially_answered_question: "neutral",
  off_topic: "neutral",
  personal_attack: "negative",
  strawman_argument: "negative",
  motive_attribution: "negative",
  topic_derailment: "negative",
  escalatory_language: "negative",
};

export const SIGNAL_COLORS: Record<"positive" | "neutral" | "negative", string> =
  {
    positive: "text-emerald-700 bg-emerald-50 border-emerald-200",
    neutral: "text-amber-700 bg-amber-50 border-amber-200",
    negative: "text-red-700 bg-red-50 border-red-200",
  };
