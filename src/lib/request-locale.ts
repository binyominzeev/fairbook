import { headers } from "next/headers";
import { getSession } from "@/lib/auth";
import { normalizeAppLocale, detectAppLocaleFromAcceptLanguage, type AppLocale } from "@/lib/i18n";
import { prisma } from "@/lib/prisma";

export async function getRequestLocale(): Promise<AppLocale> {
  const session = await getSession();

  if (session) {
    const user = await prisma.user.findUnique({
      where: { id: session.userId },
      select: { locale: true },
    });

    if (user?.locale) {
      return normalizeAppLocale(user.locale);
    }
  }

  const requestHeaders = await headers();
  return detectAppLocaleFromAcceptLanguage(requestHeaders.get("accept-language"));
}
