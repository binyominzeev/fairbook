import OpenAI from "openai";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPromptContent } from "@/lib/ai-prompts";
import { loadPostModerationContext } from "@/lib/post-moderation-context";
import { prisma } from "@/lib/prisma";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const ASSISTANT_PROMPT = `You are an admin-side moderation copilot.

Your goals:
- Explain clearly why the post may have been filtered.
- Identify potential false positives.
- Suggest concrete moderation prompt improvements.
- Preserve strict safety behavior for hate speech and abuse.

Return JSON only with fields:
- reply: concise explanation for the admin
- suggestedPromptPatch: optional prompt text suggestion, empty string if none
- riskNotes: array of short risk notes`;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/post-appeals/[id]/assistant">
) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    return Response.json({ error: "OPENAI_API_KEY is not configured." }, { status: 400 });
  }

  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const message = typeof body?.message === "string" ? body.message.trim() : "";
  const history: ChatTurn[] = Array.isArray(body?.history)
    ? body.history
        .filter(
          (turn: unknown): turn is ChatTurn =>
            Boolean(turn) &&
            typeof turn === "object" &&
            (turn as ChatTurn).role !== undefined &&
            ((turn as ChatTurn).role === "user" || (turn as ChatTurn).role === "assistant") &&
            typeof (turn as ChatTurn).content === "string"
        )
        .slice(-8)
    : [];

  if (!message) {
    return Response.json({ error: "Message is required." }, { status: 400 });
  }

  const appeal = await prisma.postAppeal.findUnique({
    where: { id },
    select: { id: true, postId: true, requestText: true, createdAt: true },
  });
  if (!appeal) {
    return Response.json({ error: "Appeal not found." }, { status: 404 });
  }

  const context = await loadPostModerationContext(appeal.postId);
  if (!context) {
    return Response.json({ error: "Post not found." }, { status: 404 });
  }

  const moderationPrompt = await getPromptContent("comment_moderation");

  const modelInput = {
    appeal: {
      id: appeal.id,
      requestText: appeal.requestText,
      createdAt: appeal.createdAt,
    },
    post: {
      content: context.post.content,
      moderationStatus: context.post.moderationStatus,
      moderationReason: context.post.moderationReason,
      moderationExplanation: context.post.moderationExplanation,
      author: {
        id: context.post.author.id,
        name: context.post.author.name,
        email: context.post.author.email,
      },
    },
    postContext: {
      postContent: context.postContent,
      sharedContent: context.sharedContent,
    },
    activeModerationPrompt: moderationPrompt,
  };

  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: ASSISTANT_PROMPT },
        { role: "user", content: `Case:\n${JSON.stringify(modelInput, null, 2)}` },
        ...history.map((turn) => ({ role: turn.role, content: turn.content })),
        { role: "user", content: message },
      ],
      response_format: { type: "json_object" },
      temperature: 0.2,
    });

    const raw = response.choices[0]?.message?.content ?? "{}";
    const parsed = JSON.parse(raw) as {
      reply?: string;
      suggestedPromptPatch?: string;
      riskNotes?: string[];
    };

    return Response.json({
      reply: parsed.reply ?? "",
      suggestedPromptPatch: parsed.suggestedPromptPatch ?? "",
      riskNotes: Array.isArray(parsed.riskNotes) ? parsed.riskNotes : [],
    });
  } catch (error) {
    const messageText = error instanceof Error ? error.message : "Unknown OpenAI error";
    return Response.json({ error: `Copilot discussion failed: ${messageText}` }, { status: 502 });
  }
}
