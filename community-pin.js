/**
 * NaMe — community pin detail modal (Instagram-style)
 */
const NaMeCommunityPin = (function () {
  let refreshCallback = () => {};
  let currentPinId = null;
  let lastCachedPost = null;
  let openRequestId = 0;
  let feedPosts = [];

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

  function setFeedPosts(posts) {
    feedPosts = Array.isArray(posts) ? posts : [];
    if (currentPinId) updateOutsideNav();
  }

  function samePinId(a, b) {
    return String(a ?? "") === String(b ?? "");
  }

  function getPinIndex(id = currentPinId) {
    return feedPosts.findIndex((p) => samePinId(p.id, id));
  }

  function getAdjacentPin(direction) {
    const idx = getPinIndex();
    if (idx === -1) return null;
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= feedPosts.length) return null;
    return feedPosts[nextIdx];
  }

  function navigatePin(direction) {
    const idx = getPinIndex();
    if (idx === -1 || feedPosts.length < 2) return;
    const nextIdx = direction === "prev" ? idx - 1 : idx + 1;
    if (nextIdx < 0 || nextIdx >= feedPosts.length) return;
    const adjacent = feedPosts[nextIdx];
    if (adjacent) openPin(adjacent.id, adjacent);
  }

  function updateOutsideNav() {
    const modal = document.getElementById("pin-modal");
    if (!modal) return;
    const prevBtn = modal.querySelector("[data-pin-prev]");
    const nextBtn = modal.querySelector("[data-pin-next]");
    if (!prevBtn || !nextBtn) return;
    const idx = getPinIndex();
    const hasList = idx !== -1 && feedPosts.length > 1;
    prevBtn.hidden = !hasList || idx <= 0;
    nextBtn.hidden = !hasList || idx >= feedPosts.length - 1;
  }

  function getPostImages(post) {
    const urls = [];
    if (Array.isArray(post?.images)) {
      post.images.forEach((url) => {
        if (url) urls.push(url);
      });
    } else if (Array.isArray(post?.imageUrls)) {
      post.imageUrls.forEach((url) => {
        if (url) urls.push(url);
      });
    }
    if (!urls.length && post?.imageUrl) urls.push(post.imageUrl);
    return urls;
  }

  function renderPinMedia(post, captionText, lang) {
    const images = getPostImages(post);
    const alt = esc(post.title || captionText || "Community pin");
    const hasCarousel = images.length > 1;

    if (!hasCarousel) {
      return `
        <div class="pin-detail__media">
          <img src="${esc(images[0])}" alt="${alt}" />
        </div>`;
    }

    const prevLabel = esc(NaMeI18n.t(lang, "previous"));
    const nextLabel = esc(NaMeI18n.t(lang, "next"));
    const slides = images
      .map(
        (url, i) => `
        <figure class="pin-detail__slide" data-index="${i}">
          <img src="${esc(url)}" alt="${alt} (${i + 1}/${images.length})" />
        </figure>`
      )
      .join("");
    const dots = images
      .map(
        (_, i) =>
          `<button type="button" class="pin-detail__dot${i === 0 ? " is-active" : ""}" data-slide-go="${i}" aria-label="${i + 1} / ${images.length}"></button>`
      )
      .join("");

    return `
      <div class="pin-detail__media pin-detail__media--carousel" data-slide-count="${images.length}">
        <div class="pin-detail__carousel-viewport">
          <div class="pin-detail__carousel-track">${slides}</div>
          <button type="button" class="pin-detail__slide-nav pin-detail__slide-nav--prev" data-slide-prev aria-label="${prevLabel}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="M15.41 7.41 14 6l-6 6 6 6 1.41-1.41L10.83 12z"/></svg>
          </button>
          <button type="button" class="pin-detail__slide-nav pin-detail__slide-nav--next" data-slide-next aria-label="${nextLabel}">
            <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path fill="currentColor" d="m10 6-1.41 1.41L13.17 12l-4.58 4.59L10 18l6-6z"/></svg>
          </button>
          <div class="pin-detail__dots" role="tablist">${dots}</div>
        </div>
      </div>`;
  }

  function initPinCarousel(detail) {
    const media = detail.querySelector(".pin-detail__media--carousel");
    if (!media) return;

    const count = Number(media.dataset.slideCount) || 0;
    if (count <= 1) return;

    const track = media.querySelector(".pin-detail__carousel-track");
    const dots = [...media.querySelectorAll(".pin-detail__dot")];
    let index = 0;

    function goTo(nextIndex) {
      index = Math.max(0, Math.min(count - 1, nextIndex));
      track.style.transform = `translateX(-${index * 100}%)`;
      dots.forEach((dot, i) => dot.classList.toggle("is-active", i === index));
      media.dataset.slideIndex = String(index);
    }

    media._slideIndex = 0;
    media._goToSlide = goTo;

    media.querySelector("[data-slide-prev]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      goTo(index - 1);
    });
    media.querySelector("[data-slide-next]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      goTo(index + 1);
    });
    dots.forEach((dot) => {
      dot.addEventListener("click", (e) => {
        e.stopPropagation();
        goTo(Number(dot.dataset.slideGo));
      });
    });
  }

  function getActiveCarousel(detail) {
    return detail?.querySelector(".pin-detail__media--carousel") || null;
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
        ${renderPinMedia(post, captionText, lang)}
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
    initPinCarousel(detail);
    updateOutsideNav();

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

  function handleOutsideNavClick(e) {
    const prevBtn = e.target.closest("[data-pin-prev]");
    const nextBtn = e.target.closest("[data-pin-next]");
    if (!prevBtn && !nextBtn) return;
    if (prevBtn?.hidden || nextBtn?.hidden) return;
    e.preventDefault();
    e.stopPropagation();
    navigatePin(prevBtn ? "prev" : "next");
  }

  function init(options = {}) {
    refreshCallback = options.onRefresh || (() => {});
    const modal = document.getElementById("pin-modal");
    modal?.querySelectorAll("[data-close-pin]").forEach((el) => {
      el.addEventListener("click", closePinModal);
    });

    modal?.addEventListener("click", handleOutsideNavClick);

    document.addEventListener("keydown", (e) => {
      if (!currentPinId) return;
      const modalEl = document.getElementById("pin-modal");
      if (!modalEl?.classList.contains("is-open")) return;
      const detail = document.getElementById("pin-detail");
      const carousel = getActiveCarousel(detail);
      const slideIndex = carousel ? Number(carousel.dataset.slideIndex || carousel._slideIndex || 0) : 0;
      const slideCount = carousel ? Number(carousel.dataset.slideCount || 0) : 0;

      if (e.key === "ArrowLeft") {
        if (carousel && slideIndex > 0) {
          e.preventDefault();
          carousel._goToSlide?.(slideIndex - 1);
          return;
        }
        const prev = getAdjacentPin("prev");
        if (prev) {
          e.preventDefault();
          openPin(prev.id, prev);
        }
      } else if (e.key === "ArrowRight") {
        if (carousel && slideIndex < slideCount - 1) {
          e.preventDefault();
          carousel._goToSlide?.(slideIndex + 1);
          return;
        }
        const next = getAdjacentPin("next");
        if (next) {
          e.preventDefault();
          openPin(next.id, next);
        }
      } else if (e.key === "Escape") {
        closePinModal();
      }
    });
  }

  function closePinModal() {
    openRequestId += 1;
    const modal = document.getElementById("pin-modal");
    modal?.classList.remove("is-open");
    modal?.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    currentPinId = null;
    updateOutsideNav();
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
    updateOutsideNav();

    let post =
      cachedPost || (lastCachedPost && samePinId(lastCachedPost.id, id) ? lastCachedPost : null);

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
    updateOutsideNav();
    modal.querySelector("[data-pin-prev]")?.setAttribute("aria-label", NaMeI18n.t(lang, "previous"));
    modal.querySelector("[data-pin-next]")?.setAttribute("aria-label", NaMeI18n.t(lang, "next"));

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

  return {
    init,
    openPin,
    closePinModal,
    setFeedPosts,
    esc,
    formatTime,
    isOpen: () => !!currentPinId,
  };
})();
