/**
 * NaMe — community mood board section (admin.html#community)
 */
let communityPosts = [];
let communityFilter = "all";

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "community") loadCommunityPosts();
});
document.addEventListener("name:adminrefresh", (e) => {
  if (e.detail?.page === "community") loadCommunityPosts();
});
document.addEventListener("name:adminsearch", (e) => {
  if (e.detail?.page === "community") renderCommunityPosts();
});

async function loadCommunityPosts() {
  const grid = document.getElementById("admin-community-grid");
  const status = document.getElementById("community-status");
  if (!grid) return;
  status.textContent = "";
  if (!communityPosts.length) grid.innerHTML = NaMeAdmin.emptyState(NaMeAdmin.t("adminLoading"));
  try {
    const { posts } = await NaMeAuth.fetchAdminCommunityPosts();
    communityPosts = posts;
    NaMeAdmin.setCount("community", posts.length);
    renderCommunityPosts();
  } catch (err) {
    grid.innerHTML = NaMeAdmin.emptyState(err.message);
  }
}

function renderCommunityPosts() {
  const grid = document.getElementById("admin-community-grid");
  if (!grid) return;
  const t = NaMeAdmin.t;
  const esc = NaMeAdmin.esc;
  const searched = communityPosts.filter((p) =>
    NaMeAdmin.matches(`${p.title || ""} ${p.caption || ""} ${p.author?.displayName || ""}`)
  );
  NaMeAdmin.renderSegment(
    document.getElementById("community-filters"),
    [
      { value: "all", label: t("naAll"), count: searched.length },
      { value: "live", label: t("naStatusLive"), count: searched.filter((p) => !p.isHidden).length },
      { value: "hidden", label: t("adminCommunityHiddenBadge"), count: searched.filter((p) => p.isHidden).length },
    ],
    communityFilter,
    (value) => {
      communityFilter = value;
      renderCommunityPosts();
    }
  );

  const list = searched.filter((p) => communityFilter === "all" || (communityFilter === "hidden") === !!p.isHidden);
  if (!list.length) {
    grid.innerHTML = NaMeAdmin.emptyState(communityPosts.length ? t("naNoMatches") : t("adminCommunityEmpty"));
    return;
  }
  // Reordering only makes sense on the full, unfiltered board.
  const canReorder = communityFilter === "all" && !NaMeAdmin.query();

  grid.innerHTML = list
    .map((post) => {
      const index = communityPosts.indexOf(post);
      const title = post.title || post.caption?.slice(0, 48) || t("naUntitledPin");
      const order = canReorder
        ? `<div class="na-item__order">
            <button type="button" class="na-icon-btn na-icon-btn--sm" data-move-up="${esc(post.id)}" ${index === 0 ? "disabled" : ""} aria-label="${esc(t("naMoveUp"))}: ${esc(title)}">${NaMeAdmin.icon("up")}</button>
            <button type="button" class="na-icon-btn na-icon-btn--sm" data-move-down="${esc(post.id)}" ${index === communityPosts.length - 1 ? "disabled" : ""} aria-label="${esc(t("naMoveDown"))}: ${esc(title)}">${NaMeAdmin.icon("down")}</button>
          </div>`
        : "";
      return NaMeAdmin.card({
        image: post.imageUrl,
        status: post.isHidden ? "hidden" : "live",
        statusLabel: t(post.isHidden ? "adminCommunityHiddenBadge" : "naStatusLive"),
        tag: `No. ${index + 1}`,
        title,
        meta: `${post.author?.displayName || t("naMember")} · ♥ ${Number(post.likeCount) || 0} · ${Number(post.commentCount) || 0} ${t("naCommentsShort")}`,
        className: post.isHidden ? "is-muted" : "",
        extra: order,
        actions: `
          <button type="button" class="na-btn na-btn--light na-btn--sm" data-toggle-hidden="${esc(post.id)}">${NaMeAdmin.icon(post.isHidden ? "eye" : "eye-off")}<span>${esc(t(post.isHidden ? "adminCommunityShow" : "adminCommunityHide"))}</span></button>
          <button type="button" class="na-btn na-btn--danger na-btn--sm" data-delete="${esc(post.id)}">${NaMeAdmin.icon("trash")}<span>${esc(t("adminDelete"))}</span></button>`,
      });
    })
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
    document.querySelector(`[data-move-${direction < 0 ? "up" : "down"}="${CSS.escape(id)}"]:not([disabled])`)?.focus();
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
  if (!confirm(NaMeAdmin.t("adminCommunityDeleteConfirm"))) return;
  try {
    await NaMeAuth.deleteCommunityPost(id);
    await loadCommunityPosts();
  } catch (err) {
    document.getElementById("community-status").textContent = err.message;
  }
}
