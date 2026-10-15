"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import PostComposerDialog, { type PostComposerSuccessResult } from "./PostComposerDialog";
import EmojiPickerButton from "./EmojiPickerButton";
import { t, tf } from "@/lib/i18n";
import { useAppLocale } from "@/components/AppLocaleProvider";
import { WEBGRADIENTS } from "@/lib/text-card-gradients";
import { HERO_PATTERN_TILES, type HeroPatternTile } from "@/lib/text-card-hero-patterns";
import { TEXT_CARD_TEXTURES } from "@/lib/text-card-textures";

type BackgroundPreset = {
  id: string;
  name: string;
  preview: string;
  category?: BackgroundCategory;
  render: {
    kind: "solid" | "linear" | "radial" | "pattern" | "image";
    angle?: number;
    stops: Array<{ offset: number; color: string }>;
    tileSvg?: string;
    tileWidth?: number;
    tileHeight?: number;
    imageUrl?: string;
    overlayColor?: string;
    textColor?: string;
  };
};

type BackgroundCategory = "gradients" | "solids" | "patterns" | "textures";

type FontPreset = {
  id: string;
  name: string;
  category: "sans" | "serif" | "handwritten";
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

type UploadResponseData = {
  error?: string;
  urls?: string[];
};

type TextCardClientErrorPayload = {
  referenceId: string;
  event: string;
  step: string;
  message: string;
  stack?: string;
  httpStatus?: number;
  responseContentType?: string;
  responseSnippet?: string;
  file?: {
    name: string;
    size: number;
    type: string;
  };
  details?: Record<string, unknown>;
};

const EXPORT_SIZE = 1080;
// Stays under nginx's default 1 MB client_max_body_size, with room for multipart overhead.
const UPLOAD_TARGET_BYTES = 900 * 1024;
const UPLOAD_WEBP_QUALITY_STEPS = [0.92, 0.85, 0.78, 0.7, 0.6, 0.5, 0.4];
const MIN_FONT_SIZE = 20;
const MAX_FONT_SIZE = 240;
const HORIZONTAL_PADDING = 0.1;
const VERTICAL_PADDING = 0.1;

// Every tile is rendered about this wide in the 1080px export, whatever its source size.
const PATTERN_TILE_EXPORT_WIDTH = 180;

const PATTERN_PALETTES: Array<{ bg: string; fg: string; opacity: number }> = [
  { bg: "#0f172a", fg: "#94a3b8", opacity: 0.35 },
  { bg: "#fde68a", fg: "#b45309", opacity: 0.25 },
  { bg: "#bfdbfe", fg: "#1d4ed8", opacity: 0.25 },
  { bg: "#fbcfe8", fg: "#9d174d", opacity: 0.25 },
  { bg: "#134e4a", fg: "#5eead4", opacity: 0.3 },
  { bg: "#f5f5f4", fg: "#57534e", opacity: 0.2 },
  { bg: "#312e81", fg: "#a5b4fc", opacity: 0.35 },
  { bg: "#fecaca", fg: "#b91c1c", opacity: 0.22 },
  { bg: "#14532d", fg: "#86efac", opacity: 0.3 },
  { bg: "#fed7aa", fg: "#c2410c", opacity: 0.25 },
];

function fillTileSvg(tile: HeroPatternTile, fg: string, opacity: number) {
  return tile.svgTemplate.replaceAll("__FILL__", fg).replaceAll("__OPACITY__", String(opacity));
}

function buildTilePreview(tileSvg: string, bgColor: string) {
  const widthPercent = ((PATTERN_TILE_EXPORT_WIDTH / EXPORT_SIZE) * 100).toFixed(3);
  const dataUrl = `data:image/svg+xml,${encodeURIComponent(tileSvg)}`;
  return `url("${dataUrl}") 0 0/${widthPercent}% auto repeat, ${bgColor}`;
}

const PATTERN_BACKGROUNDS: BackgroundPreset[] = HERO_PATTERN_TILES.map((tile, index) => {
  const palette = PATTERN_PALETTES[index % PATTERN_PALETTES.length];
  const tileSvg = fillTileSvg(tile, palette.fg, palette.opacity);
  return {
    id: tile.id,
    name: tile.name,
    preview: buildTilePreview(tileSvg, palette.bg),
    render: {
      kind: "pattern",
      stops: [{ offset: 0, color: palette.bg }],
      tileSvg,
      tileWidth: tile.width,
      tileHeight: tile.height,
    },
  };
});

const PAGE_TURNER_BACKGROUND: BackgroundPreset = {
  id: "pattern-page-turner",
  name: "Page Turner",
  category: "patterns",
  preview: `url("/text-card-backgrounds/svgbackgrounds-free/page-turner.svg") center/cover no-repeat`,
  render: {
    kind: "image",
    stops: [{ offset: 0, color: "#c9c9c9" }],
    imageUrl: "/text-card-backgrounds/svgbackgrounds-free/page-turner.svg",
    overlayColor: "rgba(255,255,255,0.2)",
  },
};

// A flat overlay keeps text readable on busy photographic textures.
const TEXTURE_BACKGROUNDS: BackgroundPreset[] = TEXT_CARD_TEXTURES.map((texture) => {
  const imageUrl = `/text-card-backgrounds/textures/${texture.file}`;
  const base: BackgroundPreset = {
    id: texture.id,
    name: texture.name,
    preview: `url("${imageUrl}") center/cover no-repeat`,
    render: { kind: "image", stops: [{ offset: 0, color: texture.avgColor }], imageUrl },
  };
  const overlayColor =
    pickReadableColor(base) === "#f8fafc" ? "rgba(0,0,0,0.3)" : "rgba(255,255,255,0.25)";
  return {
    ...base,
    preview: `linear-gradient(${overlayColor}, ${overlayColor}), ${base.preview}`,
    render: { ...base.render, overlayColor },
  };
});

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
  ...WEBGRADIENTS,
  ...PATTERN_BACKGROUNDS,
  PAGE_TURNER_BACKGROUND,
  ...TEXTURE_BACKGROUNDS,
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

const EMOJI_FONT_FALLBACK = "'Noto Color Emoji', 'Apple Color Emoji', 'Segoe UI Emoji'";

const BASE_FONTS: FontPreset[] = [
  {
    id: "roboto",
    name: "Roboto",
    category: "sans",
    family: "'Roboto', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.08,
    lineHeight: 1.15,
    transform: "none",
  },
  {
    id: "poppins",
    name: "Poppins",
    category: "sans",
    family: "'Poppins', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.1,
    lineHeight: 1.14,
    transform: "none",
  },
  {
    id: "noto-sans",
    name: "Noto Sans",
    category: "sans",
    family: "'Noto Sans', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.06,
    lineHeight: 1.15,
    transform: "none",
  },
  {
    id: "outfit",
    name: "Outfit",
    category: "sans",
    family: "'Outfit', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.1,
    lineHeight: 1.14,
    transform: "none",
  },
  {
    id: "pt-sans",
    name: "PT Sans",
    category: "sans",
    family: "'PT Sans', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.08,
    lineHeight: 1.15,
    transform: "none",
  },
  {
    id: "crimson-text",
    name: "Crimson Text",
    category: "serif",
    family: "'Crimson Text', Georgia, serif",
    weight: 700,
    letterSpacing: 0.02,
    lineHeight: 1.12,
    transform: "none",
  },
  {
    id: "newsreader",
    name: "Newsreader",
    category: "serif",
    family: "'Newsreader', Georgia, serif",
    weight: 700,
    letterSpacing: 0.02,
    lineHeight: 1.12,
    transform: "none",
  },
  {
    id: "forum",
    name: "Forum",
    category: "serif",
    family: "'Forum', Georgia, serif",
    weight: 700,
    letterSpacing: 0.04,
    lineHeight: 1.13,
    transform: "none",
  },
  {
    id: "playpen-sans-hebrew",
    name: "Playpen Sans Hebrew",
    category: "handwritten",
    family: "'Playpen Sans Hebrew', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.06,
    lineHeight: 1.14,
    transform: "none",
  },
  {
    id: "caveat",
    name: "Caveat",
    category: "handwritten",
    family: "'Caveat', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.02,
    lineHeight: 1.1,
    transform: "none",
  },
  {
    id: "kalam",
    name: "Kalam",
    category: "handwritten",
    family: "'Kalam', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0.02,
    lineHeight: 1.11,
    transform: "none",
  },
  {
    id: "baloo-2",
    name: "Baloo 2",
    category: "handwritten",
    family: "'Baloo 2', 'Segoe UI', sans-serif",
    weight: 700,
    letterSpacing: 0,
    lineHeight: 1.11,
    transform: "none",
  },
];

const FONTS: FontPreset[] = BASE_FONTS.map((font) => ({
  ...font,
  family: `${font.family}, ${EMOJI_FONT_FALLBACK}`,
}));

const DEFAULT_FONT_PICK_IDS = [
  "roboto",
  "poppins",
  "noto-sans",
  "crimson-text",
  "playpen-sans-hebrew",
  "caveat",
];
const DEFAULT_RECENT_FONT_IDS = ["roboto", "newsreader", "caveat"];
const DEFAULT_RECENT_BACKGROUND_IDS = [
  "golden-hour",
  "mint-breeze",
  "copper-ink",
  "paper-sky",
  "forest-night",
  "powder-rose",
];
const RECENT_FONT_LIMIT = 6;
const RECENT_BACKGROUND_LIMIT = 6;
const GOOGLE_FONTS_STYLESHEET =
  "https://fonts.googleapis.com/css2?family=Roboto:wght@400;500;700&family=Poppins:wght@400;500;700&family=Noto+Sans:wght@400;500;700&family=Outfit:wght@400;500;700&family=PT+Sans:wght@400;700&family=Crimson+Text:wght@400;600;700&family=Newsreader:opsz,wght@6..72,400;6..72,500;6..72,700&family=Forum&family=Playpen+Sans+Hebrew:wght@400;500;700&family=Caveat:wght@400;500;700&family=Kalam:wght@400;700&family=Baloo+2:wght@400;500;700&display=swap";

type TextCardCreatorProps = {
  initialText?: string;
  isAdmin?: boolean;
  initialHiddenFontIds?: string[];
  communityId?: string | null;
  returnToPath?: string | null;
};

const BACKGROUND_CATEGORY_LABELS: Record<BackgroundCategory, string> = {
  gradients: "Gradients",
  solids: "Solid Colors",
  patterns: "Background Patterns",
  textures: "Textures",
};

function getBackgroundCategory(preset: BackgroundPreset): BackgroundCategory {
  if (preset.category) {
    return preset.category;
  }
  if (preset.render.kind === "solid") {
    return "solids";
  }
  if (preset.render.kind === "pattern") {
    return "patterns";
  }
  if (preset.render.kind === "image") {
    return "textures";
  }
  return "gradients";
}

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

function contrastRatio(luminanceA: number, luminanceB: number) {
  const lighter = Math.max(luminanceA, luminanceB);
  const darker = Math.min(luminanceA, luminanceB);
  return (lighter + 0.05) / (darker + 0.05);
}

function pickReadableColor(background: BackgroundPreset) {
  if (background.render.textColor) {
    return background.render.textColor;
  }

  const luminance = getBackgroundLuminance(background);
  const darkText = "#0f172a";
  const lightText = "#f8fafc";
  const darkContrast = contrastRatio(luminance, relativeLuminance(darkText));
  const lightContrast = contrastRatio(luminance, relativeLuminance(lightText));

  if (background.render.kind === "pattern") {
    const hasComfortableLightContrast = lightContrast >= 4.5;
    const darkClearlyBetter = darkContrast > lightContrast * 1.25;
    if (hasComfortableLightContrast && !darkClearlyBetter) {
      return lightText;
    }
  }

  return darkContrast >= lightContrast ? darkText : lightText;
}

const graphemeSegmenter =
  typeof Intl !== "undefined" && "Segmenter" in Intl
    ? new Intl.Segmenter(undefined, { granularity: "grapheme" })
    : null;

// Grapheme clusters keep ZWJ emoji, skin tones and flags intact.
function splitGraphemes(text: string): string[] {
  if (!graphemeSegmenter) return Array.from(text);
  return Array.from(graphemeSegmenter.segment(text), (part) => part.segment);
}

// Emoji are drawn as Twemoji images so the preview and the PNG look the same on every device.
const TWEMOJI_BASE_URL = "https://cdn.jsdelivr.net/gh/jdecked/twemoji@15.1.0/assets/svg";
const EMOJI_ADVANCE = 1.1;
const EMOJI_SIZE = 1;

function isEmojiGrapheme(grapheme: string) {
  return (
    /\p{Emoji_Presentation}/u.test(grapheme) ||
    grapheme.includes("\uFE0F") ||
    grapheme.includes("\u20E3")
  );
}

function twemojiUrl(emoji: string) {
  const codePoints = Array.from(emoji, (char) => char.codePointAt(0)!.toString(16));
  // Twemoji file names drop VS16 unless the emoji is a ZWJ sequence.
  const normalized = emoji.includes("\u200D")
    ? codePoints
    : codePoints.filter((code) => code !== "fe0f");
  return `${TWEMOJI_BASE_URL}/${normalized.join("-")}.svg`;
}

type LineSegment = { text: string; emoji: boolean };

function segmentLine(line: string): LineSegment[] {
  const segments: LineSegment[] = [];
  for (const grapheme of splitGraphemes(line)) {
    if (isEmojiGrapheme(grapheme)) {
      segments.push({ text: grapheme, emoji: true });
      continue;
    }
    const last = segments[segments.length - 1];
    if (last && !last.emoji) {
      last.text += grapheme;
    } else {
      segments.push({ text: grapheme, emoji: false });
    }
  }
  return segments;
}

function getContextFontSize(ctx: CanvasRenderingContext2D) {
  const match = /(\d+(?:\.\d+)?)px/.exec(ctx.font);
  return match ? Number(match[1]) : MIN_FONT_SIZE;
}

// null marks an emoji whose image failed to load; it falls back to the system glyph.
const emojiImageCache = new Map<string, HTMLImageElement | null>();

async function preloadEmojis(text: string) {
  const emojis = new Set(
    splitGraphemes(text).filter((grapheme) => isEmojiGrapheme(grapheme))
  );
  await Promise.all(
    Array.from(emojis, (emoji) => {
      if (emojiImageCache.has(emoji)) return Promise.resolve();
      return new Promise<void>((resolve) => {
        const image = new Image();
        image.crossOrigin = "anonymous";
        image.onload = () => {
          emojiImageCache.set(emoji, image);
          resolve();
        };
        image.onerror = () => {
          emojiImageCache.set(emoji, null);
          resolve();
        };
        image.src = twemojiUrl(emoji);
      });
    })
  );
}

function PreviewLine({ line }: { line: string }) {
  if (line.length === 0) {
    return <>{"\u00A0"}</>;
  }

  return (
    <>
      {segmentLine(line).map((segment, index) =>
        segment.emoji ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            key={index}
            src={twemojiUrl(segment.text)}
            alt={segment.text}
            draggable={false}
            style={{
              display: "inline-block",
              width: `${EMOJI_SIZE}em`,
              height: `${EMOJI_SIZE}em`,
              margin: `0 ${((EMOJI_ADVANCE - EMOJI_SIZE) / 2).toFixed(3)}em`,
              verticalAlign: "-0.12em",
            }}
          />
        ) : (
          <span key={index}>{segment.text}</span>
        )
      )}
    </>
  );
}

function measureTextWidth(
  ctx: CanvasRenderingContext2D,
  text: string,
  letterSpacing: number
) {
  if (text.length === 0) return 0;
  const fontSize = getContextFontSize(ctx);
  let base = 0;
  for (const segment of segmentLine(text)) {
    base += segment.emoji
      ? fontSize * EMOJI_ADVANCE
      : ctx.measureText(segment.text).width;
  }
  const spacing = Math.max(0, splitGraphemes(text).length - 1) * Math.max(0, letterSpacing);
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
      for (const char of splitGraphemes(word)) {
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

  const graphemes = splitGraphemes(line);
  while (graphemes.length > 0) {
    const candidate = `${graphemes.join("")}${suffix}`;
    if (measureTextWidth(ctx, candidate, letterSpacing) <= maxWidth) {
      return candidate;
    }
    graphemes.pop();
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

  const fontSize = getContextFontSize(ctx);
  const spacing = Math.max(0, letterSpacing);
  let x = centerX - measureTextWidth(ctx, line, letterSpacing) / 2;

  for (const segment of segmentLine(line)) {
    if (segment.emoji) {
      const image = emojiImageCache.get(segment.text);
      if (image) {
        const inset = (EMOJI_ADVANCE - EMOJI_SIZE) / 2;
        ctx.drawImage(image, x + fontSize * inset, y + fontSize * 0.05, fontSize * EMOJI_SIZE, fontSize * EMOJI_SIZE);
      } else {
        ctx.fillText(segment.text, x, y);
      }
      x += fontSize * EMOJI_ADVANCE + spacing;
      continue;
    }

    if (spacing === 0) {
      ctx.fillText(segment.text, x, y);
      x += ctx.measureText(segment.text).width;
      continue;
    }

    for (const char of splitGraphemes(segment.text)) {
      ctx.fillText(char, x, y);
      x += ctx.measureText(char).width + spacing;
    }
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

const patternImageCache = new Map<string, Promise<HTMLImageElement>>();

function loadPatternImage(svg: string) {
  if (patternImageCache.has(svg)) {
    return patternImageCache.get(svg)!;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to decode pattern background."));
    image.src = `data:image/svg+xml,${encodeURIComponent(svg)}`;
  });

  patternImageCache.set(svg, promise);
  return promise;
}

function loadBackgroundImage(url: string) {
  if (patternImageCache.has(url)) {
    return patternImageCache.get(url)!;
  }

  const promise = new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.decoding = "async";
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("Failed to load texture background."));
    image.src = url;
  });

  patternImageCache.set(url, promise);
  return promise;
}

async function drawBackground(
  ctx: CanvasRenderingContext2D,
  background: BackgroundPreset,
  size: number
) {
  if (background.render.kind === "image") {
    const { imageUrl, overlayColor } = background.render;
    ctx.fillStyle = background.render.stops[0]?.color ?? "#ffffff";
    ctx.fillRect(0, 0, size, size);
    if (imageUrl) {
      const image = await loadBackgroundImage(imageUrl);
      ctx.drawImage(image, 0, 0, size, size);
    }
    if (overlayColor) {
      ctx.fillStyle = overlayColor;
      ctx.fillRect(0, 0, size, size);
    }
    return;
  }

  if (background.render.kind === "solid") {
    ctx.fillStyle = background.render.stops[0]?.color ?? "#ffffff";
    ctx.fillRect(0, 0, size, size);
    return;
  }

  if (background.render.kind === "pattern") {
    ctx.fillStyle = background.render.stops[0]?.color ?? "#ffffff";
    ctx.fillRect(0, 0, size, size);

    const { tileSvg, tileWidth } = background.render;
    if (!tileSvg || !tileWidth) {
      return;
    }

    const image = await loadPatternImage(tileSvg);
    const pattern = ctx.createPattern(image, "repeat");
    if (!pattern) {
      return;
    }

    const scale = (PATTERN_TILE_EXPORT_WIDTH / tileWidth) * (size / EXPORT_SIZE);
    ctx.save();
    ctx.scale(scale, scale);
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, size / scale, size / scale);
    ctx.restore();
    return;
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

async function parseUploadResponse(response: Response): Promise<{
  data: UploadResponseData;
  contentType: string;
  rawText: string | null;
}> {
  const contentType = (response.headers.get("content-type") ?? "").toLowerCase();

  if (contentType.includes("application/json")) {
    try {
      const json = (await response.json()) as UploadResponseData;
      return {
        data: json,
        contentType,
        rawText: null,
      };
    } catch {
      return {
        data: {},
        contentType,
        rawText: null,
      };
    }
  }

  try {
    const rawText = await response.text();
    return {
      data: {},
      contentType,
      rawText,
    };
  } catch {
    return {
      data: {},
      contentType,
      rawText: null,
    };
  }
}

async function reportTextCardClientError(payload: TextCardClientErrorPayload) {
  try {
    await fetch("/api/logs/text-card-client-error", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });
  } catch {
    // Ignore logging failures so we never block user flow on telemetry writes.
  }
}

function buildTextCardFileMeta(blob: Blob, referenceId: string, suffix = "png") {
  return {
    name: `text-card-${referenceId}.${suffix}`,
    size: blob.size,
    type: blob.type || "application/octet-stream",
  };
}

export default function TextCardCreator({
  initialText,
  isAdmin = false,
  initialHiddenFontIds = [],
  communityId = null,
  returnToPath = null,
}: TextCardCreatorProps) {
  const router = useRouter();
  const locale = useAppLocale();
  const [text, setText] = useState(() => initialText?.trim() || t(locale, "textCard.defaultText"));
  const [backgroundId, setBackgroundId] = useState(BACKGROUNDS[0].id);
  const [fontId, setFontId] = useState(FONTS[0].id);
  const [fontSize, setFontSize] = useState(72);
  const [previewLines, setPreviewLines] = useState<string[]>([""]);
  const [isExporting, setIsExporting] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [includeCaptionInPost, setIncludeCaptionInPost] = useState(true);
  const [isTextTesting, setIsTextTesting] = useState(false);
  const [textModerationNotice, setTextModerationNotice] = useState<{
    kind: "success" | "warning";
    message: string;
  } | null>(null);
  const [isComposerOpen, setIsComposerOpen] = useState(false);
  const [pendingComposerContent, setPendingComposerContent] = useState("");
  const [pendingComposerImageUrl, setPendingComposerImageUrl] = useState<string | null>(null);
  const [isPatternSolidMixEnabled, setIsPatternSolidMixEnabled] = useState(false);
  const [isDesktopPreviewLayout, setIsDesktopPreviewLayout] = useState(false);
  const [selectedPatternId, setSelectedPatternId] = useState(() => {
    const firstPattern = BACKGROUNDS.find((preset) => preset.render.kind === "pattern");
    return firstPattern?.id ?? BACKGROUNDS[0].id;
  });
  const [selectedSolidId, setSelectedSolidId] = useState(() => {
    const firstSolid = BACKGROUNDS.find((preset) => preset.render.kind === "solid");
    return firstSolid?.id ?? BACKGROUNDS[0].id;
  });
  const [hiddenFontIds, setHiddenFontIds] = useState<string[]>(() =>
    Array.from(new Set(initialHiddenFontIds))
  );
  const [recentFontIds, setRecentFontIds] = useState<string[]>(() => DEFAULT_RECENT_FONT_IDS);
  const [, setRecentBackgroundIds] = useState<string[]>(() => DEFAULT_RECENT_BACKGROUND_IDS);
  const [isSavingPresetVisibility, setIsSavingPresetVisibility] = useState(false);
  const [error, setError] = useState("");
  const [isMobilePreviewPinned, setIsMobilePreviewPinned] = useState(false);
  const [mobilePreviewSpacerHeight, setMobilePreviewSpacerHeight] = useState(0);

  const textFrameRef = useRef<HTMLDivElement | null>(null);
  const textInputRef = useRef<HTMLTextAreaElement | null>(null);
  const mobilePreviewAnchorRef = useRef<HTMLDivElement | null>(null);
  const mobilePreviewCardRef = useRef<HTMLDivElement | null>(null);
  const measureCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const backgroundGalleryScrollRef = useRef<HTMLDivElement | null>(null);
  const backgroundGalleryHeaderRef = useRef<HTMLDivElement | null>(null);
  const gradientSectionRef = useRef<HTMLDivElement | null>(null);
  const solidSectionRef = useRef<HTMLDivElement | null>(null);
  const patternSectionRef = useRef<HTMLDivElement | null>(null);
  const textureSectionRef = useRef<HTMLDivElement | null>(null);

  const availableBackgrounds = useMemo(() => {
    return BACKGROUNDS;
  }, []);
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
  const availablePatternBackgrounds = useMemo(
    () => availableBackgrounds.filter((preset) => preset.render.kind === "pattern"),
    [availableBackgrounds]
  );
  const availableSolidBackgrounds = useMemo(
    () => availableBackgrounds.filter((preset) => preset.render.kind === "solid"),
    [availableBackgrounds]
  );
  const selectedPatternBackground = useMemo(
    () =>
      availablePatternBackgrounds.find((preset) => preset.id === selectedPatternId) ??
      availablePatternBackgrounds[0],
    [availablePatternBackgrounds, selectedPatternId]
  );
  const selectedSolidBackground = useMemo(
    () =>
      availableSolidBackgrounds.find((preset) => preset.id === selectedSolidId) ??
      availableSolidBackgrounds[0],
    [availableSolidBackgrounds, selectedSolidId]
  );
  const shouldApplyPatternSolidMix =
    isPatternSolidMixEnabled &&
    getBackgroundCategory(activeBackground) !== "gradients" &&
    getBackgroundCategory(activeBackground) !== "textures" &&
    Boolean(selectedPatternBackground) &&
    Boolean(selectedSolidBackground);
  const effectiveBackground = useMemo(() => {
    if (!shouldApplyPatternSolidMix || !selectedPatternBackground || !selectedSolidBackground) {
      return activeBackground;
    }

    const solidColor = selectedSolidBackground.render.stops[0]?.color ?? "#ffffff";

    return {
      ...selectedPatternBackground,
      id: `${selectedPatternBackground.id}__mix__${selectedSolidBackground.id}`,
      name: `${selectedPatternBackground.name} + ${selectedSolidBackground.name}`,
      preview: buildTilePreview(selectedPatternBackground.render.tileSvg ?? "", solidColor),
      render: {
        ...selectedPatternBackground.render,
        stops: [{ offset: 0, color: solidColor }],
      },
    } satisfies BackgroundPreset;
  }, [
    activeBackground,
    selectedPatternBackground,
    selectedSolidBackground,
    shouldApplyPatternSolidMix,
  ]);
  const activeFont = useMemo(
    () => availableFonts.find((preset) => preset.id === fontId) ?? availableFonts[0],
    [availableFonts, fontId]
  );
  const galleryBackgroundsByCategory = useMemo(() => {
    const source = isAdmin ? BACKGROUNDS : availableBackgrounds;
    const grouped: Record<BackgroundCategory, BackgroundPreset[]> = {
      gradients: [],
      solids: [],
      patterns: [],
      textures: [],
    };

    for (const preset of source) {
      grouped[getBackgroundCategory(preset)].push(preset);
    }

    return grouped;
  }, [availableBackgrounds, isAdmin]);
  const orderedFonts = useMemo(() => {
    const source = isAdmin ? FONTS : availableFonts;
    const sourceMap = new Map(source.map((preset) => [preset.id, preset]));
    const orderedIds = [
      ...recentFontIds,
      ...DEFAULT_FONT_PICK_IDS,
      ...DEFAULT_RECENT_FONT_IDS,
      ...source.map((preset) => preset.id),
    ];
    const uniqueIds = Array.from(new Set(orderedIds));
    return uniqueIds
      .map((id) => sourceMap.get(id))
      .filter((preset): preset is FontPreset => Boolean(preset));
  }, [availableFonts, isAdmin, recentFontIds]);
  const textColor = useMemo(() => pickReadableColor(effectiveBackground), [effectiveBackground]);
  const previewBackgroundStyle = useMemo(
    () => ({ background: effectiveBackground.preview }),
    [effectiveBackground]
  );
  const displayText = useMemo(
    () => (activeFont.transform === "uppercase" ? text.toUpperCase() : text),
    [activeFont.transform, text]
  );
  const fontPreviewText = useMemo(() => {
    const flattened = text.replace(/\s+/g, " ").trim();
    if (!flattened) {
      return t(locale, "textCard.fontPreviewFallback");
    }
    return flattened.slice(0, 72);
  }, [locale, text]);

  useEffect(() => {
    const existing = document.querySelector(`link[href=\"${GOOGLE_FONTS_STYLESHEET}\"]`);
    if (existing) {
      return;
    }

    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = GOOGLE_FONTS_STYLESHEET;
    document.head.appendChild(link);
  }, []);

  useLayoutEffect(() => {
    const mediaQuery = window.matchMedia("(min-width: 1024px)");

    const updateLayout = () => {
      setIsDesktopPreviewLayout(mediaQuery.matches);
    };

    updateLayout();
    mediaQuery.addEventListener("change", updateLayout);
    return () => {
      mediaQuery.removeEventListener("change", updateLayout);
    };
  }, []);

  useEffect(() => {
    if (isDesktopPreviewLayout) {
      return;
    }

    const updateMobilePreviewPosition = () => {
      const anchor = mobilePreviewAnchorRef.current;
      const card = mobilePreviewCardRef.current;
      if (card) {
        setMobilePreviewSpacerHeight(card.offsetHeight);
      }
      if (!anchor) {
        return;
      }

      const anchorTop = anchor.getBoundingClientRect().top + window.scrollY;
      setIsMobilePreviewPinned(window.scrollY >= anchorTop);
    };

    updateMobilePreviewPosition();

    const resizeObserver = new ResizeObserver(() => {
      updateMobilePreviewPosition();
    });
    if (mobilePreviewCardRef.current) {
      resizeObserver.observe(mobilePreviewCardRef.current);
    }

    window.addEventListener("scroll", updateMobilePreviewPosition, { passive: true });
    window.addEventListener("resize", updateMobilePreviewPosition);

    return () => {
      resizeObserver.disconnect();
      window.removeEventListener("scroll", updateMobilePreviewPosition);
      window.removeEventListener("resize", updateMobilePreviewPosition);
    };
  }, [isDesktopPreviewLayout]);

  const handleInsertEmoji = useCallback((emoji: string) => {
    const input = textInputRef.current;
    const start = input?.selectionStart ?? null;
    const end = input?.selectionEnd ?? null;
    setText((previous) => {
      const from = start ?? previous.length;
      const to = end ?? previous.length;
      return `${previous.slice(0, from)}${emoji}${previous.slice(to)}`;
    });
    if (input && start !== null) {
      const caret = start + emoji.length;
      requestAnimationFrame(() => {
        input.focus();
        input.setSelectionRange(caret, caret);
      });
    }
  }, []);

  const handleSelectFont = useCallback((nextFontId: string) => {
    setFontId(nextFontId);
  }, []);

  const handleSelectBackgroundPreset = useCallback((preset: BackgroundPreset) => {
      setBackgroundId(preset.id);

      const category = getBackgroundCategory(preset);
      if (category === "patterns") {
        setSelectedPatternId(preset.id);
      }
      if (category === "solids") {
        setSelectedSolidId(preset.id);
      }
    }, []);

  const scrollToGalleryCategory = useCallback((category: BackgroundCategory) => {
    const targetRef =
      category === "gradients"
        ? gradientSectionRef
        : category === "solids"
          ? solidSectionRef
          : category === "textures"
            ? textureSectionRef
            : patternSectionRef;
    const scrollContainer = backgroundGalleryScrollRef.current;
    const stickyHeader = backgroundGalleryHeaderRef.current;
    const target = targetRef.current;

    if (!scrollContainer || !target) {
      target?.scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }

    const containerRect = scrollContainer.getBoundingClientRect();
    const targetRect = target.getBoundingClientRect();
    const stickyHeight = stickyHeader?.getBoundingClientRect().height ?? 0;
    const nextTop =
      scrollContainer.scrollTop + (targetRect.top - containerRect.top) - stickyHeight - 12;

    scrollContainer.scrollTo({ top: Math.max(0, nextTop), behavior: "smooth" });
  }, []);

  const renderCardBlob = useCallback(async (maxBytes?: number) => {
    const canvas = document.createElement("canvas");
    canvas.width = EXPORT_SIZE;
    canvas.height = EXPORT_SIZE;

    const ctx = canvas.getContext("2d");
    if (!ctx) {
      throw new Error("Canvas is not supported.");
    }

    await drawBackground(ctx, effectiveBackground, EXPORT_SIZE);
    await preloadEmojis(displayText);

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

    if (!maxBytes || blob.size <= maxBytes) {
      return blob;
    }

    // Photographic textures make PNGs several MB; re-encode lossy until it fits.
    let smallest = blob;
    for (const quality of UPLOAD_WEBP_QUALITY_STEPS) {
      const lossy = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob(resolve, "image/webp", quality);
      });
      if (!lossy || lossy.type !== "image/webp") {
        continue;
      }
      if (lossy.size < smallest.size) {
        smallest = lossy;
      }
      if (lossy.size <= maxBytes) {
        return lossy;
      }
    }

    return smallest;
  }, [activeFont, displayText, effectiveBackground, textColor]);

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
      setError(t(locale, "textCard.error.exportPng"));
    } finally {
      setIsExporting(false);
    }
  }, [isExporting, locale, renderCardBlob]);

  const handlePostToFairbook = useCallback(async () => {
    if (isPosting) return;
    setError("");
    setIsPosting(true);

    const referenceId = `tc-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    const baseDetails = {
      fontId: activeFont.id,
      backgroundId: activeBackground.id,
      effectiveBackgroundId: effectiveBackground.id,
      textLength: text.trim().length,
      includeCaptionInPost,
      isPatternSolidMixEnabled,
      userAgent: typeof navigator !== "undefined" ? navigator.userAgent : "unknown",
      viewport:
        typeof window !== "undefined"
          ? `${window.innerWidth}x${window.innerHeight}`
          : "unknown",
    };

    try {
      let step = "render-card-blob";
      const blob = await renderCardBlob(UPLOAD_TARGET_BYTES);
      const fileMeta = buildTextCardFileMeta(
        blob,
        referenceId,
        blob.type === "image/webp" ? "webp" : "png"
      );

      await reportTextCardClientError({
        referenceId,
        event: "attempt",
        step,
        message: "Text card export ready; starting upload.",
        file: fileMeta,
        details: {
          ...baseDetails,
          exportSize: EXPORT_SIZE,
          blobBytes: blob.size,
          blobType: blob.type || "application/octet-stream",
        },
      });

      step = "build-form-data";
      const uploadPayload = new FormData();
      // Append Blob directly with filename to avoid mobile WebView/File constructor issues.
      uploadPayload.append("files", blob, fileMeta.name);

      step = "upload-image";
      const uploadRes = await fetch("/api/uploads/images", {
        method: "POST",
        body: uploadPayload,
      });

      step = "parse-upload-response";
      const { data: uploadData, contentType, rawText } = await parseUploadResponse(uploadRes);

      await reportTextCardClientError({
        referenceId,
        event: uploadRes.ok ? "upload-response-success" : "upload-response-failure",
        step,
        message: uploadRes.ok
          ? "Upload response received successfully."
          : "Image upload failed before composer dialog.",
        httpStatus: uploadRes.status,
        responseContentType: contentType,
        responseSnippet: rawText?.slice(0, 600),
        file: fileMeta,
        details: {
          ...baseDetails,
          exportSize: EXPORT_SIZE,
          blobBytes: blob.size,
          blobType: blob.type || "application/octet-stream",
          uploadUrlCount: Array.isArray(uploadData.urls) ? uploadData.urls.length : 0,
        },
      });

      if (!uploadRes.ok) {
        setError(
          uploadRes.status === 413
            ? t(locale, "textCard.error.tooLarge")
            : (uploadData.error ?? t(locale, "textCard.error.uploadImage"))
        );
        return;
      }

      const imageUrls = Array.isArray(uploadData.urls) ? uploadData.urls : [];
      if (imageUrls.length === 0) {
        await reportTextCardClientError({
          referenceId,
          event: "upload-empty-result",
          step,
          message: "Upload succeeded but returned empty urls array.",
          httpStatus: uploadRes.status,
          responseContentType: contentType,
          responseSnippet: rawText?.slice(0, 600),
          file: fileMeta,
          details: {
            ...baseDetails,
            exportSize: EXPORT_SIZE,
            blobBytes: blob.size,
            blobType: blob.type || "application/octet-stream",
            uploadDataKeys: Object.keys(uploadData),
          },
        });
        setError(t(locale, "textCard.error.noUploadUrl"));
        return;
      }

      setRecentFontIds((previous) => {
        const next = [activeFont.id, ...previous.filter((id) => id !== activeFont.id)];
        return next.slice(0, RECENT_FONT_LIMIT);
      });
      setRecentBackgroundIds((previous) => {
        const nextBackgroundId = shouldApplyPatternSolidMix
          ? selectedPatternBackground?.id ?? backgroundId
          : activeBackground.id;
        const next = [
          nextBackgroundId,
          ...previous.filter((id) => id !== nextBackgroundId),
        ];
        return next.slice(0, RECENT_BACKGROUND_LIMIT);
      });

      setPendingComposerContent(includeCaptionInPost ? text.trim() : "");
      setPendingComposerImageUrl(imageUrls[0] ?? null);
      setIsComposerOpen(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown error";
      const stack = error instanceof Error ? error.stack : undefined;

      await reportTextCardClientError({
        referenceId,
        event: "exception",
        step: "exception",
        message,
        stack,
        file: undefined,
        details: baseDetails,
      });

      setError(`${t(locale, "textCard.error.posting")} (ref: ${referenceId})`);
    } finally {
      setIsPosting(false);
    }
  }, [
    activeBackground.id,
    effectiveBackground.id,
    backgroundId,
    activeFont.id,
    includeCaptionInPost,
    isPatternSolidMixEnabled,
    isPosting,
    locale,
    renderCardBlob,
    selectedPatternBackground,
    shouldApplyPatternSolidMix,
    text,
  ]);

  const handleTestTextModeration = useCallback(async () => {
    if (!text.trim()) {
      setTextModerationNotice({
        kind: "warning",
        message: t(locale, "textCard.notice.addTextForTest"),
      });
      return;
    }

    setIsTextTesting(true);
    setError("");
    setTextModerationNotice(null);

    try {
      const response = await fetch("/api/posts/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          content: text.trim(),
          sharedUrl: null,
          sharedTitle: null,
          sharedDescription: null,
          sharedSource: null,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? t(locale, "textCard.error.test"));
        return;
      }

      setTextModerationNotice({
        kind: data.moderation?.status === "author_only" ? "warning" : "success",
        message: data.moderation?.explanation ?? t(locale, "textCard.notice.testCompleted"),
      });
    } catch {
      setError(t(locale, "textCard.error.testRetry"));
    } finally {
      setIsTextTesting(false);
    }
  }, [locale, text]);

  const updatePresetVisibility = useCallback(async (nextHiddenFontIds: string[]) => {
      if (!isAdmin) return;

      setIsSavingPresetVisibility(true);
      try {
        const response = await fetch("/api/admin/text-card-presets", {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            hiddenFontIds: nextHiddenFontIds,
          }),
        });

        const data = await response.json();
        if (!response.ok) {
          setError(data.error ?? t(locale, "textCard.error.savePresetVisibility"));
          return;
        }

        setHiddenFontIds(Array.isArray(data.hiddenFontIds) ? data.hiddenFontIds : []);
      } catch {
        setError(t(locale, "textCard.error.savePresetVisibility"));
      } finally {
        setIsSavingPresetVisibility(false);
      }
    },
    [isAdmin, locale]
  );

  const toggleFontHidden = useCallback(
    (fontPresetId: string) => {
      if (!isAdmin || isSavingPresetVisibility) return;

      const nextHiddenFontIds = hiddenFontIds.includes(fontPresetId)
        ? hiddenFontIds.filter((id) => id !== fontPresetId)
        : [...hiddenFontIds, fontPresetId];
      void updatePresetVisibility(nextHiddenFontIds);
    },
    [hiddenFontIds, isAdmin, isSavingPresetVisibility, updatePresetVisibility]
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
  }, [activeFont, displayText, isDesktopPreviewLayout]);

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
          <div className="space-y-2">
            <div className="flex items-center justify-between gap-2">
              <label
                htmlFor="text-card-input"
                className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500"
              >
                {t(locale, "textCard.inputLabel")}
              </label>
              <div className="flex items-center gap-2">
                <EmojiPickerButton onSelect={handleInsertEmoji} label={t(locale, "textCard.insertEmoji")} />
                <button
                  type="button"
                  onClick={() => void handleTestTextModeration()}
                  disabled={isTextTesting || isPosting || isExporting}
                  className="rounded-lg border border-slate-300 bg-white px-3 py-1 text-xs font-medium text-slate-700 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {isTextTesting ? t(locale, "textCard.testing") : t(locale, "textCard.testModeration")}
                </button>
              </div>
            </div>
            <textarea
              id="text-card-input"
              ref={textInputRef}
              value={text}
              onChange={(event) => setText(event.target.value)}
              placeholder={t(locale, "textCard.placeholder")}
              rows={8}
              className="w-full resize-y rounded-2xl border border-slate-300 bg-slate-50 px-3 py-3 text-sm leading-6 text-slate-900 outline-none transition-colors focus:border-amber-500"
            />
            <p className="text-xs text-slate-500">{t(locale, "textCard.lineBreakHint")}</p>
            {textModerationNotice && (
              <p
                className={`text-xs ${
                  textModerationNotice.kind === "warning" ? "text-amber-700" : "text-emerald-700"
                }`}
              >
                {textModerationNotice.message}
              </p>
            )}
          </div>

          {!isDesktopPreviewLayout && (
            <div ref={mobilePreviewAnchorRef} className="lg:hidden">
              <div
                ref={mobilePreviewCardRef}
                className={`border-y border-slate-200 bg-white/90 px-4 py-2.5 shadow-sm backdrop-blur-sm ${
                  isMobilePreviewPinned
                    ? "fixed inset-x-4 top-0 z-30"
                    : "relative z-10"
                }`}
              >
                <div className="flex items-center justify-between gap-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
                    {t(locale, "textCard.livePreview")}
                  </p>
                </div>
                <div
                  className="relative mt-2.5 h-[22vh] max-h-[190px] overflow-hidden rounded-[1.4rem] border border-slate-300 shadow-[0_18px_40px_rgba(15,23,42,0.18)]"
                  style={previewBackgroundStyle}
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
                          <PreviewLine line={line} />
                        </p>
                      ))}
                    </div>
                  </div>
                  <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.2),_transparent_48%)]" />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-white/80 to-transparent" />
                </div>
              </div>
              {isMobilePreviewPinned && (
                <div aria-hidden="true" style={{ height: mobilePreviewSpacerHeight }} />
              )}
            </div>
          )}

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t(locale, "textCard.backgrounds")}
            </p>
            <div
              ref={backgroundGalleryScrollRef}
              className="max-h-80 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2 scroll-pt-32"
            >
              <div
                ref={backgroundGalleryHeaderRef}
                className="sticky top-0 z-10 mb-3 -mx-2 px-2 pb-2 pt-0.5 backdrop-blur-[1px]"
              >
                <div className="flex flex-wrap gap-2 rounded-xl border border-slate-200 bg-slate-50/95 p-2">
                  {(["gradients", "patterns", "textures", "solids"] as BackgroundCategory[]).map((category) => (
                    <button
                      key={category}
                      type="button"
                      onClick={() => scrollToGalleryCategory(category)}
                      className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition-colors hover:bg-slate-100"
                    >
                      {category === "gradients"
                        ? t(locale, "textCard.galleryTab.grad")
                        : category === "patterns"
                          ? t(locale, "textCard.galleryTab.pattern")
                          : category === "textures"
                            ? t(locale, "textCard.galleryTab.texture")
                            : t(locale, "textCard.galleryTab.solid")}
                    </button>
                  ))}
                </div>
              </div>

              <div className="space-y-4">
                {([
                  {
                    category: "gradients" as BackgroundCategory,
                    title: BACKGROUND_CATEGORY_LABELS.gradients,
                    items: galleryBackgroundsByCategory.gradients,
                    ref: gradientSectionRef,
                  },
                  {
                    category: "patterns" as BackgroundCategory,
                    title: BACKGROUND_CATEGORY_LABELS.patterns,
                    items: galleryBackgroundsByCategory.patterns,
                    ref: patternSectionRef,
                  },
                  {
                    category: "textures" as BackgroundCategory,
                    title: BACKGROUND_CATEGORY_LABELS.textures,
                    items: galleryBackgroundsByCategory.textures,
                    ref: textureSectionRef,
                  },
                  {
                    category: "solids" as BackgroundCategory,
                    title: BACKGROUND_CATEGORY_LABELS.solids,
                    items: galleryBackgroundsByCategory.solids,
                    ref: solidSectionRef,
                  },
                ]).map(({ category, title, items, ref }) => {
                  if (items.length === 0) {
                    return null;
                  }

                  return (
                    <section key={category} ref={ref} className="scroll-mt-32">
                      <div className="mb-2 flex items-center justify-between gap-3">
                        <h3 className="text-xs font-semibold uppercase tracking-[0.14em] text-slate-600">
                          {title}
                        </h3>
                        {category === "solids" && (
                          <label className="inline-flex items-center gap-2 text-xs font-medium text-slate-600">
                            <input
                              type="checkbox"
                              checked={isPatternSolidMixEnabled}
                              onChange={(event) => setIsPatternSolidMixEnabled(event.target.checked)}
                              className="h-4 w-4 rounded border-slate-300 text-slate-900"
                              disabled={
                                availablePatternBackgrounds.length === 0 ||
                                availableSolidBackgrounds.length === 0
                              }
                            />
                            {t(locale, "textCard.mixWithPattern")}
                          </label>
                        )}
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {items.map((preset) => {
                          const active =
                            preset.id === activeBackground.id ||
                            (shouldApplyPatternSolidMix &&
                              category === "patterns" &&
                              preset.id === selectedPatternBackground?.id) ||
                            (shouldApplyPatternSolidMix &&
                              category === "solids" &&
                              preset.id === selectedSolidBackground?.id);
                          return (
                            <div key={preset.id} className="relative">
                              <button
                                type="button"
                                onClick={() => handleSelectBackgroundPreset(preset)}
                                title={preset.name}
                                aria-label={preset.name}
                                className={`group relative w-full overflow-hidden rounded-lg border transition-transform hover:scale-[1.03] ${
                                  active
                                    ? "border-slate-900 ring-1 ring-slate-900"
                                    : "border-slate-200"
                                }`}
                              >
                                <span
                                  className="block aspect-square w-full"
                                  style={{ background: preset.preview }}
                                  aria-hidden="true"
                                />
                                {active && (
                                  <span className="pointer-events-none absolute right-1 top-1 rounded bg-black/65 px-1 text-[10px] font-semibold text-white">
                                    {t(locale, "textCard.active")}
                                  </span>
                                )}
                                <span className="absolute inset-x-0 bottom-0 bg-black/25 px-1 py-0.5 text-center text-[10px] font-semibold uppercase tracking-wide text-white">
                                  {preset.name}
                                </span>
                              </button>
                            </div>
                          );
                        })}
                      </div>
                    </section>
                  );
                })}
              </div>

              <p className="mt-4 text-center text-[11px] text-slate-400">{t(locale, "textCard.attribution")}</p>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
              {t(locale, "textCard.fontStyle")}
            </p>
            <div className="max-h-72 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                {orderedFonts.map((preset) => {
                  const active = preset.id === activeFont.id;
                  const isHidden = hiddenFontIds.includes(preset.id);
                  return (
                    <div
                      key={preset.id}
                      className={`relative overflow-hidden rounded-xl border bg-white ${
                        active ? "border-slate-900 shadow-sm" : "border-slate-200"
                      } ${isHidden && isAdmin ? "opacity-70" : ""}`}
                    >
                      <button
                        type="button"
                        onClick={() => handleSelectFont(preset.id)}
                        className="w-full px-3 py-2 text-left"
                      >
                        <p className="text-[10px] font-medium uppercase tracking-[0.14em] text-slate-500">
                          {preset.name}
                        </p>
                        <p
                          className={`mt-1 line-clamp-2 text-lg leading-tight ${
                            active ? "text-slate-950" : "text-slate-800"
                          }`}
                          style={{ fontFamily: preset.family }}
                        >
                          {fontPreviewText}
                        </p>
                      </button>
                      {isAdmin && (
                        <button
                          type="button"
                          onClick={() => toggleFontHidden(preset.id)}
                          disabled={isSavingPresetVisibility}
                          className="absolute right-2 top-2 rounded border border-slate-200 bg-white px-2 py-1 text-[10px] font-semibold text-slate-700 transition-colors hover:bg-slate-50 disabled:opacity-60"
                        >
                          {isHidden ? t(locale, "textCard.font.restore") : t(locale, "textCard.font.hide")}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
            {isAdmin && (
              <p className="text-[11px] text-slate-500">
                {t(locale, "textCard.font.hiddenHint")}
                {isSavingPresetVisibility ? ` ${t(locale, "textCard.saving")}` : ""}
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
            {t(locale, "textCard.includeCaption")}
          </label>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-600">
            <p>{t(locale, "textCard.autoContrast")}</p>
            <p>{tf(locale, "textCard.currentFontSize", { size: fontSize })}</p>
            <p>{t(locale, "textCard.downloadShortcut")}</p>
          </div>

          {error && <p className="text-xs text-red-600">{error}</p>}

          <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-1">
            <button
              type="button"
              onClick={() => void handleDownloadPng()}
              disabled={isExporting || isPosting}
              className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition-colors hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
            >
              {isExporting ? t(locale, "textCard.exporting") : t(locale, "textCard.downloadPng")}
            </button>
            <button
              type="button"
              onClick={() => void handlePostToFairbook()}
              disabled={isPosting || isExporting}
              className="inline-flex w-full items-center justify-center rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-800 transition-colors hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isPosting ? t(locale, "textCard.preparingPost") : t(locale, "textCard.postToFairbook")}
            </button>
          </div>
        </aside>

        {isDesktopPreviewLayout && (
        <div className="hidden space-y-3 self-start lg:block lg:sticky lg:top-6">
          <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">
            {t(locale, "textCard.livePreview")}
          </p>
          <div
            className="relative aspect-square w-full overflow-hidden rounded-[1.6rem] border border-slate-300 shadow-[0_24px_64px_rgba(15,23,42,0.22)]"
            style={previewBackgroundStyle}
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
                    <PreviewLine line={line} />
                  </p>
                ))}
              </div>
            </div>
            <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_left,_rgba(255,255,255,0.22),_transparent_35%),radial-gradient(circle_at_bottom_right,_rgba(15,23,42,0.2),_transparent_48%)]" />
          </div>
        </div>
        )}
      </div>

      {isComposerOpen && (
        <PostComposerDialog
          onClose={() => setIsComposerOpen(false)}
          initialContent={pendingComposerContent}
          initialImageUrls={pendingComposerImageUrl ? [pendingComposerImageUrl] : []}
          textCardImageUrl={pendingComposerImageUrl}
          communityId={communityId}
          onSuccess={(result: PostComposerSuccessResult) => {
            const params = new URLSearchParams({
              notice: result.message ?? t(locale, "textCard.posted"),
              noticeKind: result.moderation?.status === "author_only" ? "warning" : "success",
            });
            setIsComposerOpen(false);
            const redirectBase = returnToPath && returnToPath.startsWith("/") ? returnToPath : "/feed";
            router.push(`${redirectBase}?${params.toString()}`);
            router.refresh();
          }}
        />
      )}
    </section>
  );
}
