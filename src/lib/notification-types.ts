export const NOTIFICATION_TYPE_REPLY = "comment_reply";
export const NOTIFICATION_TYPE_FOLLOWED_COMMENT = "followed_user_commented";
export const NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT = "post_subscribed_commented";
export const NOTIFICATION_TYPE_POST_LIKE = "post_liked";
export const NOTIFICATION_TYPE_COMMENT_LIKE = "comment_liked";
export const NOTIFICATION_TYPE_GROUP_INVITE = "group_invited";
export const NOTIFICATION_TYPE_GROUP_NEW_POST = "group_new_post";
export const NOTIFICATION_TYPE_GROUP_JOIN_REQUEST = "group_join_requested";
export const NOTIFICATION_TYPE_GROUP_JOIN_APPROVED = "group_join_approved";
export const NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED = "group_invite_accepted";

export const NOTIFICATION_TYPES = [
  NOTIFICATION_TYPE_REPLY,
  NOTIFICATION_TYPE_FOLLOWED_COMMENT,
  NOTIFICATION_TYPE_POST_SUBSCRIBED_COMMENT,
  NOTIFICATION_TYPE_POST_LIKE,
  NOTIFICATION_TYPE_COMMENT_LIKE,
  NOTIFICATION_TYPE_GROUP_INVITE,
  NOTIFICATION_TYPE_GROUP_NEW_POST,
  NOTIFICATION_TYPE_GROUP_JOIN_REQUEST,
  NOTIFICATION_TYPE_GROUP_JOIN_APPROVED,
  NOTIFICATION_TYPE_GROUP_INVITE_ACCEPTED,
] as const;

export type NotificationType = (typeof NOTIFICATION_TYPES)[number];

const notificationTypeSet = new Set<string>(NOTIFICATION_TYPES);

export function isSupportedNotificationType(value: string): value is NotificationType {
  return notificationTypeSet.has(value);
}
