import { Fragment, type ReactNode } from "react";
import type { SerializedPost } from "@/lib/post-presentation";

export default function PostCardList({
  posts,
  renderPost,
  wrapPost,
  className = "space-y-2",
}: {
  posts: SerializedPost[];
  renderPost: (post: SerializedPost) => ReactNode;
  wrapPost?: (post: SerializedPost, content: ReactNode) => ReactNode;
  className?: string;
}) {
  if (posts.length === 0) {
    return null;
  }

  return (
    <div className={className}>
      {posts.map((post) => {
        const rendered = renderPost(post);
        const wrapped = wrapPost ? wrapPost(post, rendered) : rendered;
        return <Fragment key={post.id}>{wrapped}</Fragment>;
      })}
    </div>
  );
}
