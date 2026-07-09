"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";

type BackgroundPreset = {
  id: string;
  name: string;
  preview: string;
  render: {
    kind: "solid" | "linear" | "radial";
    angle?: number;
    stops: Array<{ offset: number; color: string }>;
  };
};

type FontPreset = {
  id: string;
  name: string;
  family: string;
  weight: number;
  letterSpacing: number;
  lineHeight: number;
  transform?: "none" | "uppercase";
};

type TextLayout = {
  fontSize: number;
  lines: string[];
  lineHeightPx: number;
};

type CreatePostPayload = {
  content: string | null;
  sharedUrl: string | null;
  sharedTitle: string | null;
  sharedDescription: string | null;
  sharedSource: string | null;
  imageUrls: string[];
};

const EXPORT_SIZE = 1080;
const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 240;
const HORIZONTAL_PADDING = 0.1;
const VERTICAL_PADDING = 0.1;

const BACKGROUNDS: BackgroundPreset[] = [
  {
    id: "golden-hour",
    name: "Golden Hour",
    preview:
      "linear-gradient(135deg, #f9d976 0%, #f39f86 48%, #df6c4f 100%)",
    render: {
      kind: "linear",
      angle: 135,
      stops: [
        { offset: 0, color: "#f9d976" },
        { offset: 0.48, color: "#f39f86" },
        { offset: 1, color: "#df6c4f" },
      ],
    },
  },
  {
    id: "mint-breeze",
    name: "Mint Breeze",
    preview:
      "linear-gradient(145deg, #dff6eb 0%, #9fe3ca 50%, #4ea884 100%)",
    render: {
      kind: "linear",
      angle: 145,
      stops: [
        { offset: 0, color: "#dff6eb" },
        { offset: 0.5, color: "#9fe3ca" },
        { offset: 1, color: "#4ea884" },
      ],
    },
  },
  {
    id: "copper-ink",
    name: "Copper Ink",
    preview:
      "linear-gradient(155deg, #1a1f2c 0%, #3b2f3f 45%, #b56a4f 100%)",
    render: {
      kind: "linear",
      angle: 155,
      stops: [
        { offset: 0, color: "#1a1f2c" },
        { offset: 0.45, color: "#3b2f3f" },
        { offset: 1, color: "#b56a4f" },
      ],
    },
  },
  {
    id: "paper-sky",
    name: "Paper Sky",
    preview:
      "radial-gradient(circle at 20% 20%, #fefcf3 0%, #d7e8f7 55%, #a4c4de 100%)",
    render: {
      kind: "radial",
      stops: [
        { offset: 0, color: "#fefcf3" },
        { offset: 0.55, color: "#d7e8f7" },
        { offset: 1, color: "#a4c4de" },
      ],
    },
  },
  {
    id: "forest-night",
    name: "Forest Night",
    preview:
      "linear-gradient(160deg, #0a2320 0%, #17483f 55%, #3f8a69 100%)",
    render: {
      kind: "linear",
      angle: 160,
      stops: [
        { offset: 0, color: "#0a2320" },
        { offset: 0.55, color: "#17483f" },
        { offset: 1, color: "#3f8a69" },
      ],
    },
  },
  {
    id: "powder-rose",
    name: "Powder Rose",
    preview:
      "linear-gradient(145deg, #fff1ec 0%, #f6d6d7 46%, #dca6b0 100%)",
    render: {
      kind: "linear",
      angle: 145,
      stops: [
        { offset: 0, color: "#fff1ec" },
        { offset: 0.46, color: "#f6d6d7" },
        { offset: 1, color: "#dca6b0" },
      ],
    },
  },
];

const FONTS: FontPreset[] = [
  {
    id: "clean",
    name: "Clean Sans",
    family: "'Trebuchet MS', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.2,
    lineHeight: 1.14,
    transform: "none",
  },
  {
    id: "editorial",
    name: "Editorial",
    family: "'Palatino Linotype', 'Book Antiqua', Palatino, serif",
    weight: 700,
    letterSpacing: 0,
    lineHeight: 1.12,
    transform: "none",
  },
  {
    id: "marker",
    name: "Marker",
    family: "'Gill Sans', 'Trebuchet MS', sans-serif",
    weight: 800,
    letterSpacing: 0.6,
    lineHeight: 1.18,
    transform: "uppercase",
  },
  {
    id: "mono-poster",
    name: "Mono Poster",
    family: "'Courier New', Courier, monospace",
    weight: 700,
    letterSpacing: 0.4,
    lineHeight: 1.2,
    transform: "none",
  },
];

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function hexToRgb(color: string) {
  const value = color.replace("#", "").trim();
  const normalized =
    value.length === 3
      ? value
          .split("")
          .map((char) => `${char}${char}`)
          .join("")
      : value;

  const parsed = Number.parseInt(normalized, 16);
  if (Number.isNaN(parsed)) {
    return { r: 128, g: 128, b: 128 };
  }

  return {
    r: (parsed >> 16) & 255,
    g: (parsed >> 8) & 255,
    b: parsed & 255,
  };
}

function relativeLuminance(color: string) {
  const { r, g, b } = hexToRgb(color);
  const channels = [r, g, b].map((channel) => {
    const srgb = channel / 255;
    return srgb <= 0.03928 ? srgb / 12.92 : ((srgb + 0.055) / 1.055) ** 2.4;
  });

  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function getBackgroundLuminance(background: BackgroundPreset) {
  if (background.render.stops.length === 0) {
    return 0.5;
  }

  let weighted = 0;
  let totalWeight = 0;
  for (let index = 0; index < background.render.stops.length; index += 1) {
    const stop = background.render.stops[index];
    const nextStop = background.render.stops[index + 1];
    const weight = nextStop ? Math.max(0.01, nextStop.offset - stop.offset) : 0.2;
    weighted += relativeLuminance(stop.color) * weight;
    totalWeight += weight;
  }

  return weighted / totalWeight;
}

function pickReadableColor(background: BackgroundPreset) {
  const luminance = getBackgroundLuminance(background);
  return luminance > 0.56 ? "#0f172a" : "#f8fafc";
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
) {
  if (text.length === 0) return 0;
  const base = ctx.measureText(text).width;
  const spacing = Math.max(0, text.length - 1) * Math.max(0, letterSpacing);
  return base + spacing;
}

function wrapLinesForWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
  letterSpacing: number
) {
  const normalized = text.replace(/\r\n/g, "\n");
  const paragraphs = normalized.split("\n");
  const lines: string[] = [];

  for (const paragraph of paragraphs) {
    if (paragraph.trim().length === 0) {
      lines.push("");
      continue;
    }

    const words = paragraph.split(/\s+/).filter(Boolean);
    let current = "";

    for (const word of words) {
      const trial = current ? `${current} ${word}` : word;
      if (measureTextWidth(ctx, trial, letterSpacing) <= maxWidth) {
        current = trial;
        continue;
      }

      if (current) {
        lines.push(current);
      }

      if (measureTextWidth(ctx, word, letterSpacing) <= maxWidth) {
        current = word;
        continue;
      }

      let segment = "";
      for (const char of word) {
        const charTrial = `${segment}${char}`;
        if (measureTextWidth(ctx, charTrial, letterSpacing) <= maxWidth) {
          segment = charTrial;
        } else {
          if (segment) {
            lines.push(segment);
          }
          segment = char;
        }
      }
      current = segment;
    }

    lines.push(current);
  }

  return lines;
}

function drawCenteredLine(
  ctx: CanvasRenderingContext2D,
  line: string,
  centerX: number,
  y: number,
  letterSpacing: number
) {
  if (line.length === 0) {
    return;
  }

  if (letterSpacing <= 0) {
    ctx.fillText(line, centerX, y);
    return;
  }

  const totalWidth = measureTextWidth(ctx, line, letterSpacing);
  let x = centerX - totalWidth / 2;
  for (const char of line) {
    ctx.fillText(char, x, y);
    x += ctx.measureText(char).width + letterSpacing;
  }
}

function buildLayout(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: FontPreset,
  maxWidth: number,
  maxHeight: number
): TextLayout {
  const content = text.length > 0 ? text : " ";
  let low = MIN_FONT_SIZE;
  let high = MAX_FONT_SIZE;
  let bestSize = MIN_FONT_SIZE;
  let bestLines: string[] = [content];

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    ctx.font = `${font.weight} ${mid}px ${font.family}`;
    const lines = wrapLinesForWidth(ctx, content, maxWidth, font.letterSpacing);
    const lineHeightPx = mid * font.lineHeight;
    const totalHeight = lines.length * lineHeightPx;

    if (totalHeight <= maxHeight) {
      bestSize = mid;
      bestLines = lines;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return {
    fontSize: bestSize,
    lines: bestLines,
    lineHeightPx: bestSize * font.lineHeight,
  };
}

function drawBackground(ctx: CanvasRenderingContext2D, background: BackgroundPreset, size: number) {
  if (background.render.kind === "solid") {
    ctx.fillStyle = background.render.stops[0]?.color ?? "#ffffff";
  } else if (background.render.kind === "radial") {
    const radial = ctx.createRadialGradient(
      size * 0.2,
      size * 0.2,
      size * 0.1,
      size * 0.5,
      size * 0.5,
      size * 0.8
    );
    for (const stop of background.render.stops) {
      radial.addColorStop(clamp(stop.offset, 0, 1), stop.color);
    }
    ctx.fillStyle = radial;
  } else {
    const radians = ((background.render.angle ?? 135) * Math.PI) / 180;
    const half = size / 2;
    const distance = Math.cos(Math.PI / 4) * size;
    const x0 = half - Math.cos(radians) * distance;
    const y0 = half - Math.sin(radians) * distance;
    const x1 = half + Math.cos(radians) * distance;
    const y1 = half + Math.sin(radians) * distance;
    const gradient = ctx.createLinearGradient(x0, y0, x1, y1);

    for (const stop of background.render.stops) {
      gradient.addColorStop(clamp(stop.offset, 0, 1), stop.color);
    }

    ctx.fillStyle = gradient;
  }

  ctx.fillRect(0, 0, size, size);
}

export default function TextCardCreator() {
  const router = useRouter();
  const [text, setText] = useState("Great conversations start where attention does not run out.");
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [fontId, setFontId] = useState(FONTS[0].id);
  const [fontSize, setFontSize] = useState(72);
  const [previewLines, setPreviewLines] = useState<string[]>([""]);
  const [isExporting, setIsExporting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [includeCaptionInPost, setIncludeCaptionInPost] = useState(true);
  const [error, setError] = useState("");

  const textFrameRef = useRef<HTMLDivElement | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const activeBackground = useMemo(
    () => BACKGROUNDS.find((preset) => preset.id === backgroundId) ?? BACKGROUNDS[0],
    [backgroundId]
  );
  const activeFont = useMemo(
    () => FONTS.find((preset) => preset.id === fontId) ?? FONTS[0],
    [fontId]
  );
  const textColor = useMemo(() => pickReadableColor(activeBackground), [activeBackground]);
  const displayText = useMemo(
    () => (activeFont.transform === "uppercase" ? text.toUpperCase() : text),
    [activeFont.transform, text]
  );

  const renderCardBlob = useCallback(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not supported.");
    }

    drawBackground(ctx, activeBackground, EXPORT_SIZE);

    const maxTextWidth = Math.floor(EXPORT_SIZE * (1 - HORIZONTAL_PADDING * 2));
    const maxTextHeight = Math.floor(EXPORT_SIZE * (1 - VERTICAL_PADDING * 2));
    const layout = buildLayout(ctx, displayText || " ", activeFont, maxTextWidth, maxTextHeight);

    ctx.font = `${activeFont.weight} ${layout.fontSize}px ${activeFont.family}`;
    ctx.textAlign = "left";
    ctx.textBaseline = "top";
    ctx.fillStyle = textColor;
    ctx.shadowColor =
      textColor === "#0f172a" ? "rgba(255,255,255,0.16)" : "rgba(0,0,0,0.32)";
    ctx.shadowBlur = layout.fontSize * 0.18;
    ctx.shadowOffsetY = Math.max(2, Math.round(layout.fontSize * 0.05));

    let y = (EXPORT_SIZE - layout.lines.length * layout.lineHeightPx) / 2;
    for (const line of layout.lines) {
      drawCenteredLine(ctx, line, EXPORT_SIZE / 2, y, activeFont.letterSpacing);
      y += layout.lineHeightPx;
    }

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob(resolve, "image/png");
    });

    if (!blob) {
      throw new Error("Failed to create PNG file.");
    }

    return blob;
  }, [activeBackground, activeFont, displayText, textColor]);

  const handleDownloadPng = useCallback(async () => {
    if (isExporting) return;
    setError("");
    setIsExporting(true);

    try {
      const blob = await renderCardBlob();
      const timestamp = new Date().toISOString().slice(0, 19).replace(/[T:]/g, "-");
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `fairbook-text-card-${timestamp}.png`;
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("PNG export failed. Please try again.");
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, renderCardBlob]);

  const handlePostToFairbook = useCallback(async () => {
    if (isPosting) return;
    setError("");
    setIsPosting(true);

    try {
      const blob = await renderCardBlob();
      const file = new File([blob], `text-card-${Date.now()}.png`, {
        type: "image/png",
      });

      const uploadPayload = new FormData();
      uploadPayload.append("files", file);

      const uploadRes = await fetch("/api/uploads/images", {
        method: "POST",
        body: uploadPayload,
      });
      const uploadData = await uploadRes.json();
      if (!uploadRes.ok) {
        setError(uploadData.error ?? "Failed to upload image.");
        return;
      }

      const imageUrls = Array.isArray(uploadData.urls) ? uploadData.urls : [];
      if (imageUrls.length === 0) {
        setError("No uploaded image URL was returned.");
        return;
      }

      const body: CreatePostPayload = {
        content: includeCaptionInPost ? text.trim() || null : null,
        sharedUrl: null,
        sharedTitle: null,
        sharedDescription: null,
        sharedSource: null,
        imageUrls,
      };

      const postRes = await fetch("/api/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const postData = await postRes.json();

      if (!postRes.ok) {
        setError(postData.error ?? "Failed to create post.");
        return;
      }

      router.push("/feed?notice=Text+card+posted.&noticeKind=success");
      router.refresh();
    } catch {
      setError("Posting failed. Please try again.");
    } finally {
      setIsPosting(false);
    }
  }, [includeCaptionInPost, isPosting, renderCardBlob, router, text]);

  useLayoutEffect(() => {
    const frame = textFrameRef.current;
    if (!frame) return;

    const fitText = () => {
      const frameWidth = frame.clientWidth;
      const frameHeight = frame.clientHeight;
      if (frameWidth === 0 || frameHeight === 0) return;

      if (!measureCanvasRef.current) {
        measureCanvasRef.current = document.createElement("canvas");
      }
      const ctx = measureCanvasRef.current.getContext("2d");
      if (!ctx) return;

      const maxWidth = Math.floor(frameWidth * (1 - HORIZONTAL_PADDING * 2));
      const maxHeight = Math.floor(frameHeight * (1 - VERTICAL_PADDING * 2));
      const layout = buildLayout(ctx, displayText || " ", activeFont, maxWidth, maxHeight);

      setFontSize(layout.fontSize);
      setPreviewLines(layout.lines);
    };

    fitText();

    const observer = new ResizeObserver(() => {
      fitText();
    });
    observer.observe(frame);

    return () => {
      observer.disconnect();
    };
  }, [activeFont, displayText]);

  useEffect(() => {
    const onShortcut = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "e") {
        event.preventDefault();
        void handleDownloadPng();
      }
    };

    window.addEventListener("keydown", onShortcut);
    return () => {
      window.removeEventListener("keydown", onShortcut);
    };
  }, [handleDownloadPng]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      <div className="grid gap-5 lg:grid-cols-[320px_minmax(0,1fr)]">
        <aside className="space-y-5">
          <div>
            <h1 className="text-lg font-semibold text-slate-900">Text Card Creator</h1>
            <p className="mt-1 text-sm leading-6 text-slate-600">
              Write freely, choose a style, then either download PNG or post directly.
            </p>
          </div>

          <div className="space-y-2">
            <label
              htmlFor="text-card-input"
              className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
            >
              Text
            </label>
            <textarea
              id="text-card-input"
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder="Type any length of text here..."
              rows={8}
              className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition-colors focus:border-amber-500"
            />
            <p className="text-xs text-slate-500">Line breaks are preserved in preview and PNG.</p>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Backgrounds
            </p>
            <div className="grid grid-cols-3 gap-2">
              {BACKGROUNDS.map((preset) => {
                const active = preset.id === activeBackground.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setBackgroundId(preset.id)}
                    className={`group relative overflow-hidden rounded-xl border transition-transform hover:scale-[1.02] ${
                      active ? "border-slate-900" : "border-slate-200"
                    }`}
                    title={preset.name}
                    aria-label={preset.name}
                  >
                    <span
                      className="block h-14 w-full"
                      style={{ background: preset.preview }}
                      aria-hidden="true"
                    />
                    <span className="absolute inset-x-0 bottom-0 bg-black/25 px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
                      {preset.name}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Font Style
            </p>
            <div className="grid grid-cols-2 gap-2">
              {FONTS.map((preset) => {
                const active = preset.id === activeFont.id;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => setFontId(preset.id)}
                    className={`rounded-xl border px-3 py-2 text-left text-sm transition-colors ${
                      active
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                    }`}
                    style={{ fontFamily: preset.family }}
                  >
                    {preset.name}
                  </button>
                );
              })}
            </div>
          </div>

          <label className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-700">
            <input
              type="checkbox"
              checked={includeCaptionInPost}
              onChange={(event) => setIncludeCaptionInPost(event.target.checked)}
              className="h-4 w-4 rounded border-slate-300 text-slate-900"
            />
            Include this text as post caption when posting directly
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>Auto contrast: on</p>
            <p>Current fitted font size: {fontSize}px</p>
            <p>Shortcut for download: Ctrl/Cmd + E</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={() => void handleDownloadPng()}
              disabled={isExporting || isPosting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isExporting ? "Exporting PNG..." : "Download PNG"}
            </button>
            <button
              type="button"
              onClick={() => void handlePostToFairbook()}
              disabled={isPosting || isExporting}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPosting ? "Posting..." : "Post to Fairbook"}
            </button>
          </div>
        </aside>

        <div className="space-y-3">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            Live Preview
          </p>
          <div
            className="relative aspect-square w-full overflow-hidden rounded-[1.6rem] border border-slate-300 shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
            style={{ background: activeBackground.preview }}
          >
            <div
              ref={textFrameRef}
              className="absolute inset-0 grid place-items-center px-[10%] py-[10%]"
            >
              <div
                className="w-full text-center"
                style={{
                  color: textColor,
                  fontSize: `${fontSize}px`,
                  fontFamily: activeFont.family,
                  fontWeight: activeFont.weight,
                  letterSpacing: `${activeFont.letterSpacing}px`,
                  lineHeight: activeFont.lineHeight,
                  textTransform: "none",
                  textShadow:
                    textColor === "#0f172a"
                      ? "0 2px 16px rgba(255,255,255,0.28)"
                      : "0 2px 16px rgba(0,0,0,0.42)",
                }}
              >
                {previewLines.map((line, index) => (
                  <p key={`${index}-${line}`} className="m-0 [overflow-wrap:anywhere]">
                    {line || "\u00A0"}
                  </p>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.2),_transparent_48%)]" />
          </div>
        </div>
      </div>
    </section>
  );
}
