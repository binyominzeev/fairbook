type VideoDimensions = { width: number; height: number };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

export function extractYouTubeVideoDimensions(html: string): VideoDimensions | null {
  const marker = /(?:var\s+)?ytInitialPlayerResponse\s*=\s*\{/g.exec(html);
  if (!marker) return null;

  const start = marker.index + marker[0].length - 1;
  let depth = 0;
  let inString = false;
  let escaped = false;
  let end = -1;

  for (let index = start; index < html.length; index++) {
    const character = html[index];
    if (inString) {
      if (escaped) escaped = false;
      else if (character === "\\") escaped = true;
      else if (character === '"') inString = false;
    } else if (character === '"') {
      inString = true;
    } else if (character === "{") {
      depth++;
    } else if (character === "}" && --depth === 0) {
      end = index + 1;
      break;
    }
  }

  if (end === -1) return null;

  let player: unknown;
  try {
    player = JSON.parse(html.slice(start, end));
  } catch {
    return null;
  }

  if (!isRecord(player) || !isRecord(player.streamingData)) return null;
  const { formats, adaptiveFormats } = player.streamingData;
  const candidates = [
    ...(Array.isArray(formats) ? formats : []),
    ...(Array.isArray(adaptiveFormats) ? adaptiveFormats : []),
  ];

  let largest: VideoDimensions | null = null;
  for (const candidate of candidates) {
    if (!isRecord(candidate)) continue;
    const { width, height } = candidate;
    if (
      typeof width !== "number" ||
      typeof height !== "number" ||
      !Number.isFinite(width) ||
      !Number.isFinite(height) ||
      width <= 0 ||
      height <= 0
    ) continue;

    if (!largest || width * height > largest.width * largest.height) {
      largest = { width, height };
    }
  }

  return largest;
}
