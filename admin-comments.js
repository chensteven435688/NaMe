let allComments = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init("comments");
  if (!ok) return;
  bootComments();
});

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "comments") bootComments();
});

function bootComments() {
  const tbody = document.getElementById("comments-table-body");
  if (!tbody) return;

  if (!tbody.dataset.booted) {
    tbody.dataset.booted = "1";
    document.getElementById("comments-refresh")?.addEventListener("click", loadComments);
    document.getElementById("comments-search")?.addEventListener("input", renderComments);
  }

  loadComments();
}

async function loadComments() {
  const tbody = document.getElementById("comments-table-body");
  const status = document.getElementById("comments-status");
  status.textContent = "";

  try {
    const { comments } = await NaMeAuth.request("/api/admin/comments");
    allComments = comments;
    renderComments();
    if (!comments.length) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "adminNoComments");
    }
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4">${NaMeAdmin.esc(err.message)}</td></tr>`;
  }
}

function renderComments() {
  const tbody = document.getElementById("comments-table-body");
  const q = document.getElementById("comments-search")?.value.trim().toLowerCase() || "";
  let list = allComments;
  if (q) {
    list = list.filter(
      (c) =>
        c.body.toLowerCase().includes(q) ||
        c.author.displayName.toLowerCase().includes(q) ||
        c.author.email.toLowerCase().includes(q) ||
        c.postTitle.toLowerCase().includes(q)
    );
  }

  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="4">${NaMeI18n.t(NaMeI18n.getLang(), "adminNoComments")}</td></tr>`;
    return;
  }

  const lang = NaMeI18n.getLang();
  const removeLabel = NaMeI18n.t(lang, "adminRemoveComment");
  const replyLabel = NaMeI18n.t(lang, "adminReplyBadge");

  tbody.innerHTML = list
    .map(
      (c) => `
    <tr class="admin-moderation-row" data-comment-id="${c.id}">
      <td class="admin-moderation-comment">
        <p class="admin-moderation-body">${NaMeAdmin.esc(c.body)}</p>
        ${c.parentId ? `<span class="admin-badge">${replyLabel}</span>` : ""}
        <small>♥ ${c.likeCount} · ${NaMeAdmin.formatDate(c.createdAt)}</small>
      </td>
      <td>
        <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(c.postSlug)}" target="_blank" rel="noopener">${NaMeAdmin.esc(c.postTitle)}</a>
      </td>
      <td>
        <strong>${NaMeAdmin.esc(c.author.displayName)}</strong><br>
        <small>${NaMeAdmin.esc(c.author.email)}</small>
      </td>
      <td class="admin-actions">
        <button type="button" class="btn btn--danger btn--sm" data-remove-comment="${c.id}">${removeLabel}</button>
      </td>
    </tr>`
    )
    .join("");

  tbody.querySelectorAll("[data-remove-comment]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      try {
        await NaMeAdmin.deleteComment(btn.dataset.removeComment, async () => {
          const status = document.getElementById("comments-status");
          status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "adminCommentRemoved");
          await loadComments();
        });
      } catch (err) {
        document.getElementById("comments-status").textContent = err.message;
      }
    });
  });
}
