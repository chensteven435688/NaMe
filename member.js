/**
 * NaMe — public member profile
 */
let currentMemberId = null;
let memberPosts = [];

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
    const [{ user }, { posts }] = await Promise.all([
      NaMeAuth.fetchPublicProfile(memberId),
      NaMeAuth.fetchMemberCommunityPosts(memberId),
    ]);
    renderMemberProfile(root, user, posts);
  } catch {
    renderMemberError(root, NaMeI18n.t(lang, "memberNotFound"));
  }
});

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

function renderMemberProfile(root, user, posts) {
  if (!root || !user) return;

  memberPosts = posts || [];

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

  const gridHtml = posts.length
    ? `<div class="member-grid" id="member-grid">${posts.map(renderMemberPostTile).join("")}</div>`
    : `<p class="member-grid__empty" data-i18n="memberPostsEmpty">No community posts yet.</p>`;

  root.innerHTML = `
    <header class="member-page__head">
      <div class="member-page__hero">
        <div class="member-page__avatar">${avatar}</div>
        <div class="member-page__identity">
          <div class="member-page__stats">
            <span class="member-page__stat">
              <strong>${postCount}</strong>
              <span>${escapeHtml(postsLabel)}</span>
            </span>
          </div>
          <h1 class="member-page__name">${escapeHtml(user.displayName)}</h1>
          ${signatureBlock}
          ${editLink}
        </div>
      </div>
    </header>
    <section class="member-page__posts" aria-label="${escapeHtml(NaMeI18n.t(lang, "memberPostsTab"))}">
      <div class="member-page__tabs">
        <span class="member-page__tab is-active" aria-current="page">
          <span class="member-page__tab-icon" aria-hidden="true">▦</span>
          <span data-i18n="memberPostsTab">Posts</span>
        </span>
      </div>
      ${gridHtml}
    </section>`;

  root.querySelectorAll("[data-pin-id]").forEach((tile) => {
    tile.addEventListener("click", () => {
      const post = memberPosts.find((p) => p.id === tile.dataset.pinId);
      NaMeCommunityPin.setFeedPosts(memberPosts);
      NaMeCommunityPin.openPin(tile.dataset.pinId, post);
    });
  });

  NaMeI18n.apply(lang);
}

async function loadMemberPosts(memberId) {
  try {
    const { posts } = await NaMeAuth.fetchMemberCommunityPosts(memberId);
    const userRes = await NaMeAuth.fetchPublicProfile(memberId);
    renderMemberProfile(document.getElementById("member-root"), userRes.user, posts);
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
