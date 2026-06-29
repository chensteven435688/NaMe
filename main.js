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
  await NaMeAuth.refresh();
  NaMeI18n.init();
  NaMeAuth.initUI();
  await initHomepage();
  loadFeeds();
  initScrollReveal();
});

async function initHomepage() {
  const heroSlides = await loadHeroSlides();
  initHero(heroSlides);
  await loadHomeIndex();
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
  exclusive: { type: "exclusive", cardClass: "card--exclusive", showMeta: true },
  article: { type: "article", section: "latest", cardClass: "card--article", showMeta: true },
  "editorial-latest": { type: "editorial", section: "latest", cardClass: "card--editorial" },
  "editorial-popular": { type: "editorial", section: "popular", cardClass: "card--editorial" },
  film: { type: "film", section: "latest", cardClass: "card--film" },
  short: { type: "short", section: "latest", cardClass: "card--short" },
};

async function loadFeeds() {
  for (const el of document.querySelectorAll("[data-feed]")) {
    const key = el.dataset.feed;
    const cfg = FEED_CONFIG[key];
    if (!cfg) continue;
    try {
      const posts = await NaMeAuth.fetchPosts({
        type: cfg.type,
        section: cfg.section,
      });
      el.innerHTML = posts.map((p) => renderCard(p, cfg)).join("");
    } catch {
      el.innerHTML = "";
    }
  }
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
  d.textContent = s;
  return d.innerHTML;
}

const CAROUSEL_MAP = {
  exclusive: "carousel-exclusive",
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

  if (!sessionStorage.getItem("name-modal-seen")) {
    setTimeout(() => {
      open();
      sessionStorage.setItem("name-modal-seen", "1");
    }, 2500);
  }
})();
