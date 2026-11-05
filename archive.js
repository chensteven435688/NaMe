/**
 * Archive — a back-of-book index of published stories, grouped by the
 * formats the magazine already uses. Empty formats are left off the page.
 */
const ARCHIVE_GROUPS = [
  {
    id: "magazine",
    labelKey: "magazine",
    match: (post) => post.type === "editorial" && post.section === "popular",
  },
  {
    id: "editorial",
    labelKey: "editorial",
    match: (post) => post.type === "editorial" && post.section !== "popular",
  },
  { id: "article", labelKey: "article", match: (post) => post.type === "article" },
  { id: "film", labelKey: "film", match: (post) => post.type === "film" },
  { id: "short", labelKey: "shorts", match: (post) => post.type === "short" },
  { id: "exclusive", labelKey: "editorsExclusive", match: (post) => post.type === "exclusive" },
  { id: "artists", labelKey: "artists", match: (post) => post.type === "artists" },
];

const ARCHIVE_DATE_LOCALE = {
  en: "en-US",
  ko: "ko-KR",
  it: "it-IT",
  fr: "fr-FR",
  es: "es-ES",
  ja: "ja-JP",
  "zh-Hans": "zh-CN",
  "zh-Hant": "zh-TW",
};

let archiveCatalog = null;

function archiveEscape(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function archiveTime(post) {
  const value = Date.parse(post?.publishedAt || post?.published_at || "");
  return Number.isNaN(value) ? 0 : value;
}

function archiveSlug(post) {
  return String(post?.slug || "").trim();
}

function groupArchive(posts) {
  const list = Array.isArray(posts) ? posts : [];
  const sorted = list
    .filter((post) => post && typeof post === "object" && archiveSlug(post))
    .sort((a, b) => archiveTime(b) - archiveTime(a) || archiveSlug(a).localeCompare(archiveSlug(b)));
  const seen = new Set();
  const unique = [];
  for (const post of sorted) {
    const slug = archiveSlug(post);
    if (seen.has(slug)) continue;
    seen.add(slug);
    unique.push(post);
  }

  const groups = [];
  for (const group of ARCHIVE_GROUPS) {
    const items = unique.filter(group.match);
    if (!items.length) continue;
    groups.push({
      id: group.id,
      labelKey: group.labelKey,
      count: items.length,
      posts: items,
    });
  }
  return groups;
}

function formatArchiveDate(iso, lang) {
  const date = new Date(iso || "");
  if (Number.isNaN(date.getTime())) return "";
  const locale = ARCHIVE_DATE_LOCALE[lang] || "en-US";
  return date.toLocaleDateString(locale, { year: "numeric", month: "short", day: "numeric" });
}

function archivePostHref(slug) {
  const path = typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html";
  return `${path}?slug=${encodeURIComponent(slug)}`;
}

function archiveLabel(lang, key) {
  if (typeof NaMeI18n === "undefined") return key;
  return NaMeI18n.t(lang, key);
}

function renderArchive(posts) {
  const root = document.getElementById("archive-root");
  const counts = document.getElementById("archive-counts");
  if (!root) return;
  archiveCatalog = Array.isArray(posts) ? posts : [];
  const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
  const groups = groupArchive(archiveCatalog);

  if (!groups.length) {
    if (counts) {
      counts.textContent = "";
      counts.hidden = true;
    }
    root.innerHTML = `<p class="archive-empty">${archiveEscape(archiveLabel(lang, "archiveEmpty"))}</p>`;
    return;
  }

  if (counts) {
    counts.hidden = false;
    counts.textContent = groups
      .map((group) => `${archiveLabel(lang, group.labelKey)} ${group.count}`)
      .join(" · ");
  }

  root.innerHTML = groups
    .map((group) => {
      const rows = group.posts
        .map((post) => {
          const slug = archiveSlug(post);
          const title = String(post.title || "").trim() || slug;
          const iso = post.publishedAt || post.published_at || "";
          const date = formatArchiveDate(iso, lang);
          const time = date
            ? `<time class="archive-entry__date" datetime="${archiveEscape(iso)}">${archiveEscape(date)}</time>`
            : "";
          return `<li><a class="archive-entry" href="${archiveEscape(archivePostHref(slug))}"><span class="archive-entry__title">${archiveEscape(title)}</span>${time}</a></li>`;
        })
        .join("");
      return `<section class="archive-group" data-archive-group="${archiveEscape(group.id)}">
        <h2 class="archive-group__title"><span class="archive-group__name">${archiveEscape(archiveLabel(lang, group.labelKey))}</span><span class="archive-group__count">${group.count}</span></h2>
        <ol class="archive-list">${rows}</ol>
      </section>`;
    })
    .join("");
}

async function collectCatalog(search) {
  const posts = [];
  const seen = new Set();
  let offset = 0;
  let total = Infinity;
  while (posts.length < total && offset < 5000) {
    const page = await search({ limit: 50, offset });
    const batch = Array.isArray(page?.posts) ? page.posts : [];
    const reported = Number(page?.total);
    if (Number.isFinite(reported)) total = reported;
    if (!batch.length) break;
    let added = 0;
    for (const post of batch) {
      const slug = archiveSlug(post);
      if (!slug || seen.has(slug)) continue;
      seen.add(slug);
      posts.push(post);
      added += 1;
    }
    if (!added) break;
    offset += batch.length;
  }
  return posts;
}

async function fetchCatalog() {
  if (typeof NaMeAuth !== "undefined" && typeof NaMeAuth.searchPosts === "function") {
    // searchPosts pages the live catalog. fetchPosts stops at 200 rows.
    return collectCatalog((query) => NaMeAuth.searchPosts(query));
  }
  if (typeof NaMeAuth !== "undefined" && typeof NaMeAuth.fetchPosts === "function") {
    const posts = await NaMeAuth.fetchPosts({});
    return Array.isArray(posts) ? posts : [];
  }
  return [];
}

async function loadArchive() {
  const root = document.getElementById("archive-root");
  if (!root || root.dataset.archiveLoading === "1") return;
  root.dataset.archiveLoading = "1";
  try {
    const posts = await fetchCatalog();
    root.dataset.archiveLoading = "0";
    renderArchive(posts);
  } catch {
    root.dataset.archiveLoading = "0";
    archiveCatalog = null;
    const counts = document.getElementById("archive-counts");
    if (counts) {
      counts.textContent = "";
      counts.hidden = true;
    }
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    root.innerHTML = `<p class="archive-empty">${archiveEscape(archiveLabel(lang, "archiveError"))}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  if (!document.getElementById("archive-root")) return;
  loadArchive();
});

document.addEventListener("name:languagechange", () => {
  if (!document.getElementById("archive-root") || !archiveCatalog) return;
  renderArchive(archiveCatalog);
});

if (typeof window !== "undefined") {
  window.NaMeArchive = {
    ARCHIVE_GROUPS,
    groupArchive,
    formatArchiveDate,
    collectCatalog,
    renderArchive,
  };
}
