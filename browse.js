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

  const { browseType, browseSection, browseCard, browseShowMeta, browseAll } =
    document.body.dataset;

  if (browseAll === "true") {
    await loadAllStoriesFeed(grid);
    return;
  }

  if (!browseType) return;

  if (browseType === "exclusive") {
    await loadExclusiveCollections(grid);
    return;
  }

  const lang = NaMeI18n.getLang();
  const loadingKey = document.body.dataset.browseLoading || "browseLoading";
  const emptyKey = document.body.dataset.browseEmpty || "browseEmpty";

  try {
    const params = { type: browseType };
    if (browseSection) params.section = browseSection;
    const posts = await NaMeAuth.fetchPosts(params);
    if (!posts.length) {
      const home = typeof NaMeBase !== "undefined" ? NaMeBase.path("/") : "/";
      window.location.replace(home);
      return;
    }
    const cardClass = browseCard || `card--${browseType}`;
    const showMeta = browseShowMeta === "true";
    grid.innerHTML = posts.map((p) => renderBrowseCard(p, cardClass, showMeta)).join("");
  } catch {
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, emptyKey))}</p>`;
  }
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

const EXCLUSIVE_UNCATEGORIZED = "__uncategorized__";

function exclusivePageHref(meta) {
  const path =
    typeof NaMeBase !== "undefined" ? NaMeBase.path("/exclusive.html") : "/exclusive.html";
  if (!meta) return path;
  return `${path}?meta=${encodeURIComponent(meta)}`;
}

function buildExclusiveFolders(posts, declared) {
  const byKey = new Map();

  function ensure(name, createdAt, uncategorized = false) {
    const key = uncategorized ? EXCLUSIVE_UNCATEGORIZED : name.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, {
        name,
        posts: [],
        createdAt: createdAt || null,
        uncategorized,
      });
    } else if (createdAt && !byKey.get(key).createdAt) {
      byKey.get(key).createdAt = createdAt;
    }
    return byKey.get(key);
  }

  for (const meta of declared || []) {
    const name = NaMeAuth.exclusiveCollectionName(meta.name);
    if (!name || name.toLowerCase() === EXCLUSIVE_UNCATEGORIZED) continue;
    ensure(name, meta.createdAt);
  }

  for (const post of posts || []) {
    const name = NaMeAuth.exclusiveCollectionName(post.meta);
    if (!name) {
      ensure(EXCLUSIVE_UNCATEGORIZED, null, true).posts.push(post);
      continue;
    }
    ensure(name, null).posts.push(post);
  }

  const folders = [...byKey.values()];
  folders.sort((a, b) => {
    if (a.uncategorized) return 1;
    if (b.uncategorized) return -1;
    return latestFolderTime(b) - latestFolderTime(a);
  });
  return folders;
}

function latestFolderTime(folder) {
  const postTime = folder.posts.reduce((latest, post) => {
    const time = Date.parse(post.publishedAt || "") || 0;
    return Math.max(latest, time);
  }, 0);
  const created = Date.parse(folder.createdAt || "") || 0;
  return Math.max(postTime, created);
}

async function loadExclusiveCollections(grid) {
  const lang = NaMeI18n.getLang();
  try {
    const [posts, declared] = await Promise.all([
      NaMeAuth.fetchPosts({ type: "exclusive" }),
      NaMeAuth.fetchExclusiveMetas().catch(() => []),
    ]);
    const folders = buildExclusiveFolders(posts, declared);
    const selected = new URLSearchParams(location.search).get("meta");
    if (selected) renderExclusiveFolder(grid, folders, selected, lang);
    else renderExclusiveFolderIndex(grid, folders, lang);
    exclusiveViewReady = true;
  } catch {
    grid.classList.remove("browse-grid--folders");
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionsEmpty"))}</p>`;
    exclusiveViewReady = true;
  }
}

function renderExclusiveFolderIndex(grid, folders, lang) {
  if (!folders.length) {
    grid.classList.remove("browse-grid--folders");
    grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionsEmpty"))}</p>`;
    return;
  }
  grid.classList.add("browse-grid--folders");
  grid.innerHTML = folders.map((folder) => renderExclusiveFolderCard(folder, lang)).join("");
}

function renderExclusiveFolderCard(folder, lang) {
  const label = folder.uncategorized
    ? NaMeI18n.t(lang, "exclusiveUncategorized")
    : folder.name;
  const href = exclusivePageHref(folder.uncategorized ? EXCLUSIVE_UNCATEGORIZED : folder.name);
  const count = folder.posts.length;
  const countWord = NaMeI18n.t(lang, count === 1 ? "exclusivePiece" : "exclusivePieces");
  const cover = folder.posts[0]?.imageUrl
    ? `<img src="${escapeHtml(folder.posts[0].imageUrl)}" alt="" />`
    : `<span class="meta-folder__mark">${escapeHtml(label.slice(0, 1) || "—")}</span>`;
  return `
    <a class="meta-folder" href="${escapeHtml(href)}">
      <div class="meta-folder__cover">${cover}</div>
      <h2 class="meta-folder__name">${escapeHtml(label)}</h2>
      <p class="meta-folder__count">${escapeHtml(`${count} ${countWord}`)}</p>
    </a>`;
}

function renderExclusiveFolder(grid, folders, selected, lang) {
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
    ? posts.map((post) => renderBrowseCard(post, "card--exclusive", false)).join("")
    : `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, "exclusiveCollectionEmpty"))}</p>`;
  grid.innerHTML = `
    <div class="meta-folder-bar">
      <a class="meta-folder-bar__back" href="${escapeHtml(exclusivePageHref())}">${escapeHtml(NaMeI18n.t(lang, "exclusiveBackCollections"))}</a>
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

let exclusiveViewReady = false;

document.addEventListener("name:languagechange", () => {
  const grid = document.getElementById("browse-grid");
  if (!exclusiveViewReady || document.body.dataset.browseType !== "exclusive" || !grid) return;
  loadExclusiveCollections(grid);
});

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}
