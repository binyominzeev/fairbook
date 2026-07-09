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
  isTextCard: boolean;
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
  {
    id: "amber-peach",
    name: "Amber Peach",
    preview: "linear-gradient(145deg, #ffe9b3 0%, #ffd3a6 55%, #ffb988 100%)",
    render: {
      kind: "linear",
      angle: 145,
      stops: [
        { offset: 0, color: "#ffe9b3" },
        { offset: 0.55, color: "#ffd3a6" },
        { offset: 1, color: "#ffb988" },
      ],
    },
  },
  {
    id: "burnt-coral",
    name: "Burnt Coral",
    preview: "linear-gradient(150deg, #ffd7c2 0%, #f7a989 52%, #d9745f 100%)",
    render: {
      kind: "linear",
      angle: 150,
      stops: [
        { offset: 0, color: "#ffd7c2" },
        { offset: 0.52, color: "#f7a989" },
        { offset: 1, color: "#d9745f" },
      ],
    },
  },
  {
    id: "clay-sunrise",
    name: "Clay Sunrise",
    preview: "linear-gradient(155deg, #fbe7d2 0%, #e8bfa6 54%, #c78972 100%)",
    render: {
      kind: "linear",
      angle: 155,
      stops: [
        { offset: 0, color: "#fbe7d2" },
        { offset: 0.54, color: "#e8bfa6" },
        { offset: 1, color: "#c78972" },
      ],
    },
  },
  {
    id: "honey-sand",
    name: "Honey Sand",
    preview: "linear-gradient(140deg, #fff4cc 0%, #f7dfa2 56%, #d6b36f 100%)",
    render: {
      kind: "linear",
      angle: 140,
      stops: [
        { offset: 0, color: "#fff4cc" },
        { offset: 0.56, color: "#f7dfa2" },
        { offset: 1, color: "#d6b36f" },
      ],
    },
  },
  {
    id: "copper-bloom",
    name: "Copper Bloom",
    preview: "linear-gradient(150deg, #f8dec8 0%, #dfab87 50%, #b9754f 100%)",
    render: {
      kind: "linear",
      angle: 150,
      stops: [
        { offset: 0, color: "#f8dec8" },
        { offset: 0.5, color: "#dfab87" },
        { offset: 1, color: "#b9754f" },
      ],
    },
  },
  {
    id: "glacier-blue",
    name: "Glacier Blue",
    preview: "linear-gradient(145deg, #e8f4ff 0%, #b9ddff 52%, #7fb5ea 100%)",
    render: {
      kind: "linear",
      angle: 145,
      stops: [
        { offset: 0, color: "#e8f4ff" },
        { offset: 0.52, color: "#b9ddff" },
        { offset: 1, color: "#7fb5ea" },
      ],
    },
  },
  {
    id: "teal-mist",
    name: "Teal Mist",
    preview: "linear-gradient(150deg, #dff5f3 0%, #9cd7cf 55%, #4ea09a 100%)",
    render: {
      kind: "linear",
      angle: 150,
      stops: [
        { offset: 0, color: "#dff5f3" },
        { offset: 0.55, color: "#9cd7cf" },
        { offset: 1, color: "#4ea09a" },
      ],
    },
  },
  {
    id: "cloud-cyan",
    name: "Cloud Cyan",
    preview: "radial-gradient(circle at 20% 20%, #f2fcff 0%, #cdeff8 55%, #8fc9da 100%)",
    render: {
      kind: "radial",
      stops: [
        { offset: 0, color: "#f2fcff" },
        { offset: 0.55, color: "#cdeff8" },
        { offset: 1, color: "#8fc9da" },
      ],
    },
  },
  {
    id: "arctic-slate",
    name: "Arctic Slate",
    preview: "linear-gradient(150deg, #e8eef5 0%, #c2d0df 55%, #8497ae 100%)",
    render: {
      kind: "linear",
      angle: 150,
      stops: [
        { offset: 0, color: "#e8eef5" },
        { offset: 0.55, color: "#c2d0df" },
        { offset: 1, color: "#8497ae" },
      ],
    },
  },
  {
    id: "rainline",
    name: "Rainline",
    preview: "linear-gradient(160deg, #edf3ff 0%, #c4d5f6 54%, #7f9acb 100%)",
    render: {
      kind: "linear",
      angle: 160,
      stops: [
        { offset: 0, color: "#edf3ff" },
        { offset: 0.54, color: "#c4d5f6" },
        { offset: 1, color: "#7f9acb" },
      ],
    },
  },
  {
    id: "ivory-grain",
    name: "Ivory Grain",
    preview: "linear-gradient(145deg, #fffdf6 0%, #f0e8d7 57%, #d9cbb5 100%)",
    render: {
      kind: "linear",
      angle: 145,
      stops: [
        { offset: 0, color: "#fffdf6" },
        { offset: 0.57, color: "#f0e8d7" },
        { offset: 1, color: "#d9cbb5" },
      ],
    },
  },
  {
    id: "stone-paper",
    name: "Stone Paper",
    preview: "linear-gradient(150deg, #f6f4ef 0%, #ddd8cf 55%, #b8afa0 100%)",
    render: {
      kind: "linear",
      angle: 150,
      stops: [
        { offset: 0, color: "#f6f4ef" },
        { offset: 0.55, color: "#ddd8cf" },
        { offset: 1, color: "#b8afa0" },
      ],
    },
  },
  {
    id: "ink-wash",
    name: "Ink Wash",
    preview: "linear-gradient(155deg, #eef1f5 0%, #b8c1ce 53%, #5f6d82 100%)",
    render: {
      kind: "linear",
      angle: 155,
      stops: [
        { offset: 0, color: "#eef1f5" },
        { offset: 0.53, color: "#b8c1ce" },
        { offset: 1, color: "#5f6d82" },
      ],
    },
  },
  {
    id: "fog-linen",
    name: "Fog Linen",
    preview: "radial-gradient(circle at 25% 20%, #faf8f3 0%, #e5e1d7 57%, #bcb7ab 100%)",
    render: {
      kind: "radial",
      stops: [
        { offset: 0, color: "#faf8f3" },
        { offset: 0.57, color: "#e5e1d7" },
        { offset: 1, color: "#bcb7ab" },
      ],
    },
  },
  {
    id: "soft-charcoal",
    name: "Soft Charcoal",
    preview: "linear-gradient(160deg, #d8dce3 0%, #a7aeb9 54%, #5f6773 100%)",
    render: {
      kind: "linear",
      angle: 160,
      stops: [
        { offset: 0, color: "#d8dce3" },
        { offset: 0.54, color: "#a7aeb9" },
        { offset: 1, color: "#5f6773" },
      ],
    },
  },
  {
    id: "deep-navy-glow",
    name: "Deep Navy Glow",
    preview: "linear-gradient(155deg, #0d1a34 0%, #1a355f 52%, #4b6ca1 100%)",
    render: {
      kind: "linear",
      angle: 155,
      stops: [
        { offset: 0, color: "#0d1a34" },
        { offset: 0.52, color: "#1a355f" },
        { offset: 1, color: "#4b6ca1" },
      ],
    },
  },
  {
    id: "graphite-plum",
    name: "Graphite Plum",
    preview: "linear-gradient(150deg, #16151f 0%, #342a3f 52%, #6a4c70 100%)",
    render: {
      kind: "linear",
      angle: 150,
      stops: [
        { offset: 0, color: "#16151f" },
        { offset: 0.52, color: "#342a3f" },
        { offset: 1, color: "#6a4c70" },
      ],
    },
  },
  {
    id: "night-olive",
    name: "Night Olive",
    preview: "linear-gradient(155deg, #131c15 0%, #243828 50%, #56704f 100%)",
    render: {
      kind: "linear",
      angle: 155,
      stops: [
        { offset: 0, color: "#131c15" },
        { offset: 0.5, color: "#243828" },
        { offset: 1, color: "#56704f" },
      ],
    },
  },
  {
    id: "onyx-ember",
    name: "Onyx Ember",
    preview: "linear-gradient(160deg, #120f12 0%, #3a2523 52%, #8a4f3a 100%)",
    render: {
      kind: "linear",
      angle: 160,
      stops: [
        { offset: 0, color: "#120f12" },
        { offset: 0.52, color: "#3a2523" },
        { offset: 1, color: "#8a4f3a" },
      ],
    },
  },
  {
    id: "solid-cloud",
    name: "Cloud",
    preview: "#f8fafc",
    render: { kind: "solid", stops: [{ offset: 0, color: "#f8fafc" }] },
  },
  {
    id: "solid-ivory",
    name: "Ivory",
    preview: "#fffaf0",
    render: { kind: "solid", stops: [{ offset: 0, color: "#fffaf0" }] },
  },
  {
    id: "solid-sand",
    name: "Sand",
    preview: "#f5e9d5",
    render: { kind: "solid", stops: [{ offset: 0, color: "#f5e9d5" }] },
  },
  {
    id: "solid-blush",
    name: "Blush",
    preview: "#f8d7da",
    render: { kind: "solid", stops: [{ offset: 0, color: "#f8d7da" }] },
  },
  {
    id: "solid-peach",
    name: "Peach",
    preview: "#ffd8b1",
    render: { kind: "solid", stops: [{ offset: 0, color: "#ffd8b1" }] },
  },
  {
    id: "solid-amber",
    name: "Amber",
    preview: "#fbbf24",
    render: { kind: "solid", stops: [{ offset: 0, color: "#fbbf24" }] },
  },
  {
    id: "solid-lemon",
    name: "Lemon",
    preview: "#fde68a",
    render: { kind: "solid", stops: [{ offset: 0, color: "#fde68a" }] },
  },
  {
    id: "solid-lime",
    name: "Lime",
    preview: "#bef264",
    render: { kind: "solid", stops: [{ offset: 0, color: "#bef264" }] },
  },
  {
    id: "solid-mint",
    name: "Mint",
    preview: "#bbf7d0",
    render: { kind: "solid", stops: [{ offset: 0, color: "#bbf7d0" }] },
  },
  {
    id: "solid-emerald",
    name: "Emerald",
    preview: "#34d399",
    render: { kind: "solid", stops: [{ offset: 0, color: "#34d399" }] },
  },
  {
    id: "solid-teal",
    name: "Teal",
    preview: "#2dd4bf",
    render: { kind: "solid", stops: [{ offset: 0, color: "#2dd4bf" }] },
  },
  {
    id: "solid-cyan",
    name: "Cyan",
    preview: "#67e8f9",
    render: { kind: "solid", stops: [{ offset: 0, color: "#67e8f9" }] },
  },
  {
    id: "solid-sky",
    name: "Sky",
    preview: "#7dd3fc",
    render: { kind: "solid", stops: [{ offset: 0, color: "#7dd3fc" }] },
  },
  {
    id: "solid-blue",
    name: "Blue",
    preview: "#60a5fa",
    render: { kind: "solid", stops: [{ offset: 0, color: "#60a5fa" }] },
  },
  {
    id: "solid-indigo",
    name: "Indigo",
    preview: "#818cf8",
    render: { kind: "solid", stops: [{ offset: 0, color: "#818cf8" }] },
  },
  {
    id: "solid-violet",
    name: "Violet",
    preview: "#a78bfa",
    render: { kind: "solid", stops: [{ offset: 0, color: "#a78bfa" }] },
  },
  {
    id: "solid-purple",
    name: "Purple",
    preview: "#c084fc",
    render: { kind: "solid", stops: [{ offset: 0, color: "#c084fc" }] },
  },
  {
    id: "solid-fuchsia",
    name: "Fuchsia",
    preview: "#e879f9",
    render: { kind: "solid", stops: [{ offset: 0, color: "#e879f9" }] },
  },
  {
    id: "solid-rose",
    name: "Rose",
    preview: "#fb7185",
    render: { kind: "solid", stops: [{ offset: 0, color: "#fb7185" }] },
  },
  {
    id: "solid-crimson",
    name: "Crimson",
    preview: "#ef4444",
    render: { kind: "solid", stops: [{ offset: 0, color: "#ef4444" }] },
  },
  {
    id: "solid-copper",
    name: "Copper",
    preview: "#c08457",
    render: { kind: "solid", stops: [{ offset: 0, color: "#c08457" }] },
  },
  {
    id: "solid-stone",
    name: "Stone",
    preview: "#a8a29e",
    render: { kind: "solid", stops: [{ offset: 0, color: "#a8a29e" }] },
  },
  {
    id: "solid-slate",
    name: "Slate",
    preview: "#64748b",
    render: { kind: "solid", stops: [{ offset: 0, color: "#64748b" }] },
  },
  {
    id: "solid-ink",
    name: "Ink",
    preview: "#1f2937",
    render: { kind: "solid", stops: [{ offset: 0, color: "#1f2937" }] },
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
    id: "garamond",
    name: "Garamond",
    family: "Garamond, 'Times New Roman', serif",
    weight: 700,
    letterSpacing: 0.1,
    lineHeight: 1.14,
    transform: "none",
  },
  {
    id: "baskerville",
    name: "Baskerville",
    family: "Baskerville, 'Palatino Linotype', serif",
    weight: 700,
    letterSpacing: 0.05,
    lineHeight: 1.13,
    transform: "none",
  },
  {
    id: "optima",
    name: "Optima",
    family: "Optima, 'Trebuchet MS', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.18,
    lineHeight: 1.16,
    transform: "none",
  },
  {
    id: "avenir",
    name: "Avenir",
    family: "'Avenir Next', 'Helvetica Neue', 'Segoe UI', sans-serif",
    weight: 800,
    letterSpacing: 0.16,
    lineHeight: 1.15,
    transform: "none",
  },
  {
    id: "source-sans-3",
    name: "Source Sans 3",
    family: "'Source Sans 3', 'Segoe UI', 'Helvetica Neue', sans-serif",
    weight: 700,
    letterSpacing: 0.14,
    lineHeight: 1.15,
    transform: "none",
  },
  {
    id: "lora",
    name: "Lora",
    family: "Lora, Georgia, serif",
    weight: 700,
    letterSpacing: 0.04,
    lineHeight: 1.14,
    transform: "none",
  },
  {
    id: "merriweather",
    name: "Merriweather",
    family: "Merriweather, Georgia, serif",
    weight: 700,
    letterSpacing: 0.02,
    lineHeight: 1.13,
    transform: "none",
  },
  {
    id: "ibm-plex-sans",
    name: "IBM Plex Sans",
    family: "'IBM Plex Sans', 'Segoe UI', 'Helvetica Neue', sans-serif",
    weight: 700,
    letterSpacing: 0.12,
    lineHeight: 1.15,
    transform: "none",
  },
];

const DEFAULT_TEXT = "Great conversations start where attention does not run out.";

type TextCardCreatorProps = {
  initialText?: string;
  isAdmin?: boolean;
  initialHiddenFontIds?: string[];
  initialHiddenBackgroundIds?: string[];
};

type BackgroundGalleryTab = "gradients" | "solids";

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

function trimLineToWidth(
  ctx: CanvasRenderingContext2D,
  line: string,
  maxWidth: number,
  letterSpacing: number,
  suffix = "..."
) {
  if (measureTextWidth(ctx, line, letterSpacing) <= maxWidth) {
    return line;
  }

  let current = line;
  while (current.length > 0) {
    const candidate = `${current}${suffix}`;
    if (measureTextWidth(ctx, candidate, letterSpacing) <= maxWidth) {
      return candidate;
    }
    current = current.slice(0, -1);
  }

  return suffix;
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
    const x = centerX - ctx.measureText(line).width / 2;
    ctx.fillText(line, x, y);
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
  if (maxWidth <= 0 || maxHeight <= 0) {
    return {
      fontSize: MIN_FONT_SIZE,
      lines: [content],
      lineHeightPx: MIN_FONT_SIZE * font.lineHeight,
    };
  }

  // Keep a sane fallback when no tested size can fully fit the frame.
  ctx.font = `${font.weight} ${MIN_FONT_SIZE}px ${font.family}`;
  let bestLines: string[] = wrapLinesForWidth(ctx, content, maxWidth, font.letterSpacing);
  let low = MIN_FONT_SIZE;
  let high = MAX_FONT_SIZE;
  let bestSize = MIN_FONT_SIZE;

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

  const lineHeightPx = bestSize * font.lineHeight;
  const maxLines = Math.max(1, Math.floor(maxHeight / lineHeightPx));
  if (bestLines.length > maxLines) {
    ctx.font = `${font.weight} ${bestSize}px ${font.family}`;
    const truncated = bestLines.slice(0, maxLines);
    const lastIndex = truncated.length - 1;
    const baseLastLine = (truncated[lastIndex] ?? "").trimEnd();
    truncated[lastIndex] = trimLineToWidth(
      ctx,
      baseLastLine,
      maxWidth,
      font.letterSpacing,
      "..."
    );
    bestLines = truncated;
  }

  return {
    fontSize: bestSize,
    lines: bestLines,
    lineHeightPx,
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

export default function TextCardCreator({
  initialText,
  isAdmin = false,
  initialHiddenFontIds = [],
  initialHiddenBackgroundIds = [],
}: TextCardCreatorProps) {
  const router = useRouter();
  const [text, setText] = useState(() => initialText?.trim() || DEFAULT_TEXT);
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [fontId, setFontId] = useState(FONTS[0].id);
  const [fontSize, setFontSize] = useState(72);
  const [previewLines, setPreviewLines] = useState<string[]>([""]);
  const [isExporting, setIsExporting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [includeCaptionInPost, setIncludeCaptionInPost] = useState(true);
  const [isBackgroundGalleryOpen, setIsBackgroundGalleryOpen] = useState(false);
  const [backgroundGalleryTab, setBackgroundGalleryTab] =
    useState<BackgroundGalleryTab>("gradients");
  const [hiddenFontIds, setHiddenFontIds] = useState<string[]>(() =>
    Array.from(new Set(initialHiddenFontIds))
  );
  const [hiddenBackgroundIds, setHiddenBackgroundIds] = useState<string[]>(() =>
    Array.from(new Set(initialHiddenBackgroundIds))
  );
  const [isSavingPresetVisibility, setIsSavingPresetVisibility] = useState(false);
  const [error, setError] = useState("");

  const textFrameRef = useRef<HTMLDivElement | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const availableBackgrounds = useMemo(() => {
    const visible = isAdmin
      ? BACKGROUNDS
      : BACKGROUNDS.filter((preset) => !hiddenBackgroundIds.includes(preset.id));
    return visible.length > 0 ? visible : [BACKGROUNDS[0]];
  }, [hiddenBackgroundIds, isAdmin]);
  const availableFonts = useMemo(() => {
    const visible = isAdmin ? FONTS : FONTS.filter((preset) => !hiddenFontIds.includes(preset.id));
    return visible.length > 0 ? visible : [FONTS[0]];
  }, [hiddenFontIds, isAdmin]);

  const activeBackground = useMemo(
    () =>
      availableBackgrounds.find((preset) => preset.id === backgroundId) ??
      availableBackgrounds[0],
    [availableBackgrounds, backgroundId]
  );
  const activeFont = useMemo(
    () => availableFonts.find((preset) => preset.id === fontId) ?? availableFonts[0],
    [availableFonts, fontId]
  );
  const galleryBackgrounds = useMemo(() => {
    const source = isAdmin ? BACKGROUNDS : availableBackgrounds;
    return source.filter((preset) =>
      backgroundGalleryTab === "solids"
        ? preset.render.kind === "solid"
        : preset.render.kind !== "solid"
    );
  }, [availableBackgrounds, backgroundGalleryTab, isAdmin]);
  const textColor = useMemo(() => pickReadableColor(activeBackground), [activeBackground]);
  const displayText = useMemo(
    () => (activeFont.transform === "uppercase" ? text.toUpperCase() : text),
    [activeFont.transform, text]
  );

  useEffect(() => {
    if (!availableBackgrounds.some((preset) => preset.id === backgroundId)) {
      setBackgroundId(availableBackgrounds[0].id);
    }
  }, [availableBackgrounds, backgroundId]);

  useEffect(() => {
    if (!availableFonts.some((preset) => preset.id === fontId)) {
      setFontId(availableFonts[0].id);
    }
  }, [availableFonts, fontId]);

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
        isTextCard: true,
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

  const updatePresetVisibility = useCallback(
    async (nextHiddenFontIds: string[], nextHiddenBackgroundIds: string[]) => {
      if (!isAdmin) return;

      setIsSavingPresetVisibility(true);
      try {
        const response = await fetch("/api/admin/text-card-presets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hiddenFontIds: nextHiddenFontIds,
            hiddenBackgroundIds: nextHiddenBackgroundIds,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? "Failed to save preset visibility.");
          return;
        }

        setHiddenFontIds(Array.isArray(data.hiddenFontIds) ? data.hiddenFontIds : []);
        setHiddenBackgroundIds(
          Array.isArray(data.hiddenBackgroundIds) ? data.hiddenBackgroundIds : []
        );
      } catch {
        setError("Failed to save preset visibility.");
      } finally {
        setIsSavingPresetVisibility(false);
      }
    },
    [isAdmin]
  );

  const toggleFontHidden = useCallback(
    (fontPresetId: string) => {
      if (!isAdmin || isSavingPresetVisibility) return;

      const nextHiddenFontIds = hiddenFontIds.includes(fontPresetId)
        ? hiddenFontIds.filter((id) => id !== fontPresetId)
        : [...hiddenFontIds, fontPresetId];
      void updatePresetVisibility(nextHiddenFontIds, hiddenBackgroundIds);
    },
    [hiddenBackgroundIds, hiddenFontIds, isAdmin, isSavingPresetVisibility, updatePresetVisibility]
  );

  const toggleBackgroundHidden = useCallback(
    (backgroundPresetId: string) => {
      if (!isAdmin || isSavingPresetVisibility) return;

      const nextHiddenBackgroundIds = hiddenBackgroundIds.includes(backgroundPresetId)
        ? hiddenBackgroundIds.filter((id) => id !== backgroundPresetId)
        : [...hiddenBackgroundIds, backgroundPresetId];
      void updatePresetVisibility(hiddenFontIds, nextHiddenBackgroundIds);
    },
    [hiddenBackgroundIds, hiddenFontIds, isAdmin, isSavingPresetVisibility, updatePresetVisibility]
  );

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

      if (event.key === "Escape") {
        setIsBackgroundGalleryOpen(false);
      }
    };

    window.addEventListener("keydown", onShortcut);
    return () => {
      window.removeEventListener("keydown", onShortcut);
    };
  }, [handleDownloadPng]);

  return (
    <section className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
      {isBackgroundGalleryOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-slate-900/50 px-4 py-8 sm:items-center"
          role="dialog"
          aria-modal="true"
          onMouseDown={() => setIsBackgroundGalleryOpen(false)}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-4 shadow-2xl sm:p-5"
            onMouseDown={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <div>
                <h2 className="text-base font-semibold text-slate-900">Background Gallery</h2>
                <p className="text-xs text-slate-500">
                  Pick from all available presets. More backgrounds can be added here later.
                </p>
              </div>
              <button
                type="button"
                onClick={() => setIsBackgroundGalleryOpen(false)}
                className="rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 transition-colors hover:bg-slate-50"
              >
                Close
              </button>
            </div>

            <div className="mb-4 grid grid-cols-2 gap-2 rounded-xl border border-slate-200 bg-slate-50 p-1">
              <button
                type="button"
                onClick={() => setBackgroundGalleryTab("gradients")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  backgroundGalleryTab === "gradients"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Gradients
              </button>
              <button
                type="button"
                onClick={() => setBackgroundGalleryTab("solids")}
                className={`rounded-lg px-3 py-2 text-xs font-semibold transition-colors ${
                  backgroundGalleryTab === "solids"
                    ? "bg-white text-slate-900 shadow-sm"
                    : "text-slate-500 hover:text-slate-700"
                }`}
              >
                Solid Colors
              </button>
            </div>

            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
              {galleryBackgrounds.map((preset) => {
                const active = preset.id === activeBackground.id;
                const isHidden = hiddenBackgroundIds.includes(preset.id);
                return (
                  <div
                    key={preset.id}
                    className={`relative overflow-hidden rounded-xl border bg-white ${
                      active ? "border-slate-900" : "border-slate-200"
                    } ${isHidden && isAdmin ? "opacity-70" : ""}`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        setBackgroundId(preset.id);
                        setIsBackgroundGalleryOpen(false);
                      }}
                      className="w-full text-left"
                    >
                      <span className="block h-24 w-full" style={{ background: preset.preview }} />
                      <span className="flex items-center justify-between bg-white px-2 py-1.5 text-xs font-medium text-slate-700">
                        <span>{preset.name}</span>
                        {isHidden && isAdmin && (
                          <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-semibold text-amber-900">
                            Hidden
                          </span>
                        )}
                      </span>
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleBackgroundHidden(preset.id)}
                        disabled={isSavingPresetVisibility}
                        className="absolute right-2 top-2 rounded bg-white/90 px-2 py-1 text-[10px] font-semibold text-slate-700 shadow-sm transition-colors hover:bg-white disabled:opacity-60"
                      >
                        {isHidden ? "Restore" : "Hide"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

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
              {availableBackgrounds.slice(0, 6).map((preset) => {
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
            <button
              type="button"
              onClick={() => {
                setBackgroundGalleryTab(
                  activeBackground.render.kind === "solid" ? "solids" : "gradients"
                );
                setIsBackgroundGalleryOpen(true);
              }}
              className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2 text-xs font-semibold uppercase tracking-[0.16em] text-slate-700 transition-colors hover:bg-slate-50"
            >
              Open Gallery
            </button>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              Font Style
            </p>
            <div className="grid grid-cols-2 gap-2">
              {(isAdmin ? FONTS : availableFonts).map((preset) => {
                const active = preset.id === activeFont.id;
                const isHidden = hiddenFontIds.includes(preset.id);
                return (
                  <div key={preset.id} className="relative">
                    <button
                      type="button"
                      onClick={() => setFontId(preset.id)}
                      className={`w-full rounded-xl border px-3 py-2 pr-14 text-left text-sm transition-colors ${
                        active
                          ? "border-slate-900 bg-slate-900 text-white"
                          : "border-slate-200 bg-white text-slate-700 hover:border-slate-300"
                      } ${isHidden && isAdmin ? "opacity-70" : ""}`}
                      style={{ fontFamily: preset.family }}
                    >
                      {preset.name}
                    </button>
                    {isAdmin && (
                      <button
                        type="button"
                        onClick={() => toggleFontHidden(preset.id)}
                        disabled={isSavingPresetVisibility}
                        className="absolute right-2 top-1/2 -translate-y-1/2 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                      >
                        {isHidden ? "Restore" : "Hide"}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
            {isAdmin && (
              <p className="text-[11px] text-slate-500">
                Hidden presets are not shown for non-admin users.
                {isSavingPresetVisibility ? " Saving..." : ""}
              </p>
            )}
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
