const TOPIC_MAX_LENGTH = 40;
const HEX_COLOR_PATTERN = /^#[0-9A-Fa-f]{6}$/;

export function normalizeTopicName(value: unknown) {
  if (typeof value !== "string") return "";
  return value.replace(/\s+/g, " ").trim().slice(0, TOPIC_MAX_LENGTH);
}

export function normalizeTopicKey(name: string) {
  const slug = name
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^A-Za-z0-9\s-]/g, "")
    .toLowerCase();

  return slug
    .trim()
    .replace(/[\s_-]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function getTopicSlugLookupCandidates(slug: string) {
  const normalized = normalizeTopicKey(slug);
  const candidates = new Set<string>();
  if (normalized) candidates.add(normalized);
  if (normalized.includes("-")) candidates.add(normalized.replace(/-/g, " "));
  return Array.from(candidates);
}

export function isHexColor(value: unknown): value is string {
  return typeof value === "string" && HEX_COLOR_PATTERN.test(value.trim());
}