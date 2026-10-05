/**
 * NaMe — Magazine / Editorial / Articles browse pages
 */
const STORY_TYPES = new Set(["article", "editorial", "film", "short"]);

const TYPE_I18N = {
  article: "article",
  editorial: "editorial",
  film: "film",
  short: "shorts",
};

async function loadBrowseFeed() {
  const grid = document.getElementById("browse-grid");
  if (!grid) return;

  const { browseAll, browseType } = document.body.dataset;

  if (browseAll === "true") {
    await loadAllStoriesFeed(grid);
    return;
  }

  if (!browseType) return;

  await loadSectionFolders(grid);
}

async function loadAllStoriesFeed(grid) {
  const lang = NaMeI18n.getLang();
  const emptyKey = document.body.dataset.browseEmpty || "storiesEmpty";

  try {
    const posts = (await NaMeAuth.fetchPosts({})).filter((p) => STORY_TYPES.has(p.type));
    if (!posts.length) {
      grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, emptyKey))}</p>`;
      return;
    }
    grid.innerHTML = posts
      .map((p) => renderBrowseCard(p, `card--${p.type}`, true, true))
      .join("");
  } catch {
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, emptyKey))}</p>`;
  }
}

function folderPagePath() {
  const url = new URL(location.href);
  url.searchParams.delete("meta");
  return `${url.pathname}${url.search}`;
}

async function loadSectionFolders(grid) {
  const lang = NaMeI18n.getLang();
  const { browseType, browseSection, browseCard } = document.body.dataset;
  const query = new URLSearchParams(location.search);
  const type = query.get("feed") === "short" ? "short" : browseType;
  const cardClass = type === "short" ? "card--short" : browseCard || `card--${type}`;
  const pagePath = folderPagePath();
  try {
    const params = { type };
    if (type !== "short" && browseSection) params.section = browseSection;
    const [posts, declared] = await Promise.all([
      NaMeAuth.fetchPosts(params),
      type === "exclusive" ? NaMeAuth.fetchExclusiveMetas().catch(() => []) : Promise.resolve([]),
    ]);
    if (!posts.length && !declared.length && !query.get("meta")) {
      const home = typeof NaMeBase !== "undefined" ? NaMeBase.path("/") : "/";
      window.location.replace(home);
      return;
    }
    const folders = buildExclusiveFolders(posts, declared);
    const selected = query.get("meta");
    if (selected) renderExclusiveFolder(grid, folders, selected, lang, cardClass, pagePath);
    else renderExclusiveFolderIndex(grid, folders, lang, pagePath);
    folderViewReady = true;
  } catch {
    grid.classList.remove("browse-grid--folders");
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionsEmpty"))}</p>`;
    folderViewReady = true;
  }
}

function renderExclusiveFolderIndex(grid, folders, lang, pagePath) {
  if (!folders.length) {
    grid.classList.remove("browse-grid--folders");
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionsEmpty"))}</p>`;
    return;
  }
  grid.classList.add("browse-grid--folders");
  grid.innerHTML = folders
    .map((folder) => renderExclusiveFolderCard(folder, lang, pagePath))
    .join("");
}

function renderExclusiveFolder(grid, folders, selected, lang, cardClass, pagePath) {
  grid.classList.remove("browse-grid--folders");
  const key = selected.toLowerCase();
  const folder = folders.find((item) => {
    const name = item.uncategorized ? EXCLUSIVE_UNCATEGORIZED : item.name;
    return name.toLowerCase() === key;
  });
  const title = folder?.uncategorized
    ? NaMeI18n.t(lang, "exclusiveUncategorized")
    : folder?.name || NaMeAuth.exclusiveCollectionName(selected) || selected;
  const posts = folder?.posts || [];
  const cards = posts.length
    ? posts.map((post) => renderBrowseCard(post, cardClass || "card--exclusive", false)).join("")
    : `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionEmpty"))}</p>`;
  grid.innerHTML = `
    <div class="meta-folder-bar">
      <a class="meta-folder-bar__back" href="${escapeHtml(exclusivePageHref(null, pagePath))}">${escapeHtml(NaMeI18n.t(lang, "exclusiveBackCollections"))}</a>
      <h2 class="meta-folder-bar__title">${escapeHtml(title)}</h2>
    </div>
    ${cards}`;
}

function renderBrowseCard(post, cardClass, showMeta, showType = false) {
  const href = `${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(post.slug)}`;
  const meta = showMeta && post.meta ? `<p class="card__meta">${escapeHtml(post.meta)}</p>` : "";
  const typeKey = TYPE_I18N[post.type];
  const typeLabel =
    showType && typeKey
      ? `<span class="card__type">${escapeHtml(NaMeI18n.t(NaMeI18n.getLang(), typeKey))}</span>`
      : "";
  return `
    <a href="${href}" class="card ${cardClass}">
      <div class="card__img"><img src="${escapeHtml(post.imageUrl || "")}" alt="${escapeHtml(post.title)}" loading="lazy" /></div>
      ${typeLabel}
      ${meta}
      <h3 class="card__title">${escapeHtml(post.title)}</h3>
    </a>`;
}

let folderViewReady = false;

document.addEventListener("name:languagechange", () => {
  const grid = document.getElementById("browse-grid");
  if (!folderViewReady || !grid || !document.body.dataset.browseType || document.body.dataset.browseAll === "true") {
    return;
  }
  loadSectionFolders(grid);
});

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
