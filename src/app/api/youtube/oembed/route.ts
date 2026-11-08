const YOUTUBE_VIDEO_ID_PATTERN = /^[a-zA-Z0-9_-]{11}$/;
const OEMBED_ENDPOINT = "https://www.youtube.com/oembed";

type YouTubeOEmbedResponse = {
  width?: unknown;
  height?: unknown;
};

export async function GET(request: Request) {
  const videoId = new URL(request.url).searchParams.get("id");
  if (!videoId || !YOUTUBE_VIDEO_ID_PATTERN.test(videoId)) {
    return Response.json({ error: "Invalid YouTube video ID." }, { status: 400 });
  }

  const videoUrl = `https://www.youtube.com/watch?v=${encodeURIComponent(videoId)}`;
  const oEmbedUrl = new URL(OEMBED_ENDPOINT);
  oEmbedUrl.searchParams.set("url", videoUrl);
  oEmbedUrl.searchParams.set("format", "json");

  let response: Response;
  try {
    response = await fetch(oEmbedUrl, {
      next: { revalidate: 86400 },
      signal: AbortSignal.timeout(5000),
    });
  } catch (error) {
    console.error("Failed to fetch YouTube oEmbed dimensions.", error);
    return Response.json({ error: "Could not load YouTube video dimensions." }, { status: 502 });
  }

  if (!response.ok) {
    console.error("YouTube oEmbed request failed.", { status: response.status, videoId });
    return Response.json({ error: "Could not load YouTube video dimensions." }, { status: 502 });
  }

  let metadata: YouTubeOEmbedResponse;
  try {
    metadata = (await response.json()) as YouTubeOEmbedResponse;
  } catch (error) {
    console.error("YouTube oEmbed returned invalid JSON.", error);
    return Response.json({ error: "Invalid YouTube video dimensions." }, { status: 502 });
  }

  const { width, height } = metadata;
  if (
    typeof width !== "number" ||
    typeof height !== "number" ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    console.error("YouTube oEmbed returned invalid dimensions.", { videoId, width, height });
    return Response.json({ error: "Invalid YouTube video dimensions." }, { status: 502 });
  }

  return Response.json({ width, height });
}
