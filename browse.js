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
  const emptyKey = document.body.dataset.browseEmpty || "storiesEmpty";
  try {
    await initArchiveSearch(grid, emptyKey);
  } catch {
    NaMePinOps.detach(grid);
    grid.innerHTML = emptyParagraph(emptyKey);
  }
  storyViewReady = true;
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

function mountStoryBoard(grid, posts, showMeta, showType, emptyKey, cardClass, leadHtml, paging) {
  const options = {
    kind: "story",
    items: posts,
    leadHtml: leadHtml || "",
    emptyClass: "browse-grid__empty",
    emptyHtml: emptyParagraph(emptyKey),
    renderItem: (post) =>
      NaMePinOps.storyCardHtml(post, {
        cardClass: cardClass || `card--${post.type || "article"}`,
        showMeta,
        showType,
      }),
  };
  if (paging) {
    options.batch = paging.batch;
    options.hasMore = paging.hasMore;
    options.onLoadMore = paging.onLoadMore;
    options.ensureAll = paging.ensureAll;
  }
  NaMePinOps.attach(grid, options);
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

const SEARCH_PAGE = 12;
let searchSeq = 0;

function emptyParagraph(key) {
  return `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(NaMeI18n.getLang(), key))}</p>`;
}

function setArchiveCount(form, text) {
  const status = form.querySelector('[role="status"]');
  if (status) status.textContent = text;
}

function appendUniquePosts(target, incoming) {
  const seen = new Set(target.map((post) => post.slug));
  for (const post of incoming || []) {
    if (!post?.slug || seen.has(post.slug)) continue;
    seen.add(post.slug);
    target.push(post);
  }
}

async function fetchSearchPage(q, offset, limit) {
  if (typeof NaMeAuth.searchPosts !== "function") throw new Error("Search is unavailable");
  const page = await NaMeAuth.searchPosts({
    q,
    limit,
    offset,
    types: ["article", "editorial", "film", "short"],
  });
  const posts = Array.isArray(page?.posts) ? page.posts : [];
  const total = Number.isFinite(Number(page?.total)) ? Number(page.total) : posts.length;
  return { posts, total };
}

function showArchiveError(grid, form) {
  NaMePinOps.detach(grid);
  grid.innerHTML = emptyParagraph("archiveSearchError");
  setArchiveCount(form, "");
}

async function paintServerSearch(grid, form, state) {
  if (NaMePinOps.currentMode() !== "latest") await fillServerSearch(grid, form, state);
  mountStoryBoard(grid, state.posts, true, true, "atelierEmpty", "", "", {
    batch: Math.max(state.posts.length, 1),
    hasMore: state.posts.length < state.total,
    onLoadMore: () => loadMoreServerSearch(grid, form, state),
    ensureAll: () => fillServerSearch(grid, form, state),
  });
  setArchiveCount(form, `${state.posts.length} / ${state.total}`);
}

async function fillServerSearch(grid, form, state) {
  while (state.seq === searchSeq && state.posts.length < state.total) {
    const before = state.posts.length;
    const page = await fetchSearchPage(state.raw, state.posts.length, 50);
    if (state.seq !== searchSeq) return;
    if (Number.isFinite(page.total)) state.total = page.total;
    appendUniquePosts(state.posts, page.posts);
    if (state.posts.length === before) break;
  }
  const ops = grid._pinOps;
  if (ops && state.seq === searchSeq) {
    ops.items = state.posts;
    ops.hasMore = state.posts.length < state.total;
    ops.batch = Math.max(state.posts.length, 1);
  }
  if (state.seq === searchSeq) setArchiveCount(form, `${state.posts.length} / ${state.total}`);
}

async function loadMoreServerSearch(grid, form, state) {
  if (state.seq !== searchSeq) return false;
  try {
    const page = await fetchSearchPage(state.raw, state.posts.length, SEARCH_PAGE);
    if (state.seq !== searchSeq) return false;
    if (Number.isFinite(page.total)) state.total = page.total;
    const before = state.posts.length;
    appendUniquePosts(state.posts, page.posts);
    if (state.posts.length === before) state.total = state.posts.length;
    await paintServerSearch(grid, form, state);
    return true;
  } catch {
    if (state.seq !== searchSeq) return false;
    showArchiveError(grid, form);
    return false;
  }
}

async function runArchiveSearch(grid, form, emptyKey) {
  const seq = ++searchSeq;
  const raw = form.elements.q.value.trim();
  const url = new URL(location.href);
  if (raw) url.searchParams.set("q", raw);
  else url.searchParams.delete("q");
  history.replaceState(history.state, "", url);
  grid.setAttribute("aria-busy", "true");
  try {
    if (!raw) {
      const posts = (await NaMeAuth.fetchPosts({})).filter((post) => STORY_TYPES.has(post.type));
      if (seq !== searchSeq) return;
      if (!posts.length) {
        NaMePinOps.detach(grid);
        grid.innerHTML = emptyParagraph(emptyKey);
      } else {
        mountStoryBoard(grid, posts, true, true, emptyKey);
      }
      setArchiveCount(form, posts.length ? `${posts.length} / ${posts.length}` : "");
      return;
    }
    const page = await fetchSearchPage(raw, 0, SEARCH_PAGE);
    if (seq !== searchSeq) return;
    const state = { seq, raw, posts: [], total: page.total };
    appendUniquePosts(state.posts, page.posts);
    await paintServerSearch(grid, form, state);
  } catch {
    if (seq !== searchSeq) return;
    if (raw) showArchiveError(grid, form);
    else {
      NaMePinOps.detach(grid);
      grid.innerHTML = emptyParagraph(emptyKey);
      setArchiveCount(form, "");
    }
  } finally {
    if (seq === searchSeq) grid.setAttribute("aria-busy", "false");
  }
}

async function initArchiveSearch(grid, emptyKey) {
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
  form.applySearch = () => runArchiveSearch(grid, form, emptyKey);
  form.querySelectorAll("[data-i18n]").forEach((el) => {
    el.textContent = NaMeI18n.t(NaMeI18n.getLang(), el.dataset.i18n);
  });
  await form.applySearch();
}
