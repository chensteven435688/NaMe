import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "crypto";
import db from "../db.js";
import { app } from "../index.js";

const SLUG = "zzsitemap-stone & light";

let baseUrl;
let server;

test.before(async () => {
  wipe();
  server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  wipe();
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

function wipe() {
  db.prepare("DELETE FROM posts WHERE slug = ?").run(SLUG);
}

test("sitemap.xml includes static pages and published posts", async () => {
  const stamp = "2024-05-06T12:00:00.000Z";
  db.prepare(
    `INSERT INTO posts (
      id, slug, type, title, meta, image_url, body, video_url, section, featured, author_id, published_at, created_at
    ) VALUES (?, ?, 'article', 'Stone and light', NULL, NULL, NULL, NULL, 'latest', 0, NULL, ?, ?)`
  ).run(randomUUID(), SLUG, stamp, stamp);

  const res = await fetch(`${baseUrl}/sitemap.xml`);
  const xml = await res.text();
  assert.equal(res.status, 200);
  assert.match(res.headers.get("content-type") || "", /xml/);
  assert.match(xml, /<loc>https:\/\/name-magazine\.vercel\.app\/artists<\/loc>/);
  assert.match(xml, /<loc>https:\/\/name-magazine\.vercel\.app\/post\?slug=zzsitemap-stone%20%26%20light<\/loc>/);
  assert.match(xml, /<lastmod>2024-05-06<\/lastmod>/);
  const unescaped = xml.replace(/&(?:amp|lt|gt|quot|apos);/g, "");
  assert.equal(unescaped.includes("&"), false);

  const robots = await fetch(`${baseUrl}/robots.txt`);
  assert.equal(robots.status, 200);
  assert.match(await robots.text(), /Sitemap: https:\/\/name-magazine\.vercel\.app\/sitemap\.xml/);
});
