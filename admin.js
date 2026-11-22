/**
 * NaMe — admin controller: boot, overview, posts, users, edit drawer.
 * Other sections live in admin-{exclusive,community,submissions,comments,upload}.js.
 */
let allPosts = [];
let postsFilter = "all";
let allUsers = [];
let usersFilter = "all";
let commentCounts = null;
let editMetaNames = [];

const esc = (value) => NaMeAdmin.esc(value);
const formatDate = (value) => NaMeAdmin.formatDate(value);
const tr = (key) => NaMeI18n.t(NaMeI18n.getLang(), key);
const TYPE_ORDER = ["article", "editorial", "magazine", "film", "short", "artists"];

async function refreshEditMetaNames(type) {
  if (typeof NaMeMetaCombo === "undefined") return;
  editMetaNames = await NaMeMetaCombo.loadNames(type === "exclusive" ? "exclusive" : "post");
}

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init();
  if (!ok) return;
  initEditModal();
  NaMeAdmin.start();
  loadSummary();
});

document.addEventListener("name:adminpage", (e) => {
  const page = e.detail?.page;
  if (page === "overview") loadSummary();
  if (page === "posts") loadContent();
  if (page === "users") loadUsers();
});

document.addEventListener("name:adminsearch", (e) => {
  const page = e.detail?.page;
  if (page === "posts") applyContentFilters();
  if (page === "users") renderUsers();
  if (page === "overview") renderRecent(allPosts);
});

document.addEventListener("name:adminrefresh", (e) => {
  const page = e.detail?.page;
  if (page === "overview") loadSummary();
  if (page === "posts") loadContent();
  if (page === "users") loadUsers();
});

document.addEventListener("name:posts-changed", () => {
  loadSummary();
  if (NaMeAdmin.current() === "posts") loadContent();
});

/* ---------- overview ---------- */

function settle(promise) {
  return promise.then((value) => ({ ok: true, value }), (error) => ({ ok: false, error }));
}

async function loadSummary() {
  const [stats, posts, submissions, comments, community] = await Promise.all([
    settle(NaMeAuth.fetchAdminStats()),
    settle(NaMeAuth.fetchPosts()),
    settle(NaMeAuth.fetchAdminSubmissions()),
    settle(NaMeAuth.fetchAdminComments()),
    settle(NaMeAuth.fetchAdminCommunityPosts()),
  ]);
  [stats, posts, submissions, comments, community].forEach((r) => !r.ok && console.warn(r.error));

  const byType = stats.ok ? stats.value.postsByType || {} : countBy(posts.ok ? posts.value : [], "type");
  if (posts.ok) allPosts = posts.value;
  const postCount = Object.entries(byType).reduce((n, [type, v]) => n + (type === "exclusive" ? 0 : v), 0);
  NaMeAdmin.setCount("posts", postCount);
  NaMeAdmin.setCount("exclusive", byType.exclusive || 0);
  if (community.ok) NaMeAdmin.setCount("community", community.value.posts.length);
  if (comments.ok) {
    NaMeAdmin.setCount("comments", comments.value.comments.length);
    commentCounts = countBy(comments.value.comments.map((c) => ({ id: c.author.id })), "id");
  }
  if (stats.ok) NaMeAdmin.setCount("users", stats.value.users);
  const subCounts = submissions.ok ? submissions.value.counts || {} : {};
  if (submissions.ok) {
    const total = submissions.value.submissions.length;
    NaMeAdmin.setCount("submissions", subCounts.pending || 0);
    NaMeAdmin.setPlan(total - (subCounts.pending || 0), total);
  }

  renderStats({
    stats: stats.ok ? stats.value : null,
    posts: posts.ok ? posts.value : [],
    subCounts,
    comments: comments.ok ? comments.value.comments : [],
  });
  renderRecent(allPosts);
  renderPipeline(submissions.ok ? subCounts : null);
  renderFormatStrip(byType);
}

function countBy(list, key) {
  const out = {};
  for (const item of list) out[item[key]] = (out[item[key]] || 0) + 1;
  return out;
}

function since(list, days, field) {
  const from = Date.now() - days * 86400000;
  return list.filter((item) => new Date(item[field]).getTime() >= from).length;
}

function renderStats({ stats, posts, subCounts, comments }) {
  const el = document.getElementById("admin-stats");
  if (!el) return;
  const n = (v) => (v == null ? "—" : Number(v).toLocaleString());
  const fill = (key, value) => tr(key).replace("{n}", n(value));
  const cards = [
    { label: tr("naStatPosts"), value: stats?.posts, icon: "grid", tone: "red", note: fill("naStatPostsNote", since(posts, 30, "publishedAt")), href: "#posts" },
    { label: tr("naStatPending"), value: subCounts.pending ?? null, icon: "inbox", tone: "amber", note: fill("naStatPendingNote", subCounts.published || 0), href: "#submissions" },
    { label: tr("adminNavComments"), value: stats?.comments, icon: "chat", tone: "teal", note: fill("naStatCommentsNote", since(comments, 7, "createdAt")), href: "#comments" },
    { label: tr("naStatMembers"), value: stats?.users, icon: "users", tone: "violet", note: fill("naStatMembersNote", stats?.admins), href: "#users" },
  ];
  el.innerHTML = cards
    .map(
      (c) => `
      <a class="na-stat" href="${c.href}">
        <span class="na-stat__top"><span class="na-stat__label">${esc(c.label)}</span><span class="na-stat__icon na-stat__icon--${c.tone}">${NaMeAdmin.icon(c.icon)}</span></span>
        <strong class="na-stat__value">${esc(n(c.value))}</strong>
        <small class="na-stat__note">${esc(c.note)}</small>
      </a>`
    )
    .join("");
}

function renderRecent(posts) {
  const list = document.getElementById("dashboard-recent");
  if (!list) return;
  const recent = posts.filter((p) => NaMeAdmin.matches(`${p.title} ${p.meta || ""} ${p.type}`)).slice(0, 6);
  if (!recent.length) {
    list.innerHTML = `<li>${NaMeAdmin.emptyState(posts.length ? tr("naNoMatches") : tr("naNoPosts"))}</li>`;
    return;
  }
  list.innerHTML = recent
    .map((p) => {
      const src = NaMeAdmin.safeUrl(p.imageUrl);
      return `
      <li class="na-recent__row">
        <span class="na-recent__thumb">${src ? `<img src="${esc(src)}" alt="" loading="lazy" />` : NaMeAdmin.icon("file")}</span>
        <span class="na-recent__main"><strong>${esc(p.title)}</strong><small>${esc(NaMeAdmin.typeLabel(p.type))} · ${esc(NaMeAdmin.timeAgo(p.publishedAt))}</small></span>
        <button type="button" class="na-btn na-btn--light na-btn--sm" data-edit="${esc(p.id)}">${esc(tr("naEdit"))}</button>
      </li>`;
    })
    .join("");
  bindEditButtons(list);
}

function renderPipeline(counts) {
  const el = document.getElementById("na-pipeline");
  if (!el) return;
  if (!counts) {
    el.innerHTML = NaMeAdmin.emptyState(tr("naLoadFailed"));
    return;
  }
  const rows = ["pending", "published", "rejected"];
  const total = rows.reduce((sum, key) => sum + (counts[key] || 0), 0);
  el.innerHTML = rows
    .map((key) => {
      const value = counts[key] || 0;
      const share = total ? Math.round((value / total) * 100) : 0;
      return `
      <button type="button" class="na-pipeline__row" data-pipeline="${key}">
        <span class="na-pipeline__label">${NaMeAdmin.pill(key, tr(`submissionStatus_${key}`))}<b>${value}</b></span>
        <span class="na-meter na-meter--${key}"><span style="width:${share}%"></span></span>
      </button>`;
    })
    .join("");
  el.querySelectorAll("[data-pipeline]").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (typeof setSubmissionFilter === "function") setSubmissionFilter(btn.dataset.pipeline);
      NaMeAdmin.navigateTo("#submissions");
    });
  });
}

function renderFormatStrip(byType) {
  const el = document.getElementById("na-format-strip");
  if (!el) return;
  const types = Object.keys(byType)
    .filter((type) => type !== "exclusive" && byType[type])
    .sort((a, b) => (TYPE_ORDER.indexOf(a) + 99) % 99 - (TYPE_ORDER.indexOf(b) + 99) % 99);
  const total = types.reduce((sum, type) => sum + byType[type], 0);
  if (!types.length) {
    el.innerHTML = NaMeAdmin.emptyState(tr("naNoPosts"));
    return;
  }
  el.innerHTML = types
    .map((type) => {
      const share = total ? Math.round((byType[type] / total) * 100) : 0;
      return `
      <button type="button" class="na-strip__card" data-format="${esc(type)}">
        <span class="na-strip__label">${esc(NaMeAdmin.typeLabel(type))}</span>
        <strong>${byType[type]}</strong>
        <span class="na-meter"><span style="width:${share}%"></span></span>
        <small>${share}%</small>
      </button>`;
    })
    .join("");
  el.querySelectorAll("[data-format]").forEach((btn) => {
    btn.addEventListener("click", () => {
      postsFilter = btn.dataset.format;
      NaMeAdmin.navigateTo("#posts");
    });
  });
}

/* ---------- posts ---------- */

async function loadContent() {
  const grid = document.getElementById("posts-grid");
  if (!grid) return;
  if (!allPosts.length) grid.innerHTML = NaMeAdmin.emptyState(tr("adminLoading"));
  try {
    const posts = await NaMeAuth.fetchPosts();
    if (!grid.isConnected) return;
    allPosts = posts;
    applyContentFilters();
  } catch {
    grid.innerHTML = NaMeAdmin.emptyState(tr("naLoadFailed"));
  }
}

function applyContentFilters() {
  const posts = allPosts.filter((p) => p.type !== "exclusive");
  const types = [...new Set(posts.map((p) => p.type))].sort(
    (a, b) => (TYPE_ORDER.indexOf(a) + 99) % 99 - (TYPE_ORDER.indexOf(b) + 99) % 99
  );
  if (postsFilter !== "all" && !types.includes(postsFilter)) postsFilter = "all";
  const searched = posts.filter((p) => NaMeAdmin.matches(`${p.title} ${p.slug} ${p.meta || ""}`));
  NaMeAdmin.renderSegment(
    document.getElementById("posts-filters"),
    [
      { value: "all", label: tr("naAll"), count: searched.length },
      ...types.map((type) => ({ value: type, label: NaMeAdmin.typeLabel(type), count: searched.filter((p) => p.type === type).length })),
    ],
    postsFilter,
    (value) => {
      postsFilter = value;
      applyContentFilters();
    }
  );
  const shown = searched.filter((p) => postsFilter === "all" || p.type === postsFilter);
  const status = document.getElementById("content-results");
  if (status) status.textContent = `${shown.length} / ${posts.length}`;
  renderPostGrid(shown, posts.length);
}

function renderPostGrid(posts, total) {
  const grid = document.getElementById("posts-grid");
  if (!grid) return;
  if (!posts.length) {
    grid.innerHTML = NaMeAdmin.emptyState(total ? tr("naNoMatches") : tr("naNoPosts"));
    return;
  }
  grid.innerHTML = posts
    .map((p) =>
      NaMeAdmin.card({
        image: p.imageUrl,
        status: p.featured ? "featured" : "live",
        statusLabel: tr(p.featured ? "naStatusFeatured" : "naStatusLive"),
        tag: NaMeAdmin.typeLabel(p.type),
        title: p.title,
        meta: [p.meta, NaMeAdmin.formatDate(p.publishedAt)].filter(Boolean).join(" · "),
        actions: `
          <button type="button" class="na-btn na-btn--dark na-btn--sm" data-edit="${esc(p.id)}">${NaMeAdmin.icon("pen")}<span>${esc(tr("naEdit"))}</span></button>
          <a class="na-btn na-btn--light na-btn--sm" href="${esc(NaMeAdmin.postUrl(p.slug))}" target="_blank" rel="noopener">${NaMeAdmin.icon("arrow")}<span>${esc(tr("naView"))}</span></a>`,
      })
    )
    .join("");
  bindEditButtons(grid);
}

function bindEditButtons(root) {
  root?.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit).catch((error) => alert(error.message)));
  });
}

/* ---------- edit drawer ---------- */

function initEditModal() {
  const modal = document.getElementById("edit-modal");
  if (!modal || modal.dataset.booted) return;
  modal.dataset.booted = "1";

  const editBody = document.getElementById("edit-body");
  const editStatus = document.getElementById("edit-status");
  NaMeAdminBodyImages.init({
    textarea: editBody,
    statusEl: editStatus,
    typeSelect: document.querySelector("#edit-form select[name=type]"),
  });

  const editMeta = document.getElementById("edit-meta");
  if (editMeta && typeof NaMeMetaCombo !== "undefined") {
    NaMeMetaCombo.attach(editMeta, { getNames: () => editMetaNames });
  }
  document.querySelector("#edit-form select[name=type]")?.addEventListener("change", (event) => {
    refreshEditMetaNames(event.target.value);
  });

  document.getElementById("edit-delete")?.addEventListener("click", async (event) => {
    const btn = event.currentTarget;
    const id = document.getElementById("edit-id").value;
    if (!id || !confirm(tr("naDeletePostConfirm"))) return;
    btn.disabled = true;
    try {
      await NaMeAuth.deletePost(id);
      document.dispatchEvent(new CustomEvent("name:form-saved", { detail: { form: document.getElementById("edit-form") } }));
      NaMeAdmin.closeDrawer("edit-modal");
      NaMeAdmin.announce(tr("naPostDeleted"));
      document.dispatchEvent(new CustomEvent("name:posts-changed"));
    } catch (error) {
      editStatus.textContent = error.message;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById("edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById("edit-id").value;
    editStatus.textContent = "";
    const fd = new FormData(form);
    if (fd.get("featured")) fd.set("featured", "1");
    else fd.delete("featured");
    const submit = form.querySelector('[type="submit"]');
    if (submit.disabled) return;
    submit.disabled = true;
    try {
      const res = await NaMeAuth.updatePost(id, fd);
      document.dispatchEvent(new CustomEvent("name:form-saved", { detail: { form } }));
      editStatus.textContent = `${tr("naSaved")} ${res.post.title}`;
      document.dispatchEvent(new CustomEvent("name:posts-changed"));
      setTimeout(() => NaMeAdmin.closeDrawer("edit-modal"), 800);
    } catch (err) {
      editStatus.textContent = err.message;
    } finally {
      submit.disabled = false;
    }
  });
}

async function openEditModal(id) {
  const { post } = await NaMeAuth.fetchAdminPost(id);
  const f = document.getElementById("edit-form");
  f.reset();
  document.getElementById("edit-id").value = post.id;
  f.elements.type.value = post.type;
  f.elements.section.value = post.section || "";
  f.elements.title.value = post.title;
  f.elements.slug.value = post.slug;
  f.elements.meta.value = post.meta || "";
  refreshEditMetaNames(post.type);
  f.elements.contentDate.value = post.contentDate ? post.contentDate.slice(0, 10) : "";
  f.elements.imageUrl.value = post.imageUrl || "";
  f.elements.body.value =
    typeof NaMeInstagram !== "undefined" ? NaMeInstagram.stripMarker(post.body || "") : post.body || "";
  if (f.elements.instagramUrl) {
    f.elements.instagramUrl.value = typeof NaMeInstagram !== "undefined" ? NaMeInstagram.permalink(post) : "";
  }
  f.elements.videoUrl.value = post.videoUrl || "";
  f.elements.featured.checked = post.featured;
  document.getElementById("edit-status").textContent = "";
  NaMeAdmin.openDrawer("edit-modal", { focus: "[name=title]" });
}

function closeEditModal() {
  NaMeAdmin.closeDrawer("edit-modal");
}

/* ---------- users ---------- */

async function loadUsers() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  if (!allUsers.length) tbody.innerHTML = `<tr><td colspan="5">${esc(tr("adminLoading"))}</td></tr>`;
  try {
    const { users } = await NaMeAuth.fetchAdminUsers();
    if (!tbody.isConnected) return;
    allUsers = users;
    NaMeAdmin.setCount("users", users.length);
    if (!commentCounts) {
      NaMeAuth.fetchAdminComments()
        .then(({ comments }) => {
          commentCounts = countBy(comments.map((c) => ({ id: c.author.id })), "id");
          renderUsers();
        })
        .catch(() => {});
    }
    renderUsers();
  } catch {
    tbody.innerHTML = `<tr><td colspan="5">${esc(tr("naLoadFailed"))}</td></tr>`;
  }
}

function renderUsers() {
  const tbody = document.getElementById("users-table-body");
  if (!tbody) return;
  const searched = allUsers.filter((u) => NaMeAdmin.matches(`${u.displayName} ${u.email}`));
  NaMeAdmin.renderSegment(
    document.getElementById("users-filters"),
    [
      { value: "all", label: tr("naAll"), count: searched.length },
      { value: "admin", label: tr("naRole_admin"), count: searched.filter((u) => u.role === "admin").length },
      { value: "member", label: tr("naRole_member"), count: searched.filter((u) => u.role !== "admin").length },
    ],
    usersFilter,
    (value) => {
      usersFilter = value;
      renderUsers();
    }
  );
  const list = searched.filter((u) => usersFilter === "all" || (usersFilter === "admin" ? u.role === "admin" : u.role !== "admin"));
  if (!list.length) {
    tbody.innerHTML = `<tr><td colspan="5">${esc(allUsers.length ? tr("naNoMatches") : tr("naNoUsers"))}</td></tr>`;
    return;
  }
  const me = NaMeAuth.getUser()?.id;
  tbody.innerHTML = list
    .map((u) => {
      const role = u.role === "admin" ? "admin" : "member";
      return `
      <tr>
        <td>
          <span class="na-person">
            <span class="na-avatar na-avatar--sm" aria-hidden="true">${esc(NaMeAdmin.initials(u.displayName || u.email))}</span>
            <span class="na-person__text"><strong>${esc(u.displayName || "—")}</strong><small>${esc(u.email || "")}</small></span>
          </span>
        </td>
        <td>
          <span class="na-role">
            ${NaMeAdmin.pill(role, tr(`naRole_${role}`))}
            <select class="na-select" aria-label="${esc(tr("adminColRole"))}: ${esc(u.displayName)}" data-user-role="${esc(u.id)}" ${u.id === me ? "disabled" : ""}>
              <option value="member" ${role === "member" ? "selected" : ""}>${esc(tr("naRole_member"))}</option>
              <option value="admin" ${role === "admin" ? "selected" : ""}>${esc(tr("naRole_admin"))}</option>
            </select>
          </span>
        </td>
        <td class="na-num" data-label="${esc(tr("naRecentComments"))}">${commentCounts ? commentCounts[u.id] || 0 : "—"}</td>
        <td data-label="${esc(tr("adminColJoined"))}">${esc(formatDate(u.createdAt))}</td>
        <td class="na-row-actions">
          ${u.id !== me ? `<button type="button" class="na-btn na-btn--danger na-btn--sm" data-delete-user="${esc(u.id)}">${esc(tr("adminDelete"))}</button>` : `<small class="na-dim">${esc(tr("naYou"))}</small>`}
        </td>
      </tr>`;
    })
    .join("");

  tbody.querySelectorAll("[data-user-role]").forEach((sel) => {
    sel.addEventListener("change", async () => {
      try {
        await NaMeAuth.updateAdminUser(sel.dataset.userRole, { role: sel.value });
        const user = allUsers.find((u) => u.id === sel.dataset.userRole);
        if (user) user.role = sel.value;
        renderUsers();
      } catch (err) {
        alert(err.message);
        loadUsers();
      }
    });
  });

  tbody.querySelectorAll("[data-delete-user]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm(tr("naDeleteUserConfirm"))) return;
      try {
        await NaMeAuth.deleteAdminUser(btn.dataset.deleteUser);
        allUsers = allUsers.filter((u) => u.id !== btn.dataset.deleteUser);
        loadUsers();
      } catch (err) {
        alert(err.message);
      }
    });
  });
}
