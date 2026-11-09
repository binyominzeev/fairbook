import { buildPostInclude, serializePost } from "@/lib/post-presentation";
import type { Prisma } from "@/generated/prisma/client";

export function buildGroupPostInclude(viewerId: string) {
  const include = buildPostInclude(viewerId);
  return {
    ...include,
    sharedPost: {
      select: {
        ...include.sharedPost.select,
        visibility: true,
        moderationStatus: true,
        community: { select: { id: true, permalinkSlug: true, name: true, isPrivate: true } },
      },
    },
  } satisfies Prisma.PostInclude;
}

type GroupPost = Prisma.PostGetPayload<{ include: ReturnType<typeof buildGroupPostInclude> }>;

export function serializeGroupPost(post: GroupPost, isGuest: boolean) {
  const source = post.sharedPost;
  const sourceIsPublic = source?.visibility === "public" &&
    source.moderationStatus === "visible" && !source.community?.isPrivate;
  return serializePost({ ...post, sharedPost: isGuest && !sourceIsPublic ? null : source });
}
