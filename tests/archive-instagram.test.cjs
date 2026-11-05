const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const { JSDOM } = require("jsdom");

const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, name), "utf8");
const tick = () => new Promise((resolve) => setTimeout(resolve, 20));

async function page(name, url = name) {
  const dom = new JSDOM(source(name), {
    url: `http://localhost:8080/${url}`,
    runScripts: "outside-only",
    pretendToBeVisual: true,
  });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {}, addListener() {}, removeListener() {} });
  w.scrollTo = () => {};
  await tick();
  w.eval(source("i18n.js") + "\nwindow.NaMeI18n = NaMeI18n;");
  return dom;
}

const evaluate = (w, file) => w.eval(source(file));
const boot = (w) => w.document.dispatchEvent(new w.Event("DOMContentLoaded"));

function story(fields) {
  return {
    title: "Untitled",
    type: "article",
    section: "latest",
    publishedAt: "2026-01-01T12:00:00.000Z",
    body: "<p>A study in light and paper.</p>",
    imageUrl: "/images/hero/hero-1.png",
    ...fields,
  };
}

const POST = "https://www.instagram.com/p/C0ffeeStory1/";
const REEL = "https://www.instagram.com/reel/ReelCode99/";
const PROFILE = "https://www.instagram.com/name_magazine_/";

test("archive strings exist in every language pack", () => {
  const langs = ["en", "zh-Hant", "zh-Hans", "ko", "ja", "fr", "es", "it"];
  const keys = [
    "archive",
    "archiveLabel",
    "archivePageTitle",
    "archivePageDescription",
    "archivePageHeading",
    "archivePageIntro",
    "archiveEmpty",
    "archiveError",
    "igSeeOriginal",
    "igOnInstagram",
    "igViewPost",
    "igFollow",
    "adminInstagramUrl",
    "adminInstagramHint",
  ];
  const en = JSON.parse(source("locales/en.json"));
  for (const lang of langs) {
    const pack = JSON.parse(source(`locales/${lang}.json`));
    for (const key of keys) {
      assert.equal(typeof pack[key], "string", `${lang}.${key}`);
      assert.ok(pack[key].trim(), `${lang}.${key} empty`);
    }
  }
  assert.equal(en.archivePageHeading, "Archive");
  assert.equal(en.igSeeOriginal, "See the original post on Instagram ↗");
  assert.match(source("i18n.js"), /"igSeeOriginal": "在 Instagram 查看原始貼文 ↗"/);
  assert.match(source("i18n.js"), /"archivePageHeading": "檔案"/);
});

test("archive groups published stories by format, newest first, and omits empty groups", async () => {
  const dom = await page("archive.html");
  const w = dom.window;
  evaluate(w, "archive.js");
  const group = w.NaMeArchive.groupArchive;
  const posts = [
    story({ slug: "mag-old", title: "Older magazine", type: "editorial", section: "popular", publishedAt: "2026-01-02T12:00:00.000Z" }),
    story({ slug: "mag-new", title: "New magazine", type: "editorial", section: "popular", publishedAt: "2026-05-02T12:00:00.000Z" }),
    story({ slug: "edit-new", title: "New editorial", type: "editorial", section: "latest", publishedAt: "2026-04-01T12:00:00.000Z" }),
    story({ slug: "edit-open", title: "Open editorial", type: "editorial", section: null, publishedAt: "2026-02-01T12:00:00.000Z" }),
    story({ slug: "article-new", title: "New article", type: "article", publishedAt: "2026-06-01T12:00:00.000Z" }),
    story({ slug: "article-new", title: "Duplicate older", type: "article", publishedAt: "2026-01-01T12:00:00.000Z" }),
    story({ slug: "stone light", title: "Stone and light", type: "article", publishedAt: "2026-03-01T12:00:00.000Z" }),
    story({ slug: "film-old", title: "Winter film", type: "film", publishedAt: "2026-01-15T12:00:00.000Z" }),
    story({ slug: "film-pop", title: "Popular film", type: "film", section: "popular", publishedAt: "2026-07-01T12:00:00.000Z" }),
    story({ slug: "nana", title: "Nana's note", type: "exclusive", publishedAt: "2026-03-20T12:00:00.000Z" }),
    story({ slug: "maker", title: "A maker", type: "artists", publishedAt: "2026-02-02T12:00:00.000Z" }),
    story({ title: "No slug", type: "article" }),
    story({ slug: "other", title: "Interview", type: "interview" }),
  ];

  const groups = group(posts);
  const ids = (list) => [...list].map((item) => item.id).join("|");
  const slugs = (list) => [...list].map((post) => post.slug).join("|");
  assert.equal(ids(groups), "magazine|editorial|article|film|exclusive|artists");
  assert.equal(groups.some((item) => item.id === "short" || item.count === 0), false);
  assert.equal(
    [...groups].map((item) => `${item.id}:${item.count}`).join("|"),
    "magazine:2|editorial:2|article:2|film:2|exclusive:1|artists:1"
  );
  assert.equal(slugs(groups.find((item) => item.id === "magazine").posts), "mag-new|mag-old");
  assert.equal(slugs(groups.find((item) => item.id === "editorial").posts), "edit-new|edit-open");
  assert.equal(slugs(groups.find((item) => item.id === "film").posts), "film-pop|film-old");
  assert.equal(group([]).length, 0);
  assert.equal(group(null).length, 0);

  w.NaMeArchive.renderArchive(posts);
  const counts = w.document.getElementById("archive-counts");
  assert.equal(counts.hidden, false);
  assert.equal(
    counts.textContent,
    "Magazine 2 · Editorial 2 · Article 2 · Film 2 · Editor's Exclusive 1 · Artists 1"
  );
  assert.equal(counts.textContent.includes(" 0"), false);
  assert.equal(w.document.querySelector('[data-archive-group="short"]'), null);
  const articleLinks = [...w.document.querySelectorAll('[data-archive-group="article"] .archive-entry')];
  assert.equal(
    articleLinks.map((link) => link.querySelector(".archive-entry__title").textContent).join("|"),
    "New article|Stone and light"
  );
  assert.match(articleLinks[1].getAttribute("href"), /\/post\.html\?slug=stone%20light$/);
  assert.equal(
    articleLinks[0].querySelector("time").textContent,
    w.NaMeArchive.formatArchiveDate("2026-06-01T12:00:00.000Z", "en")
  );
  assert.equal(articleLinks[0].querySelector("time").getAttribute("datetime"), "2026-06-01T12:00:00.000Z");

  w.NaMeI18n.apply("zh-Hant");
  assert.equal(w.document.querySelector(".archive-group__name").textContent, "雜誌");
  assert.match(w.document.getElementById("archive-counts").textContent, /^雜誌 2 · 專題 2/);
  assert.equal(w.document.querySelector(".browse-hero__title").textContent, "檔案");

  w.NaMeArchive.renderArchive([]);
  assert.equal(w.document.getElementById("archive-counts").hidden, true);
  assert.equal(w.document.querySelector(".archive-group"), null);
  assert.equal(w.document.querySelector(".archive-empty").textContent.includes("0"), false);
  dom.window.close();
});

test("archive reads the live catalog page by page and keeps exclusive stories", async () => {
  const dom = await page("archive.html");
  const w = dom.window;
  const calls = [];
  const first = [
    story({ slug: "page-a", title: "Page A", type: "article", publishedAt: "2026-05-01T12:00:00.000Z" }),
    story({ slug: "page-b", title: "Page B", type: "editorial", section: "latest", publishedAt: "2026-04-01T12:00:00.000Z" }),
  ];
  const second = [
    story({ slug: "page-b", title: "Duplicate", type: "editorial", publishedAt: "2026-04-01T12:00:00.000Z" }),
    story({ slug: "page-c", title: "Nana", type: "exclusive", publishedAt: "2026-03-01T12:00:00.000Z" }),
  ];
  w.NaMeAuth = {
    searchPosts: async (query) => {
      calls.push(query);
      if (query.offset === 0) return { posts: first, total: 3 };
      if (query.offset === 2) return { posts: second, total: 3 };
      return { posts: [], total: 3 };
    },
    fetchPosts: async () => {
      throw new Error("capped list should not be used");
    },
  };
  evaluate(w, "archive.js");
  boot(w);
  for (let i = 0; i < 20 && !w.document.querySelector('[data-archive-group="exclusive"]'); i += 1) await tick();
  assert.equal(calls.map((query) => query.offset).join("|"), "0|2");
  assert.equal(calls.every((query) => query.limit === 50 && !query.types && !query.type), true);
  assert.equal(
    [...w.document.querySelectorAll(".archive-entry__title")].map((node) => node.textContent).join("|"),
    "Page B|Page A|Nana"
  );
  dom.window.close();

  const fallback = await page("archive.html");
  const view = fallback.window;
  view.NaMeAuth = {
    fetchPosts: async () => [story({ slug: "only", title: "Only film", type: "film", publishedAt: "2026-08-01T12:00:00.000Z" })],
  };
  evaluate(view, "archive.js");
  boot(view);
  for (let i = 0; i < 20 && !view.document.querySelector('[data-archive-group="film"]'); i += 1) await tick();
  assert.equal(view.document.querySelector(".archive-entry__title").textContent, "Only film");
  assert.equal(view.document.querySelectorAll(".archive-group").length, 1);
  fallback.window.close();
});

test("archive stays quiet when the catalog is empty or unavailable", async () => {
  const dom = await page("archive.html");
  const w = dom.window;
  w.NaMeAuth = { searchPosts: async () => ({ posts: [], total: 0 }) };
  evaluate(w, "archive.js");
  boot(w);
  for (let i = 0; i < 20 && !w.document.querySelector(".archive-empty"); i += 1) await tick();
  assert.equal(w.document.querySelector(".archive-group"), null);
  assert.equal(w.document.getElementById("archive-counts").hidden, true);
  assert.equal(w.document.querySelector(".archive-empty").textContent, "Nothing in the archive yet.");
  dom.window.close();

  const failed = await page("archive.html");
  const view = failed.window;
  view.NaMeAuth = {
    searchPosts: async () => {
      throw new Error("offline");
    },
  };
  evaluate(view, "archive.js");
  boot(view);
  for (let i = 0; i < 20 && !view.document.querySelector(".archive-empty"); i += 1) await tick();
  assert.equal(view.document.querySelector(".archive-empty").textContent, "The archive could not be loaded.");
  assert.equal(view.document.querySelector(".archive-group"), null);
  failed.window.close();
});

test("archive is linked from the footer and stories, without a new top-nav item", () => {
  const storiesMenu = ["magazine.html", "editorial.html", "articles.html", "film.html", "artists.html"];
  for (const name of ["archive.html", "index.html", "stories.html", "post.html", "film.html"]) {
    const dom = new JSDOM(source(name));
    const doc = dom.window.document;
    assert.deepEqual(
      [...doc.querySelectorAll('.nav-dropdown[data-nav-dropdown="stories"] .nav-dropdown__menu a')].map((link) => link.getAttribute("href")),
      storiesMenu,
      name
    );
    assert.equal(doc.querySelector('.header__nav > a[href="archive.html"]'), null, name);
    assert.ok(doc.querySelector('footer a[href="archive.html"]'), name);
    dom.window.close();
  }
  const home = new JSDOM(source("index.html"));
  assert.equal(
    home.window.document.querySelector("[data-i18n='coverArchive']").getAttribute("href"),
    "archive.html"
  );
  home.window.close();
  const stories = new JSDOM(source("stories.html"));
  assert.ok(stories.window.document.querySelector('.stories-categories__link[href="archive.html"]'));
  stories.window.close();
  assert.equal(source("index.html").includes("embed.js"), false);
  assert.equal(source("post.html").includes("embed.js"), false);
  assert.match(source("post.html"), /src="instagram\.js"/);
});

function authStub(extra) {
  return {
    isLoggedIn: () => false,
    refresh: async () => {},
    initUI() {},
    fetchPostComments: async () => ({ comments: [] }),
    fetchPosts: async () => [],
    ...extra,
  };
}

async function renderStory(fields) {
  const dom = await page("post.html", "post.html?slug=current");
  const w = dom.window;
  w.NaMeAuth = authStub({ fetchPost: async () => story({ slug: "current", title: "Current story", ...fields }) });
  w.eval(source("pin-ops.js") + "\nwindow.NaMePinOps = NaMePinOps;");
  evaluate(w, "instagram.js");
  evaluate(w, "post.js");
  boot(w);
  for (let i = 0; i < 30 && !w.document.querySelector(".post__title"); i += 1) await tick();
  return dom;
}

test("instagram permalinks are taken from a post or reel, never a profile", async () => {
  const dom = await page("post.html");
  const w = dom.window;
  evaluate(w, "instagram.js");
  const ig = w.NaMeInstagram;
  assert.equal(ig.permalink(story({ body: `<p><a href="${POST}?igsh=1">post</a></p>` })), POST);
  assert.equal(ig.permalink(story({ body: `Watch ${REEL}?utm=ig` })), REEL);
  assert.equal(ig.permalink(story({ body: `<p>Follow ${PROFILE}</p>`, meta: PROFILE })), "");
  assert.equal(ig.permalink(story({ meta: "notinstagram.com/p/C0ffeeStory1/" })), "");
  assert.equal(ig.permalink(story({ instagramUrl: REEL, body: `<a href="${POST}">other</a>` })), REEL);
  const marked = ig.applyMarker(`<p>A study.</p><a href="${POST}">other</a>`, REEL);
  assert.match(marked, /data-name-instagram="https:\/\/www\.instagram\.com\/reel\/ReelCode99\/"/);
  assert.equal(ig.permalink(story({ body: marked })), REEL);
  assert.equal(ig.stripMarker(marked).includes("data-name-instagram"), false);
  assert.equal(ig.applyMarker("<p>A study.</p>", PROFILE), "<p>A study.</p>");
  assert.equal(ig.MAGAZINE_INSTAGRAM_URL, PROFILE);
  dom.window.close();
});

test("a story shows the instagram source and placement only when a permalink exists", async () => {
  const shown = await renderStory({
    type: "film",
    videoUrl: "https://example.com/film.mp4",
    imageUrl: "/images/hero/hero-2.png",
    body: `<p>A study in light and paper.</p><p><a href="${REEL}">the reel</a></p>`,
  });
  const w = shown.window;
  const doc = w.document;
  const sourceLink = doc.querySelector(".post-ig-source a");
  const embed = doc.querySelector("blockquote.instagram-media");
  const placement = doc.querySelector(".post-instagram");
  const article = doc.querySelector("#post-root .post");
  const related = doc.getElementById("post-related");
  assert.equal(sourceLink.getAttribute("href"), REEL);
  assert.equal(sourceLink.textContent, "See the original post on Instagram ↗");
  assert.equal(embed.getAttribute("data-instgrm-permalink"), REEL);
  assert.equal(doc.querySelector(".post-ig-card__link").getAttribute("href"), REEL);
  assert.equal(doc.querySelector(".post-ig-card__link").textContent, "View on Instagram");
  assert.equal(doc.querySelector(".post-ig-card__img").getAttribute("src"), "/images/hero/hero-2.png");
  assert.match(doc.querySelector(".post-ig-card__caption").textContent, /A study in light and paper/);
  assert.equal(doc.querySelector(".post-ig-follow a").getAttribute("href"), PROFILE);
  assert.equal(doc.querySelector('script[data-name-ig-embed]').getAttribute("src"), "https://www.instagram.com/embed.js");
  assert.equal(doc.querySelectorAll("script[data-name-ig-embed]").length, 1);
  assert.ok(doc.querySelector(".post__title").compareDocumentPosition(sourceLink) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(sourceLink.compareDocumentPosition(doc.querySelector(".post__content")) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(doc.querySelector(".post__content").compareDocumentPosition(placement) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.ok(article.compareDocumentPosition(related) & w.Node.DOCUMENT_POSITION_FOLLOWING);
  assert.equal(related.querySelector("#post-related-title, .post-related__title").textContent, "Related Reading");
  w.NaMeI18n.apply("zh-Hant");
  assert.equal(doc.querySelector(".post-ig-source a").textContent, "在 Instagram 查看原始貼文 ↗");
  assert.equal(doc.querySelector(".post-ig-card__link").textContent, "在 Instagram 查看");
  shown.window.close();

  const hidden = await renderStory({
    body: `<p>A study in light and paper.</p><p>IG: name_magazine_</p><p>${PROFILE}</p>`,
    imageUrl: "/images/hero/hero-1.png",
  });
  const quiet = hidden.window.document;
  assert.equal(quiet.querySelector(".post__title").textContent, "Current story");
  assert.equal(quiet.querySelector(".post-ig-source"), null);
  assert.equal(quiet.querySelector(".post-instagram"), null);
  assert.equal(quiet.querySelector("blockquote.instagram-media"), null);
  assert.equal(quiet.querySelector("script[data-name-ig-embed]"), null);
  assert.match(quiet.querySelector(".post__content").textContent, /A study in light and paper/);
  hidden.window.close();

  const marked = await renderStory({
    body: `<p>Kept prose.</p><p data-name-instagram="${POST}" hidden></p>`,
    imageUrl: "",
  });
  const markedDoc = marked.window.document;
  assert.equal(markedDoc.querySelector(".post-ig-source a").getAttribute("href"), POST);
  assert.equal(markedDoc.querySelector(".post__content").innerHTML.includes("data-name-instagram"), false);
  assert.match(markedDoc.querySelector(".post__content").textContent, /Kept prose/);
  assert.equal(markedDoc.querySelector(".post-ig-card__img"), null);
  assert.equal(markedDoc.querySelector(".post-ig-card__link").getAttribute("href"), POST);
  marked.window.close();
});
