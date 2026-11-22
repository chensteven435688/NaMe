/**
 * NaMe — comments inbox (admin.html#comments)
 * "New" means posted in the last 24 hours.
 */
let allComments = [];
let commentsFilter = "all";
const NEW_WINDOW_MS = 24 * 60 * 60 * 1000;

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "comments") loadComments();
});
document.addEventListener("name:adminrefresh", (e) => {
  if (e.detail?.page === "comments") loadComments();
});
document.addEventListener("name:adminsearch", (e) => {
  if (e.detail?.page === "comments") renderComments();
});

async function loadComments() {
  const list = document.getElementById("comments-list");
  if (!list) return;
  if (!allComments.length) list.innerHTML = NaMeAdmin.emptyState(NaMeAdmin.t("adminLoading"));
  try {
    const { comments } = await NaMeAuth.fetchAdminComments();
    allComments = comments;
    NaMeAdmin.setCount("comments", comments.length);
    renderComments();
  } catch (err) {
    list.innerHTML = NaMeAdmin.emptyState(err.message);
  }
}

function isNewComment(c) {
  return Date.now() - new Date(c.createdAt).getTime() < NEW_WINDOW_MS;
}

function renderComments() {
  const list = document.getElementById("comments-list");
  if (!list) return;
  const t = NaMeAdmin.t;
  const esc = NaMeAdmin.esc;
  const searched = allComments.filter((c) =>
    NaMeAdmin.matches(`${c.body} ${c.author.displayName} ${c.author.email} ${c.postTitle}`)
  );
  NaMeAdmin.renderSegment(
    document.getElementById("comments-filters"),
    [
      { value: "all", label: t("naAll"), count: searched.length },
      { value: "new", label: t("naNew"), count: searched.filter(isNewComment).length },
      { value: "comment", label: t("adminColComment"), count: searched.filter((c) => !c.parentId).length },
      { value: "reply", label: t("adminReplyBadge"), count: searched.filter((c) => c.parentId).length },
    ],
    commentsFilter,
    (value) => {
      commentsFilter = value;
      renderComments();
    }
  );

  const shown = searched.filter((c) => {
    if (commentsFilter === "new") return isNewComment(c);
    if (commentsFilter === "comment") return !c.parentId;
    if (commentsFilter === "reply") return !!c.parentId;
    return true;
  });
  if (!shown.length) {
    list.innerHTML = NaMeAdmin.emptyState(allComments.length ? t("naNoMatches") : t("adminNoComments"));
    return;
  }

  list.innerHTML = shown
    .map((c) => {
      const kind = c.parentId ? "reply" : "comment";
      const fresh = isNewComment(c);
      return `
      <article class="na-msg${fresh ? " is-new" : ""}" data-comment-id="${esc(c.id)}">
        <span class="na-avatar" aria-hidden="true">${esc(NaMeAdmin.initials(c.author.displayName))}</span>
        <div class="na-msg__main">
          <div class="na-msg__head">
            <strong>${esc(c.author.displayName)}</strong>
            ${c.author.email ? `<small class="na-dim">${esc(c.author.email)}</small>` : ""}
            ${NaMeAdmin.pill(kind, t(kind === "reply" ? "adminReplyBadge" : "adminColComment"))}
            ${fresh ? NaMeAdmin.pill("new", t("naNew")) : ""}
            <time class="na-msg__time" datetime="${esc(c.createdAt)}" title="${esc(NaMeAdmin.formatDate(c.createdAt))}">${esc(NaMeAdmin.timeAgo(c.createdAt))}</time>
          </div>
          <p class="na-msg__body">${esc(c.body)}</p>
          <div class="na-msg__foot">
            <span class="na-dim">${esc(t("naOnStory"))} <a class="na-link" href="${esc(NaMeAdmin.postUrl(c.postSlug))}" target="_blank" rel="noopener">${esc(c.postTitle || "—")}</a> · ♥ ${Number(c.likeCount) || 0}</span>
            <span class="na-msg__actions">
              <a class="na-btn na-btn--light na-btn--sm" href="${esc(NaMeAdmin.postUrl(c.postSlug))}#comments" target="_blank" rel="noopener">${NaMeAdmin.icon("chat")}<span>${esc(t("naReplyOnStory"))}</span></a>
              <button type="button" class="na-btn na-btn--danger na-btn--sm" data-remove-comment="${esc(c.id)}">${NaMeAdmin.icon("trash")}<span>${esc(t("adminRemoveComment"))}</span></button>
            </span>
          </div>
        </div>
      </article>`;
    })
    .join("");

  list.querySelectorAll("[data-remove-comment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const status = document.getElementById("comments-status");
      try {
        await NaMeAdmin.deleteComment(btn.dataset.removeComment, async () => {
          status.textContent = t("adminCommentRemoved");
          await loadComments();
        });
      } catch (err) {
        status.textContent = err.message;
      }
    });
  });
}
