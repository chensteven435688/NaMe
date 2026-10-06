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

  document.getElementById("community-grid")?.addEventListener("click", onGridClick);

  document.addEventListener("name:languagechange", () => {
    const grid = document.getElementById("community-grid");
    if (grid?._pinOps) NaMePinOps.attach(grid, grid._pinOps);
    if (!currentPinId || !NaMeCommunityPin.isOpen?.()) return;
    const idx = feedPosts.findIndex((p) => String(p.id) === String(currentPinId));
    const post = idx >= 0 ? feedPosts[idx] : null;
    NaMeCommunityPin.setFeedPosts(feedPosts);
    NaMeCommunityPin.openPin(currentPinId, post, idx);
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

let feedRequestId = 0;

async function loadFeed() {
  const grid = document.getElementById("community-grid");
  if (!grid) return;
  const lang = NaMeI18n.getLang();
  const requestId = ++feedRequestId;
  try {
    const { posts } = await NaMeAuth.fetchCommunityPosts();
    // A newer load (e.g. triggered by login) already rendered — discard this stale response.
    if (requestId !== feedRequestId) return;
    feedPosts = posts;
    NaMeCommunityPin.setFeedPosts(posts);
    NaMePinOps.attach(grid, {
      kind: "community",
      items: posts,
      emptyClass: "community-feed__empty",
      emptyHtml: `<p class="community-feed__empty">${esc(NaMeI18n.t(lang, "communityEmpty"))}</p>`,
      renderItem: (post) => renderPinCard(post),
    });
  } catch (err) {
    if (requestId !== feedRequestId) return;
    NaMePinOps.detach(grid);
    grid.innerHTML = `<p class="community-feed__empty">${esc(err.message)}</p>`;
  }
}

function onGridClick(e) {
  const likeBtn = e.target.closest("[data-community-like]");
  if (likeBtn) {
    e.preventDefault();
    e.stopPropagation();
    toggleCardLike(likeBtn);
    return;
  }
  if (e.target.closest("a")) return;
  const card = e.target.closest("[data-pin-id]");
  if (!card) return;
  const idx = feedPosts.findIndex((p) => String(p.id) === String(card.dataset.pinId));
  const post = idx >= 0 ? feedPosts[idx] : null;
  openPin(card.dataset.pinId, post, idx);
}

async function toggleCardLike(btn) {
  if (!NaMeAuth.isLoggedIn()) {
    NaMeAuth.openAuthModal("login");
    return;
  }
  if (btn.disabled) return;
  btn.disabled = true;
  try {
    const res = await NaMeAuth.toggleCommunityPostLike(btn.dataset.communityLike);
    const post = feedPosts.find((p) => String(p.id) === String(btn.dataset.communityLike));
    if (post) {
      post.liked = res.liked;
      post.likeCount = res.likeCount;
    }
    btn.classList.toggle("is-on", !!res.liked);
    btn.setAttribute("aria-pressed", res.liked ? "true" : "false");
    const count = btn.querySelector(".pin-like__count");
    if (count) count.textContent = String(res.likeCount);
    const counts = btn.closest(".pin-card")?.querySelector(".pin-card__counts");
    if (counts && post) counts.textContent = `♥ ${post.likeCount} · 💬 ${post.commentCount}`;
  } catch (err) {
    NaMePinOps.toast(err.message);
  } finally {
    btn.disabled = false;
  }
}

function renderPinCard(post) {
  const lang = NaMeI18n.getLang();
  const title = post.title || post.caption?.slice(0, 40) || "Moodboard";
  const avatar = NaMeAuth.formatUserAvatarLink(post.author, "user-avatar user-avatar--sm");
  const save = NaMePinOps.saveButton({
    kind: "community",
    key: String(post.id),
    title,
    imageUrl: post.imageUrl || "",
    href: "",
    authorName: post.author?.displayName || "",
  });
  return `
    <article class="pin-card" data-pin-id="${esc(post.id)}">
      <button type="button" class="pin-card__img pin-card__open" aria-label="${esc(title)}">
        <img class="pin-fade" src="${esc(post.imageUrl)}" alt="" loading="lazy" decoding="async" />
      </button>
      <button type="button" class="pin-like${post.liked ? " is-on" : ""}" data-community-like="${esc(post.id)}" aria-pressed="${post.liked ? "true" : "false"}" aria-label="${esc(NaMeI18n.t(lang, "pinOpsLike"))}">
        <span aria-hidden="true">♥</span>
        <span class="pin-like__count">${Number(post.likeCount) || 0}</span>
      </button>
      ${save}
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

function openPin(id, cachedPost, feedIndex) {
  currentPinId = id;
  NaMeCommunityPin.setFeedPosts(feedPosts);
  NaMeCommunityPin.openPin(id, cachedPost, feedIndex);
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
  const status = document.getElementById("share-status");
  if (status) status.textContent = "";
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
    const setStatus = (text) => {
      if (status) status.textContent = text;
    };
    const submitBtn = e.target.querySelector('button[type="submit"]');
    if (submitBtn?.disabled) return;
    const fd = new FormData(e.target);
    if (!fd.get("image")?.size) {
      setStatus(NaMeI18n.t(NaMeI18n.getLang(), "communityImageRequired"));
      return;
    }
    if (submitBtn) submitBtn.disabled = true;
    setStatus("");
    try {
      await NaMeAuth.createCommunityPost(fd);
      setStatus(NaMeI18n.t(NaMeI18n.getLang(), "communityShareSuccess"));
      e.target.reset();
      closeShareModal();
      loadFeed();
      loadStats();
    } catch (err) {
      setStatus(err.message);
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function esc(s) {
  return NaMeCommunityPin.esc(s);
}
