/**
 * NaMe — admin shell: gate, sidebar, hash routing, topbar search, drawers.
 *
 * admin.html holds every section. Section scripts listen for:
 *   name:adminpage    { page }  a section was opened (boot / reload it)
 *   name:adminsearch  { page }  the topbar search changed
 *   name:adminrefresh { page }  the refresh button was pressed
 * Permissions are enforced by the server and Supabase; this file only decides
 * what to show.
 */
const NaMeAdmin = (function () {
  const ADMIN_SESSION_KEY = "name-admin-ok";

  const SECTIONS = [
    { id: "overview", group: "naGroupDashboard", key: "naNavOverview", icon: "home", search: "naSearchOverview" },
    { id: "posts", group: "naGroupContent", key: "naNavPosts", icon: "grid", search: "naSearchPosts" },
    { id: "exclusive", group: "naGroupContent", key: "adminNavExclusive", icon: "star", search: "naSearchPosts" },
    { id: "community", group: "naGroupContent", key: "adminNavCommunity", icon: "pin", search: "naSearchPins" },
    { id: "submissions", group: "naGroupPeople", key: "naNavSubmissions", icon: "inbox", search: "naSearchSubmissions" },
    { id: "comments", group: "naGroupPeople", key: "adminNavComments", icon: "chat", search: "adminSearchComments" },
    { id: "users", group: "naGroupPeople", key: "adminNavUsers", icon: "users", search: "naSearchUsers" },
  ];
  const ALIASES = { "": "overview", dashboard: "overview", content: "posts", upload: "posts", moderate: "comments" };

  let current = null;
  let query = "";
  const counts = {};
  const dirtyForms = new Set();

  /* ---------- small helpers ---------- */

  function t(key) {
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    return typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, key) : key;
  }

  function lang() {
    return typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
  }

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  /** Only http(s) and same-site paths may become src/href values. */
  function safeUrl(url) {
    const value = String(url ?? "").trim();
    if (!value) return "";
    try {
      const parsed = new URL(value, location.href);
      return ["http:", "https:"].includes(parsed.protocol) ? value : "";
    } catch {
      return "";
    }
  }

  function path(p) {
    return typeof NaMeBase !== "undefined" ? NaMeBase.path(p) : p;
  }

  function postUrl(slug) {
    return `${path("/post.html")}?slug=${encodeURIComponent(slug || "")}`;
  }

  function formatDate(iso) {
    if (!iso) return "—";
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return "—";
    return date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" });
  }

  function timeAgo(iso) {
    const then = new Date(iso).getTime();
    if (!iso || Number.isNaN(then)) return "—";
    const seconds = Math.round((then - Date.now()) / 1000);
    const steps = [
      [60, "second"], [60, "minute"], [24, "hour"], [7, "day"], [4.345, "week"], [12, "month"], [Infinity, "year"],
    ];
    let value = seconds;
    for (const [size, unit] of steps) {
      if (Math.abs(value) < size) {
        try {
          return new Intl.RelativeTimeFormat(lang(), { numeric: "auto" }).format(Math.round(value), unit);
        } catch {
          return formatDate(iso);
        }
      }
      value /= size;
    }
    return formatDate(iso);
  }

  function initials(name) {
    const parts = String(name || "").trim().split(/[\s@._-]+/).filter(Boolean);
    if (!parts.length) return "?";
    const letters = parts.length > 1 ? parts[0][0] + parts[1][0] : parts[0].slice(0, 2);
    return letters.toUpperCase();
  }

  function icon(name) {
    return `<svg aria-hidden="true"><use href="#i-${name}" /></svg>`;
  }

  function pill(status, label) {
    return `<span class="na-pill na-pill--${esc(status)}"><i aria-hidden="true"></i>${esc(label)}</span>`;
  }

  function typeLabel(type) {
    const key = `naType_${type}`;
    const label = t(key);
    return label === key ? String(type || "—") : label;
  }

  function matches(text) {
    return !query || String(text || "").toLocaleLowerCase().includes(query);
  }

  /** Segmented pill filter. items: [{ value, label, count }] */
  function renderSegment(container, items, active, onPick) {
    if (!container) return;
    container.innerHTML = items
      .map(
        (item) => `<button type="button" class="na-segment__item${item.value === active ? " is-active" : ""}" data-value="${esc(item.value)}" aria-pressed="${item.value === active}">${esc(item.label)}<span class="na-segment__count">${Number(item.count) || 0}</span></button>`
      )
      .join("");
    container.querySelectorAll("[data-value]").forEach((btn) => {
      btn.addEventListener("click", () => onPick(btn.dataset.value));
    });
  }

  /**
   * Image card: media on top with a status pill (top-left) and a tag
   * (bottom-left), then title, meta line and action buttons. Every value is
   * escaped here except `actions`/`extra`, which callers build from escaped parts.
   */
  function card({ image, status, statusLabel, tag, title, meta, extra = "", actions = "", className = "" }) {
    const src = safeUrl(image);
    const media = src
      ? `<img src="${esc(globalThis.NaMeMedia?.img(src, 480) ?? src)}" alt="" loading="lazy" decoding="async" />`
      : `<span class="na-item__placeholder">${icon("file")}</span>`;
    return `
      <article class="na-item ${esc(className)}">
        <div class="na-item__media">
          ${media}
          ${status ? `<span class="na-item__status">${pill(status, statusLabel)}</span>` : ""}
          ${tag ? `<span class="na-item__tag">${esc(tag)}</span>` : ""}
        </div>
        <div class="na-item__body">
          <h3 class="na-item__title">${esc(title)}</h3>
          ${meta ? `<p class="na-item__meta">${esc(meta)}</p>` : ""}
          ${extra}
          ${actions ? `<div class="na-item__actions">${actions}</div>` : ""}
        </div>
      </article>`;
  }

  function emptyState(text) {
    return `<p class="na-empty">${esc(text)}</p>`;
  }

  function announce(text) {
    const live = document.getElementById("na-live");
    if (live) live.textContent = text;
  }

  /* ---------- unsaved form guard ---------- */

  const hasChanges = () => [...dirtyForms].some((form) => form.isConnected);
  document.addEventListener("input", (event) => {
    const form = event.target.closest?.("#upload-form, #edit-form, #exclusive-form");
    if (form) dirtyForms.add(form);
  });
  document.addEventListener("reset", (event) => dirtyForms.delete(event.target));
  document.addEventListener("name:form-saved", (event) => dirtyForms.delete(event.detail.form));
  window.addEventListener("beforeunload", (event) => {
    if (!hasChanges()) return;
    event.preventDefault();
    event.returnValue = "";
  });

  function discardForm(form) {
    if (!form || !dirtyForms.has(form)) return true;
    if (!confirm(t("unsavedChanges"))) return false;
    dirtyForms.delete(form);
    return true;
  }

  function canLeave() {
    return !hasChanges() || confirm(t("unsavedChanges"));
  }

  /* ---------- drawers ---------- */
  // Drawers are .modal elements, so experience.js traps focus, makes the page
  // inert, closes on Escape (via .modal__close) and returns focus to the opener.

  function openDrawer(id, { focus } = {}) {
    const drawer = document.getElementById(id);
    if (!drawer) return;
    closeMobileNav(false);
    drawer.classList.add("is-open");
    drawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    // experience.js focuses the close button first; move to the first field after it.
    setTimeout(() => {
      const target =
        (focus && drawer.querySelector(focus)) ||
        drawer.querySelector(".na-form input:not([type=hidden]):not([disabled]), .na-form select, .na-form textarea");
      target?.focus({ preventScroll: true });
    }, 0);
  }

  function closeDrawer(id) {
    const drawer = typeof id === "string" ? document.getElementById(id) : id;
    if (!drawer || !drawer.classList.contains("is-open")) return true;
    for (const form of drawer.querySelectorAll("form")) {
      if (!discardForm(form)) return false;
    }
    drawer.classList.remove("is-open");
    drawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
    return true;
  }

  document.addEventListener("click", (event) => {
    const closer = event.target.closest?.("[data-drawer-close]");
    if (!closer) return;
    const drawer = closer.closest(".na-drawer");
    if (drawer) closeDrawer(drawer);
  });

  /* ---------- sidebar ---------- */

  function renderSidebar() {
    const nav = document.getElementById("admin-sidebar-nav");
    if (!nav) return;
    let group = null;
    nav.innerHTML = SECTIONS.map((section) => {
      const head = section.group !== group ? `<p class="na-nav__label">${esc(t(section.group))}</p>` : "";
      group = section.group;
      const active = section.id === current;
      const count = counts[section.id];
      return `${head}<a href="#${section.id}" class="na-nav__item${active ? " is-active" : ""}"${active ? ' aria-current="page"' : ""} data-nav="${section.id}">${icon(section.icon)}<span>${esc(t(section.key))}</span>${count == null ? "" : `<span class="na-nav__count" data-count="${section.id}">${Number(count) || 0}</span>`}</a>`;
    }).join("");
  }

  function setCount(id, value) {
    counts[id] = value;
    const badge = document.querySelector(`[data-count="${id}"]`);
    if (badge) badge.textContent = Number(value) || 0;
    else renderSidebar();
  }

  function setPlan(done, total) {
    const plan = document.getElementById("na-plan");
    if (!plan) return;
    plan.hidden = !total;
    const label = document.getElementById("na-plan-label");
    if (label) label.textContent = t("naPlanCount").replace("{done}", done).replace("{total}", total);
    const meter = document.getElementById("na-plan-meter");
    if (meter) meter.style.width = `${total ? Math.round((done / total) * 100) : 0}%`;
  }

  /* ---------- mobile sidebar drawer ---------- */

  function sidebarEls() {
    return {
      sidebar: document.getElementById("na-sidebar"),
      scrim: document.querySelector("[data-sidebar-scrim]"),
      menu: document.querySelector("[data-admin-menu]"),
      workspace: document.querySelector(".na-workspace"),
    };
  }

  function openMobileNav() {
    const { sidebar, scrim, menu, workspace } = sidebarEls();
    if (!sidebar) return;
    sidebar.classList.add("is-open");
    menu?.setAttribute("aria-expanded", "true");
    if (scrim) scrim.hidden = false;
    if (workspace) workspace.inert = true;
    sidebar.querySelector("[data-sidebar-close]")?.focus();
  }

  function closeMobileNav(restore = true) {
    const { sidebar, scrim, menu, workspace } = sidebarEls();
    if (!sidebar?.classList.contains("is-open")) return;
    sidebar.classList.remove("is-open");
    menu?.setAttribute("aria-expanded", "false");
    if (scrim) scrim.hidden = true;
    workspace?.removeAttribute("inert");
    if (restore) menu?.focus();
  }

  function initMobileNav() {
    const { sidebar, scrim, menu } = sidebarEls();
    if (!sidebar || sidebar.dataset.drawerBound) return;
    sidebar.dataset.drawerBound = "1";
    menu?.addEventListener("click", openMobileNav);
    scrim?.addEventListener("click", () => closeMobileNav());
    sidebar.querySelector("[data-sidebar-close]")?.addEventListener("click", () => closeMobileNav());
    sidebar.addEventListener("keydown", (event) => {
      if (!sidebar.classList.contains("is-open")) return;
      if (event.key === "Escape") {
        event.preventDefault();
        closeMobileNav();
        return;
      }
      if (event.key !== "Tab") return;
      const items = [...sidebar.querySelectorAll("a[href],button")].filter((el) => !el.disabled && el.getClientRects().length);
      if (event.shiftKey && document.activeElement === items[0]) {
        event.preventDefault();
        items.at(-1).focus();
      } else if (!event.shiftKey && document.activeElement === items.at(-1)) {
        event.preventDefault();
        items[0].focus();
      }
    });
    matchMedia("(max-width: 920px)").addEventListener?.("change", () => closeMobileNav(false));
  }

  /* ---------- routing ---------- */

  function resolveSection(hash) {
    const raw = String(hash || "").replace(/^#/, "");
    if (raw in ALIASES) return ALIASES[raw];
    return SECTIONS.some((s) => s.id === raw) ? raw : "overview";
  }

  function showSection(id, { focus = true } = {}) {
    const section = SECTIONS.find((s) => s.id === id) || SECTIONS[0];
    current = section.id;
    document.querySelectorAll("[data-section]").forEach((panel) => {
      panel.hidden = panel.dataset.section !== current;
    });
    renderSidebar();
    query = "";
    const search = document.getElementById("na-search");
    if (search) {
      search.value = "";
      search.placeholder = t(section.search);
    }
    document.title = `${t(section.key)} — NaMe Admin`;
    closeMobileNav(false);
    if (focus) {
      document.querySelector(`[data-section="${current}"] .na-title`)?.focus({ preventScroll: true });
      window.scrollTo({ top: 0, behavior: "instant" });
    }
    document.dispatchEvent(new CustomEvent("name:adminpage", { detail: { page: current } }));
  }

  function navigateTo(url, { push = true } = {}) {
    const target = new URL(url, location.href);
    const raw = target.hash.replace(/^#/, "");
    const id = resolveSection(raw);
    if (id === current && target.hash === location.hash) return;
    if (id !== current && !canLeave()) {
      if (!push) history.replaceState(null, "", `#${current}`);
      return;
    }
    dirtyForms.clear();
    if (push && target.hash !== location.hash) history.pushState(null, "", target.hash || "#overview");
    if (id !== current) showSection(id);
    if (raw === "upload") document.dispatchEvent(new CustomEvent("name:open-upload"));
  }

  function initRouting() {
    if (document.body.dataset.adminRouting) return;
    document.body.dataset.adminRouting = "1";
    window.addEventListener("hashchange", () => navigateTo(location.href, { push: false }));
  }

  /* ---------- topbar ---------- */

  function initTopbar() {
    const search = document.getElementById("na-search");
    if (search && !search.dataset.bound) {
      search.dataset.bound = "1";
      let timer;
      search.addEventListener("input", () => {
        clearTimeout(timer);
        timer = setTimeout(() => {
          query = search.value.trim().toLocaleLowerCase();
          document.dispatchEvent(new CustomEvent("name:adminsearch", { detail: { page: current } }));
        }, 120);
      });
      search.addEventListener("keydown", (event) => {
        if (event.key === "Escape" && search.value) {
          event.preventDefault();
          event.stopPropagation();
          search.value = "";
          search.dispatchEvent(new Event("input"));
        }
      });
      const kbd = document.getElementById("na-search-kbd");
      if (kbd && !/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent)) kbd.textContent = "Ctrl K";
      document.addEventListener("keydown", (event) => {
        if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
          if (document.querySelector(".modal.is-open")) return;
          event.preventDefault();
          search.focus();
          search.select();
        }
      });
    }

    const refresh = document.getElementById("na-refresh");
    if (refresh && !refresh.dataset.bound) {
      refresh.dataset.bound = "1";
      refresh.addEventListener("click", () => {
        refresh.classList.add("is-spinning");
        setTimeout(() => refresh.classList.remove("is-spinning"), 700);
        document.dispatchEvent(new CustomEvent("name:adminrefresh", { detail: { page: current } }));
      });
    }

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
  }

  /* ---------- gate + auth ---------- */

  try {
    if (sessionStorage.getItem(ADMIN_SESSION_KEY) === "1" && document.body) {
      document.body.classList.add("admin-optimistic");
    }
  } catch {
    /* ignore */
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
            <input type="email" name="loginEmail" data-login-email data-i18n-aria="authEmail" aria-label="Email" autocomplete="username" required />
            <input type="password" name="loginPassword" data-login-password data-i18n-aria="authPassword" aria-label="Password" autocomplete="current-password" required />
            <button type="submit" class="btn btn--primary" data-i18n="authLoginBtn">Login</button>
          </form>
          <form id="auth-register-form" class="auth-form is-hidden" data-auth-panel="register" autocomplete="on">
            <input type="text" name="registerName" data-register-name data-i18n-aria="authDisplayName" aria-label="Display name" autocomplete="name" required />
            <input type="email" name="registerEmail" data-register-email data-i18n-aria="authEmail" aria-label="Email" autocomplete="email" required />
            <input type="password" name="registerPassword" data-register-password data-i18n-aria="authPasswordMin" aria-label="Password (8+ characters)" autocomplete="new-password" required minlength="8" />
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

  function updateGate() {
    const bypass = typeof window !== "undefined" && window.NA_ME_DEV_BYPASS === true;
    const isAdmin = bypass || NaMeAuth.isAdmin();
    document.getElementById("admin-gate")?.classList.toggle("is-hidden", isAdmin);
    document.getElementById("admin-app")?.classList.toggle("is-hidden", !isAdmin);

    if (isAdmin) {
      const user = NaMeAuth.getUser();
      const name = user?.displayName || user?.email || "";
      const label = document.getElementById("admin-user-label");
      if (label) label.textContent = name;
      const avatar = document.getElementById("na-user-initials");
      if (avatar) avatar.textContent = initials(name);
    } else {
      updateGateStatus();
    }
    return isAdmin;
  }

  function finishAuthCheck() {
    document.body.classList.add("admin-auth-checked");
    const isAdmin = updateGate();
    setAdminSession(isAdmin);
    return isAdmin;
  }

  async function init() {
    if (typeof NaMeI18n !== "undefined") NaMeI18n.init();
    ensureAuthModal();
    await NaMeAuth.refresh();
    NaMeAuth.initAuthModal();
    NaMeAuth.initUI();
    renderSidebar();
    initMobileNav();
    initTopbar();
    initRouting();
    NaMeAuth.onChange(() => finishAuthCheck());
    return finishAuthCheck();
  }

  /** Open the section named in the URL hash (call once the user is an admin). */
  function start() {
    showSection(resolveSection(location.hash), { focus: false });
    if (location.hash === "#upload") {
      history.replaceState(null, "", "#posts");
      document.dispatchEvent(new CustomEvent("name:open-upload"));
    }
  }

  async function deleteComment(id, onDone) {
    if (!confirm(t("adminRemoveCommentConfirm"))) return;
    await NaMeAuth.deleteAdminComment(id);
    onDone?.();
  }

  return {
    init,
    start,
    updateGate,
    navigateTo,
    showSection,
    current: () => current,
    query: () => query,
    matches,
    setCount,
    setPlan,
    openDrawer,
    closeDrawer,
    discardForm,
    renderSegment,
    card,
    emptyState,
    announce,
    esc,
    safeUrl,
    postUrl,
    formatDate,
    timeAgo,
    initials,
    icon,
    pill,
    typeLabel,
    t,
    deleteComment,
    renderSidebar,
  };
})();
