import { prisma } from "@/lib/prisma";

const APP_CONFIG_ID = 1;

type TextCardPresetVisibility = {
  hiddenFontIds: string[];
  hiddenBackgroundIds: string[];
};

function parseStringArray(value: string | null | undefined) {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (!Array.isArray(parsed)) return [];
    return Array.from(new Set(parsed.filter((item): item is string => typeof item === "string")));
  } catch {
    return [];
  }
}

export async function getCommentInsightsEnabled() {
  const config = await prisma.appConfig.findUnique({
    where: { id: APP_CONFIG_ID },
    select: { commentInsightsEnabled: true },
  });

  return config?.commentInsightsEnabled ?? true;
}

export async function setCommentInsightsEnabled(enabled: boolean) {
  const config = await prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    create: {
      id: APP_CONFIG_ID,
      commentInsightsEnabled: enabled,
    },
    update: {
      commentInsightsEnabled: enabled,
    },
    select: { commentInsightsEnabled: true },
  });

  return config.commentInsightsEnabled;
}

export async function getTextCardPresetVisibility(): Promise<TextCardPresetVisibility> {
  const config = await prisma.appConfig.findUnique({
    where: { id: APP_CONFIG_ID },
    select: {
      hiddenTextCardFontIds: true,
      hiddenTextCardBackgroundIds: true,
    },
  });

  return {
    hiddenFontIds: parseStringArray(config?.hiddenTextCardFontIds),
    hiddenBackgroundIds: parseStringArray(config?.hiddenTextCardBackgroundIds),
  };
}

export async function setTextCardPresetVisibility(input: TextCardPresetVisibility) {
  const config = await prisma.appConfig.upsert({
    where: { id: APP_CONFIG_ID },
    create: {
      id: APP_CONFIG_ID,
      commentInsightsEnabled: true,
      hiddenTextCardFontIds: JSON.stringify(Array.from(new Set(input.hiddenFontIds))),
      hiddenTextCardBackgroundIds: JSON.stringify(
        Array.from(new Set(input.hiddenBackgroundIds))
      ),
    },
    update: {
      hiddenTextCardFontIds: JSON.stringify(Array.from(new Set(input.hiddenFontIds))),
      hiddenTextCardBackgroundIds: JSON.stringify(
        Array.from(new Set(input.hiddenBackgroundIds))
      ),
    },
    select: {
      hiddenTextCardFontIds: true,
      hiddenTextCardBackgroundIds: true,
    },
  });

  return {
    hiddenFontIds: parseStringArray(config.hiddenTextCardFontIds),
    hiddenBackgroundIds: parseStringArray(config.hiddenTextCardBackgroundIds),
  };
}
