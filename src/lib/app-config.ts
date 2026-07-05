import { prisma } from "@/lib/prisma";

const APP_CONFIG_ID = 1;

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
