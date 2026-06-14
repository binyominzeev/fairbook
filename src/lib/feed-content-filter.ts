type FeedLikePost = {
  feedSourceId: string | null;
  mayContainViolence: boolean;
};

function postMayContainViolence(post: FeedLikePost) {
  return Boolean(post.feedSourceId) && post.mayContainViolence;
}

export function filterViolentFeedPostsForUser<T extends FeedLikePost>(
  posts: T[],
  hideViolentFeed: boolean
) {
  if (!hideViolentFeed) {
    return posts;
  }

  return posts.filter((post) => !postMayContainViolence(post));
}
