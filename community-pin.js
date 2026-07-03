/**
 * NaMe — community pin detail modal (Instagram-style)
 */
const NaMeCommunityPin = (function () {
  let refreshCallback = () => {};
  let currentPinId = null;
  let lastCachedPost = null;
  let openRequestId = 0;

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function withTimeout(promise, ms = 15000, message = "Could not load this pin.") {
    return Promise.race([
      promise,
      new Promise((_, reject) => setTimeout(() => reject(new Error(message)), ms)),
    ]);
  }

  function formatTime(iso) {
    const d = new Date(iso);
    const diff = (Date.now() - d) / 1000;
    if (diff < 60) return "just now";
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
    if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`;
    return d.toLocaleDateString();
  }

  function likesLabel(count, lang) {
    if (count === 1) return NaMeI18n.t(lang, "pinDetailOneLike");
    return NaMeI18n.t(lang, "pinDetailLikes").replace("{n}", String(count));
  }

  function renderPinComment(c) {
    return `
      <div class="pin-comment">
        <span class="pin-comment__avatar">${NaMeAuth.formatUserAvatarLink(c.author, "user-avatar user-avatar--sm")}</span>
        <div class="pin-comment__body">
          <p class="pin-comment__text">
            <strong>${NaMeAuth.formatAuthorNameLink(c.author, "pin-comment__author")}</strong>
            ${esc(c.body)}
          </p>
          <span class="pin-comment__time">${formatTime(c.createdAt)}</span>
        </div>
      </div>`;
  }

  function renderPinDetail(post, comments, lang, { commentsLoading = false } = {}) {
    const avatar = NaMeAuth.formatUserAvatarLink(post.author, "user-avatar user-avatar--md");
    const authorName = esc(post.author?.displayName || "Member");
    const isOwner =
      NaMeAuth.isLoggedIn() && NaMeAuth.getUser().id === post.author?.id;
    const isAdmin = NaMeAuth.isAdmin();
    const canDeleteOwn = isOwner;
    const canModerate = isAdmin && !isOwner;

    const captionParts = [];
    if (post.title) captionParts.push(post.title);
    if (post.caption) captionParts.push(post.caption);
    const captionText = captionParts.join(" — ");

    const commentsHtml = commentsLoading
      ? `<p class="pin-detail__comments-loading">${esc(NaMeI18n.t(lang, "pinDetailLoadingComments"))}</p>`
      : comments.length
        ? comments.map(renderPinComment).join("")
        : `<p class="pin-detail__comments-empty">${esc(NaMeI18n.t(lang, "commentsEmpty"))}</p>`;

    const moderationHtml =
      canDeleteOwn || canModerate
        ? `<div class="pin-detail__moderation">
            ${canDeleteOwn ? `<button type="button" class="pin-detail__delete pin-detail__delete--own" data-pin-delete="${post.id}">${esc(NaMeI18n.t(lang, "communityDeletePin"))}</button>` : ""}
            ${canModerate ? `<button type="button" class="pin-detail__delete pin-detail__delete--mod" data-pin-delete="${post.id}">${esc(NaMeI18n.t(lang, "adminRemovePin"))}</button>` : ""}
          </div>`
        : "";

    return `
      <div class="pin-detail__layout pin-detail__layout--ig">
        <div class="pin-detail__media">
          <button type="button" class="pin-detail__close" data-close-pin aria-label="Close">&times;</button>
          <img src="${esc(post.imageUrl)}" alt="${esc(post.title || captionText || "Community pin")}" />
        </div>
        <div class="pin-detail__panel">
          <header class="pin-detail__header">
            <span class="pin-detail__header-avatar">${avatar}</span>
            <strong class="pin-detail__header-name">${authorName}</strong>
          </header>

          <div class="pin-detail__scroll">
            ${captionText ? `
              <div class="pin-detail__caption-row">
                <span class="pin-detail__caption-avatar">${NaMeAuth.formatUserAvatarLink(post.author, "user-avatar user-avatar--sm")}</span>
                <div>
                  <p class="pin-detail__caption-text">
                    <strong>${authorName}</strong> ${esc(captionText)}
                  </p>
                  <span class="pin-detail__time">${formatTime(post.createdAt)}</span>
                </div>
              </div>` : ""}
            <div class="pin-detail__comments-list" id="pin-comments-list">
              ${commentsHtml}
            </div>
          </div>

          <footer class="pin-detail__footer">
            <div class="pin-detail__toolbar">
              <button type="button" class="pin-detail__action pin-detail__like${post.liked ? " is-liked" : ""}" data-pin-like="${post.id}" aria-label="Like">
                ♥
              </button>
              <button type="button" class="pin-detail__action pin-detail__focus-comment" aria-label="Comment">💬</button>
            </div>
            <p class="pin-detail__likes" data-pin-likes>${esc(likesLabel(post.likeCount, lang))}</p>
            <p class="pin-detail__posted">${formatTime(post.createdAt)}</p>
            ${moderationHtml}
            <form class="pin-detail__comment-form" id="pin-comment-form" data-pin-id="${post.id}">
              <input type="text" maxlength="500" data-i18n-placeholder="commentPlaceholder" placeholder="Add a comment…" required />
              <button type="submit" class="pin-detail__post-btn" ${NaMeAuth.isLoggedIn() ? "" : "disabled"}>${esc(NaMeI18n.t(lang, "commentPost"))}</button>
            </form>
          </footer>
        </div>
      </div>`;
  }

  function bindPinDetailEvents(detail, post, lang) {
    detail.querySelectorAll("[data-close-pin]").forEach((el) => {
      el.addEventListener("click", closePinModal);
    });

    detail.querySelector("[data-pin-like]")?.addEventListener("click", async () => {
      if (!NaMeAuth.isLoggedIn()) {
        NaMeAuth.openAuthModal("login");
        return;
      }
      const res = await NaMeAuth.toggleCommunityPostLike(post.id);
      post.liked = res.liked;
      post.likeCount = res.likeCount;
      const btn = detail.querySelector("[data-pin-like]");
      btn?.classList.toggle("is-liked", res.liked);
      const likesEl = detail.querySelector("[data-pin-likes]");
      if (likesEl) likesEl.textContent = likesLabel(res.likeCount, lang);
      refreshCallback();
    });

    detail.querySelector(".pin-detail__focus-comment")?.addEventListener("click", () => {
      detail.querySelector("#pin-comment-form input")?.focus();
    });

    detail.querySelectorAll("[data-pin-delete]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const confirmKey =
          NaMeAuth.isAdmin() && NaMeAuth.getUser()?.id !== post.author?.id
            ? "adminRemovePinConfirm"
            : "communityDeletePinConfirm";
        if (!confirm(NaMeI18n.t(lang, confirmKey))) return;
        await NaMeAuth.deleteCommunityPost(post.id);
        closePinModal();
        refreshCallback();
      });
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
      openPin(post.id, post);
      refreshCallback();
    });

    const commentInput = detail.querySelector("#pin-comment-form input");
    commentInput?.addEventListener("focus", () => {
      if (!NaMeAuth.isLoggedIn()) NaMeAuth.openAuthModal("login");
    });
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

  async function loadPinComments(detail, postId, lang, requestId) {
    const list = detail.querySelector("#pin-comments-list");
    if (!list) return;

    try {
      const { comments } = await withTimeout(
        NaMeAuth.fetchCommunityPostComments(postId),
        12000,
        "Could not load comments."
      );
      if (requestId !== openRequestId) return;
      list.innerHTML = comments.length
        ? comments.map(renderPinComment).join("")
        : `<p class="pin-detail__comments-empty">${esc(NaMeI18n.t(lang, "commentsEmpty"))}</p>`;
    } catch {
      if (requestId !== openRequestId) return;
      list.innerHTML = `<p class="pin-detail__comments-empty">${esc(NaMeI18n.t(lang, "commentsEmpty"))}</p>`;
    }
  }

  async function openPin(id, cachedPost = null) {
    const modal = document.getElementById("pin-modal");
    const detail = document.getElementById("pin-detail");
    if (!modal || !detail) return;

    currentPinId = id;
    if (cachedPost) lastCachedPost = cachedPost;
    const requestId = ++openRequestId;
    const lang = NaMeI18n.getLang();

    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";

    let post = cachedPost || (lastCachedPost?.id === id ? lastCachedPost : null);

    if (!post) {
      detail.innerHTML = `<p class="pin-detail__loading">${esc(NaMeI18n.t(lang, "pinDetailLoading"))}</p>`;
      try {
        const res = await withTimeout(NaMeAuth.fetchCommunityPost(id));
        if (requestId !== openRequestId) return;
        post = res.post;
      } catch (err) {
        if (requestId !== openRequestId) return;
        detail.innerHTML = `<p class="pin-detail__error">${esc(err.message || "Could not load this pin.")}</p>`;
        return;
      }
    }

    lastCachedPost = post;
    detail.innerHTML = renderPinDetail(post, [], lang, { commentsLoading: true });
    bindPinDetailEvents(detail, post, lang);
    NaMeI18n.apply(lang);

    loadPinComments(detail, id, lang, requestId);

    withTimeout(NaMeAuth.fetchCommunityPost(id), 8000)
      .then((res) => {
        if (requestId !== openRequestId || !res.post) return;
        post.liked = res.post.liked;
        post.likeCount = res.post.likeCount;
        const btn = detail.querySelector("[data-pin-like]");
        btn?.classList.toggle("is-liked", post.liked);
        const likesEl = detail.querySelector("[data-pin-likes]");
        if (likesEl) likesEl.textContent = likesLabel(post.likeCount, lang);
      })
      .catch(() => {});
  }

  return { init, openPin, closePinModal, esc, formatTime, isOpen: () => !!currentPinId };
})();
