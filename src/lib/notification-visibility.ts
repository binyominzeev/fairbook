type NotificationComment = {
  id: string;
  parentId: string | null;
  authorId: string;
  moderationStatus: string;
} | null;

type NotificationWithCommentTarget = {
  commentId: string | null;
  comment: NotificationComment;
};

export function isNotificationTargetVisibleToRecipient(
  item: NotificationWithCommentTarget,
  recipientId: string
) {
  // Notifications without a comment target (e.g. post likes) are always openable.
  if (!item.commentId) return true;

  // Orphaned relations can happen if old rows predate FK constraints or data got inconsistent.
  if (!item.comment) return false;

  if (item.comment.moderationStatus === "author_only" && item.comment.authorId !== recipientId) {
    return false;
  }

  return true;
}

type NotificationVisibilityBase = {
  id: string;
  recipientId: string;
  commentId: string | null;
  comment: NotificationComment;
};

type CommentVisibilityNode = {
  id: string;
  parentId: string | null;
  authorId: string;
  moderationStatus: string;
};

function isCommentNodeVisibleToRecipient(node: CommentVisibilityNode, recipientId: string) {
  return !(node.moderationStatus === "author_only" && node.authorId !== recipientId);
}

export async function partitionNotificationsByVisibility<T extends NotificationVisibilityBase>(
  items: T[],
  loadCommentsByIds: (ids: string[]) => Promise<CommentVisibilityNode[]>
) {
  const commentsById = new Map<string, CommentVisibilityNode>();
  const missingCommentIds = new Set<string>();

  for (const item of items) {
    if (!item.commentId || !item.comment) continue;
    commentsById.set(item.comment.id, {
      id: item.comment.id,
      parentId: item.comment.parentId,
      authorId: item.comment.authorId,
      moderationStatus: item.comment.moderationStatus,
    });
  }

  let frontier = new Set<string>();
  for (const node of commentsById.values()) {
    if (node.parentId) {
      frontier.add(node.parentId);
    }
  }

  while (frontier.size > 0) {
    const idsToLoad = [...frontier].filter(
      (id) => !commentsById.has(id) && !missingCommentIds.has(id)
    );
    frontier = new Set<string>();

    if (idsToLoad.length === 0) {
      break;
    }

    const rows = await loadCommentsByIds(idsToLoad);
    const loadedIds = new Set(rows.map((row) => row.id));

    for (const row of rows) {
      commentsById.set(row.id, row);
      if (row.parentId && !commentsById.has(row.parentId)) {
        frontier.add(row.parentId);
      }
    }

    for (const id of idsToLoad) {
      if (!loadedIds.has(id)) {
        missingCommentIds.add(id);
      }
    }
  }

  const visibleItems: T[] = [];
  const staleNotificationIds: string[] = [];

  for (const item of items) {
    if (!item.commentId) {
      visibleItems.push(item);
      continue;
    }

    if (!item.comment) {
      staleNotificationIds.push(item.id);
      continue;
    }

    let currentId: string | null = item.comment.id;
    let visible = true;
    let safetyCounter = 0;

    while (currentId) {
      safetyCounter += 1;
      if (safetyCounter > 200) {
        visible = false;
        break;
      }

      const node = commentsById.get(currentId);
      if (!node) {
        visible = false;
        break;
      }

      if (!isCommentNodeVisibleToRecipient(node, item.recipientId)) {
        visible = false;
        break;
      }

      currentId = node.parentId;
    }

    if (visible) {
      visibleItems.push(item);
    } else {
      staleNotificationIds.push(item.id);
    }
  }

  return { visibleItems, staleNotificationIds };
}