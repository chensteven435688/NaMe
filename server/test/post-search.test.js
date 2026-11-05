import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { randomUUID } from "crypto";
import db from "../db.js";
import { app } from "../index.js";

const PREFIX = "zzsearch-";

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
  db.prepare("DELETE FROM posts WHERE slug LIKE ?").run(`${PREFIX}%`);
}

function insertPost({ slug, type, title, meta = null, body = null, publishedAt }) {
  const stamp = publishedAt || new Date().toISOString();
  db.prepare(
    `INSERT INTO posts (
      id, slug, type, title, meta, image_url, body, video_url, section, featured, author_id, published_at, created_at
    ) VALUES (?, ?, ?, ?, ?, NULL, ?, NULL, 'latest', 0, NULL, ?, ?)`
  ).run(randomUUID(), slug, type, title, meta, body, stamp, stamp);
}

async function getPosts(query) {
  const res = await fetch(`${baseUrl}/api/posts?${query}`);
  const text = await res.text();
  assert.equal(res.status, 200, text);
  return JSON.parse(text);
}

test("listing posts without a query stays a full unpaged list", async () => {
  const data = await getPosts("type=article");
  assert.ok(Array.isArray(data.posts));
  assert.equal(Object.hasOwn(data, "total"), false);
  assert.ok(data.posts.every((post) => post.type === "article"));
});

test("search matches title, meta, type, and body with 12-item pages", async () => {
  wipe();
  for (let i = 0; i < 13; i += 1) {
    insertPost({
      slug: `${PREFIX}page-${i}`,
      type: "article",
      title: `Zzsearch page ${i}`,
      meta: "Studio",
      body: "<p>catalog page</p>",
      publishedAt: new Date(Date.UTC(2031, 0, 1, 0, 0, i)).toISOString(),
    });
  }
  insertPost({
    slug: `${PREFIX}meta`,
    type: "editorial",
    title: "Plain folder piece",
    meta: "Zzsearch-meta-folder",
    body: "<p>no title token</p>",
    publishedAt: "2031-02-01T00:00:00.000Z",
  });
  insertPost({
    slug: `${PREFIX}body`,
    type: "film",
    title: "Plain body piece",
    meta: "Studio",
    body: "<p>Stored excerpt zzsearch-body-token in the article.</p>",
    publishedAt: "2031-02-02T00:00:00.000Z",
  });
  insertPost({
    slug: `${PREFIX}type`,
    type: "short",
    title: "Plain type piece",
    meta: "Wood",
    body: "<p>A table.</p>",
    publishedAt: "2031-02-03T00:00:00.000Z",
  });
  insertPost({
    slug: `${PREFIX}exclusive`,
    type: "exclusive",
    title: "Zzsearch exclusive only",
    meta: "Vault",
    body: "<p>hidden from the story index</p>",
    publishedAt: "2031-02-04T00:00:00.000Z",
  });

  const first = await getPosts("q=zzsearch%20page");
  assert.equal(first.total, 13);
  assert.equal(first.limit, 12);
  assert.equal(first.offset, 0);
  assert.equal(first.posts.length, 12);
  assert.equal(first.posts[0].slug, `${PREFIX}page-12`);
  assert.equal(first.posts.some((post) => post.slug === `${PREFIX}page-0`), false);

  const second = await getPosts("q=zzsearch%20page&offset=12");
  assert.equal(second.posts.length, 1);
  assert.equal(second.posts[0].slug, `${PREFIX}page-0`);
  assert.equal(second.total, 13);

  const meta = await getPosts("q=zzsearch-meta-folder");
  assert.deepEqual(meta.posts.map((post) => post.slug), [`${PREFIX}meta`]);

  const body = await getPosts("q=zzsearch-body-token");
  assert.deepEqual(body.posts.map((post) => post.slug), [`${PREFIX}body`]);
  assert.match(body.posts[0].body, /zzsearch-body-token/);

  const typed = await getPosts("q=plain%20type%20piece");
  assert.equal(typed.posts.length, 1);
  const byTypeWord = await getPosts("q=short&limit=50");
  assert.ok(byTypeWord.posts.some((post) => post.slug === `${PREFIX}type`));
  assert.equal(byTypeWord.posts.some((post) => post.slug === `${PREFIX}page-0`), false);
  const byType = await getPosts(`q=${encodeURIComponent("Plain type piece")}&types=article,editorial,film,short`);
  assert.equal(byType.posts.length, 1);
  assert.equal(byType.posts[0].type, "short");

  const stories = await getPosts("q=zzsearch%20exclusive&types=article,editorial,film,short");
  assert.equal(stories.total, 0);
  const anyType = await getPosts("q=zzsearch%20exclusive");
  assert.equal(anyType.posts[0].slug, `${PREFIX}exclusive`);

  const cased = await getPosts("q=ZZSEARCH%20PAGE%2012");
  assert.equal(cased.posts[0].slug, `${PREFIX}page-12`);
});

test("search treats % and _ as literals and ignores injection", async () => {
  wipe();
  insertPost({
    slug: `${PREFIX}percent`,
    type: "article",
    title: "Zzsearch 100% cotton",
    body: "<p>cloth</p>",
  });
  insertPost({
    slug: `${PREFIX}plain`,
    type: "article",
    title: "Zzsearch plain cotton",
    body: "<p>cloth</p>",
  });
  insertPost({
    slug: `${PREFIX}score`,
    type: "article",
    title: "Zzsearch a_b token",
    body: "<p>cloth</p>",
  });
  insertPost({
    slug: `${PREFIX}noscore`,
    type: "article",
    title: "Zzsearch ab token",
    body: "<p>cloth</p>",
  });

  const percent = await getPosts(`q=${encodeURIComponent("100%")}`);
  assert.deepEqual(percent.posts.map((post) => post.slug), [`${PREFIX}percent`]);

  const wildcard = await getPosts(`q=${encodeURIComponent("%")}`);
  assert.ok(wildcard.posts.some((post) => post.slug === `${PREFIX}percent`));
  assert.equal(wildcard.posts.some((post) => post.slug === `${PREFIX}plain`), false);

  const underscore = await getPosts(`q=${encodeURIComponent("a_b")}`);
  assert.deepEqual(underscore.posts.map((post) => post.slug), [`${PREFIX}score`]);

  const injected = await getPosts(`q=${encodeURIComponent("' OR 1=1 --")}`);
  assert.equal(injected.total, 0);
  const stillThere = await getPosts(`q=${encodeURIComponent("Zzsearch plain cotton")}`);
  assert.equal(stillThere.total, 1);
});

test("paging clamps the page size and empty type lists match nothing", async () => {
  const huge = await getPosts("q=zzsearch-does-not-exist&limit=500&offset=-4");
  assert.equal(huge.limit, 50);
  assert.equal(huge.offset, 0);
  assert.equal(huge.total, 0);
  assert.deepEqual(huge.posts, []);

  const bogus = await getPosts("q=zzsearch&types=not-a-type");
  assert.equal(bogus.total, 0);
  assert.deepEqual(bogus.posts, []);
});
