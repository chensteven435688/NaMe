/**
 * NaMe — shared admin layout (gate, sidebar, auth, in-app navigation)
 */
const NaMeAdmin = (function () {
  const ADMIN_SESSION_KEY = "name-admin-ok";

  const PAGE_SCRIPTS = {
    dashboard: "admin.js",
    content: "admin.js",
    users: "admin.js",
    upload: "admin-upload.js",
    exclusive: "admin-exclusive.js",
    submissions: "admin-submissions.js",
    comments: "admin-comments.js",
  };

  const loadedScripts = new Set();
  let renderedPage = resolvePage(location.pathname, location.hash);

  try {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1" && document.body) {
      document.body.classList.add("admin-optimistic");
    }
  } catch {
    /* ignore */
  }

  document.querySelectorAll('script[src]').forEach((s) => {
    if (s.src) loadedScripts.add(s.src.split("?")[0]);
  });

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

  function pageFile(pathname) {
    const name = pathname.split("/").filter(Boolean).pop() || "";
    return name || "index.html";
  }

  function resolvePage(pathname, hash) {
    const file = pageFile(pathname);
    const h = (hash || "").replace("#", "");
    if (file === "admin.html") {
      if (h === "content") return "content";
      if (h === "users") return "users";
      return "dashboard";
    }
    if (file === "admin-upload.html") return "upload";
    if (file === "admin-exclusive.html") return "exclusive";
    if (file === "admin-submissions.html") return "submissions";
    if (file === "admin-comments.html") return "comments";
    return null;
  }

  function isDashboardFile(pathname) {
    return pageFile(pathname) === "admin.html";
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
      return `<a href="${path(item.href)}" class="admin-nav__item${active}" data-admin-nav>${label}</a>`;
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

  function setAdminSession(isAdmin) {
    try {
      if (isAdmin) sessionStorage.setItem(ADMIN_SESSION_KEY, "1");
      else sessionStorage.removeItem(ADMIN_SESSION_KEY);
    } catch {
      /* ignore */
    }
    document.body?.classList.toggle("admin-optimistic", isAdmin);
  }

  function finishAuthCheck() {
    document.body.classList.add("admin-auth-checked");
    const isAdmin = updateGate();
    setAdminSession(isAdmin);
    return isAdmin;
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

  function setNavLoading(loading) {
    document.body.classList.toggle("admin-nav-loading", loading);
  }

  function syncPageModals(doc) {
    document.querySelectorAll("body > .modal:not(#auth-modal)").forEach((el) => el.remove());
    doc.querySelectorAll("body > .modal:not(#auth-modal)").forEach((el) => {
      document.body.appendChild(el.cloneNode(true));
    });
  }

  function swapAdminMain(doc) {
    const incoming = doc.querySelector(".admin-main");
    const current = document.querySelector(".admin-main");
    if (!incoming || !current) return false;
    current.innerHTML = incoming.innerHTML;
    return true;
  }

  function ensureScript(filename) {
    const src = new URL(filename, window.location.href).href.split("?")[0];
    if (loadedScripts.has(src)) return Promise.resolve();
    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = filename;
      script.onload = () => {
        loadedScripts.add(src);
        resolve();
      };
      script.onerror = reject;
      document.body.appendChild(script);
    });
  }

  async function navigateTo(url, { push = true } = {}) {
    const target = new URL(url, window.location.href);
    const page = resolvePage(target.pathname, target.hash);
    if (!page) {
      window.location.href = url;
      return;
    }

    if (
      page === renderedPage &&
      target.pathname === location.pathname &&
      target.hash === location.hash
    ) {
      return;
    }

    if (isDashboardFile(target.pathname) && isDashboardFile(location.pathname)) {
      if (push) history.pushState({ adminPage: page }, "", target.pathname + target.hash);
      renderSidebar(page === "dashboard" ? "dashboard" : page);
      document.title = docTitleForPage(page);
      renderedPage = page;
      document.dispatchEvent(new CustomEvent("name:adminpage", { detail: { page } }));
      return;
    }

    setNavLoading(true);
    try {
      const res = await fetch(target.pathname + target.search, { credentials: "same-origin" });
      if (!res.ok) throw new Error("fetch failed");
      const html = await res.text();
      const doc = new DOMParser().parseFromString(html, "text/html");

      if (!swapAdminMain(doc)) throw new Error("missing admin main");
      syncPageModals(doc);

      const title = doc.querySelector("title")?.textContent;
      if (title) document.title = title;

      if (push) history.pushState({ adminPage: page }, "", target.pathname + target.hash);

      renderSidebar(page === "dashboard" ? "dashboard" : page);
      initMobileNav();
      updateGate();

      const scriptFile = PAGE_SCRIPTS[page];
      if (scriptFile) await ensureScript(scriptFile);

      if (typeof NaMeI18n !== "undefined") NaMeI18n.apply(NaMeI18n.getLang());
      renderedPage = page;
      document.dispatchEvent(new CustomEvent("name:adminpage", { detail: { page } }));
    } catch {
      window.location.href = url;
    } finally {
      setNavLoading(false);
    }
  }

  function docTitleForPage(page) {
    const titles = {
      dashboard: "NaMe — Admin",
      content: "NaMe — Admin",
      users: "NaMe — Admin",
      upload: "NaMe — Upload post",
      exclusive: "NaMe — Editor's Exclusive",
      submissions: "NaMe — Review submissions",
      comments: "NaMe — Moderate comments",
    };
    return titles[page] || document.title;
  }

  function onAdminNavClick(e) {
    const link = e.target.closest("[data-admin-nav]");
    if (!link || link.target === "_blank") return;
    if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

    const href = link.getAttribute("href");
    if (!href || href.startsWith("http")) return;

    const target = new URL(link.href, window.location.href);
    if (target.origin !== window.location.origin) return;

    e.preventDefault();
    navigateTo(link.href);
  }

  function onAdminPopState() {
    navigateTo(window.location.href, { push: false });
  }

  function initClientNav() {
    if (document.body.dataset.adminNavBound) return;
    document.body.dataset.adminNavBound = "1";
    document.addEventListener("click", onAdminNavClick);
    window.addEventListener("popstate", onAdminPopState);
  }

  function initMobileNav() {
    const sidebar = document.querySelector(".admin-sidebar");
    const topbar = document.querySelector(".admin-topbar");
    if (!sidebar || !topbar) return;

    let btn = topbar.querySelector("[data-admin-menu]");
    if (!btn) {
      btn = document.createElement("button");
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
        const backdrop = document.querySelector(".admin-sidebar-backdrop");
        if (backdrop) backdrop.hidden = !open;
      });
    }

    if (!document.querySelector(".admin-sidebar-backdrop")) {
      const backdrop = document.createElement("div");
      backdrop.className = "admin-sidebar-backdrop";
      backdrop.hidden = true;
      document.body.appendChild(backdrop);
      backdrop.addEventListener("click", () => {
        sidebar.classList.remove("is-open");
        btn?.setAttribute("aria-expanded", "false");
        backdrop.hidden = true;
      });
    }
  }

  async function init(activePage) {
    if (typeof NaMeI18n !== "undefined") NaMeI18n.init();
    ensureAuthModal();
    await NaMeAuth.refresh();
    NaMeAuth.initAuthModal();
    NaMeAuth.initUI();
    renderSidebar(activePage);
    initMobileNav();
    initClientNav();

    const logoutBtn = document.getElementById("admin-logout");
    if (logoutBtn && !logoutBtn.dataset.bound) {
      logoutBtn.dataset.bound = "1";
      logoutBtn.addEventListener("click", () => {
        if (confirm(t("logoutConfirm"))) {
          setAdminSession(false);
          NaMeAuth.logout();
        }
      });
    }

    NaMeAuth.onChange(() => finishAuthCheck());
    return finishAuthCheck();
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
    await NaMeAuth.deleteAdminComment(id);
    onDone?.();
  }

  return { init, renderSidebar, updateGate, navigateTo, esc, formatDate, deleteComment };
})();
