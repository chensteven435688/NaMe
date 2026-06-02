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
  ];

  function renderSidebar(activePage) {
    const nav = document.getElementById("admin-sidebar-nav");
    if (!nav) return;
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    nav.innerHTML = NAV.map((item) => {
      const label =
        typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, item.key) : item.key;
      const active = item.page === activePage ? " is-active" : "";
      const href =
        typeof NaMeBase !== "undefined" ? NaMeBase.path(item.href) : item.href;
      return `<a href="${href}" class="admin-nav__item${active}">${label}</a>`;
    }).join("");
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
    }
    return isAdmin;
  }

  async function init(activePage) {
    if (typeof NaMeI18n !== "undefined") NaMeI18n.init();
    await NaMeAuth.refresh();
    NaMeAuth.initAuthModal();
    NaMeAuth.initUI();
    renderSidebar(activePage);

    document.getElementById("admin-logout")?.addEventListener("click", () => {
      const msg =
        typeof NaMeI18n !== "undefined"
          ? NaMeI18n.t(NaMeI18n.getLang(), "logoutConfirm")
          : "Log out?";
      if (confirm(msg)) NaMeAuth.logout();
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
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    const msg =
      typeof NaMeI18n !== "undefined"
        ? NaMeI18n.t(lang, "adminRemoveCommentConfirm")
        : "Remove this comment? It will be deleted for everyone.";
    if (!confirm(msg)) return;
    await NaMeAuth.request(`/api/admin/comments/${id}`, { method: "DELETE" });
    onDone?.();
  }

  return { init, renderSidebar, updateGate, esc, formatDate, deleteComment };
})();
