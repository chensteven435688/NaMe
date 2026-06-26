/**
 * NaMe — auth session hint (load in <head> to avoid subscribe/login flash on navigation)
 */
(function () {
  const KEY = "name-auth-snapshot";

  function label(value) {
    return `"${String(value || "Member").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return;

    const user = JSON.parse(raw);
    if (!user?.id) return;

    window.__NAME_AUTH_SNAPSHOT__ = user;
    const root = document.documentElement;
    root.classList.add("auth-optimistic-early");
    if (user.role === "admin") root.classList.add("auth-optimistic-admin");
    root.style.setProperty("--auth-user-label", label(user.displayName));
  } catch {
    /* ignore */
  }
})();
