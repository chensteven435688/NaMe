const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { spawnSync } = require("node:child_process");
const { JSDOM } = require("jsdom");
const { buildRobots, buildSitemap, postUrl, STATIC_PATHS } = require("../scripts/sitemap");

const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, name), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
const PUBLIC_PAGES = [
  "index.html",
  "stories.html",
  "magazine.html",
  "editorial.html",
  "articles.html",
  "film.html",
  "artists.html",
  "exclusive.html",
  "about.html",
  "business.html",
  "contact.html",
  "community.html",
  "submission.html",
  "subscribe.html",
  "terms.html",
  "privacy.html",
  "post.html",
];

function meta(document, attr, key) {
  return document.querySelector(`meta[${attr}="${key}"]`)?.getAttribute("content") || "";
}

function locs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function page(name, url = name) {
  const dom = new JSDOM(source(name), {
    url: `http://localhost:8080/${url}`,
    runScripts: "outside-only",
  });
  dom.window.eval(`${source("i18n.js")}\nwindow.NaMeI18n = NaMeI18n;`);
  return dom;
}

const evaluate = (w, file) => w.eval(source(file));

test("public pages ship brand share tags and canonical URLs", () => {
  const sitemapLocs = new Set(locs(buildSitemap()));
  for (const file of PUBLIC_PAGES) {
    const html = source(file);
    const dom = new JSDOM(html);
    const document = dom.window.document;
    assert.ok(meta(document, "property", "og:title"), `${file} og:title`);
    assert.ok(meta(document, "property", "og:description"), `${file} og:description`);
    assert.equal(
      meta(document, "property", "og:image"),
      "https://name-magazine.vercel.app/images/hero/hero-1.png",
      file
    );
    assert.equal(meta(document, "name", "twitter:card"), "summary_large_image", file);
    assert.equal(meta(document, "name", "twitter:title"), meta(document, "property", "og:title"), file);
    assert.equal(
      meta(document, "name", "twitter:description"),
      meta(document, "property", "og:description"),
      file
    );
    assert.equal(meta(document, "property", "og:title"), document.title, file);
    const canonical = document.querySelector('link[rel="canonical"]')?.getAttribute("href");
    assert.equal(meta(document, "property", "og:url"), canonical, file);
    assert.match(canonical, /^https:\/\/name-magazine\.vercel\.app(\/|$)/, file);
    assert.match(html, /src="seo\.js"/, file);
    if (file !== "post.html") assert.ok(sitemapLocs.has(canonical), `${file} ${canonical}`);
    dom.window.close();
  }
  assert.equal(
    source("index.html").includes('type="application/ld+json"'),
    true
  );
  const home = new JSDOM(source("index.html"));
  const data = JSON.parse(home.window.document.getElementById("name-seo-jsonld").textContent);
  const types = data["@graph"].map((node) => node["@type"]);
  assert.deepEqual(types, ["Organization", "WebSite"]);
  assert.equal(data["@graph"][0].name, "NaMe Magazine");
  home.window.close();
});

test("sitemap lists public pages and published posts", () => {
  const xml = buildSitemap({
    posts: [
      { slug: "stone & light", publishedAt: "2026-03-01T15:04:05.000Z" },
      { slug: "stone & light", publishedAt: "2026-03-02T00:00:00.000Z" },
      { slug: "  bad\nslug  ", publishedAt: "not-a-date" },
      { slug: "" },
    ],
  });
  const found = locs(xml);
  for (const pathname of STATIC_PATHS) {
    const loc =
      pathname === "/"
        ? "https://name-magazine.vercel.app/"
        : `https://name-magazine.vercel.app${pathname}`;
    assert.ok(found.includes(loc), loc);
  }
  assert.equal(found.includes("https://name-magazine.vercel.app/post"), false);
  assert.ok(found.includes(postUrl("stone & light")));
  assert.equal(found.filter((loc) => loc === postUrl("stone & light")).length, 1);
  assert.ok(found.includes(postUrl("bad\nslug")));
  assert.equal(postUrl("bad\nslug").includes("%0A"), false);
  assert.match(xml, /<lastmod>2026-03-01<\/lastmod>/);
  assert.equal(xml.includes("<lastmod>not-a-date</lastmod>"), false);
  const unescaped = xml.replace(/&(?:amp|lt|gt|quot|apos);/g, "");
  assert.equal(unescaped.includes("&"), false);
  assert.equal(buildRobots(), "User-agent: *\nAllow: /\n\nSitemap: https://name-magazine.vercel.app/sitemap.xml\n");
  assert.equal(fs.readFileSync(path.join(root, "robots.txt"), "utf8"), buildRobots());
  const committed = fs.readFileSync(path.join(root, "sitemap.xml"), "utf8");
  for (const loc of locs(buildSitemap())) assert.ok(committed.includes(loc), loc);
});

test("sitemap generator writes posts from a JSON file", () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "name-sitemap-"));
  const postsFile = path.join(dir, "posts.json");
  fs.writeFileSync(
    postsFile,
    JSON.stringify({ posts: [{ slug: "from-file", publishedAt: "2025-01-02T00:00:00.000Z" }] })
  );
  const out = path.join(dir, "out");
  const result = spawnSync(
    process.execPath,
    ["scripts/generate-sitemap.js", "--posts", postsFile, "--out", out],
    { cwd: root, encoding: "utf8" }
  );
  assert.equal(result.status, 0, result.stderr);
  const xml = fs.readFileSync(path.join(out, "sitemap.xml"), "utf8");
  assert.ok(xml.includes(postUrl("from-file")));
  assert.match(xml, /<lastmod>2025-01-02<\/lastmod>/);
  assert.equal(fs.readFileSync(path.join(out, "robots.txt"), "utf8"), buildRobots());
  const rejected = spawnSync(
    process.execPath,
    ["scripts/generate-sitemap.js", "--posts", postsFile, "--from-catalog"],
    { cwd: root, encoding: "utf8" }
  );
  assert.notEqual(rejected.status, 0);
  assert.match(rejected.stderr, /only one of/i);
});

test("homepage share tags follow the visible language", async () => {
  const dom = await page("index.html");
  const w = dom.window;
  evaluate(w, "seo.js");
  w.NaMeI18n.init();
  assert.equal(meta(w.document, "property", "og:title"), w.document.title);
  assert.equal(meta(w.document, "property", "og:description"), meta(w.document, "name", "description"));
  assert.equal(meta(w.document, "property", "og:url"), "https://name-magazine.vercel.app/");
  assert.equal(meta(w.document, "property", "og:locale"), "en_US");
  let data = JSON.parse(w.document.getElementById("name-seo-jsonld").textContent);
  assert.equal(data["@graph"][1]["@type"], "WebSite");
  assert.equal(data["@graph"][1].description, meta(w.document, "name", "description"));

  w.NaMeI18n.apply("ja");
  assert.equal(meta(w.document, "property", "og:title"), w.document.title);
  assert.equal(meta(w.document, "name", "twitter:title"), w.document.title);
  assert.equal(meta(w.document, "property", "og:description"), w.NaMeI18n.t("ja", "pageDescription"));
  assert.equal(meta(w.document, "property", "og:locale"), "ja_JP");
  assert.equal(meta(w.document, "property", "og:url"), "https://name-magazine.vercel.app/");
  data = JSON.parse(w.document.getElementById("name-seo-jsonld").textContent);
  assert.equal(data["@graph"][1].description, w.NaMeI18n.t("ja", "pageDescription"));
  assert.equal(data["@graph"][1].inLanguage, "ja");
  dom.window.close();
});

test("section pages keep share tags aligned with the translated title", async () => {
  const dom = await page("stories.html");
  const w = dom.window;
  w.NaMeAuth = { isLoggedIn: () => false, refresh: async () => {}, initUI() {} };
  evaluate(w, "seo.js");
  evaluate(w, "page.js");
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  await tick();
  assert.equal(w.document.title, "Stories — NaMe Magazine");
  assert.equal(meta(w.document, "property", "og:title"), w.document.title);
  assert.equal(meta(w.document, "property", "og:url"), "https://name-magazine.vercel.app/stories");

  w.NaMeI18n.apply("fr");
  assert.equal(w.document.title, "Histoires — NaMe Magazine");
  assert.equal(meta(w.document, "property", "og:title"), "Histoires — NaMe Magazine");
  assert.equal(meta(w.document, "name", "twitter:description"), meta(w.document, "name", "description"));
  assert.equal(meta(w.document, "property", "og:description"), w.NaMeI18n.t("fr", "storiesPageDescription"));
  assert.equal(meta(w.document, "property", "og:locale"), "fr_FR");
  assert.equal(meta(w.document, "property", "og:url"), "https://name-magazine.vercel.app/stories");
  dom.window.close();
});

test("a loaded story sets share tags and article json-ld", async () => {
  const dom = await page("post.html", "post.html?slug=light-study");
  const w = dom.window;
  w.NaMeAuth = {
    isLoggedIn: () => false,
    refresh: async () => {},
    initUI() {},
    fetchPost: async () => ({
      slug: "light-study",
      title: "Light study",
      type: "article",
      body: "<script>alert(1)</script><p>A study in light and paper.</p>",
      imageUrl: "/images/hero/hero-2.png",
      publishedAt: "2026-03-01T00:00:00.000Z",
    }),
    fetchPosts: async () => [],
    fetchPostComments: async () => ({ comments: [] }),
  };
  w.NaMePinOps = { saveButton: () => "", storySnapshot: () => ({}), attach() {} };
  evaluate(w, "seo.js");
  w.NaMeI18n.apply("fr");
  assert.equal(meta(w.document, "property", "og:title"), w.document.title);
  assert.equal(w.document.title, w.NaMeI18n.t("fr", "pageTitle"));
  assert.equal(meta(w.document, "property", "og:url"), "https://name-magazine.vercel.app/post?slug=light-study");
  evaluate(w, "post.js");
  assert.equal(w.NaMeSeo.postUrl("stone & light"), postUrl("stone & light"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  for (let i = 0; i < 20 && !w.document.querySelector(".comments__empty"); i += 1) await tick();
  assert.ok(w.document.querySelector(".comments__empty"));
  assert.equal(w.document.title, "Light study — NaMe Magazine");
  assert.equal(meta(w.document, "property", "og:title"), "Light study — NaMe Magazine");
  assert.equal(meta(w.document, "name", "twitter:title"), "Light study — NaMe Magazine");
  assert.equal(meta(w.document, "property", "og:description"), "A study in light and paper.");
  assert.equal(meta(w.document, "name", "twitter:description"), "A study in light and paper.");
  assert.equal(
    meta(w.document, "property", "og:image"),
    "https://name-magazine.vercel.app/images/hero/hero-2.png"
  );
  assert.equal(meta(w.document, "name", "twitter:image"), meta(w.document, "property", "og:image"));
  assert.equal(meta(w.document, "property", "og:url"), "https://name-magazine.vercel.app/post?slug=light-study");
  assert.equal(
    w.document.querySelector('link[rel="canonical"]').getAttribute("href"),
    "https://name-magazine.vercel.app/post?slug=light-study"
  );
  assert.equal(meta(w.document, "property", "og:type"), "article");
  const data = JSON.parse(w.document.getElementById("name-seo-jsonld").textContent);
  assert.equal(data["@type"], "Article");
  assert.equal(data.headline, "Light study");
  assert.equal(data.datePublished, "2026-03-01T00:00:00.000Z");
  assert.deepEqual(data.image, ["https://name-magazine.vercel.app/images/hero/hero-2.png"]);
  assert.equal(data.publisher.name, "NaMe Magazine");
  assert.equal(data.publisher.logo.url, "https://name-magazine.vercel.app/images/favicon.png");
  assert.equal(data.description.includes("alert"), false);

  w.NaMeI18n.apply("ko");
  assert.equal(w.document.title, "Light study — NaMe Magazine");
  assert.equal(meta(w.document, "property", "og:title"), "Light study — NaMe Magazine");
  assert.equal(meta(w.document, "property", "og:description"), "A study in light and paper.");
  assert.equal(meta(w.document, "property", "og:image"), "https://name-magazine.vercel.app/images/hero/hero-2.png");

  w.NaMeSeo.applyPost({
    slug: "unsafe",
    title: "Unsafe",
    body: "",
    imageUrl: "javascript:alert(1)",
    publishedAt: "nope",
  });
  assert.equal(
    meta(w.document, "property", "og:image"),
    "https://name-magazine.vercel.app/images/hero/hero-1.png"
  );
  const fallback = JSON.parse(w.document.getElementById("name-seo-jsonld").textContent);
  assert.equal(fallback.datePublished, undefined);
  assert.equal(fallback.description, w.NaMeI18n.t("ko", "pageDescription"));

  w.NaMeSeo.applyPost({
    slug: "remote",
    title: "Remote",
    body: "<p>Kept.</p>",
    imageUrl: "https://cdn.example.com/cover.jpg",
  });
  assert.equal(meta(w.document, "property", "og:image"), "https://cdn.example.com/cover.jpg");
  dom.window.close();
});
