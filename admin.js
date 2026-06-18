/**
 * NaMe — full admin dashboard
 */
let allPosts = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init("dashboard");
  if (!ok) return;

  bootDashboard();

  window.addEventListener("hashchange", () => {
    const hash = location.hash.replace("#", "");
    if (hash === "content" || hash === "users") showPanel(hash);
    else if (!hash) showPanel("dashboard");
    NaMeAdmin.renderSidebar("dashboard");
  });
});

document.addEventListener("name:adminpage", (e) => {
  const page = e.detail?.page;
  if (page === "dashboard" || page === "content" || page === "users") {
    bootDashboard(page);
  }
});

function bootDashboard(page = null) {
  initEditModal();
  initFilters();

  const target =
    page ||
    (location.hash === "#content" ? "content" : location.hash === "#users" ? "users" : "dashboard");

  showPanel(target);

  loadDashboard();
  loadContent();
  loadUsers();
}

function showPanel(panel) {
  const titles = {
    dashboard: "adminNavDashboard",
    content: "adminNavContent",
    users: "adminNavUsers",
  };

  document.querySelectorAll("[data-panel-view]").forEach((v) => {
    v.classList.toggle("is-active", v.dataset.panelView === panel);
  });

  const titleEl = document.getElementById("admin-page-title");
  if (titleEl) {
    titleEl.textContent = NaMeI18n.t(NaMeI18n.getLang(), titles[panel] || panel);
  }
}

function initPanels() {
  showPanel("dashboard");
}

async function loadDashboard() {
  try {
    const { posts, users, comments, members, admins, postsByType } =
      await NaMeAuth.fetchAdminStats();
    document.getElementById("admin-stats").innerHTML = `
      <div class="admin-stat"><span class="admin-stat__n">${posts}</span><span class="admin-stat__l">Posts</span></div>
      <div class="admin-stat"><span class="admin-stat__n">${users}</span><span class="admin-stat__l">Users</span></div>
      <div class="admin-stat"><span class="admin-stat__n">${comments}</span><span class="admin-stat__l">Comments</span></div>
      <div class="admin-stat"><span class="admin-stat__n">${admins}</span><span class="admin-stat__l">Admins</span></div>
      <div class="admin-stat"><span class="admin-stat__n">${members}</span><span class="admin-stat__l">Members</span></div>
      <div class="admin-stat admin-stat--wide">
        <span class="admin-stat__l">By type</span>
        <span class="admin-stat__meta">${Object.entries(postsByType || {})
          .map(([k, v]) => `${k}: ${v}`)
          .join(" · ") || "—"}</span>
      </div>`;

    const list = await NaMeAuth.fetchPosts();
    const recent = list.slice(0, 8);
    document.getElementById("dashboard-recent").innerHTML = recent
      .map(
        (p) => `
      <li class="admin-table__row">
        <span>${esc(p.title)} <small>${p.type}</small></span>
        <span>
          <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(p.slug)}" target="_blank">View</a>
          <button type="button" data-edit="${p.id}">Edit</button>
        </span>
      </li>`
      )
      .join("");
    bindEditButtons(document.getElementById("dashboard-recent"));
  } catch (e) {
    console.error(e);
  }
}

async function loadContent() {
  try {
    allPosts = await NaMeAuth.fetchPosts();
    renderContentTable(allPosts);
  } catch {
    document.getElementById("content-table-body").innerHTML =
      '<tr><td colspan="5">Could not load posts.</td></tr>';
  }
}

function renderContentTable(posts) {
  const tbody = document.getElementById("content-table-body");
  if (!posts.length) {
    tbody.innerHTML = '<tr><td colspan="5">No posts yet.</td></tr>';
    return;
  }
  tbody.innerHTML = posts
    .map(
      (p) => `
    <tr>
      <td><strong>${esc(p.title)}</strong><br><small class="text-dim">/${esc(p.slug)}</small></td>
      <td>${esc(p.type)}</td>
      <td>${esc(p.section || "—")}</td>
      <td>${p.featured ? "★" : "—"}</td>
      <td class="admin-actions">
        <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(p.slug)}" target="_blank">View</a>
        <button type="button" data-edit="${p.id}">Edit</button>
        <button type="button" class="danger" data-delete-post="${p.id}">Delete</button>
      </td>
    </tr>`
    )
    .join("");

  bindEditButtons(tbody);
  tbody.querySelectorAll("[data-delete-post]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      if (!confirm("Delete this post permanently?")) return;
      await NaMeAuth.deletePost(btn.dataset.deletePost);
      loadContent();
      loadDashboard();
    });
  });
}

function initFilters() {
  const search = document.getElementById("content-search");
  const typeFilter = document.getElementById("content-filter-type");
  if (!search && !typeFilter) return;
  if (search?.dataset.booted) return;
  if (search) search.dataset.booted = "1";

  const apply = () => {
    let list = [...allPosts];
    const q = search?.value.trim().toLowerCase();
    const type = typeFilter?.value;
    if (q) list = list.filter((p) => p.title.toLowerCase().includes(q));
    if (type) list = list.filter((p) => p.type === type);
    renderContentTable(list);
  };
  search?.addEventListener("input", apply);
  typeFilter?.addEventListener("change", apply);
}

function bindEditButtons(root) {
  root?.querySelectorAll("[data-edit]").forEach((btn) => {
    btn.addEventListener("click", () => openEditModal(btn.dataset.edit));
  });
}

function initEditModal() {
  const modal = document.getElementById("edit-modal");
  if (!modal || modal.dataset.booted) return;
  modal.dataset.booted = "1";

  modal.querySelectorAll("[data-close-edit]").forEach((el) => {
    el.addEventListener("click", () => closeEditModal());
  });

  document.getElementById("edit-form")?.addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = e.target;
    const id = document.getElementById("edit-id").value;
    const status = document.getElementById("edit-status");
    status.textContent = "";
    const fd = new FormData(form);
    if (fd.get("featured")) fd.set("featured", "1");
    else fd.delete("featured");
    try {
      const res = await NaMeAuth.updatePost(id, fd);
      status.textContent = `Saved: ${res.post.title}`;
      allPosts = await NaMeAuth.fetchPosts();
      loadContent();
      loadDashboard();
      setTimeout(closeEditModal, 800);
    } catch (err) {
      status.textContent = err.message;
    }
  });
}

async function openEditModal(id) {
  const modal = document.getElementById("edit-modal");
  const form = document.getElementById("edit-form");
  const { post } = await NaMeAuth.fetchAdminPost(id);
  const f = document.getElementById("edit-form");
  document.getElementById("edit-id").value = post.id;
  f.elements.type.value = post.type;
  f.elements.section.value = post.section || "";
  f.elements.title.value = post.title;
  f.elements.slug.value = post.slug;
  f.elements.meta.value = post.meta || "";
  f.elements.imageUrl.value = post.imageUrl || "";
  f.elements.body.value = post.body || "";
  f.elements.videoUrl.value = post.videoUrl || "";
  f.elements.featured.checked = post.featured;
  f.elements.image.value = "";
  document.getElementById("edit-status").textContent = "";
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closeEditModal() {
  const modal = document.getElementById("edit-modal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function loadUsers() {
  const tbody = document.getElementById("users-table-body");
  try {
    const { users } = await NaMeAuth.fetchAdminUsers();
    const me = NaMeAuth.getUser()?.id;
    tbody.innerHTML = users
      .map(
        (u) => `
      <tr>
        <td>${esc(u.displayName)}</td>
        <td>${esc(u.email)}</td>
        <td>
          <select data-user-role="${u.id}" ${u.id === me ? "disabled" : ""}>
            <option value="member" ${u.role === "member" ? "selected" : ""}>member</option>
            <option value="admin" ${u.role === "admin" ? "selected" : ""}>admin</option>
          </select>
        </td>
        <td>${formatDate(u.createdAt)}</td>
        <td>
          ${u.id !== me ? `<button type="button" class="danger" data-delete-user="${u.id}">Delete</button>` : "<small>you</small>"}
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-user-role]").forEach((sel) => {
      sel.addEventListener("change", async () => {
        try {
          await NaMeAuth.updateAdminUser(sel.dataset.userRole, {
            role: sel.value,
          });
        } catch (err) {
          alert(err.message);
          loadUsers();
        }
      });
    });

    tbody.querySelectorAll("[data-delete-user]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        if (!confirm("Delete this user and all their comments?")) return;
        try {
          await NaMeAuth.deleteAdminUser(btn.dataset.deleteUser);
          loadUsers();
          loadDashboard();
        } catch (err) {
          alert(err.message);
        }
      });
    });
  } catch {
    tbody.innerHTML = '<tr><td colspan="5">Could not load users.</td></tr>';
  }
}

const esc = NaMeAdmin.esc;
const formatDate = NaMeAdmin.formatDate;
