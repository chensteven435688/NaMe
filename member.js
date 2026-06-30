/**
 * NaMe — public member profile
 */
document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();
  await NaMeAuth.refresh();
  NaMeAuth.initUI();

  const params = new URLSearchParams(location.search);
  const memberId = params.get("id");
  const root = document.getElementById("member-root");
  const lang = NaMeI18n.getLang();

  if (!memberId) {
    renderMemberError(root, NaMeI18n.t(lang, "memberNotFound"));
    return;
  }

  try {
    const { user } = await NaMeAuth.fetchPublicProfile(memberId);
    renderMemberProfile(root, user);
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

function renderMemberProfile(root, user) {
  if (!root || !user) return;

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

  const avatar = NaMeAuth.formatUserAvatar(user, "user-avatar user-avatar--xl");
  const signatureBlock = user.signature
    ? `<p class="member-page__signature">${escapeHtml(user.signature)}</p>`
    : `<p class="member-page__signature member-page__signature--empty" data-i18n="memberNoSignature">No signature yet.</p>`;

  const editLink = isSelf
    ? `<a href="${escapeHtml(profilePath())}" class="btn btn--ghost btn--sm member-page__edit" data-i18n="memberEditProfile">Edit profile</a>`
    : "";

  root.innerHTML = `
    <header class="member-page__head">
      <p class="profile-page__eyebrow" data-i18n="memberEyebrow">NaMe member</p>
      <div class="member-page__hero">
        <div class="member-page__avatar">${avatar}</div>
        <div class="member-page__identity">
          <h1 class="member-page__name">${escapeHtml(user.displayName)}</h1>
          ${signatureBlock}
          ${editLink}
        </div>
      </div>
    </header>`;

  NaMeI18n.apply(lang);
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
