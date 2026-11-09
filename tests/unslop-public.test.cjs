const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("fs");
const path = require("path");
const { JSDOM } = require("jsdom");
const csstree = require("css-tree");

const root = path.resolve(__dirname, "..");
const source = (name) => fs.readFileSync(path.join(root, name), "utf8");
const langs = ["en", "ko", "it", "fr", "es", "ja", "zh-Hans", "zh-Hant"];

function domWith(html, href, reduced = false) {
  const dom = new JSDOM(html, { url: href, runScripts: "outside-only", pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = (query) => ({
    matches: reduced && String(query).includes("reduce"),
    addEventListener() {},
    removeEventListener() {},
  });
  return dom;
}

test("public styles parse and drop the audited tells", () => {
  for (const file of ["experience.css", "home-design.css"]) {
    const errors = [];
    csstree.parse(source(file), { onParseError: (error) => errors.push(error.message) });
    assert.deepEqual(errors, [], file);
  }
  const home = source("home-design.css");
  const shared = source("experience.css");
  assert.equal(home.includes("community-banner::before"), false);
  assert.equal(home.includes("text-transform: uppercase"), false);
  assert.match(shared, /@media \(prefers-reduced-motion: no-preference\) \{\s*@view-transition \{ navigation: auto; \}/);
  assert.match(shared, /translateY\(2px\) scale\(0\.985\)/);
  assert.equal(shared.includes("scale(1.025)"), false);
  assert.match(shared, /body:not\(\.page-admin\) \.btn--primary \{\s*background: var\(--text\)/);
  assert.match(shared, /box-shadow: 0 8px 24px rgb\(90 74 52 \/ 10%\)/);
});

test("login sits on paper and does not use a stock photograph", () => {
  const html = source("account.html");
  assert.equal(html.includes("unsplash.com"), false);
  assert.equal(html.includes("auth-page__visual"), false);
  assert.equal(html.includes("auth-page__benefits"), false);
  assert.equal(html.match(/<h1\b/g).length, 1);
  assert.match(html, /data-i18n="authPageSubtitle">Comment on a story, or send work to the desk\./);
});

test("changed copy is present in all eight locales and the compiled catalog", () => {
  const compiled = source("i18n.js");
  const en = JSON.parse(source("locales/en.json"));
  const keys = ["coverCoordinates", "coverStatus", "coverManifesto", "subscribePageHeading", "subscribePageIntro", "authPageSubtitle"];
  assert.equal(en.coverStatus, "New York");
  assert.equal(en.subscribePageHeading, "Letter from the desk");
  assert.match(en.coverManifesto, /New York desk/);
  for (const lang of langs) {
    const pack = JSON.parse(source(`locales/${lang}.json`));
    for (const key of keys) {
      assert.equal(typeof pack[key], "string", `${lang}.${key}`);
      assert.ok(pack[key].trim().length > 0, `${lang}.${key}`);
      assert.match(compiled, new RegExp(`${JSON.stringify(key)}: ${JSON.stringify(pack[key])}`));
    }
    assert.equal(pack.coverStatus.includes("!"), false, lang);
  }
});

test("opening a story names the plate and remembers the photograph", () => {
  const dom = domWith(
    '<a href="post.html?slug=beauty-obsession"><img src="/images/hero/hero-1.png" alt="Beauty Obsession"></a>',
    "http://localhost:8080/"
  );
  const w = dom.window;
  w.eval(source("experience.js"));
  w.document.querySelector("img").dispatchEvent(new w.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
  const img = w.document.querySelector("img");
  assert.equal(img.style.viewTransitionName, "plate-beauty-obsession");
  const stored = JSON.parse(w.sessionStorage.getItem("name.plate"));
  assert.equal(stored.slug, "beauty-obsession");
  assert.equal(stored.src, "/images/hero/hero-1.png");
  assert.equal(stored.alt, "Beauty Obsession");
  dom.window.close();
});

test("reduced motion skips the shared plate", () => {
  const dom = domWith(
    '<a href="post.html?slug=beauty-obsession"><img src="/images/hero/hero-1.png" alt="Beauty Obsession"></a>',
    "http://localhost:8080/",
    true
  );
  const w = dom.window;
  w.eval(source("experience.js"));
  w.document.querySelector("img").dispatchEvent(new w.MouseEvent("click", { bubbles: true, button: 0, cancelable: true }));
  assert.equal(w.document.querySelector("img").style.viewTransitionName, "");
  assert.equal(w.sessionStorage.getItem("name.plate"), null);
  dom.window.close();
});

test("a story page paints the handed-off plate before the article replaces it", () => {
  const dom = domWith(source("post.html"), "http://localhost:8080/post.html?slug=beauty-obsession");
  const w = dom.window;
  w.sessionStorage.setItem("name.plate", JSON.stringify({
    slug: "beauty-obsession",
    name: "plate-beauty-obsession",
    src: "/images/hero/hero-1.png",
    alt: "Beauty Obsession",
  }));
  const inline = source("post.html").match(/<script>\s*(\(function \(\) \{[\s\S]*?\}\)\(\);)\s*<\/script>/);
  assert.ok(inline, "plate script");
  w.eval(inline[1]);
  const img = w.document.getElementById("post-hero-img");
  assert.equal(img.hidden, false);
  assert.equal(img.getAttribute("src"), "/images/hero/hero-1.png");
  assert.equal(img.style.viewTransitionName, "plate-beauty-obsession");
  assert.equal(w.sessionStorage.getItem("name.plate"), null);
  dom.window.close();
});

test("a direct story visit keeps the plate hidden and still names the loaded hero", async () => {
  const dom = domWith(source("post.html"), "http://localhost:8080/post.html?slug=current");
  const w = dom.window;
  w.scrollTo = () => {};
  w.NaMeI18n = { init() {}, getLang: () => "en", t: (_lang, key) => key, onChange() {} };
  w.NaMeAuth = {
    refresh: async () => {},
    initUI() {},
    isLoggedIn: () => false,
    fetchPost: async () => ({ slug: "current", title: "Current story", type: "editorial", meta: "Studio", body: "<p>A study.</p>", imageUrl: "/images/hero/hero-1.png" }),
    fetchPostComments: async () => ({ comments: [] }),
    fetchPosts: async () => [],
  };
  w.NaMePinOps = { saveButton: () => "", storySnapshot: () => ({}) };
  w.eval(source("post.js"));
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  for (let i = 0; i < 20 && !w.document.querySelector(".post__title"); i += 1) {
    await new Promise((resolve) => setTimeout(resolve, 10));
  }
  const hero = w.document.querySelector(".post__hero-img");
  assert.equal(w.document.querySelector(".post__title").textContent, "Current story");
  assert.equal(hero.getAttribute("src"), "/images/hero/hero-1.png");
  assert.equal(hero.style.viewTransitionName, "plate-current");
  assert.equal(w.document.querySelectorAll("#post-related").length, 1);
  dom.window.close();
});
