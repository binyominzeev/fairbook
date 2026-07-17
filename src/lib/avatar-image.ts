import sharp from "sharp";

const MAX_AVATAR_BYTES = 1024 * 1024;
const MAX_INPUT_DATA_URL_CHARS = 20_000_000;
const DATA_URL_REGEX = /^data:image\/(png|jpeg|jpg|webp|gif);base64,([a-z0-9+/=\s]+)$/i;

async function optimizeAvatarDataUrl(dataUrl: string) {
  if (dataUrl.length > MAX_INPUT_DATA_URL_CHARS) {
    throw new Error("Avatar image is too large to process.");
  }

  const match = dataUrl.match(DATA_URL_REGEX);
  if (!match) {
    throw new Error("Avatar must be a valid image URL.");
  }

  const base64Payload = match[2].replace(/\s+/g, "");
  const inputBuffer = Buffer.from(base64Payload, "base64");

  if (inputBuffer.length === 0) {
    throw new Error("Avatar image data is invalid.");
  }

  const metadata = await sharp(inputBuffer, { failOn: "none", animated: false })
    .rotate()
    .metadata();

  const sourceWidth = Math.max(1, metadata.width ?? 1024);
  const sourceHeight = Math.max(1, metadata.height ?? 1024);

  const qualitySteps = [82, 74, 66, 58, 50, 42, 34, 26];
  const scaleSteps = [1, 0.85, 0.7, 0.55, 0.4, 0.3, 0.2];

  for (const scale of scaleSteps) {
    const width = Math.max(64, Math.round(sourceWidth * scale));
    const height = Math.max(64, Math.round(sourceHeight * scale));

    for (const quality of qualitySteps) {
      const outputBuffer = await sharp(inputBuffer, { failOn: "none", animated: false })
        .rotate()
        .resize(width, height, { fit: "inside", withoutEnlargement: true })
        .webp({ quality, effort: 4 })
        .toBuffer();

      if (outputBuffer.length <= MAX_AVATAR_BYTES) {
        return `data:image/webp;base64,${outputBuffer.toString("base64")}`;
      }
    }
  }

  throw new Error("Avatar image is too large. Please use a smaller image.");
}

export async function normalizeAndOptimizeAvatarUrl(value: unknown) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  if (!trimmed) {
    return null;
  }

  if (trimmed.startsWith("data:")) {
    return optimizeAvatarDataUrl(trimmed);
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(trimmed);
  } catch {
    throw new Error("Avatar must be a valid image URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error("Avatar must use http or https.");
  }

  return parsedUrl.toString();
}
