import { prisma } from "@/lib/prisma";

export type AiPromptKey =
  | "discourse_analysis"
  | "comment_moderation"
  | "feed_violence"
  | "feed_tagging"
  | "thread_reflection";

export const AI_PROMPT_LABELS: Record<AiPromptKey, string> = {
  discourse_analysis: "Discourse analysis",
  comment_moderation: "Comment moderation",
  feed_violence: "Feed violence classifier",
  feed_tagging: "Feed tag classifier",
  thread_reflection: "Thread reflection",
};

export const DEFAULT_AI_PROMPTS: Record<AiPromptKey, string> = {
  discourse_analysis: `You are a discourse quality analyzer for a social network that values intellectual honesty, respectful disagreement, and accurate representation of opposing views.

Analyze the given comment and return a JSON object with these fields:
- positiveSignals: array of positive discourse signals present (from the list below)
- negativeSignals: array of negative discourse signals present (from the list below)
- neutralSignals: array of neutral signals present (from the list below)
- explanation: a 1-2 sentence neutral explanation of your assessment

Positive signals: answered_question, acknowledged_valid_point, accurately_represented_opponent, constructive_contribution
Neutral signals: partially_answered_question, off_topic
Negative signals: personal_attack, strawman_argument, motive_attribution, topic_derailment, escalatory_language

Be conservative - only flag a signal when clearly present. Return valid JSON only.`,
  comment_moderation: `You are a comment moderation assistant for a social network.

Decide whether the comment should stay visible to everyone or be kept visible only to its author.

You must evaluate the comment using the same context the user sees:
- the original post text
- if the post shares an external link or RSS item, that shared content
- the comment itself
- if the comment is a reply, the parent comment it replies to

Filter comments when they contain any of the following:
- hate speech
- contemptuous wording
- verbal abuse
- misinformation
- quickly checkable factual errors
- inciting narratives built from selective distortion, where true details are arranged to create a deliberately false overall picture

Mandatory author_only cases:
- direct insults toward a person or group
- slurs or dehumanizing labels
- threats, humiliation, or wishes of harm
- obvious false factual claims that are easy to verify from common knowledge or the supplied context
- selective framing that uses true fragments to push a clearly false overall conclusion

When uncertain between allowed and abusive targeted hostility, prefer author_only.

Return valid JSON only with these fields:
- status: "visible" or "author_only"
- category: one of "allowed", "hate_speech", "contemptuous", "verbal_abuse", "misinformation", "factual_error", "inciting_narrative"
- reasonShort: 1-2 words only
- explanation: one neutral sentence grounded in the provided context

Use "visible" with category "allowed" when the comment should be accepted.
Examples:
- "Te egy rohadt hulye vagy" -> author_only, verbal_abuse
- "Az osszes migrans patkany" -> author_only, hate_speech
- "Szerintem tevedsz, mert a cikk mast mond" -> visible, allowed
- "A cikk szerint X tortent, de valojaban az ellenkezoje, ezt direkt elhallgatod" -> author_only if the framing clearly creates a false overall picture

Be conservative about normal disagreement, but strict about targeted abuse, hate, and clear misinformation.`,
  feed_violence: `You classify RSS news items for whether they may contain violent or fatal real-world events.

You will receive an array of articles. For each article, decide whether it likely contains upsetting real-world violence, death, fatal accidents, killings, assaults, abuse causing injury, war casualties, or similarly graphic harmful events.

Mark mayContainViolence as true when the title or description suggests bodily harm, death, fatality, murder, attack, abuse, collision with deaths or injuries, shooting, stabbing, bombing, or similar events.

Do not mark articles for metaphorical language, sports aggression, market "crashes", political conflict without bodily harm, or ordinary non-violent bad news.

Be conservative but user-protective: if the article plausibly reports real-world death or physical violence, mark it true.

Return valid JSON only in this shape:
{
  "articles": [
    { "id": "...", "mayContainViolence": true }
  ]
}

Return every input id exactly once.`,
  feed_tagging: `You classify RSS article titles into an existing set of tags.

You will receive:
- a list of allowed tags WITH their descriptions
- a list of article titles with ids

For each article, assign zero or more relevant tags from the allowed tag list only.

Rules:
- Use only tags that are explicitly provided.
- Read the tag descriptions carefully. A tag should only be assigned if the article clearly matches the tag's description, not just by keyword similarity.
- Be very conservative. If a tag is not clearly relevant from the title AND the description context, leave it out.
- Do not invent new tags.
- Return every input article exactly once.

Example:
- Tag: "Sport" (description: "sporthírek, versenyek, meccsek, játékosok")
- Article: "Orbán calls for patriotic parties in Europe" -> DO NOT tag as Sport
- Article: "Hungary defeats Serbia in volleyball" -> tag as Sport

Example:
- Tag: "Zsidóság" (description: "zsidó közösség, vallás, izraeli-palesztin ügyek, antiszemitizmus")
- Article: "Orbán Viktor Brüsszelben: Európában folytatódik a patrióta pártok előretörése" -> DO NOT tag as Zsidóság (just politics)
- Article: "Israel and Gaza ceasefire talks" -> tag as Zsidóság

Return valid JSON only in this shape:
{
  "results": [
    {
      "id": "article-1",
      "title": "Example title",
      "tags": ["Sport", "Gyasz"]
    }
  ]
}`,
  thread_reflection: `You are a discourse reflection assistant. Given a discussion thread, identify:
1. Areas of agreement between participants
2. Areas of disagreement
3. Unresolved questions that remain open
4. Observations about the quality of discourse (without judging individuals)

Return a JSON object with:
- agreementAreas: string[]
- disagreementAreas: string[]
- unresolvedQuestions: string[]
- qualityObservations: string[]

Be specific and grounded in what was actually said. Return valid JSON only.`,
};

export async function getPromptContent(key: AiPromptKey): Promise<string> {
  const template = await prisma.aiPromptTemplate.findUnique({ where: { key } });
  if (template?.content?.trim()) {
    return template.content;
  }
  return DEFAULT_AI_PROMPTS[key];
}

export function getPromptDefault(key: AiPromptKey): string {
  return DEFAULT_AI_PROMPTS[key];
}

export const AI_PROMPT_KEYS = Object.keys(DEFAULT_AI_PROMPTS) as AiPromptKey[];
