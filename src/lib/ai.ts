import OpenAI from "openai";
import { getPromptContent } from "@/lib/ai-prompts";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (_client) return _client;

  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    if (process.env.NODE_ENV === "production") {
      throw new Error(
        "OPENAI_API_KEY environment variable is required in production."
      );
    }

    console.warn(
      "[fairbook] OPENAI_API_KEY is not set. AI features will return empty results."
    );

    _client = new OpenAI({ apiKey: "sk-placeholder" });
  } else {
    _client = new OpenAI({ apiKey });
  }

  return _client;
}

function getApiKey() {
  return process.env.OPENAI_API_KEY?.trim() || null;
}

export type DiscourseSignal =
  // Positive
  | "answered_question"
  | "acknowledged_valid_point"
  | "accurately_represented_opponent"
  | "constructive_contribution"
  // Neutral
  | "partially_answered_question"
  | "off_topic"
  // Negative
  | "personal_attack"
  | "strawman_argument"
  | "motive_attribution"
  | "topic_derailment"
  | "escalatory_language";

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

export interface DiscourseAnalysis {
  positiveSignals: DiscourseSignal[];
  negativeSignals: DiscourseSignal[];
  neutralSignals: DiscourseSignal[];
  explanation: string;
}

export type CommentModerationCategory =
  | "allowed"
  | "personal_attack"
  | "verbal_abuse"
  | "hate_speech"
  | "group_degradation"
  | "threat"
  | "factual_error"
  | "moderation_unavailable";

export type CommentModerationStatus = "visible" | "author_only";

export interface CommentModerationResult {
  status: CommentModerationStatus;
  category: CommentModerationCategory;
  reasonShort: string;
  explanation: string;
  source: "rules" | "ai" | "fallback";
  diagnostic?: string;
}

const MODERATION_REASON_LABELS: Record<
  Exclude<CommentModerationCategory, "allowed">,
  string
> = {
  personal_attack: "Personal attack",
  verbal_abuse: "Verbal abuse",
  hate_speech: "Hate speech",
  group_degradation: "Group degradation",
  threat: "Threat",
  factual_error: "False claim",
  moderation_unavailable: "AI issue",
};

/**
 * These are deliberately narrow.
 *
 * The rule-based layer is only a safety net for obvious cases.
 * It should NOT attempt to determine whether an opinion is offensive,
 * controversial, politically incorrect, religiously controversial, etc.
 *
 * Substantive disagreement is handled by the AI moderation prompt.
 */
const RULE_BASED_MODERATION: Array<{
  category: Exclude<
    CommentModerationCategory,
    "allowed" | "factual_error" | "moderation_unavailable"
  >;
  reasonShort: string;
  explanation: string;
  patterns: RegExp[];
}> = [
  {
    category: "hate_speech",
    reasonShort: "Hate speech",
    explanation:
      "The comment contains clearly dehumanizing or group-targeted hostile language.",
    patterns: [
      // Explicitly dehumanizing a group
      /\b(?:zsid[oó]k?|cig[aá]nyok?|migr[aá]nsok?|muszlimok?|kereszt[eé]nyek?|melegek?|transz(?:nem[uű]ek)?|palesztinok?|arabok?)\b.{0,30}\b(?:patk[aá]nyok?|férgek?|férgeknek|állatok?|szem[eé]t|szem[eé]tek|alával[oó]k|undor[ií]t[oó]k)\b/iu,

      // Explicit calls for extermination / removal
      /\b(?:ki\s+kell\s+irtani|meg\s+kell\s+tiszt[ií]tani|el\s+kell\s+takar[ií]tani|puszt[ií]tani\s+kell)\b.{0,50}\b(?:zsid[oó]k?|cig[aá]nyok?|migr[aá]nsok?|buzik?|melegek?|muszlimok?|palesztinok?|arabok?)\b/iu,

      // Clear English group-directed dehumanization
      /\b(?:all|every)\s+(?:gays?|jews?|muslims?|immigrants?|romani|palestinians?)\b.{0,30}\b(?:are|should\s+be)\b.{0,20}\b(?:vermin|animals?|subhuman|worms?|filth|scum)\b/iu,
    ],
  },

  {
    category: "verbal_abuse",
    reasonShort: "Verbal abuse",
    explanation:
      "The comment contains a direct abusive insult aimed at a person.",
    patterns: [
      // Direct second-person insults
      /\b(?:te|ti|you)\b.{0,25}\b(?:kurva|fasz|h[üu]lye|id[ií]ota|barom|nyomor[eé]k|szarh[aá]zi|retard[aá]lt)\b/iu,

      // Explicit abusive imperatives
      /\b(?:d[oö]gj(?:e|etek)?\s+meg|rohadj(?:atok)?\s+meg|fuck\s+you)\b/iu,

      // Common direct Hungarian insults
      /\b(?:semmirekell[oő]|szaralak|h[üu]lye\s+picsa|h[üu]lye\s+fasz)\b/iu,

      // Direct English personal insults
      /\b(?:you\s+are|you're)\s+(?:an?\s+)?(?:idiot|moron|stupid|retard|piece\s+of\s+shit)\b/iu,
    ],
  },

  {
    category: "personal_attack",
    reasonShort: "Personal attack",
    explanation:
      "The comment directly attacks or humiliates a person instead of addressing the person's argument or claim.",
    patterns: [
      // "te/you + negative personal characterization"
      /\b(?:te|you)\b.{0,20}\b(?:hazug|ostoba|hülye|idióta|tudatlan|alkalmatlan|fogalmad\s+sincs|fogalma\s+sincs)\b/iu,
      /\b(?:ennek\s+a\s+)?(?:rabbinak|embernek|szerz[oő]nek|ír[oó]nak)\b.{0,30}\b(?:fogalma\s+sincs|semmit\s+sem\s+tud|hülye|ostoba|idióta)\b/iu,
      /\b(?:you\s+have\s+no\s+idea|you\s+know\s+nothing|you\s+are\s+ignorant)\b/iu,
    ],
  },

  {
    category: "group_degradation",
    reasonShort: "Group degradation",
    explanation:
      "The comment uses degrading language or a degrading comparison to ridicule people based on their group identity.",
    patterns: [
      // Explicit identity-based degradation
      /\b(?:zsid[oó]k?|cig[aá]nyok?|migr[aá]nsok?|muszlimok?|kereszt[eé]nyek?|palesztinok?|arabok?|melegek?|transz(?:nem[uű]ek)?)\b.{0,30}\b(?:nevets[eé]ges|szánalmas|undor[ií]t[oó]|gusztustalan|férgek?|patk[aá]nyok?)\b/iu,

      // "X olyan mint..." style degrading identity comparisons
      /\b(?:olyan\s+mint|ugyanolyan\s+mint|mintha)\b.{0,80}\b(?:transz|meleg|zsid[oó]|palesztin|cig[aá]ny|migr[aá]ns|muszlim)\w*\b.{0,80}\b(?:nevets[eé]ges|nem\s+l[eé]tezik|nem\s+ember|állat|patk[aá]ny|féreg)\w*\b/iu,

      // Generic explicit identity ridicule
      /\b(?:az\s+ilyen|ezek\s+az)\s+(?:emberek|embereknek)\b.{0,30}\b(?:nevets[eé]gesek|férgek|patk[aá]nyok|szánalmasak|nem\s+emberek)\b/iu,
    ],
  },
];

function createFallbackModerationResult(
  reasonShort: string,
  explanation: string,
  diagnostic: string
): CommentModerationResult {
  return {
    status: "author_only",
    category: "moderation_unavailable",
    reasonShort,
    explanation,
    source: "fallback",
    diagnostic,
  };
}

function runRuleBasedModeration(
  input: CommentModerationInput
): CommentModerationResult | null {
  const haystack = input.commentContent;

  for (const rule of RULE_BASED_MODERATION) {
    if (rule.patterns.some((pattern) => pattern.test(haystack))) {
      return {
        status: "author_only",
        category: rule.category,
        reasonShort: rule.reasonShort,
        explanation: rule.explanation,
        source: "rules",
      };
    }
  }

  return null;
}

/**
 * Normalizes the AI result and, critically, enforces the invariant:
 *
 *   allowed             -> visible
 *   everything else     -> author_only
 *
 * The AI is allowed to determine the category.
 * The application determines what that category means for visibility.
 */
function normalizeModerationResult(
  parsed: Partial<CommentModerationResult> | null | undefined
): CommentModerationResult {
  const rawCategory = parsed?.category;

  const allowedCategories: CommentModerationCategory[] = [
    "allowed",
    "personal_attack",
    "verbal_abuse",
    "hate_speech",
    "group_degradation",
    "threat",
    "factual_error",
    "moderation_unavailable",
  ];

  const isValidCategory = allowedCategories.includes(
    rawCategory as CommentModerationCategory
  );

  // Never silently turn an invalid AI response into "allowed".
  if (!isValidCategory) {
    return {
      status: "author_only",
      category: "moderation_unavailable",
      reasonShort: "AI issue",
      explanation:
        "The moderation result could not be interpreted safely, so the comment is temporarily held back.",
      source: "ai",
      diagnostic: `Invalid moderation category returned by AI: ${String(rawCategory)}`,
    };
  }

  const safeCategory = rawCategory as CommentModerationCategory;

  // This is intentionally deterministic.
  // The AI cannot accidentally return "visible" for a prohibited category.
  const safeStatus: CommentModerationStatus =
    safeCategory === "allowed" ? "visible" : "author_only";

  const fallbackReason =
    safeCategory === "allowed"
      ? "Accepted"
      : MODERATION_REASON_LABELS[safeCategory];

  return {
    status: safeStatus,
    category: safeCategory,
    reasonShort:
      typeof parsed?.reasonShort === "string" && parsed.reasonShort.trim()
        ? parsed.reasonShort.trim().split(/\s+/).slice(0, 2).join(" ")
        : fallbackReason,
    explanation:
      typeof parsed?.explanation === "string" && parsed.explanation.trim()
        ? parsed.explanation.trim()
        : safeCategory === "allowed"
          ? "Comment accepted."
          : "Comment is visible only to its author because it matched a moderation rule.",
    source:
      parsed?.source === "rules" || parsed?.source === "fallback"
        ? parsed.source
        : "ai",
    diagnostic:
      typeof parsed?.diagnostic === "string" && parsed.diagnostic.trim()
        ? parsed.diagnostic.trim()
        : undefined,
  };
}

export async function analyzeComment(
  commentContent: string,
  threadContext?: string
): Promise<DiscourseAnalysis> {
  const userMessage = threadContext
    ? `Thread context:\n${threadContext}\n\nComment to analyze:\n${commentContent}`
    : `Comment to analyze:\n${commentContent}`;

  try {
    const systemPrompt = await getPromptContent("discourse_analysis");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);

    return {
      positiveSignals: (parsed.positiveSignals ?? []) as DiscourseSignal[],
      negativeSignals: (parsed.negativeSignals ?? []) as DiscourseSignal[],
      neutralSignals: (parsed.neutralSignals ?? []) as DiscourseSignal[],
      explanation: parsed.explanation ?? "",
    };
  } catch {
    return {
      positiveSignals: [],
      negativeSignals: [],
      neutralSignals: [],
      explanation: "Analysis unavailable.",
    };
  }
}

export interface CommentModerationInput {
  postContent?: string;
  sharedContent?: string;
  parentComment?: string;
  commentContent: string;
}

export interface PostModerationInput {
  postContent?: string;
  sharedContent?: string;
}

export interface FeedArticleViolenceInput {
  id: string;
  title?: string | null;
  description?: string | null;
  source?: string | null;
  url?: string | null;
}

export interface FeedArticleViolenceResult {
  id: string;
  mayContainViolence: boolean;
}

export interface FeedArticleTaggingInput {
  id: string;
  title: string;
}

export interface FeedArticleTaggingResult {
  id: string;
  title: string;
  tags: string[];
}

export async function moderateComment({
  postContent,
  sharedContent,
  parentComment,
  commentContent,
}: CommentModerationInput): Promise<CommentModerationResult> {
  const ruleMatch = runRuleBasedModeration({
    postContent,
    sharedContent,
    parentComment,
    commentContent,
  });

  if (ruleMatch) {
    return ruleMatch;
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    return createFallbackModerationResult(
      "AI unavailable",
      "The comment is visible only to you until AI moderation is configured correctly.",
      "OPENAI_API_KEY is missing or empty, so no moderation API call was made."
    );
  }

  const contextParts = [
    postContent?.trim()
      ? `Original post:\n${postContent.trim()}`
      : null,

    sharedContent?.trim()
      ? `Shared article or RSS content:\n${sharedContent.trim()}`
      : null,

    parentComment?.trim()
      ? `Parent comment:\n${parentComment.trim()}`
      : null,

    `Comment to moderate:\n${commentContent.trim()}`,
  ].filter(Boolean);

  try {
    const moderationPrompt = await getPromptContent("comment_moderation");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: moderationPrompt },
        {
          role: "user",
          content: contextParts.join("\n\n"),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    const parsed = JSON.parse(raw) as Partial<CommentModerationResult>;

    /*
     * IMPORTANT:
     *
     * We deliberately do NOT trust parsed.status.
     *
     * The model determines the category, but visibility is derived
     * deterministically from that category by normalizeModerationResult().
     */
    return normalizeModerationResult({
      ...parsed,
      source: "ai",
    });
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI error";

    console.error(
      "[fairbook] Comment moderation failed:",
      message
    );

    return createFallbackModerationResult(
      "AI error",
      "The comment is visible only to you until the moderation error is fixed.",
      `Moderation request failed before completing: ${message}`
    );
  }
}

export async function moderatePost({
  postContent,
  sharedContent,
}: PostModerationInput): Promise<CommentModerationResult> {
  return moderateComment({
    postContent: undefined,
    sharedContent,
    parentComment: undefined,
    commentContent: postContent?.trim() || "[link-only post]",
  });
}

export async function classifyFeedArticlesForViolence(
  articles: FeedArticleViolenceInput[]
): Promise<FeedArticleViolenceResult[]> {
  if (articles.length === 0) {
    return [];
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    return articles.map((article) => ({
      id: article.id,
      mayContainViolence: false,
    }));
  }

  const articleIds = new Set(articles.map((article) => article.id));

  try {
    const feedViolencePrompt = await getPromptContent("feed_violence");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: feedViolencePrompt },
        {
          role: "user",
          content: JSON.stringify({
            articles: articles.map((article) => ({
              id: article.id,
              title: article.title ?? null,
              description: article.description ?? null,
              source: article.source ?? null,
              url: article.url ?? null,
            })),
          }),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";

    const parsed = JSON.parse(raw) as {
      articles?: Array<{
        id?: string;
        mayContainViolence?: boolean;
      }>;
    };

    const results = new Map<string, boolean>();

    for (const item of parsed.articles ?? []) {
      if (
        typeof item.id !== "string" ||
        !articleIds.has(item.id)
      ) {
        continue;
      }

      results.set(
        item.id,
        item.mayContainViolence === true
      );
    }

    return articles.map((article) => ({
      id: article.id,
      mayContainViolence:
        results.get(article.id) === true,
    }));
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unknown OpenAI error";

    console.error(
      "[fairbook] RSS violence classification failed:",
      message
    );

    return articles.map((article) => ({
      id: article.id,
      mayContainViolence: false,
    }));
  }
}

export async function classifyFeedArticlesByTags(
  tagsWithDescriptions: Array<{
    name: string;
    description?: string | null;
  }>,
  articles: FeedArticleTaggingInput[]
): Promise<FeedArticleTaggingResult[]> {
  if (
    tagsWithDescriptions.length === 0 ||
    articles.length === 0
  ) {
    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      tags: [],
    }));
  }

  const apiKey = getApiKey();

  if (!apiKey) {
    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      tags: [],
    }));
  }

  const allowedTagNames = new Set(
    tagsWithDescriptions.map((t) => t.name)
  );

  const articleIds = new Set(
    articles.map((article) => article.id)
  );

  try {
    const feedTaggingPrompt =
      await getPromptContent("feed_tagging");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: feedTaggingPrompt },
        {
          role: "user",
          content: JSON.stringify({
            tags: tagsWithDescriptions.map((t) => ({
              name: t.name,
              description:
                t.description || "no description provided",
            })),
            articles: articles.map((article) => ({
              id: article.id,
              title: article.title,
            })),
          }),
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0,
    });

    const raw =
      response.choices[0]?.message?.content ?? "{}";

    const parsed = JSON.parse(raw) as {
      results?: Array<{
        id?: string;
        title?: string;
        tags?: unknown;
      }>;
    };

    const byId = new Map<
      string,
      FeedArticleTaggingResult
    >();

    for (const item of parsed.results ?? []) {
      if (
        typeof item.id !== "string" ||
        !articleIds.has(item.id)
      ) {
        continue;
      }

      const normalizedTags = Array.isArray(item.tags)
        ? item.tags.filter(
            (
              tag
            ): tag is string =>
              typeof tag === "string" &&
              allowedTagNames.has(tag)
          )
        : [];

      byId.set(item.id, {
        id: item.id,
        title:
          typeof item.title === "string" &&
          item.title.trim()
            ? item.title.trim()
            : articles.find(
                (article) =>
                  article.id === item.id
              )?.title ?? "",
        tags: Array.from(
          new Set(normalizedTags)
        ),
      });
    }

    return articles.map(
      (article) =>
        byId.get(article.id) ?? {
          id: article.id,
          title: article.title,
          tags: [],
        }
    );
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "Unknown OpenAI error";

    console.error(
      "[fairbook] RSS tag classification failed:",
      message
    );

    return articles.map((article) => ({
      id: article.id,
      title: article.title,
      tags: [],
    }));
  }
}

export interface ThreadReflectionData {
  agreementAreas: string[];
  disagreementAreas: string[];
  unresolvedQuestions: string[];
  qualityObservations: string[];
}

export async function generateReflection(
  thread: string
): Promise<ThreadReflectionData> {
  try {
    const reflectionPrompt =
      await getPromptContent("thread_reflection");

    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content: reflectionPrompt,
        },
        {
          role: "user",
          content:
            `Analyze this discussion thread:\n\n${thread}`,
        },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });

    const raw =
      response.choices[0]?.message?.content ?? "{}";

    const parsed = JSON.parse(raw);

    return {
      agreementAreas: parsed.agreementAreas ?? [],
      disagreementAreas:
        parsed.disagreementAreas ?? [],
      unresolvedQuestions:
        parsed.unresolvedQuestions ?? [],
      qualityObservations:
        parsed.qualityObservations ?? [],
    };
  } catch {
    return {
      agreementAreas: [],
      disagreementAreas: [],
      unresolvedQuestions: [],
      qualityObservations: [],
    };
  }
}