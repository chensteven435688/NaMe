/**
 * NaMe — shared admin layout (gate, sidebar, auth)
 */
const NaMeAdmin = (function () {
  const NAV = [
    { href: "/admin.html", key: "adminNavDashboard", page: "dashboard" },
    { href: "/admin-upload.html", key: "adminNavUpload", page: "upload" },
    { href: "/admin-exclusive.html", key: "adminNavExclusive", page: "exclusive" },
    { href: "/admin-submissions.html", key: "adminNavSubmissions", page: "submissions" },
    { href: "/admin-comments.html", key: "adminNavModerate", page: "comments" },
    { href: "/admin.html#content", key: "adminNavContent", page: "content" },
    { href: "/admin.html#users", key: "adminNavUsers", page: "users" },
  ];

  function t(key) {
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    return typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, key) : key;
  }

  function path(p) {
    return typeof NaMeBase !== "undefined" ? NaMeBase.path(p) : p;
  }

  function renderSidebar(activePage) {
    const nav = document.getElementById("admin-sidebar-nav");
    if (!nav) return;

    let current = activePage;
    if (current === "dashboard") {
      const hash = location.hash.replace("#", "");
      if (hash === "content" || hash === "users") current = hash;
    }

    nav.innerHTML = NAV.map((item) => {
      const label = t(item.key);
      const active = item.page === current ? " is-active" : "";
      return `<a href="${path(item.href)}" class="admin-nav__item${active}">${label}</a>`;
    }).join("");
  }

  function ensureAuthModal() {
    if (document.getElementById("auth-modal")) return;

    const wrap = document.createElement("div");
    wrap.innerHTML = `
      <div class="modal" id="auth-modal" aria-hidden="true">
        <div class="modal__backdrop" data-close-auth></div>
        <div class="modal__panel modal__panel--wide" role="dialog">
          <button class="modal__close" type="button" data-close-auth>&times;</button>
          <h2 class="modal__title" data-i18n="authTitle">NaMe Account</h2>
          <p id="auth-error" class="auth-error" hidden></p>
          <div class="auth-tabs">
            <button type="button" class="auth-tabs__btn is-active" data-auth-tab="login" data-i18n="authLogin">Login</button>
            <button type="button" class="auth-tabs__btn" data-auth-tab="register" data-i18n="authRegister">Join</button>
          </div>
          <form id="auth-login-form" class="auth-form" data-auth-panel="login" autocomplete="on">
            <input type="email" name="loginEmail" data-login-email autocomplete="username" required />
            <input type="password" name="loginPassword" data-login-password autocomplete="current-password" required />
            <button type="submit" class="btn btn--primary" data-i18n="authLoginBtn">Login</button>
          </form>
          <form id="auth-register-form" class="auth-form is-hidden" data-auth-panel="register" autocomplete="on">
            <input type="text" name="registerName" data-register-name autocomplete="name" required />
            <input type="email" name="registerEmail" data-register-email autocomplete="email" required />
            <input type="password" name="registerPassword" data-register-password autocomplete="new-password" required minlength="8" />
            <button type="submit" class="btn btn--primary" data-i18n="authRegisterBtn">Create account</button>
          </form>
        </div>
      </div>`;

    document.body.appendChild(wrap.firstElementChild);
    if (typeof NaMeI18n !== "undefined") NaMeI18n.apply(NaMeI18n.getLang());
  }

  function updateGateStatus() {
    const status = document.getElementById("admin-gate-status");
    if (!status) return;

    const user = NaMeAuth.getUser();
    const isAdmin = (typeof window !== "undefined" && window.NA_ME_DEV_BYPASS) || NaMeAuth.isAdmin();

    if (user && !isAdmin) {
      status.textContent = t("adminNotAdmin").replace("{email}", user.email || user.displayName);
      status.hidden = false;
      return;
    }

    status.textContent = "";
    status.hidden = true;
  }

  function updateGate() {
    const bypass = typeof window !== "undefined" && window.NA_ME_DEV_BYPASS === true;
    const isAdmin = bypass || NaMeAuth.isAdmin();
    document.getElementById("admin-gate")?.classList.toggle("is-hidden", isAdmin);
    document.getElementById("admin-app")?.classList.toggle("is-hidden", !isAdmin);

    if (isAdmin) {
      const user = NaMeAuth.getUser();
      const label = document.getElementById("admin-user-label");
      if (label && user) label.textContent = `${user.displayName} · admin`;
    } else {
      updateGateStatus();
    }

    return isAdmin;
  }

  function initMobileNav() {
    const sidebar = document.querySelector(".admin-sidebar");
    const topbar = document.querySelector(".admin-topbar");
    if (!sidebar || !topbar || topbar.querySelector("[data-admin-menu]")) return;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "admin-topbar__menu";
    btn.dataset.adminMenu = "1";
    btn.setAttribute("aria-expanded", "false");
    btn.setAttribute("aria-label", t("openMenu"));
    btn.innerHTML = "<span></span><span></span>";
    topbar.prepend(btn);

    btn.addEventListener("click", () => {
      const open = sidebar.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
    });
  }

  async function init(activePage) {
    if (typeof NaMeI18n !== "undefined") NaMeI18n.init();
    ensureAuthModal();
    await NaMeAuth.refresh();
    NaMeAuth.initAuthModal();
    NaMeAuth.initUI();
    renderSidebar(activePage);
    initMobileNav();

    document.getElementById("admin-logout")?.addEventListener("click", () => {
      if (confirm(t("logoutConfirm"))) NaMeAuth.logout();
    });

    NaMeAuth.onChange(() => updateGate());
    return updateGate();
  }

  function esc(s) {
    const d = document.createElement("div");
    d.textContent = s ?? "";
    return d.innerHTML;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    return new Date(iso).toLocaleDateString(undefined, {
      year: "numeric",
      month: "short",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  }

  async function deleteComment(id, onDone) {
    if (!confirm(t("adminRemoveCommentConfirm"))) return;
    await NaMeAuth.request(`/api/admin/comments/${id}`, { method: "DELETE" });
    onDone?.();
  }

  return { init, renderSidebar, updateGate, esc, formatDate, deleteComment };
})();
