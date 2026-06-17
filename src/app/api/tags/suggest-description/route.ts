import { NextRequest } from "next/server";
import OpenAI from "openai";

export async function POST(request: NextRequest) {
  const { tagName } = await request.json();
  if (!tagName || !tagName.trim()) {
    return Response.json({ error: "Tag name is required." }, { status: 400 });
  }

  try {
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) {
      return Response.json({ description: null });
    }

    const client = new OpenAI({ apiKey });
    const response = await client.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        {
          role: "system",
          content:
            'You generate brief, helpful descriptions for content tags used in RSS feed classification. The description should be 3-15 words and list the main topics/keywords that articles tagged with this label would contain. Return ONLY the description text, no quotes or markdown.',
        },
        {
          role: "user",
          content: `Generate a description for the tag: "${tagName.trim()}"`,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    const description = content && content.length > 0 ? content : null;

    return Response.json({ description });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not generate description.";
    return Response.json({ error: message }, { status: 500 });
  }
}
