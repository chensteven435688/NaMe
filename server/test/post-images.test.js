import test from "node:test";
import assert from "node:assert/strict";
import {
  parseBodyFiles,
  buildBodyFigures,
  buildPublishedPostBody,
  collectGalleryUrls,
} from "../lib/post-images.js";

test("parseBodyFiles handles array, JSON string, and empty values", () => {
  assert.deepEqual(parseBodyFiles(null), []);
  assert.deepEqual(parseBodyFiles("[]"), []);
  assert.deepEqual(
    parseBodyFiles('[{"url":"https://x/a.jpg","mime":"image/jpeg"}]'),
    [{ url: "https://x/a.jpg", mime: "image/jpeg" }]
  );
  assert.deepEqual(
    parseBodyFiles([{ url: "https://x/b.jpg", mime: "image/png" }]),
    [{ url: "https://x/b.jpg", mime: "image/png" }]
  );
});

test("buildBodyFigures creates post figure HTML", () => {
  const html = buildBodyFigures([
    { url: "https://cdn.example/body1.jpg", name: "Look 1", mime: "image/jpeg" },
    { url: "https://cdn.example/body2.jpg", name: "Look 2", mime: "image/jpeg" },
  ]);
  assert.match(html, /post__figure/);
  assert.match(html, /body1\.jpg/);
  assert.match(html, /body2\.jpg/);
});

test("buildPublishedPostBody merges description and gallery figures", () => {
  const body = buildPublishedPostBody({
    title: "Spring editorial",
    description: "A portrait series.",
    file_mime: "image/jpeg",
    file_url: "https://cdn.example/cover.jpg",
    body_files: [{ url: "https://cdn.example/gallery.jpg", mime: "image/jpeg" }],
  });
  assert.match(body, /portrait series/);
  assert.match(body, /gallery\.jpg/);
});

test("collectGalleryUrls deduplicates cover and body images", () => {
  const urls = collectGalleryUrls(
    "https://cdn.example/cover.jpg",
    [{ url: "https://cdn.example/gallery.jpg", mime: "image/jpeg" }],
    '<figure class="post__figure"><img src="https://cdn.example/cover.jpg" /></figure>'
  );
  assert.deepEqual(urls, [
    "https://cdn.example/cover.jpg",
    "https://cdn.example/gallery.jpg",
  ]);
});
