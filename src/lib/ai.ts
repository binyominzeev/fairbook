import OpenAI from "openai";

const client = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY ?? "sk-placeholder",
});

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

const SYSTEM_PROMPT = `You are a discourse quality analyzer for a social network that values intellectual honesty, respectful disagreement, and accurate representation of opposing views.

Analyze the given comment and return a JSON object with these fields:
- positiveSignals: array of positive discourse signals present (from the list below)
- negativeSignals: array of negative discourse signals present (from the list below)
- neutralSignals: array of neutral signals present (from the list below)
- explanation: a 1–2 sentence neutral explanation of your assessment

Positive signals: answered_question, acknowledged_valid_point, accurately_represented_opponent, constructive_contribution
Neutral signals: partially_answered_question, off_topic
Negative signals: personal_attack, strawman_argument, motive_attribution, topic_derailment, escalatory_language

Be conservative — only flag a signal when clearly present. Return valid JSON only.`;

export async function analyzeComment(
  commentContent: string,
  threadContext?: string
): Promise<DiscourseAnalysis> {
  const userMessage = threadContext
    ? `Thread context:\n${threadContext}\n\nComment to analyze:\n${commentContent}`
    : `Comment to analyze:\n${commentContent}`;

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
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

const STEELMAN_PROMPT = `You are a steelman generator. Given a user's comments in a discussion, produce a fair, charitable, and accurate summary of their position — capturing their strongest arguments without distortion or ridicule.

The summary should:
- Represent the view as the person would ideally state it themselves
- Be 2–4 sentences
- Be neutral in tone
- Avoid strawmanning or weakening the position

Return only the summary text.`;

export async function generateSteelman(
  authorName: string,
  comments: string[]
): Promise<string> {
  const content = comments.map((c, i) => `[${i + 1}] ${c}`).join("\n");
  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: STEELMAN_PROMPT },
        {
          role: "user",
          content: `Generate a steelman summary of ${authorName}'s position based on these comments:\n\n${content}`,
        },
      ],
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content ?? "Unable to generate summary.";
  } catch {
    return "Unable to generate summary.";
  }
}

const REFLECTION_PROMPT = `You are a discourse reflection assistant. Given a discussion thread, identify:
1. Areas of agreement between participants
2. Areas of disagreement
3. Unresolved questions that remain open
4. Observations about the quality of discourse (without judging individuals)

Return a JSON object with:
- agreementAreas: string[]
- disagreementAreas: string[]
- unresolvedQuestions: string[]
- qualityObservations: string[]

Be specific and grounded in what was actually said. Return valid JSON only.`;

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
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: REFLECTION_PROMPT },
        { role: "user", content: `Analyze this discussion thread:\n\n${thread}` },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
    });
    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw);
    return {
      agreementAreas: parsed.agreementAreas ?? [],
      disagreementAreas: parsed.disagreementAreas ?? [],
      unresolvedQuestions: parsed.unresolvedQuestions ?? [],
      qualityObservations: parsed.qualityObservations ?? [],
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
