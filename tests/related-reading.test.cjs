const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, name), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));

async function page(url = "post.html?slug=current") {
  const dom = new JSDOM(source("post.html"), {
    url: `http://localhost:8080/${url}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.ResizeObserver = class {
    observe() {}
    disconnect() {}
  };
  w.IntersectionObserver = class {
    observe() {}
    disconnect() {}
  };
  w.scrollTo = () => {};
  w.HTMLElement.prototype.getClientRects = function () {
    return this.closest("[hidden], .is-hidden, .modal:not(.is-open)") ? [] : [{ width: 100, height: 40 }];
  };
  await tick();
  w.eval(source("i18n.js") + "\nwindow.NaMeI18n = NaMeI18n;");
  return dom;
}

const evaluate = (w, file, expose = "") => w.eval(source(file) + (expose ? `\nwindow.${expose} = ${expose};` : ""));
const boot = (w) => w.document.dispatchEvent(new w.Event("DOMContentLoaded"));

function story(fields) {
  return {
    imageUrl: "/images/hero/hero-1.png",
    body: "<p>A related story.</p>",
    publishedAt: "2026-01-01T00:00:00.000Z",
    ...fields,
  };
}

const current = story({
  id: "cur",
  slug: "current",
  title: "Current fashion story",
  type: "article",
  meta: "Fashion, Art — 02 Mar 2026",
  tags: ["milan", "tailoring"],
  publishedAt: "2026-03-02T00:00:00.000Z",
  body: "<p>A study in light and paper.</p>",
  imageUrl: "/images/hero/hero-2.png",
});

function catalog() {
  return [
    current,
    story({ id: "cur", slug: "republished", title: "Same id", type: "editorial", publishedAt: "2026-05-01T00:00:00.000Z" }),
    story({ slug: "current", title: "Duplicate slug", type: "film", publishedAt: "2026-05-02T00:00:00.000Z" }),
    story({
      slug: "tagged",
      title: "Milan night",
      type: "film",
      meta: "Film — 20 Jan 2026",
      tags: "milan, night",
      publishedAt: "2026-01-20T00:00:00.000Z",
    }),
    story({
      slug: "fashion-edit",
      title: "Fashion editorial",
      type: "editorial",
      meta: "Fashion — 01 Jan 2026",
      publishedAt: "2026-01-01T00:00:00.000Z",
    }),
    story({
      slug: "same-type",
      title: "Another article",
      type: "article",
      meta: "Life — 01 Feb 2026",
      publishedAt: "2026-02-01T00:00:00.000Z",
    }),
    story({
      slug: "recent",
      title: "Recent artist",
      type: "artists",
      meta: "Studio — 01 Apr 2026",
      publishedAt: "2026-04-01T00:00:00.000Z",
    }),
    story({
      slug: "also-recent",
      title: "Also recent",
      type: "exclusive",
      publishedAt: "2026-03-20T00:00:00.000Z",
    }),
    story({ slug: "older", title: "Older short", type: "short", publishedAt: "2025-01-01T00:00:00.000Z" }),
    story({ slug: "recent", title: "Duplicate recent", type: "artists", publishedAt: "2026-04-02T00:00:00.000Z" }),
    { id: "noslug", title: "Missing slug", type: "article" },
  ];
}

function slugs(posts) {
  return [...posts].map((post) => post.slug).join("|");
}

function authStub(extra) {
  return {
    isLoggedIn: () => false,
    refresh: async () => {},
    initUI() {},
    fetchPostComments: async () => ({ comments: [] }),
    ...extra,
  };
}

async function until(predicate) {
  for (let i = 0; i < 30 && !predicate(); i += 1) await tick();
}

test("related reading strings exist in every language pack", () => {
  const expected = {
    en: "Related Reading",
    "zh-Hant": "相關閱讀",
    "zh-Hans": "相关阅读",
    ko: "관련 글",
    ja: "関連記事",
    fr: "À lire aussi",
    es: "Lecturas relacionadas",
    it: "Da leggere anche",
  };
  for (const [lang, heading] of Object.entries(expected)) {
    const pack = JSON.parse(source(`locales/${lang}.json`));
    assert.equal(pack.relatedReading, heading);
  }
  assert.match(source("i18n.js"), /"relatedReading": "相關閱讀"/);
  assert.match(source("post.html"), /data-i18n="relatedReading"/);
});

test("related stories prefer category, type, and tags, then recent posts", async () => {
  const dom = await page();
  const w = dom.window;
  evaluate(w, "post.js");
  const select = w.NaMeRelated.selectRelatedPosts;
  const picked = select(current, catalog());
  assert.equal(slugs(picked), "tagged|fashion-edit|same-type|recent");
  assert.equal([...picked].some((post) => post.slug === "current" || post.id === "cur"), false);
  assert.equal(select(current, catalog(), 10).length, 4);
  assert.equal(slugs(select(current, catalog(), 2)), "tagged|fashion-edit");

  const fillers = catalog().filter((post) => !["tagged", "fashion-edit"].includes(post.slug));
  assert.equal(slugs(select(current, fillers)), "same-type|recent|also-recent|older");

  const onlyTwo = [current, story({ slug: "recent", title: "Recent artist", type: "artists", publishedAt: "2026-04-01T00:00:00.000Z" }), story({ slug: "older", title: "Older short", type: "short", publishedAt: "2025-01-01T00:00:00.000Z" })];
  assert.equal(slugs(select(current, onlyTwo)), "recent|older");
  assert.equal(select(current, [current]).length, 0);
  assert.equal(select(current, null).length, 0);

  const taggedObject = story({
    slug: "object-tag",
    title: "Object tag",
    type: "short",
    tags: [{ name: "Tailoring" }],
    publishedAt: "2024-01-01T00:00:00.000Z",
  });
  assert.equal(select(current, [taggedObject, story({ slug: "plain", title: "Plain", type: "short", publishedAt: "2026-06-01T00:00:00.000Z" })])[0].slug, "object-tag");

  dom.window.close();
});

test("a loaded story shows at most four related cards and keeps its own share tags", async () => {
  const dom = await page();
  const w = dom.window;
  const queries = [];
  w.NaMeAuth = authStub({
    fetchPost: async () => current,
    fetchPosts: async (query) => {
      queries.push(query);
      return catalog();
    },
  });
  evaluate(w, "seo.js");
  evaluate(w, "pin-ops.js", "NaMePinOps");
  evaluate(w, "post.js");
  boot(w);
  await until(() => w.document.querySelectorAll("#post-related-grid .pin-tile").length === 4);
  await until(() => w.document.querySelector(".comments__empty"));

  const section = w.document.getElementById("post-related");
  const footer = w.document.querySelector("footer.footer");
  const article = w.document.querySelector("#post-root .post");
  assert.equal(section.hidden, false);
  assert.equal(section.getAttribute("aria-labelledby"), "post-related-title");
  assert.equal(w.document.getElementById("post-related-title").textContent, "Related Reading");
  assert.ok(article.compareDocumentPosition(section) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(section.compareDocumentPosition(footer) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(queries.length, 1);
  assert.equal(JSON.stringify(queries[0]), "{}");

  const cards = [...w.document.querySelectorAll("#post-related-grid .pin-tile")];
  assert.equal(cards.length, 4);
  assert.equal(
    cards.map((card) => card.querySelector(".card__title").textContent).join("|"),
    "Milan night|Fashion editorial|Another article|Recent artist"
  );
  const hrefs = cards.map((card) => card.querySelector(".pin-tile__link").getAttribute("href"));
  assert.equal(hrefs.some((href) => href.includes("slug=current")), false);
  assert.match(hrefs[0], /slug=tagged$/);
  const first = cards[0].querySelector(".pin-tile__link");
  assert.equal(first.querySelector("img").getAttribute("alt"), "Milan night");
  assert.equal(first.querySelector("img").getAttribute("src"), "/images/hero/hero-1.png");
  assert.equal(cards[1].querySelector(".card__meta").textContent, "Fashion — 01 Jan 2026");
  assert.equal(cards[2].querySelector(".card__type").textContent, "Article");
  first.focus();
  assert.equal(w.document.activeElement, first);

  assert.equal(w.document.title, "Current fashion story — NaMe Magazine");
  assert.equal(w.document.querySelector('meta[property="og:title"]').getAttribute("content"), w.document.title);
  assert.equal(w.document.querySelector('meta[property="og:type"]').getAttribute("content"), "article");
  const data = JSON.parse(w.document.getElementById("name-seo-jsonld").textContent);
  assert.equal(data["@type"], "Article");
  assert.equal(data.headline, "Current fashion story");

  w.NaMeI18n.apply("zh-Hant");
  assert.equal(w.document.getElementById("post-related-title").textContent, "相關閱讀");
  assert.equal(cards[2].isConnected, false);
  const translated = [...w.document.querySelectorAll("#post-related-grid .pin-tile")].find(
    (card) => card.querySelector(".card__title").textContent === "Another article"
  );
  assert.equal(translated.querySelector(".card__type").textContent, "文章");
  assert.equal(w.document.title, "Current fashion story — NaMe Magazine");
  assert.equal(
    w.document.querySelector('meta[property="og:title"]').getAttribute("content"),
    "Current fashion story — NaMe Magazine"
  );
  assert.equal(
    w.document.querySelector('meta[property="og:description"]').getAttribute("content"),
    "A study in light and paper."
  );

  dom.window.close();
});

test("related reading shows a short list and hides when nothing else is published", async () => {
  const dom = await page("post.html?slug=current");
  const w = dom.window;
  const others = [
    story({ slug: "recent", title: "Recent artist", type: "artists", publishedAt: "2026-04-01T00:00:00.000Z" }),
    story({ slug: "older", title: "Older short", type: "short", publishedAt: "2025-01-01T00:00:00.000Z" }),
  ];
  w.NaMeAuth = authStub({
    fetchPost: async () => current,
    fetchPosts: async () => [current, ...others],
  });
  evaluate(w, "pin-ops.js", "NaMePinOps");
  evaluate(w, "post.js");
  boot(w);
  await until(() => w.document.querySelectorAll("#post-related-grid .pin-tile").length === 2);

  const section = w.document.getElementById("post-related");
  assert.equal(section.hidden, false);
  assert.equal(w.document.querySelector("#post-related-grid .browse-grid__empty"), null);
  assert.equal(
    [...w.document.querySelectorAll("#post-related-grid .card__title")].map((el) => el.textContent).join("|"),
    "Recent artist|Older short"
  );

  dom.window.close();

  const empty = await page("post.html?slug=current");
  const blank = empty.window;
  blank.NaMeAuth = authStub({
    fetchPost: async () => current,
    fetchPosts: async () => [current],
  });
  evaluate(blank, "pin-ops.js", "NaMePinOps");
  evaluate(blank, "post.js");
  boot(blank);
  await until(() => blank.document.querySelector(".comments__empty"));
  assert.equal(blank.document.getElementById("post-related").hidden, true);
  assert.equal(blank.document.querySelector("#post-related-grid .pin-tile"), null);
  assert.equal(blank.document.title, "Current fashion story — NaMe Magazine");
  empty.window.close();
});

test("a catalog failure leaves the story page up without a related block", async () => {
  const dom = await page();
  const w = dom.window;
  w.NaMeAuth = authStub({
    fetchPost: async () => current,
    fetchPosts: async () => {
      throw new Error("offline");
    },
  });
  evaluate(w, "seo.js");
  evaluate(w, "pin-ops.js", "NaMePinOps");
  evaluate(w, "post.js");
  boot(w);
  await until(() => w.document.querySelector(".post__title"));
  await until(() => w.document.querySelector(".comments__empty"));
  assert.equal(w.document.querySelector(".post__title").textContent, "Current fashion story");
  assert.equal(w.document.getElementById("post-related").hidden, true);
  assert.equal(w.document.querySelector("#post-related-grid").childElementCount, 0);
  assert.equal(w.document.querySelector('meta[property="og:title"]').getAttribute("content"), "Current fashion story — NaMe Magazine");
  dom.window.close();
});
