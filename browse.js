/**
 * NaMe — Magazine / Editorial / Articles browse pages
 */
async function loadBrowseFeed() {
  const grid = document.getElementById("browse-grid");
  if (!grid) return;

  const { browseType, browseSection, browseCard, browseShowMeta } = document.body.dataset;
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

function renderBrowseCard(post, cardClass, showMeta) {
  const href = `/post.html?slug=${encodeURIComponent(post.slug)}`;
  const meta = showMeta && post.meta ? `<p class="card__meta">${escapeHtml(post.meta)}</p>` : "";
  return `
    <a href="${href}" class="card ${cardClass}">
      <div class="card__img"><img src="${escapeHtml(post.imageUrl || "")}" alt="${escapeHtml(post.title)}" loading="lazy" /></div>
      ${meta}
      <h3 class="card__title">${escapeHtml(post.title)}</h3>
    </a>`;
}

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
  return d.innerHTML;
}
