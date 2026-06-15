export interface ProfileLinkable {
  id: string;
  slug?: string | null;
}

export function getProfileIdentifier(user: ProfileLinkable) {
  const slug = user.slug?.trim();
  return slug || user.id;
}

export function buildProfilePath(user: ProfileLinkable) {
  return `/profile/${getProfileIdentifier(user)}`;
}