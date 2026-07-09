import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { isAdminEmail } from "@/lib/admin";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const tags = await prisma.tag.findMany({ orderBy: { name: "asc" } });
  return Response.json({ tags });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });
  if (!isAdminEmail(session.email)) return Response.json({ error: "Forbidden." }, { status: 403 });

  const { name, color, description } = await request.json();
  if (!name || !name.trim()) return Response.json({ error: "Name is required." }, { status: 400 });

  try {
    // If description not provided, ask AI to generate one
    let finalDescription = description?.trim() || null;
    if (!finalDescription) {
      const suggestedDescription = await generateTagDescription(name.trim());
      finalDescription = suggestedDescription;
    }

    const tag = await prisma.tag.create({
      data: {
        name: name.trim(),
        color: color?.trim() || "#9CA3AF",
        description: finalDescription,
      },
    });
    return Response.json({ tag }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create tag.";
    return Response.json({ error: message }, { status: 400 });
  }
}

// Helper function to generate tag descriptions using AI
async function generateTagDescription(tagName: string): Promise<string | null> {
  try {
    // Using the AI to generate a description for the tag
    // We'll call a simple prompt instead
    const OpenAI = (await import("openai")).default;
    const apiKey = process.env.OPENAI_API_KEY?.trim();
    if (!apiKey) return null;

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
          content: `Generate a description for the tag: "${tagName}"`,
        },
      ],
      temperature: 0.7,
    });

    const content = response.choices[0]?.message?.content?.trim();
    return content && content.length > 0 ? content : null;
  } catch {
    return null;
  }
}
