import assert from "node:assert/strict";
import { test } from "node:test";
import { extractYouTubeVideoDimensions } from "./youtube-video-dimensions.ts";

test("extracts the largest video format, ignoring thumbnail and audio formats", () => {
  const player = {
    videoDetails: { title: 'Text with } and "quoted" content' },
    streamingData: {
      formats: [{ width: 360, height: 640 }],
      adaptiveFormats: [
        { width: 48, height: 27 },
        { audioQuality: "AUDIO_QUALITY_MEDIUM" },
        { width: 720, height: 1280 },
      ],
    },
  };
  const html = `<script>var ytInitialPlayerResponse = ${JSON.stringify(player)}; otherCode();</script>`;
  assert.deepEqual(extractYouTubeVideoDimensions(html), { width: 720, height: 1280 });
});

test("extracts landscape formats", () => {
  const html = '<script>ytInitialPlayerResponse = {"streamingData":{"formats":[{"width":1920,"height":1080}]}};</script>';
  assert.deepEqual(extractYouTubeVideoDimensions(html), { width: 1920, height: 1080 });
});

test("does not invent dimensions for missing or invalid metadata", () => {
  assert.equal(extractYouTubeVideoDimensions("<html></html>"), null);
  assert.equal(extractYouTubeVideoDimensions("ytInitialPlayerResponse = {invalid}"), null);
  assert.equal(extractYouTubeVideoDimensions('ytInitialPlayerResponse = {"streamingData":{"formats":[{"width":0,"height":10}]}}'), null);
});
