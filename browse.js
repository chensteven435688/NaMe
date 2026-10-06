/**
 * NaMe — Magazine / Editorial / Articles browse pages
 */
const STORY_TYPES = new Set(["article", "editorial", "film", "short"]);

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
      NaMePinOps.detach(grid);
      grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, emptyKey))}</p>`;
      return;
    }
    initArchiveSearch(grid, posts, emptyKey);
    storyViewReady = true;
  } catch {
    NaMePinOps.detach(grid);
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
    NaMePinOps.detach(grid);
    grid.classList.remove("browse-grid--folders");
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionsEmpty"))}</p>`;
    folderViewReady = true;
  }
}

function renderExclusiveFolderIndex(grid, folders, lang, pagePath) {
  NaMePinOps.detach(grid);
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
  const leadHtml = `
    <div class="meta-folder-bar">
      <a class="meta-folder-bar__back" href="${escapeHtml(exclusivePageHref(null, pagePath))}">${escapeHtml(NaMeI18n.t(lang, "exclusiveBackCollections"))}</a>
      <h2 class="meta-folder-bar__title">${escapeHtml(title)}</h2>
    </div>`;
  if (!posts.length) {
    NaMePinOps.detach(grid);
    grid.innerHTML = `${leadHtml}<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionEmpty"))}</p>`;
    return;
  }
  mountStoryBoard(grid, posts, false, false, "exclusiveCollectionEmpty", cardClass || "card--exclusive", leadHtml);
}

function mountStoryBoard(grid, posts, showMeta, showType, emptyKey, cardClass, leadHtml) {
  NaMePinOps.attach(grid, {
    kind: "story",
    items: posts,
    leadHtml: leadHtml || "",
    emptyClass: "browse-grid__empty",
    emptyHtml: `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(NaMeI18n.getLang(), emptyKey))}</p>`,
    renderItem: (post) =>
      NaMePinOps.storyCardHtml(post, {
        cardClass: cardClass || `card--${post.type || "article"}`,
        showMeta,
        showType,
      }),
  });
}

let folderViewReady = false;
let storyViewReady = false;

document.addEventListener("name:languagechange", () => {
  const grid = document.getElementById("browse-grid");
  if (!grid) return;
  if (document.body.dataset.browseAll === "true") {
    if (!storyViewReady) return;
    loadAllStoriesFeed(grid);
    return;
  }
  if (!folderViewReady || !document.body.dataset.browseType) return;
  loadSectionFolders(grid);
});

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function initArchiveSearch(grid, posts, emptyKey) {
  let form = document.getElementById("archive-search");
  if (!form) {
    form = document.createElement("form");
    form.id = "archive-search";
    form.className = "archive-search";
    form.setAttribute("role", "search");
    form.innerHTML = `<label><span data-i18n="archiveSearch">Search the archive</span><input type="search" name="q" autocomplete="off" /></label><button class="btn btn--ghost" type="reset" data-i18n="clearFilters">Clear</button><span class="archive-search__count" role="status"></span>`;
    grid.before(form);
    form.elements.q.value = new URLSearchParams(location.search).get("q") || "";
    let timer;
    form.addEventListener("input", () => { clearTimeout(timer); timer = setTimeout(() => form.applySearch(), 150); });
    form.addEventListener("submit", (event) => { event.preventDefault(); clearTimeout(timer); form.applySearch(); });
    form.addEventListener("reset", () => { clearTimeout(timer); setTimeout(() => { form.applySearch(); form.elements.q.focus(); }, 0); });
  }
  form.applySearch = () => {
    const q = form.elements.q.value.trim().toLocaleLowerCase();
    const matches = posts.filter((post) => `${post.title || ""} ${post.meta || ""} ${post.type || ""}`.toLocaleLowerCase().includes(q));
    mountStoryBoard(grid, matches, true, true, q ? "atelierEmpty" : emptyKey);
    form.querySelector('[role="status"]').textContent = `${matches.length} / ${posts.length}`;
    const url = new URL(location.href);
    if (q) url.searchParams.set("q", form.elements.q.value.trim());
    else url.searchParams.delete("q");
    history.replaceState(history.state, "", url);
  };
  form.applySearch();
  form.querySelectorAll('[data-i18n]').forEach((el) => {
    el.textContent = NaMeI18n.t(NaMeI18n.getLang(), el.dataset.i18n);
  });
}
