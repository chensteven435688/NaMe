/**
 * NaMe Magazine — homepage & interactions
 */

const HERO_SLIDES = [1, 2, 3, 4, 5, 6, 7].map((n) => ({
  title: `Cover slide ${n}`,
  imageUrl: heroImagePath(n),
}));

function heroImagePath(n) {
  const path = `/images/hero/hero-${n}.png`;
  return typeof NaMeBase !== "undefined" ? NaMeBase.path(path) : path;
}

const TYPE_I18N = {
  article: "article",
  editorial: "editorial",
  film: "film",
  short: "shorts",
  exclusive: "exclusiveLabel",
};

document.addEventListener("DOMContentLoaded", async () => {
  const startedAt = performance.now();
  try {
    await NaMeAuth.refresh();
    NaMeI18n.init();
    NaMeAuth.initUI();
    await initHomepage();
    await loadFeeds();
    initScrollReveal();
    await waitForCriticalImages();
  } finally {
    await revealPage(startedAt);
  }
});

const PAGE_LOADER_MIN_MS = 0;
const CRITICAL_IMAGE_TIMEOUT_MS = 4500;

function waitForCriticalImages() {
  const imgs = [...document.querySelectorAll(".atelier-piece img, .hero__slide img")].slice(0, 3);
  if (!imgs.length) return Promise.resolve();

  return Promise.all(
    imgs.map(
      (img) =>
        new Promise((resolve) => {
          if (img.complete && img.naturalWidth > 0) {
            resolve();
            return;
          }
          const done = () => resolve();
          img.addEventListener("load", done, { once: true });
          img.addEventListener("error", done, { once: true });
          setTimeout(done, CRITICAL_IMAGE_TIMEOUT_MS);
        })
    )
  );
}

async function revealPage(startedAt = performance.now()) {
  const elapsed = performance.now() - startedAt;
  const remaining = PAGE_LOADER_MIN_MS - elapsed;
  if (remaining > 0) {
    await new Promise((resolve) => setTimeout(resolve, remaining));
  }

  document.body.classList.add("is-page-ready");
  document.dispatchEvent(new CustomEvent("name:page-ready"));

  const loader = document.getElementById("page-loader");
  if (!loader) return;

  loader.classList.add("is-done");
  loader.setAttribute("aria-busy", "false");
  const remove = () => loader.remove();
  loader.addEventListener("transitionend", remove, { once: true });
  setTimeout(remove, 800);
}

async function initHomepage() {
  if (document.getElementById("atelier-gallery")) {
    await initAtelier();
    return;
  }
  const heroSlides = await loadHeroSlides();
  initHero(heroSlides);
  await loadHomeIndex();
}

let atelierPosts = [];
let atelierMetas = [];

async function initAtelier() {
  try {
    const [posts, metas] = await Promise.all([
      NaMeAuth.fetchPosts({}),
      NaMeAuth.fetchExclusiveMetas().catch(() => []),
    ]);
    atelierPosts = posts;
    atelierMetas = metas;
  } catch {
    atelierPosts = [];
    atelierMetas = [];
  }

  const form = document.getElementById("atelier-tools");
  const filter = document.getElementById("atelier-filter");
  const search = document.getElementById("atelier-search");

  form?.addEventListener("submit", (event) => {
    event.preventDefault();
    renderAtelier();
  });
  filter?.addEventListener("change", () => renderAtelier());
  search?.addEventListener("input", () => renderAtelier());
  document.getElementById("atelier-chips")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-type]");
    if (!btn || !filter) return;
    filter.value = filter.value === btn.dataset.type ? "" : btn.dataset.type;
    renderAtelier();
  });
  document.addEventListener("name:languagechange", () => renderAtelier());
  renderAtelier();
}

function atelierSource() {
  if (atelierPosts.length) return atelierPosts;
  return [1, 2, 3].map((n, i) => ({
    slug: "",
    type: ["editorial", "article", "film"][i],
    title: ["Before the Name", "Cover study", "New voices"][i],
    meta: "Photography, film, and writing from voices still becoming known.",
    imageUrl: heroImagePath(n),
  }));
}

function stripHtml(value) {
  const node = document.createElement("div");
  node.innerHTML = value || "";
  return (node.textContent || "").replace(/\s+/g, " ").trim();
}

function clipText(value, max) {
  const text = (value || "").replace(/\s+/g, " ").trim();
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, "")}…`;
}

function storyBlurb(post) {
  const fromBody = stripHtml(post.body);
  if (fromBody.length > 36) return clipText(fromBody, 148);
  if (post.meta) return clipText(stripHtml(post.meta), 148);
  return "";
}

function renderAtelier() {
  const gallery = document.getElementById("atelier-gallery");
  const countEl = document.getElementById("atelier-count");
  const chips = document.getElementById("atelier-chips");
  if (!gallery) return;

  const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
  const filter = document.getElementById("atelier-filter")?.value || "";
  const query = (document.getElementById("atelier-search")?.value || "").trim().toLowerCase();
  const source = atelierSource();

  const types = [...new Set(source.map((post) => post.type).filter(Boolean))].slice(0, 4);
  if (chips) {
    chips.innerHTML = types
      .map((type) => {
        const typeKey = TYPE_I18N[type] || "article";
        const label = typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, typeKey) : type;
        const active = filter === type ? " is-active" : "";
        return `<button type="button" class="atelier-chip${active}" data-type="${escapeHtml(type)}" aria-pressed="${filter === type}"><span class="atelier-chip__mark" aria-hidden="true">${escapeHtml(label.slice(0, 1))}</span>${escapeHtml(label)}</button>`;
      })
      .join("");
  }

  if (filter === "exclusive") {
    renderAtelierExclusive(gallery, countEl, lang, query, source);
    return;
  }

  gallery.classList.remove("is-folders");
  gallery.classList.toggle("is-filtered", Boolean(filter || query));

  const matches = source.filter((post) => {
    if (filter && post.type !== filter) return false;
    if (!query) return true;
    const haystack = `${post.title || ""} ${post.meta || ""} ${stripHtml(post.body)}`.toLowerCase();
    return haystack.includes(query);
  });

  if (countEl) countEl.textContent = String(matches.length);

  if (!matches.length) {
    const emptyText =
      typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "atelierEmpty") : "No stories match.";
    gallery.innerHTML = `<p class="atelier__empty">${escapeHtml(emptyText)}</p>`;
    return;
  }

  // Browsing shows an editorial selection; searching exposes every match.
  const visible = filter || query ? matches : matches.slice(0, 3);
  gallery.innerHTML = visible
    .map((post, index) => atelierPieceHtml(post, ["left", "center", "right"][index % 3], lang))
    .join("");
}

function renderAtelierExclusive(gallery, countEl, lang, query, source) {
  const exclusivePosts = source.filter((post) => post.type === "exclusive");
  let folders =
    typeof buildExclusiveFolders === "function"
      ? buildExclusiveFolders(exclusivePosts, atelierMetas)
      : [];
  if (query) {
    folders = folders.filter((folder) => {
      const label = folder.uncategorized
        ? typeof NaMeI18n !== "undefined"
          ? NaMeI18n.t(lang, "exclusiveUncategorized")
          : folder.name
        : folder.name;
      return label.toLowerCase().includes(query);
    });
  }

  if (countEl) countEl.textContent = String(folders.length);
  gallery.classList.add("is-filtered", "is-folders");
  if (!folders.length) {
    const emptyText =
      typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "atelierEmpty") : "No stories match.";
    gallery.innerHTML = `<p class="atelier__empty">${escapeHtml(emptyText)}</p>`;
    return;
  }
  gallery.innerHTML = folders
    .map((folder) => renderExclusiveFolderCard(folder, lang))
    .join("");
}

function atelierPieceHtml(post, slot, lang) {
  if (!post) return "";
  const href = post.slug
    ? postHref(post.slug)
    : typeof NaMeBase !== "undefined"
      ? NaMeBase.path("/stories.html")
      : "stories.html";
  const typeKey = TYPE_I18N[post.type] || "article";
  const typeLabel = typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, typeKey) : post.type;
  const blurb = storyBlurb(post);
  const copy = `<span class="atelier-piece__copy">
          <span class="atelier-piece__kicker">${escapeHtml(typeLabel)}</span>
          <span class="atelier-piece__title">${escapeHtml(post.title)}</span>
          ${blurb ? `<span class="atelier-piece__text">${escapeHtml(blurb)}</span>` : ""}
        </span>`;

  return `
    <a class="atelier-piece atelier-piece--${slot}" href="${href}">
      <span class="atelier-piece__frame">
        <img src="${escapeHtml(post.imageUrl || "")}" alt="${escapeHtml(post.title || "")}" decoding="async" />
      </span>
      ${copy}
    </a>`;
}

async function loadHeroSlides() {
  return HERO_SLIDES;
}

function postHref(slug) {
  const base = typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html";
  return `${base}?slug=${encodeURIComponent(slug)}`;
}

function initHero(slides) {
  const media = document.getElementById("hero-media");
  if (!media || !slides.length) return;

  const slideMarkup = slides
    .map(
      (slide, i) => `
    <figure class="hero__slide">
      <img src="${escapeHtml(slide.imageUrl || "")}" alt="${escapeHtml(slide.title)}" ${i < 2 ? "" : 'loading="lazy"'} />
    </figure>`
    )
    .join("");

  media.innerHTML = `
    <div class="hero__fit">
      <div class="hero__track">
        <div class="hero__set">${slideMarkup}</div>
        <div class="hero__set" aria-hidden="true">${slideMarkup}</div>
      </div>
    </div>`;

  fitHeroStrip();
  window.addEventListener("resize", fitHeroStrip, { passive: true });
  media.querySelectorAll("img").forEach((img) => {
    if (img.complete) return;
    img.addEventListener("load", fitHeroStrip, { once: true });
  });
}

function fitHeroStrip() {
  const hero = document.getElementById("hero");
  const fit = document.querySelector(".hero__fit");
  if (!hero || !fit) return;

  const count = HERO_SLIDES.length || 7;
  const naturalH = hero.clientWidth * (1024 / (count * 819));
  if (!naturalH) return;

  const scale = Math.min(Math.max(1, hero.clientHeight / naturalH), 1.35);
  fit.style.setProperty("--hero-strip-scale", String(scale));
}

async function loadHomeIndex() {
  const list = document.getElementById("home-index-list");
  if (!list) return;

  const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
  const emptyText =
    typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "homeIndexEmpty") : "No stories yet.";

  try {
    const posts = (await NaMeAuth.fetchPosts({})).slice(0, 8);
    if (!posts.length) {
      list.innerHTML = `<li class="home-index__empty">${escapeHtml(emptyText)}</li>`;
      return;
    }

    list.innerHTML = posts
      .map((post, i) => {
        const typeKey = TYPE_I18N[post.type] || "article";
        const typeLabel = typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, typeKey) : post.type;
        return `
      <li class="home-index__item">
        <a href="${postHref(post.slug)}" class="home-index__link">
          <span class="home-index__num">${String(i + 1).padStart(2, "0")}</span>
          <span class="home-index__type">${escapeHtml(typeLabel)}</span>
          <span class="home-index__name">${escapeHtml(post.title)}</span>
          ${
            post.imageUrl
              ? `<img class="home-index__preview" src="${escapeHtml(post.imageUrl)}" alt="" loading="lazy" />`
              : ""
          }
        </a>
      </li>`;
      })
      .join("");
  } catch {
    list.innerHTML = `<li class="home-index__empty">${escapeHtml(emptyText)}</li>`;
  }
}

const FEED_CONFIG = {
  article: { type: "article", section: "latest", cardClass: "card--article", showMeta: true },
  "editorial-latest": { type: "editorial", section: "latest", cardClass: "card--editorial" },
  "editorial-popular": { type: "editorial", section: "popular", cardClass: "card--editorial" },
  film: { type: "film", section: "latest", cardClass: "card--film" },
  short: { type: "short", section: "latest", cardClass: "card--short" },
};

const HOME_SECTION_FOR_FEED = {
  exclusive: "exclusive",
  article: "articles",
  "editorial-latest": "editorial",
  "editorial-popular": "magazine",
};

function hideBlock(el) {
  if (!el) return;
  el.hidden = true;
  el.classList.add("is-empty-section");
}

async function loadExclusiveHome() {
  const el = document.getElementById("home-meta-folders");
  if (!el || typeof buildExclusiveFolders !== "function") return 0;
  try {
    const [posts, declared] = await Promise.all([
      NaMeAuth.fetchPosts({ type: "exclusive" }),
      NaMeAuth.fetchExclusiveMetas().catch(() => []),
    ]);
    const folders = buildExclusiveFolders(posts, declared);
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    el.innerHTML = folders.map((folder) => renderExclusiveFolderCard(folder, lang)).join("");
    return folders.length;
  } catch {
    el.innerHTML = "";
    return 0;
  }
}

let homeFoldersReady = false;

document.addEventListener("name:languagechange", () => {
  if (!homeFoldersReady) return;
  loadFeeds();
});

async function loadFeeds() {
  const counts = {};
  if (document.getElementById("home-meta-folders")) {
    counts.exclusive = await loadExclusiveHome();
    homeFoldersReady = true;
  }
  for (const el of document.querySelectorAll("[data-feed]")) {
    const key = el.dataset.feed;
    const cfg = FEED_CONFIG[key];
    if (!cfg) continue;
    try {
      const posts = await NaMeAuth.fetchPosts({
        type: cfg.type,
        section: cfg.section,
      });
      if (el.classList.contains("home-meta-folders")) {
        const folders = buildExclusiveFolders(posts, []);
        const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
        el.innerHTML = folders
          .map((folder) => renderExclusiveFolderCard(folder, lang, el.dataset.folderPage))
          .join("");
        counts[key] = folders.length;
      } else {
        counts[key] = posts.length;
        el.innerHTML = posts.map((p) => renderCard(p, cfg)).join("");
      }
    } catch {
      el.innerHTML = "";
    }
  }

  for (const [feed, id] of Object.entries(HOME_SECTION_FOR_FEED)) {
    if (counts[feed] === 0) hideBlock(document.getElementById(id));
  }

  const filmSection = document.getElementById("film");
  if (!filmSection || counts.film === undefined || counts.short === undefined) return;
  if (counts.film === 0 && counts.short === 0) {
    hideBlock(filmSection);
    return;
  }
  if (counts.film === 0) {
    hideBlock(filmSection.querySelector(".section__head"));
    hideBlock(document.getElementById("home-films"));
  }
  if (counts.short === 0) hideBlock(filmSection.querySelector(".shorts"));
}

function renderCard(post, cfg) {
  const href = postHref(post.slug);
  const meta = cfg.showMeta && post.meta ? `<p class="card__meta">${escapeHtml(post.meta)}</p>` : "";
  const title =
    cfg.cardClass === "card--short"
      ? ""
      : `<h3 class="card__title">${escapeHtml(post.title)}</h3>`;
  return `
    <a href="${href}" class="card ${cfg.cardClass}">
      <div class="card__img"><img src="${escapeHtml(post.imageUrl || "")}" alt="${escapeHtml(post.title)}" loading="lazy" /></div>
      ${meta}
      ${title}
    </a>`;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

const CAROUSEL_MAP = {
  articles: "carousel-articles",
  "editorials-latest": "carousel-editorials-latest",
  "editorials-popular": "carousel-editorials-popular",
  films: "carousel-films",
  shorts: "carousel-shorts",
};

document.querySelectorAll("[data-carousel]").forEach((btn) => {
  btn.addEventListener("click", () => {
    const id = CAROUSEL_MAP[btn.dataset.carousel];
    const el = document.getElementById(id);
    if (!el) return;
    const dir = Number(btn.dataset.dir);
    const card = el.querySelector(".card");
    const gap = 16;
    const step = card ? card.offsetWidth + gap : 300;
    el.scrollBy({ left: dir * step, behavior: "smooth" });
  });
});

(function initHeaderScroll() {
  const header = document.getElementById("header");
  if (!header) return;

  let lastY = 0;
  window.addEventListener(
    "scroll",
    () => {
      const y = window.scrollY;
      if (y > 120 && y > lastY) {
        header.classList.add("header--hidden");
      } else {
        header.classList.remove("header--hidden");
      }
      lastY = y;
    },
    { passive: true }
  );
})();

function initScrollReveal() {
  const targets = document.querySelectorAll(".home-reveal");
  if (!targets.length || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
  );

  targets.forEach((el) => observer.observe(el));
}

(function initModal() {
  const modal = document.getElementById("member-modal");
  if (!modal) return;

  const open = () => {
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
  };

  const close = () => {
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  };

  modal.querySelectorAll("[data-close-modal]").forEach((el) => {
    el.addEventListener("click", close);
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && modal.classList.contains("is-open")) close();
  });

  // Membership stays available through Login / Join without interrupting reading.
})();
