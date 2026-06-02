/**
 * NaMe Magazine — interactions
 */

document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();
  await NaMeAuth.refresh();
  NaMeAuth.initUI();
  loadFeeds();
});

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
  const href = `/post.html?slug=${encodeURIComponent(post.slug)}`;
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

// ─── Hero slideshow ───
(function initHero() {
  const slides = document.querySelectorAll(".hero__slide");
  const dotsContainer = document.getElementById("hero-dots");
  if (!slides.length || !dotsContainer) return;

  let current = 0;
  let timer;

  slides.forEach((_, i) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "hero__dot" + (i === 0 ? " hero__dot--active" : "");
    dot.addEventListener("click", () => goTo(i));
    dotsContainer.appendChild(dot);
  });

  document.addEventListener("name:languagechange", () => {
    const lang = NaMeI18n.getLang();
    dotsContainer.querySelectorAll(".hero__dot").forEach((dot, i) => {
      dot.setAttribute("aria-label", `${NaMeI18n.t(lang, "slide")} ${i + 1}`);
    });
  });

  const dots = dotsContainer.querySelectorAll(".hero__dot");

  function goTo(index) {
    slides[current].classList.remove("hero__slide--active");
    dots[current].classList.remove("hero__dot--active");
    current = (index + slides.length) % slides.length;
    slides[current].classList.add("hero__slide--active");
    dots[current].classList.add("hero__dot--active");
    resetTimer();
  }

  function resetTimer() {
    clearInterval(timer);
    timer = setInterval(() => goTo(current + 1), 6000);
  }

  resetTimer();
})();

// ─── Carousels ───
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

// ─── Header hide on scroll ───
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

// ─── Member modal ───
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

  // Show once per session after a short delay (like PAP)
  if (!sessionStorage.getItem("name-modal-seen")) {
    setTimeout(() => {
      open();
      sessionStorage.setItem("name-modal-seen", "1");
    }, 2500);
  }
})();

// ─── Newsletter form ───
document.querySelector(".newsletter__form")?.addEventListener("submit", (e) => {
  e.preventDefault();
  const input = e.target.querySelector("input[type=email]");
  if (input?.value) {
    alert(NaMeI18n.t(NaMeI18n.getLang(), "newsletterThanks"));
    input.value = "";
  }
});
