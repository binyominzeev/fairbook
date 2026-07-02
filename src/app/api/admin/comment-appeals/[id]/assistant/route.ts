import OpenAI from "openai";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPromptContent } from "@/lib/ai-prompts";
import { loadCommentModerationContext } from "@/lib/comment-moderation-context";
import { prisma } from "@/lib/prisma";

type ChatTurn = {
  role: "user" | "assistant";
  content: string;
};

const ASSISTANT_PROMPT = `You are an admin-side moderation copilot.

Your goals:
- Explain clearly why the comment may have been filtered.
- Identify potential false positives.
- Suggest concrete moderation prompt improvements.
- Preserve strict safety behavior for hate speech and abuse.

Return JSON only with fields:
- reply: concise explanation for the admin
- suggestedPromptPatch: optional prompt text suggestion, empty string if none
- riskNotes: array of short risk notes`;

export async function POST(
  request: Request,
  ctx: RouteContext<"/api/admin/comment-appeals/[id]/assistant">
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

  const appeal = await prisma.commentAppeal.findUnique({
    where: { id },
    select: { id: true, commentId: true, requestText: true, createdAt: true },
  });
  if (!appeal) {
    return Response.json({ error: "Appeal not found." }, { status: 404 });
  }

  const context = await loadCommentModerationContext(appeal.commentId);
  if (!context) {
    return Response.json({ error: "Comment not found." }, { status: 404 });
  }

  const moderationPrompt = await getPromptContent("comment_moderation");

  const modelInput = {
    appeal: {
      id: appeal.id,
      requestText: appeal.requestText,
      createdAt: appeal.createdAt,
    },
    comment: {
      content: context.comment.content,
      moderationStatus: context.comment.moderationStatus,
      moderationReason: context.comment.moderationReason,
      moderationExplanation: context.comment.moderationExplanation,
      author: {
        id: context.comment.author.id,
        name: context.comment.author.name,
        email: context.comment.author.email,
      },
    },
    postContext: {
      postContent: context.postContent,
      sharedContent: context.sharedContent,
      parentComment: context.parentComment,
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
      riskNotes?: unknown;
    };

    return Response.json({
      reply:
        typeof parsed.reply === "string" && parsed.reply.trim()
          ? parsed.reply.trim()
          : "No explanation available.",
      suggestedPromptPatch:
        typeof parsed.suggestedPromptPatch === "string"
          ? parsed.suggestedPromptPatch
          : "",
      riskNotes: Array.isArray(parsed.riskNotes)
        ? parsed.riskNotes.filter((note): note is string => typeof note === "string")
        : [],
      moderationPrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";
    return Response.json({ error: message }, { status: 500 });
  }
}
