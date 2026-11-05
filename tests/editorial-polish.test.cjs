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
  await tick();
  w.eval(source("i18n.js") + "\nwindow.NaMeI18n = NaMeI18n;");
  return dom;
}

const evaluate = (w, file, expose = "") => w.eval(source(file) + (expose ? `\nwindow.${expose} = ${expose};` : ""));

test("homepage masthead leaves room for the lead story and does not invent a count", () => {
  const html = source("index.html");
  const css = source("home-design.css");
  assert.equal(html.includes("atelier__side"), false);
  assert.equal(html.includes('id="atelier-count">0<'), false);
  assert.match(html, /id="atelier-count-wrap"[^>]*hidden/);
  assert.match(html, /class="atelier__field-label"/);
  assert.match(html, /class="atelier__search-label"/);
  assert.match(html, /atelier-skeleton__frame/);
  assert.equal(css.includes("grid-row: span"), false);
  assert.match(css, /atelier__rail/);
  assert.match(css, /object-position: center 22%/);
  assert.doesNotMatch(css, /font-size: clamp\(7rem/);
});

test("homepage feature uses a lead and a rail instead of a spanning row", async () => {
  const dom = await page("index.html");
  const w = dom.window;
  const posts = [
    { slug: "beauty", title: "Beauty Obsession", type: "exclusive", meta: "Fashion Editorial", body: "Beauty obsession\nPhotographer / Creative Director / Producer @jingnanaaaaaaa\nModels @amy", imageUrl: "/a.jpg" },
    { slug: "prototype", title: "Prototype II", type: "exclusive", meta: "Fashion Photography", body: "<p>A study.</p>", imageUrl: "/b.jpg" },
    { slug: "substation", title: "SUBSTATION", type: "exclusive", meta: "The Life of Things", body: "<p>Objects.</p>", imageUrl: "/c.jpg" },
  ];
  w.NaMeAuth = {
    isLoggedIn: () => false,
    refresh: () => new Promise(() => {}),
    initUI() {},
    fetchPosts: async () => posts,
    fetchExclusiveMetas: async () => [],
  };
  evaluate(w, "exclusive-folders.js");
  evaluate(w, "main.js");
  w.document.dispatchEvent(new w.Event("DOMContentLoaded"));
  for (let i = 0; i < 20 && !w.document.querySelector("a.atelier-piece--lead"); i += 1) await tick();
  assert.equal(w.document.querySelectorAll(".atelier-piece--lead").length, 1);
  assert.equal(w.document.querySelectorAll(".atelier__rail .atelier-piece").length, 2);
  assert.equal(w.document.querySelector(".atelier-piece--lead .atelier-piece__title").textContent, "Beauty Obsession");
  assert.equal(w.document.querySelector(".atelier-piece--lead .atelier-piece__text").textContent, "Fashion Editorial");
  assert.equal(w.document.querySelector(".atelier-piece--lead").textContent.includes("@jingnanaaaaaaa"), false);
  assert.equal(w.document.querySelector("#atelier-count").textContent, "3");
  assert.equal(w.document.getElementById("atelier-count-wrap").hidden, false);
  assert.equal(w.document.querySelector(".atelier-skeleton__frame"), null);
  dom.window.close();
});

test("category folders lead with photographs", async () => {
  const dom = await page("exclusive.html");
  const w = dom.window;
  evaluate(w, "exclusive-folders.js");
  const html = w.renderExclusiveFolderCard(
    {
      name: "Fashion Photography",
      posts: [
        { imageUrl: "/prototype.jpg", title: "Prototype II" },
        { imageUrl: "/raw.jpg", title: "Raw Cycle" },
        { imageUrl: "/first.jpg", title: "Prototype I" },
      ],
    },
    "en",
    "/exclusive.html"
  );
  const host = w.document.createElement("div");
  host.innerHTML = html;
  assert.equal(host.querySelector(".meta-folder__cover img").getAttribute("src"), "/prototype.jpg");
  assert.equal(host.querySelectorAll(".meta-folder__thumbs img").length, 2);
  assert.equal(host.querySelector(".meta-folder__name").textContent, "Fashion Photography");
  assert.match(host.querySelector(".meta-folder__count").textContent, /3 pieces/);
  dom.window.close();
});

test("dense credits become role and name rows without touching prose", async () => {
  const dom = await page("post.html", "post.html?slug=beauty-obsession");
  const w = dom.window;
  evaluate(w, "post.js");
  const format = w.NaMeStoryCopy.formatStoryCopy;
  const credits = `
Beauty obsession

Photographer / Creative Director / Producer @jingnanaaaaaaa
Models @amywanglalalala @salvepaprika
Fashion Designer: Shaorui
IG: shaorui_mmmmm
Studio @pine_apple_ji@nyps.lab
`;
  const host = w.document.createElement("div");
  host.innerHTML = format(credits);
  const rows = [...host.querySelectorAll(".post-credits__row")];
  assert.equal(rows[0].querySelector("dt").textContent, "Photographer / Creative Director / Producer");
  assert.equal(rows[0].querySelector("dd").textContent, "@jingnanaaaaaaa");
  assert.equal(rows[1].querySelector("dt").textContent, "Models");
  assert.match(host.textContent, /Beauty obsession/);
  const designer = rows.find((row) => row.querySelector("dt").textContent === "Fashion Designer");
  assert.match(designer.querySelector("dd").textContent, /Shaorui/);
  assert.match(designer.querySelector("dd").textContent, /shaorui_mmmmm/);
  assert.match(host.textContent, /@pine_apple_ji @nyps\.lab/);

  const prose = format("<script>alert(1)</script><p>A study in light and paper.</p>");
  assert.equal(prose.includes("alert"), false);
  assert.match(prose, /<p>A study in light and paper\.<\/p>/);
  dom.window.close();
});

test("listing, article, and artists pages share the main nav and footer", () => {
  for (const name of ["stories.html", "artists.html", "post.html", "editorial.html"]) {
    const dom = new JSDOM(source(name));
    const doc = dom.window.document;
    assert.ok(doc.querySelector('.header__nav a[href="stories.html"]'), `${name} nav`);
    assert.ok(doc.querySelector('.header__actions a[href="submission.html"]'), `${name} submission`);
    assert.ok(doc.querySelector('.footer__links a[href="terms.html"]'), `${name} terms`);
    assert.ok(doc.querySelector('.footer__links a[href="privacy.html"]'), `${name} privacy`);
    assert.ok(doc.querySelector(".footer__social a[href*='instagram.com']"), `${name} instagram`);
    assert.equal(doc.querySelector(".header__secondary--solo"), null, `${name} solo header`);
    dom.window.close();
  }
});
