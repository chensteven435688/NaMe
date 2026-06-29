/**
 * NaMe — post detail & comments
 */
document.addEventListener("DOMContentLoaded", async () => {
  await NaMeAuth.refresh();
  NaMeI18n.init();
  NaMeAuth.initUI();

  const params = new URLSearchParams(location.search);
  const slug = params.get("slug");
  if (!slug) {
    location.href = "/";
    return;
  }

  try {
    const post = await NaMeAuth.fetchPost(slug);
    renderPost(post);
  } catch {
    document.getElementById("post-root").innerHTML =
      '<p class="post-error">Post not found.</p>';
    return;
  }

  try {
    await loadComments(slug);
  } catch {
    const list = document.getElementById("comments-list");
    if (list) {
      list.innerHTML = '<p class="comments__empty">Comments could not be loaded.</p>';
    }
  }
});

function renderPost(post) {
  const root = document.getElementById("post-root");
  const lang = NaMeI18n.getLang();
  const isExclusive = post.type === "exclusive";
  const isFilm = post.type === "film";
  const typeLabel = isExclusive
    ? NaMeI18n.t(lang, "exclusiveBadge")
    : post.type + (isFilm ? " · Film" : "");
  const backPath = isExclusive ? "/exclusive.html" : isFilm ? "/film.html" : "/";
  const backHref =
    typeof NaMeBase !== "undefined" ? NaMeBase.path(backPath) : backPath;
  const backLabel = isExclusive
    ? NaMeI18n.t(lang, "editorsExclusive")
    : isFilm
      ? NaMeI18n.t(lang, "film")
      : NaMeI18n.t(lang, "backHome");
  const backEl = document.querySelector(".post-page__back");
  if (backEl) {
    backEl.href = backHref;
    backEl.textContent = isExclusive ? `← ${backLabel}` : NaMeI18n.t(lang, "backHome");
  }

  const media = post.videoUrl
    ? `<video class="post__video" controls poster="${post.imageUrl || ""}" src="${post.videoUrl}"></video>`
    : `<img class="post__hero-img" src="${post.imageUrl || ""}" alt="${escapeHtml(post.title)}" />`;

  const datesHtml = buildPostDates(post, lang);

  root.innerHTML = `
    <article class="post${isExclusive ? " post--exclusive" : ""}">
      <div class="post__media">${media}</div>
      <div class="post__body">
        ${post.meta ? `<p class="post__meta">${escapeHtml(post.meta)}</p>` : ""}
        <h1 class="post__title">${escapeHtml(post.title)}</h1>
        <p class="post__type${isExclusive ? " post__type--exclusive" : ""}">${escapeHtml(typeLabel)}</p>
        ${datesHtml}
        <div class="post__content">${post.body || ""}</div>
      </div>
    </article>
  `;
  document.title = `${post.title} — NaMe Magazine`;
}

function buildPostDates(post, lang) {
  const locale = lang === "ko" ? "ko-KR" : lang === "it" ? "it-IT" : "en-US";
  const parts = [];

  if (post.contentDate) {
    const isFilm = post.type === "film" || post.type === "short";
    const label = NaMeI18n.t(lang, isFilm ? "postFilmedDate" : "postCreatedDate");
    parts.push(
      `<span class="post__date">${escapeHtml(label)} ${formatPostDate(post.contentDate, locale)}</span>`
    );
  }

  if (post.publishedAt) {
    const label = NaMeI18n.t(lang, "postPublishedDate");
    parts.push(
      `<span class="post__date">${escapeHtml(label)} ${formatPostDate(post.publishedAt, locale)}</span>`
    );
  }

  if (!parts.length) return "";
  return `<p class="post__dates">${parts.join('<span class="post__date-sep" aria-hidden="true">·</span>')}</p>`;
}

function formatPostDate(iso, locale) {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleDateString(locale, { year: "numeric", month: "long", day: "numeric" });
}

async function loadComments(slug) {
  const list = document.getElementById("comments-list");
  const data = await NaMeAuth.fetchPostComments(slug);
  list.innerHTML = "";
  if (!data.comments.length) {
    list.innerHTML = '<p class="comments__empty" data-i18n="commentsEmpty">No comments yet. Be the first.</p>';
    NaMeI18n.apply(NaMeI18n.getLang());
    return;
  }
  for (const c of data.comments) {
    list.appendChild(renderComment(c, slug));
  }
}

function renderComment(comment, slug, isReply = false) {
  const el = document.createElement("div");
  el.className = "comment" + (isReply ? " comment--reply" : "");
  el.dataset.commentId = comment.id;
  const time = formatTime(comment.createdAt);
  const isAdmin = NaMeAuth.isAdmin();
  const isOwner =
    NaMeAuth.isLoggedIn() && NaMeAuth.getUser().id === comment.author.id;
  const canDelete = isOwner || isAdmin;
  const deleteLabel = isAdmin
    ? NaMeI18n.t(NaMeI18n.getLang(), "adminRemoveComment")
    : "Delete";
  const signatureHtml = comment.author.signature
    ? `<span class="comment__signature">${escapeHtml(comment.author.signature)}</span>`
    : "";

  el.innerHTML = `
    <div class="comment__avatar">${NaMeAuth.formatUserAvatar(comment.author, "user-avatar")}</div>
    <div class="comment__main">
      <div class="comment__head">
        <span class="comment__author-wrap">
          <span class="comment__author">${escapeHtml(comment.author.displayName)}</span>
          ${signatureHtml}
        </span>
        <span class="comment__time">${time}</span>
      </div>
      <p class="comment__body">${escapeHtml(comment.body)}</p>
      <div class="comment__actions">
        <button type="button" class="comment__like${comment.liked ? " is-liked" : ""}" data-like="${comment.id}">
          ♥ <span>${comment.likeCount}</span>
        </button>
        ${!isReply ? `<button type="button" class="comment__reply" data-reply="${comment.id}">Reply</button>` : ""}
        ${canDelete ? `<button type="button" class="comment__delete${isAdmin ? " comment__delete--mod" : ""}" data-delete="${comment.id}">${escapeHtml(deleteLabel)}</button>` : ""}
      </div>
      <form class="comment__reply-form is-hidden" data-reply-form="${comment.id}">
        <input type="text" placeholder="Reply…" maxlength="500" required />
        <button type="submit" class="btn btn--primary btn--sm">Post</button>
      </form>
      <div class="comment__replies"></div>
    </div>
  `;

  el.querySelector("[data-like]")?.addEventListener("click", async () => {
    if (!NaMeAuth.isLoggedIn()) {
      NaMeAuth.openAuthModal("login");
      return;
    }
    const res = await NaMeAuth.togglePostCommentLike(comment.id);
    const btn = el.querySelector("[data-like]");
    btn.classList.toggle("is-liked", res.liked);
    btn.querySelector("span").textContent = res.likeCount;
  });

  el.querySelector("[data-reply]")?.addEventListener("click", () => {
    if (!NaMeAuth.isLoggedIn()) {
      NaMeAuth.openAuthModal("login");
      return;
    }
    el.querySelector(`[data-reply-form="${comment.id}"]`)?.classList.toggle("is-hidden");
  });

  el.querySelector(`[data-reply-form="${comment.id}"]`)?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const input = e.target.querySelector("input");
    await NaMeAuth.createPostComment(slug, { body: input.value, parentId: comment.id });
    await loadComments(slug);
  });

  el.querySelector("[data-delete]")?.addEventListener("click", async () => {
    const msg = NaMeAuth.isAdmin()
      ? NaMeI18n.t(NaMeI18n.getLang(), "adminRemoveCommentConfirm")
      : "Delete this comment?";
    if (!confirm(msg)) return;
    if (NaMeAuth.isAdmin()) {
      await NaMeAuth.deleteAdminComment(comment.id);
    } else {
      await NaMeAuth.deletePostComment(comment.id);
    }
    await loadComments(slug);
  });

  const repliesEl = el.querySelector(".comment__replies");
  for (const r of comment.replies || []) {
    repliesEl.appendChild(renderComment(r, slug, true));
  }

  return el;
}

document.getElementById("comment-form")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!NaMeAuth.isLoggedIn()) {
    NaMeAuth.openAuthModal("login");
    return;
  }
  const slug = new URLSearchParams(location.search).get("slug");
  const input = e.target.querySelector("textarea");
  await NaMeAuth.createPostComment(slug, { body: input.value });
  input.value = "";
  await loadComments(slug);
});

function escapeHtml(s) {
  const d = document.createElement("div");
  d.textContent = s;
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
