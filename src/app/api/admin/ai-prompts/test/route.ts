import OpenAI from "openai";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { getPromptContent, type AiPromptKey } from "@/lib/ai-prompts";

export async function POST(request: Request) {
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

  const body = await request.json();
  const key = typeof body?.key === "string" ? (body.key as AiPromptKey) : null;
  const userInput = typeof body?.userInput === "string" ? body.userInput.trim() : "";
  const draftPrompt = typeof body?.draftPrompt === "string" ? body.draftPrompt.trim() : "";

  if (!key) {
    return Response.json({ error: "Prompt key is required." }, { status: 400 });
  }
  if (!userInput) {
    return Response.json({ error: "Test input is required." }, { status: 400 });
  }

  const systemPrompt = draftPrompt || (await getPromptContent(key));
  const client = new OpenAI({ apiKey });

  try {
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userInput },
      ],
      temperature: 0,
    });

    return Response.json({
      output: response.choices[0]?.message?.content ?? "",
      model: "gpt-4o-mini",
      promptUsed: systemPrompt,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown OpenAI error";
    return Response.json({ error: message }, { status: 500 });
  }
}
