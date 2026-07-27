import FeedPage from "@/app/feed/page";

export default async function TopicFeedPage(props: {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{
    notice?: string;
    noticeKind?: string;
    mode?: string;
    group?: string;
    q?: string;
    sort?: string;
  }>;
}) {
  const { slug } = await props.params;
  const searchParams = await props.searchParams;

  return FeedPage({
    searchParams: Promise.resolve({
      ...searchParams,
      topicSlug: slug,
    }),
  });
}
