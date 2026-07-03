/**
 * NaMe — community pin detail modal (shared by community + member profile)
 */
const NaMeCommunityPin = (function () {
  let refreshCallback = () => {};
  let currentPinId = null;
  let openRequestId = 0;

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

  function renderPinComment(c) {
    const avatar = NaMeAuth.formatUserAvatarLink(c.author, "user-avatar user-avatar--sm");
    const signatureHtml = c.author?.signature
      ? `<span class="pin-comment__signature">${esc(c.author.signature)}</span>`
      : "";
    return `
      <div class="pin-comment">
        <span class="pin-comment__avatar">${avatar}</span>
        <div>
          <strong>${NaMeAuth.formatAuthorNameLink(c.author, "pin-comment__author")}</strong>
          ${signatureHtml}
          <span class="pin-comment__time">${formatTime(c.createdAt)}</span>
          <p>${esc(c.body)}</p>
        </div>
      </div>`;
  }

  function init(options = {}) {
    refreshCallback = options.onRefresh || (() => {});
    const modal = document.getElementById("pin-modal");
    modal?.querySelectorAll("[data-close-pin]").forEach((el) => {
      el.addEventListener("click", closePinModal);
    });
  }

  function closePinModal() {
    openRequestId += 1;
    const modal = document.getElementById("pin-modal");
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentPinId = null;
  }

  async function openPin(id) {
    const modal = document.getElementById("pin-modal");
    const detail = document.getElementById("pin-detail");
    if (!modal || !detail) return;

    currentPinId = id;
    const requestId = ++openRequestId;
    const lang = NaMeI18n.getLang();
    detail.innerHTML = `<p class="pin-detail__loading">${esc(
      NaMeI18n.t(lang, "pinDetailLoading")
    )}</p>`;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    try {
      const [postRes, commentsRes] = await Promise.allSettled([
        NaMeAuth.fetchCommunityPost(id),
        NaMeAuth.fetchCommunityPostComments(id),
      ]);

      if (requestId !== openRequestId) return;
      if (postRes.status === "rejected") throw postRes.reason;

      const post = postRes.value.post;
      const comments =
        commentsRes.status === "fulfilled" ? commentsRes.value.comments || [] : [];

      const avatar = NaMeAuth.formatUserAvatarLink(post.author, "user-avatar user-avatar--md");
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
                <strong>${NaMeAuth.formatAuthorNameLink(post.author, "pin-detail__author")}</strong>
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
        refreshCallback();
      });

      detail.querySelector("[data-pin-delete]")?.addEventListener("click", async () => {
        if (!confirm(NaMeI18n.t(lang, "communityDeletePinConfirm"))) return;
        await NaMeAuth.deleteCommunityPost(post.id);
        closePinModal();
        refreshCallback();
      });

      detail.querySelector("#pin-comment-form")?.addEventListener("submit", async (e) => {
        e.preventDefault();
        if (!NaMeAuth.isLoggedIn()) {
          NaMeAuth.openAuthModal("login");
          return;
        }
        const input = e.target.querySelector("input");
        await NaMeAuth.createCommunityPostComment(post.id, input.value);
        input.value = "";
        openPin(post.id);
        refreshCallback();
      });

      NaMeI18n.apply(lang);
    } catch (err) {
      if (requestId !== openRequestId) return;
      detail.innerHTML = `<p class="pin-detail__error">${esc(err.message || "Could not load this pin.")}</p>`;
    }
  }

  return { init, openPin, closePinModal, esc, formatTime, isOpen: () => !!currentPinId };
})();
