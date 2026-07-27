import ProfilePage from "@/app/profile/[id]/page";

export default async function ProfileTopicPage(props: {
  params: Promise<{ id: string; topicSlug: string }>;
  searchParams: Promise<{ tab?: string; settings?: string; q?: string }>;
}) {
  const { id, topicSlug } = await props.params;
  const searchParams = await props.searchParams;

  return ProfilePage({
    params: Promise.resolve({ id }),
    searchParams: Promise.resolve({
      ...searchParams,
      topicSlug,
    }),
  });
}
