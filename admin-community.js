/**
 * NaMe — admin community mood board
 */
let communityPosts = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init("community");
  if (!ok) return;
  bootCommunityAdmin();
});

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "community") bootCommunityAdmin();
});

function bootCommunityAdmin() {
  const grid = document.getElementById("admin-community-grid");
  if (!grid) return;

  if (!grid.dataset.booted) {
    grid.dataset.booted = "1";
    document.getElementById("community-refresh")?.addEventListener("click", loadCommunityPosts);
  }

  loadCommunityPosts();
}

async function loadCommunityPosts() {
  const grid = document.getElementById("admin-community-grid");
  const status = document.getElementById("community-status");
  status.textContent = "";

  try {
    const { posts } = await NaMeAuth.fetchAdminCommunityPosts();
    communityPosts = posts;
    renderCommunityPosts();
    if (!posts.length) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "adminCommunityEmpty");
    }
  } catch (err) {
    grid.innerHTML = `<p>${NaMeAdmin.esc(err.message)}</p>`;
  }
}

function renderCommunityPosts() {
  const grid = document.getElementById("admin-community-grid");
  const lang = NaMeI18n.getLang();

  if (!communityPosts.length) {
    grid.innerHTML = `<p>${NaMeI18n.t(lang, "adminCommunityEmpty")}</p>`;
    return;
  }

  grid.innerHTML = communityPosts
    .map(
      (post, index) => `
    <article class="admin-community-card${post.isHidden ? " is-hidden" : ""}" data-post-id="${post.id}">
      <div class="admin-community-card__img">
        <img src="${NaMeAdmin.esc(post.imageUrl)}" alt="${NaMeAdmin.esc(post.title || "Community pin")}" loading="lazy" />
      </div>
      <div class="admin-community-card__body">
        <strong>${NaMeAdmin.esc(post.title || post.caption?.slice(0, 48) || "Untitled pin")}</strong>
        <p>${NaMeAdmin.esc(post.author?.displayName || "Member")}</p>
        <p class="admin-community-card__meta">♥ ${post.likeCount} · 💬 ${post.commentCount}</p>
        ${post.isHidden ? `<span class="admin-badge">${NaMeI18n.t(lang, "adminCommunityHiddenBadge")}</span>` : ""}
      </div>
      <div class="admin-community-card__actions">
        <button type="button" class="btn btn--ghost btn--sm" data-move-up="${post.id}" ${index === 0 ? "disabled" : ""} aria-label="Move up">↑</button>
        <button type="button" class="btn btn--ghost btn--sm" data-move-down="${post.id}" ${index === communityPosts.length - 1 ? "disabled" : ""} aria-label="Move down">↓</button>
        <button type="button" class="btn btn--ghost btn--sm" data-toggle-hidden="${post.id}">
          ${NaMeI18n.t(lang, post.isHidden ? "adminCommunityShow" : "adminCommunityHide")}
        </button>
        <button type="button" class="btn btn--ghost btn--sm admin-community-card__delete" data-delete="${post.id}">
          ${NaMeI18n.t(lang, "adminDelete")}
        </button>
      </div>
    </article>`
    )
    .join("");

  grid.querySelectorAll("[data-move-up]").forEach((btn) => {
    btn.addEventListener("click", () => movePost(btn.dataset.moveUp, -1));
  });
  grid.querySelectorAll("[data-move-down]").forEach((btn) => {
    btn.addEventListener("click", () => movePost(btn.dataset.moveDown, 1));
  });
  grid.querySelectorAll("[data-toggle-hidden]").forEach((btn) => {
    btn.addEventListener("click", () => toggleHidden(btn.dataset.toggleHidden));
  });
  grid.querySelectorAll("[data-delete]").forEach((btn) => {
    btn.addEventListener("click", () => deletePost(btn.dataset.delete));
  });
}

async function movePost(id, direction) {
  const index = communityPosts.findIndex((p) => p.id === id);
  if (index < 0) return;
  const next = index + direction;
  if (next < 0 || next >= communityPosts.length) return;

  const reordered = communityPosts.slice();
  const [item] = reordered.splice(index, 1);
  reordered.splice(next, 0, item);
  communityPosts = reordered;

  try {
    await NaMeAuth.reorderAdminCommunityPosts(reordered.map((p) => p.id));
    renderCommunityPosts();
  } catch (err) {
    document.getElementById("community-status").textContent = err.message;
    loadCommunityPosts();
  }
}

async function toggleHidden(id) {
  const post = communityPosts.find((p) => p.id === id);
  if (!post) return;

  try {
    await NaMeAuth.updateAdminCommunityPost(id, { isHidden: !post.isHidden });
    await loadCommunityPosts();
  } catch (err) {
    document.getElementById("community-status").textContent = err.message;
  }
}

async function deletePost(id) {
  const lang = NaMeI18n.getLang();
  if (!confirm(NaMeI18n.t(lang, "adminCommunityDeleteConfirm"))) return;

  try {
    await NaMeAuth.deleteCommunityPost(id);
    await loadCommunityPosts();
  } catch (err) {
    document.getElementById("community-status").textContent = err.message;
  }
}
