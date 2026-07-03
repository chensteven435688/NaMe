/**
 * NaMe — public member profile
 */
let currentMemberId = null;
let memberPosts = [];
let memberLikes = [];
let activeMemberTab = "posts";

document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();
  await NaMeAuth.refresh();
  NaMeAuth.initAuthModal();
  NaMeAuth.initUI();

  NaMeCommunityPin.init({
    onRefresh: () => {
      if (currentMemberId) loadMemberPosts(currentMemberId);
    },
  });

  const params = new URLSearchParams(location.search);
  const memberId = params.get("id");
  const root = document.getElementById("member-root");
  const lang = NaMeI18n.getLang();

  if (!memberId) {
    renderMemberError(root, NaMeI18n.t(lang, "memberNotFound"));
    return;
  }

  currentMemberId = memberId;

  try {
    const [{ user }, { posts }, { likes }] = await Promise.all([
      NaMeAuth.fetchPublicProfile(memberId),
      NaMeAuth.fetchMemberCommunityPosts(memberId),
      fetchMemberLikes(memberId),
    ]);
    renderMemberProfile(root, user, posts, likes);
  } catch {
    renderMemberError(root, NaMeI18n.t(lang, "memberNotFound"));
  }
});

async function fetchMemberLikes(memberId) {
  try {
    const { posts } = await NaMeAuth.fetchMemberLikedCommunityPosts(memberId);
    return { likes: posts || [] };
  } catch {
    return { likes: [] };
  }
}

function renderMemberError(root, message) {
  if (!root) return;
  document.title = NaMeI18n.t(NaMeI18n.getLang(), "memberPageTitle");
  root.innerHTML = `
    <div class="member-page__empty">
      <h1 class="profile-page__title">${escapeHtml(message)}</h1>
      <a href="${escapeHtml(homePath())}" class="btn btn--ghost" data-i18n="backHome">← Back to NaMe</a>
    </div>`;
  NaMeI18n.apply(NaMeI18n.getLang());
}

function renderMemberProfile(root, user, posts, likes) {
  if (!root || !user) return;

  memberPosts = posts || [];
  memberLikes = likes || [];

  const lang = NaMeI18n.getLang();
  const isSelf = NaMeAuth.isLoggedIn() && NaMeAuth.getUser()?.id === user.id;
  const title = `${user.displayName} — NaMe Magazine`;
  document.title = title;

  const meta = document.querySelector('meta[name="description"]');
  if (meta) {
    meta.setAttribute(
      "content",
      user.signature || NaMeI18n.t(lang, "memberPageDescription")
    );
  }

  const avatar = NaMeAuth.formatUserAvatar(user, "user-avatar user-avatar--profile");
  const signatureBlock = user.signature
    ? `<p class="member-page__signature">${escapeHtml(user.signature)}</p>`
    : "";

  const editLink = isSelf
    ? `<a href="${escapeHtml(profilePath())}" class="btn btn--ghost btn--sm member-page__edit" data-i18n="memberEditProfile">Edit profile</a>`
    : "";

  const postCount = posts.length;
  const postsLabel =
    postCount === 1
      ? NaMeI18n.t(lang, "memberPostSingular")
      : NaMeI18n.t(lang, "memberPostPlural");

  const postsGrid = memberPosts.length
    ? `<div class="member-grid">${memberPosts.map(renderMemberPostTile).join("")}</div>`
    : `<p class="member-grid__empty" data-i18n="memberPostsEmpty">No community posts yet.</p>`;

  const likesGrid = memberLikes.length
    ? `<div class="member-grid">${memberLikes.map(renderMemberPostTile).join("")}</div>`
    : `<p class="member-grid__empty" data-i18n="memberLikesEmpty">No liked pins yet.</p>`;

  if (activeMemberTab !== "likes") activeMemberTab = "posts";

  root.innerHTML = `
    <header class="member-page__head">
      <div class="member-page__hero">
        <div class="member-page__avatar">${avatar}</div>
        <div class="member-page__identity">
          <h1 class="member-page__name">${escapeHtml(user.displayName)}</h1>
          <div class="member-page__stats">
            <span class="member-page__stat">
              <strong>${postCount}</strong>
              <span>${escapeHtml(postsLabel)}</span>
            </span>
          </div>
          ${signatureBlock}
          ${editLink}
        </div>
      </div>
    </header>
    <section class="member-page__posts" aria-label="${escapeHtml(NaMeI18n.t(lang, "memberPostsTab"))}">
      <div class="member-page__tabs" role="tablist">
        <button type="button" class="member-page__tab${activeMemberTab === "posts" ? " is-active" : ""}" data-member-tab="posts">
          <span class="member-page__tab-icon" aria-hidden="true">▦</span>
          <span data-i18n="memberPostsTab">Posts</span>
        </button>
        <button type="button" class="member-page__tab${activeMemberTab === "likes" ? " is-active" : ""}" data-member-tab="likes">
          <span class="member-page__tab-icon" aria-hidden="true">♥</span>
          <span data-i18n="memberLikesTab">Likes</span>
        </button>
      </div>
      <div class="member-tab-panel${activeMemberTab === "posts" ? "" : " is-hidden"}" data-member-panel="posts">
        ${postsGrid}
      </div>
      <div class="member-tab-panel${activeMemberTab === "likes" ? "" : " is-hidden"}" data-member-panel="likes">
        ${likesGrid}
      </div>
    </section>`;

  bindMemberTabs(root);
  bindMemberTiles(root);

  NaMeI18n.apply(lang);
}

function collectionForPanel(panelName) {
  return panelName === "likes" ? memberLikes : memberPosts;
}

function bindMemberTabs(root) {
  const tabs = root.querySelectorAll("[data-member-tab]");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      activeMemberTab = tab.dataset.memberTab;
      tabs.forEach((t) => {
        t.classList.toggle("is-active", t === tab);
      });
      root.querySelectorAll("[data-member-panel]").forEach((panel) => {
        panel.classList.toggle("is-hidden", panel.dataset.memberPanel !== activeMemberTab);
      });
    });
  });
}

function bindMemberTiles(root) {
  root.querySelectorAll("[data-member-panel]").forEach((panel) => {
    const collection = collectionForPanel(panel.dataset.memberPanel);
    panel.querySelectorAll("[data-pin-id]").forEach((tile) => {
      tile.addEventListener("click", () => {
        const idx = collection.findIndex((p) => String(p.id) === String(tile.dataset.pinId));
        const post = idx >= 0 ? collection[idx] : null;
        NaMeCommunityPin.setFeedPosts(collection);
        NaMeCommunityPin.openPin(tile.dataset.pinId, post, idx);
      });
    });
  });
}

async function loadMemberPosts(memberId) {
  try {
    const [userRes, { posts }, { likes }] = await Promise.all([
      NaMeAuth.fetchPublicProfile(memberId),
      NaMeAuth.fetchMemberCommunityPosts(memberId),
      fetchMemberLikes(memberId),
    ]);
    renderMemberProfile(document.getElementById("member-root"), userRes.user, posts, likes);
  } catch {
    /* keep current view */
  }
}

function renderMemberPostTile(post) {
  const title = post.title || post.caption?.slice(0, 40) || "Community post";
  return `
    <button type="button" class="member-grid__item" data-pin-id="${escapeHtml(post.id)}" aria-label="${escapeHtml(title)}">
      <img src="${escapeHtml(post.imageUrl)}" alt="${escapeHtml(title)}" loading="lazy" />
      <span class="member-grid__overlay" aria-hidden="true">
        <span>♥ ${post.likeCount}</span>
        <span>💬 ${post.commentCount}</span>
      </span>
    </button>`;
}

function homePath() {
  return typeof NaMeBase !== "undefined" ? NaMeBase.path("/") : "/";
}

function profilePath() {
  return typeof NaMeBase !== "undefined" ? NaMeBase.path("/profile.html") : "/profile.html";
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/"/g, "&quot;");
}
