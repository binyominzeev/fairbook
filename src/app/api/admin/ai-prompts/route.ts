import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import {
  AI_PROMPT_KEYS,
  AI_PROMPT_LABELS,
  getPromptDefault,
  type AiPromptKey,
} from "@/lib/ai-prompts";
import { prisma } from "@/lib/prisma";

function isPromptKey(value: string): value is AiPromptKey {
  return AI_PROMPT_KEYS.includes(value as AiPromptKey);
}

export async function GET() {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const templates = await prisma.aiPromptTemplate.findMany({
    where: { key: { in: AI_PROMPT_KEYS } },
  });
  const byKey = new Map(templates.map((template) => [template.key, template]));

  const prompts = AI_PROMPT_KEYS.map((key) => {
    const customized = byKey.get(key);
    const defaultContent = getPromptDefault(key);
    return {
      key,
      label: AI_PROMPT_LABELS[key],
      content: customized?.content ?? defaultContent,
      defaultContent,
      isCustomized: Boolean(customized),
      updatedAt: customized?.updatedAt ?? null,
      updatedByEmail: customized?.updatedByEmail ?? null,
    };
  });

  return Response.json({ prompts });
}

export async function PATCH(request: Request) {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: "Not authenticated." }, { status: 401 });
  }
  if (!isAdminEmail(session.email)) {
    return Response.json({ error: "Forbidden." }, { status: 403 });
  }

  const body = await request.json();
  const key = typeof body?.key === "string" ? body.key.trim() : "";
  const content = typeof body?.content === "string" ? body.content : "";
  const resetToDefault = body?.resetToDefault === true;

  if (!isPromptKey(key)) {
    return Response.json({ error: "Unknown prompt key." }, { status: 400 });
  }

  if (resetToDefault) {
    await prisma.aiPromptTemplate.deleteMany({ where: { key } });
    return Response.json({
      key,
      label: AI_PROMPT_LABELS[key],
      content: getPromptDefault(key),
      isCustomized: false,
      updatedByEmail: null,
      updatedAt: null,
    });
  }

  if (!content.trim()) {
    return Response.json({ error: "Prompt content is required." }, { status: 400 });
  }

  const template = await prisma.aiPromptTemplate.upsert({
    where: { key },
    create: {
      key,
      label: AI_PROMPT_LABELS[key],
      content,
      updatedByEmail: session.email,
    },
    update: {
      label: AI_PROMPT_LABELS[key],
      content,
      updatedByEmail: session.email,
    },
  });

  return Response.json({
    key,
    label: AI_PROMPT_LABELS[key],
    content: template.content,
    isCustomized: true,
    updatedByEmail: template.updatedByEmail,
    updatedAt: template.updatedAt,
  });
}
