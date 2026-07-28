import { NextRequest } from "next/server";
import { getSession } from "@/lib/auth";
import { DEFAULT_APP_LOCALE, normalizeAppLocale, parseAppLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export async function GET() {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const user = await prisma.user.findUnique({
    where: { id: session.userId },
    select: { locale: true },
  });

  if (!user) return Response.json({ error: "User not found." }, { status: 404 });

  return Response.json({ locale: normalizeAppLocale(user.locale ?? DEFAULT_APP_LOCALE) });
}

export async function POST(request: NextRequest) {
  const session = await getSession();
  if (!session) return Response.json({ error: "Not authenticated." }, { status: 401 });

  const body = await request.json().catch(() => ({}));
  const nextLocale = parseAppLocale((body as { locale?: unknown }).locale);

  if (!nextLocale) {
    return Response.json({ error: "Invalid locale." }, { status: 400 });
  }

  try {
    await prisma.user.update({
      where: { id: session.userId },
      data: { locale: nextLocale },
    });

    return Response.json({ locale: nextLocale });
  } catch {
    return Response.json({ error: "Could not update language preference." }, { status: 400 });
  }
}
