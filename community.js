/**
 * NaMe Community — moodboard feed
 */
let currentPinId = null;
let feedPosts = [];

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
  NaMeCommunityPin.init({
    onRefresh: () => {
      loadFeed();
      loadStats();
    },
  });
  initShareModal();

  NaMeAuth.onChange(() => {
    NaMeAuth.initUI();
    if (!NaMeCommunityPin.isOpen?.()) {
      loadFeed();
    }
  });

  document.addEventListener("name:languagechange", () => {
    if (currentPinId) {
      const post = feedPosts.find((p) => p.id === currentPinId);
      NaMeCommunityPin.openPin(currentPinId, post);
    }
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
    feedPosts = posts;
    NaMeCommunityPin.setFeedPosts(posts);
    if (!posts.length) {
      grid.innerHTML = `<p class="community-feed__empty" data-i18n="communityEmpty">${esc(NaMeI18n.t(lang, "communityEmpty"))}</p>`;
      return;
    }
    grid.innerHTML = posts.map((p) => renderPinCard(p)).join("");
    grid.querySelectorAll("[data-pin-id]").forEach((card) => {
      card.addEventListener("click", () => {
        const post = feedPosts.find((p) => p.id === card.dataset.pinId);
        openPin(card.dataset.pinId, post);
      });
    });
    grid.querySelectorAll(".pin-card__avatar a, .pin-card__author").forEach((link) => {
      link.addEventListener("click", (e) => e.stopPropagation());
    });
  } catch (err) {
    grid.innerHTML = `<p class="community-feed__empty">${esc(err.message)}</p>`;
  }
}

function renderPinCard(post) {
  const title = post.title || post.caption?.slice(0, 40) || "Moodboard";
  const avatar = NaMeAuth.formatUserAvatarLink(post.author, "user-avatar user-avatar--sm");
  return `
    <article class="pin-card" data-pin-id="${post.id}">
      <div class="pin-card__img">
        <img src="${esc(post.imageUrl)}" alt="${esc(title)}" loading="lazy" />
      </div>
      <div class="pin-card__overlay">
        <p class="pin-card__title">${esc(title)}</p>
        <div class="pin-card__meta">
          <span class="pin-card__avatar">${avatar}</span>
          <span>${NaMeAuth.formatAuthorNameLink(post.author, "pin-card__author")}</span>
          <span class="pin-card__counts">♥ ${post.likeCount} · 💬 ${post.commentCount}</span>
        </div>
      </div>
    </article>`;
}

function openPin(id, cachedPost) {
  currentPinId = id;
  NaMeCommunityPin.openPin(id, cachedPost);
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
    const submitBtn = e.target.querySelector('button[type="submit"]');
    const fd = new FormData(e.target);
    if (!fd.get("image")?.size) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "communityImageRequired");
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    status.textContent = "";
    try {
      await NaMeAuth.createCommunityPost(fd);
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "communityShareSuccess");
      e.target.reset();
      closeShareModal();
      loadFeed();
      loadStats();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function esc(s) {
  return NaMeCommunityPin.esc(s);
}
