export function buildGlobalTopicPath(slug: string) {
  return `/tema/${encodeURIComponent(slug)}`;
}

export function buildProfileTopicPath(profilePath: string, slug: string) {
  return `${profilePath}/tema/${encodeURIComponent(slug)}`;
}