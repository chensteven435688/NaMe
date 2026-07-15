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

  const lang = NaMeI18n.getLang();
  const loadingKey = document.body.dataset.browseLoading || "browseLoading";
  const emptyKey = document.body.dataset.browseEmpty || "browseEmpty";

  try {
    const params = { type: browseType };
    if (browseSection) params.section = browseSection;
    const posts = await NaMeAuth.fetchPosts(params);
    if (!posts.length) {
      grid.innerHTML = `<p class="browse-grid__empty">${escapeHtml(NaMeI18n.t(lang, emptyKey))}</p>`;
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

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
