import type { SerializedPost } from "@/lib/post-presentation";
import { prisma } from "@/lib/prisma";

function buildPairKey(userId: string, topicId: string) {
  return `${userId}:${topicId}`;
}

export async function applyAuthorTopicColors(posts: SerializedPost[]) {
  const pairs: Array<{ userId: string; topicId: string }> = [];
  const seen = new Set<string>();

  for (const post of posts) {
    if (!post.topic) continue;

    const key = buildPairKey(post.author.id, post.topic.id);
    if (seen.has(key)) continue;

    seen.add(key);
    pairs.push({ userId: post.author.id, topicId: post.topic.id });
  }

  if (pairs.length === 0) {
    return posts;
  }

  const preferences = await prisma.userTopicPreference.findMany({
    where: {
      OR: pairs,
    },
    select: {
      userId: true,
      topicId: true,
      buttonColor: true,
    },
  });

  if (preferences.length === 0) {
    return posts;
  }

  const colorByPair = new Map<string, string>();
  for (const preference of preferences) {
    if (!preference.buttonColor) continue;
    colorByPair.set(buildPairKey(preference.userId, preference.topicId), preference.buttonColor);
  }

  if (colorByPair.size === 0) {
    return posts;
  }

  return posts.map((post) => {
    if (!post.topic) return post;

    const override = colorByPair.get(buildPairKey(post.author.id, post.topic.id));
    if (!override) return post;

    return {
      ...post,
      topic: {
        ...post.topic,
        color: override,
      },
    };
  });
}