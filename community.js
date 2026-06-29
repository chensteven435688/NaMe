/**
 * NaMe Community — moodboard feed
 */
let currentPinId = null;

document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();
  await NaMeAuth.refresh();
  NaMeAuth.initUI();
  loadStats();
  loadFeed();

  document.getElementById("share-pin-btn")?.addEventListener("click", () => {
    if (!NaMeAuth.isLoggedIn()) {
      NaMeAuth.openAuthModal("login");
      return;
    }
    openShareModal();
  });

  initShareForm();
  initPinModal();
  initShareModal();

  NaMeAuth.onChange(() => {
    NaMeAuth.initUI();
    loadFeed();
  });

  document.addEventListener("name:languagechange", () => {
    if (currentPinId) openPin(currentPinId);
  });
});

async function loadStats() {
  const el = document.getElementById("community-stats");
  if (!el) return;
  try {
    const { posts, members } = await NaMeAuth.fetchCommunityStats();
    const lang = NaMeI18n.getLang();
    el.innerHTML = `
      <span>${posts} ${NaMeI18n.t(lang, "communityStatPins")}</span>
      <span>${members} ${NaMeI18n.t(lang, "communityStatMembers")}</span>`;
  } catch {
    el.innerHTML = "";
  }
}

async function loadFeed() {
  const grid = document.getElementById("community-grid");
  if (!grid) return;
  const lang = NaMeI18n.getLang();
  try {
    const { posts } = await NaMeAuth.fetchCommunityPosts();
    if (!posts.length) {
      grid.innerHTML = `<p class="community-feed__empty" data-i18n="communityEmpty">${esc(NaMeI18n.t(lang, "communityEmpty"))}</p>`;
      return;
    }
    grid.innerHTML = posts.map((p) => renderPinCard(p)).join("");
    grid.querySelectorAll("[data-pin-id]").forEach((card) => {
      card.addEventListener("click", () => openPin(card.dataset.pinId));
    });
  } catch (err) {
    grid.innerHTML = `<p class="community-feed__empty">${esc(err.message)}</p>`;
  }
}

function renderPinCard(post) {
  const title = post.title || post.caption?.slice(0, 40) || "Moodboard";
  const avatar = NaMeAuth.formatUserAvatar(post.author, "user-avatar user-avatar--sm");
  return `
    <article class="pin-card" data-pin-id="${post.id}">
      <div class="pin-card__img">
        <img src="${esc(post.imageUrl)}" alt="${esc(title)}" loading="lazy" />
      </div>
      <div class="pin-card__overlay">
        <p class="pin-card__title">${esc(title)}</p>
        <div class="pin-card__meta">
          <span class="pin-card__avatar">${avatar}</span>
          <span>${esc(post.author?.displayName || "")}</span>
          <span class="pin-card__counts">♥ ${post.likeCount} · 💬 ${post.commentCount}</span>
        </div>
      </div>
    </article>`;
}

async function openPin(id) {
  currentPinId = id;
  const modal = document.getElementById("pin-modal");
  const detail = document.getElementById("pin-detail");
  const lang = NaMeI18n.getLang();
  detail.innerHTML = `<p>${esc(NaMeI18n.t(lang, "communityLoading"))}</p>`;
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";

  try {
    const { post } = await NaMeAuth.fetchCommunityPost(id);
    const { comments } = await NaMeAuth.fetchCommunityPostComments(id);
    const avatar = NaMeAuth.formatUserAvatar(post.author, "user-avatar user-avatar--md");
    const signatureHtml = post.author?.signature
      ? `<span class="pin-detail__signature">${esc(post.author.signature)}</span>`
      : "";
    const canDelete =
      NaMeAuth.isLoggedIn() &&
      (NaMeAuth.getUser().id === post.author?.id || NaMeAuth.isAdmin());

    detail.innerHTML = `
      <div class="pin-detail__layout">
        <div class="pin-detail__img">
          <img src="${esc(post.imageUrl)}" alt="${esc(post.title || "")}" />
        </div>
        <div class="pin-detail__side">
          <div class="pin-detail__author">
            <span class="pin-detail__avatar">${avatar}</span>
            <div>
              <strong>${esc(post.author?.displayName)}</strong>
              ${signatureHtml}
              <span class="pin-detail__time">${formatTime(post.createdAt)}</span>
            </div>
          </div>
          ${post.title ? `<h3 class="pin-detail__title">${esc(post.title)}</h3>` : ""}
          ${post.caption ? `<p class="pin-detail__caption">${esc(post.caption)}</p>` : ""}
          <div class="pin-detail__actions">
            <button type="button" class="pin-detail__like${post.liked ? " is-liked" : ""}" data-pin-like="${post.id}">
              ♥ <span>${post.likeCount}</span>
            </button>
            ${canDelete ? `<button type="button" class="pin-detail__delete" data-pin-delete="${post.id}">${esc(NaMeI18n.t(lang, "communityDeletePin"))}</button>` : ""}
          </div>
          <div class="pin-detail__comments">
            <h4>${esc(NaMeI18n.t(lang, "communityComments"))}</h4>
            <div class="pin-detail__comments-list" id="pin-comments-list">
              ${comments.length ? comments.map(renderPinComment).join("") : `<p class="pin-detail__comments-empty">${esc(NaMeI18n.t(lang, "commentsEmpty"))}</p>`}
            </div>
            <form class="pin-detail__comment-form" id="pin-comment-form" data-pin-id="${post.id}">
              <input type="text" maxlength="500" data-i18n-placeholder="commentPlaceholder" placeholder="Add a comment…" required />
              <button type="submit" class="btn btn--primary btn--sm">${esc(NaMeI18n.t(lang, "commentPost"))}</button>
            </form>
          </div>
        </div>
      </div>`;

    detail.querySelector("[data-pin-like]")?.addEventListener("click", async () => {
      if (!NaMeAuth.isLoggedIn()) {
        NaMeAuth.openAuthModal("login");
        return;
      }
      const res = await NaMeAuth.toggleCommunityPostLike(post.id);
      const btn = detail.querySelector("[data-pin-like]");
      btn.classList.toggle("is-liked", res.liked);
      btn.querySelector("span").textContent = res.likeCount;
      loadFeed();
    });

    detail.querySelector("[data-pin-delete]")?.addEventListener("click", async () => {
      if (!confirm(NaMeI18n.t(lang, "communityDeletePinConfirm"))) return;
      await NaMeAuth.deleteCommunityPost(post.id);
      closePinModal();
      loadFeed();
      loadStats();
    });

    document.getElementById("pin-comment-form")?.addEventListener("submit", async (e) => {
      e.preventDefault();
      if (!NaMeAuth.isLoggedIn()) {
        NaMeAuth.openAuthModal("login");
        return;
      }
      const input = e.target.querySelector("input");
      await NaMeAuth.createCommunityPostComment(post.id, input.value);
      input.value = "";
      openPin(post.id);
      loadFeed();
    });

    NaMeI18n.apply(lang);
  } catch (err) {
    detail.innerHTML = `<p>${esc(err.message)}</p>`;
  }
}

function renderPinComment(c) {
  const avatar = NaMeAuth.formatUserAvatar(c.author, "user-avatar user-avatar--sm");
  const signatureHtml = c.author?.signature
    ? `<span class="pin-comment__signature">${esc(c.author.signature)}</span>`
    : "";
  return `
    <div class="pin-comment">
      <span class="pin-comment__avatar">${avatar}</span>
      <div>
        <strong>${esc(c.author?.displayName)}</strong>
        ${signatureHtml}
        <span class="pin-comment__time">${formatTime(c.createdAt)}</span>
        <p>${esc(c.body)}</p>
      </div>
    </div>`;
}

function initPinModal() {
  const modal = document.getElementById("pin-modal");
  modal?.querySelectorAll("[data-close-pin]").forEach((el) => {
    el.addEventListener("click", closePinModal);
  });
}

function closePinModal() {
  const modal = document.getElementById("pin-modal");
  modal?.classList.remove("is-open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
  currentPinId = null;
}

function initShareModal() {
  const modal = document.getElementById("share-modal");
  modal?.querySelectorAll("[data-close-share]").forEach((el) => {
    el.addEventListener("click", closeShareModal);
  });
}

function openShareModal() {
  const modal = document.getElementById("share-modal");
  modal?.classList.add("is-open");
  modal?.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
  document.getElementById("share-status").textContent = "";
}

function closeShareModal() {
  const modal = document.getElementById("share-modal");
  modal?.classList.remove("is-open");
  modal?.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

function initShareForm() {
  document.getElementById("share-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("share-status");
    const fd = new FormData(e.target);
    if (!fd.get("image")?.size) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "communityImageRequired");
      return;
    }
    try {
      await NaMeAuth.createCommunityPost(fd);
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "communityShareSuccess");
      e.target.reset();
      closeShareModal();
      loadFeed();
      loadStats();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function formatTime(iso) {
  const d = new Date(iso);
  const diff = (Date.now() - d) / 1000;
  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return d.toLocaleDateString();
}
