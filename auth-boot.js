/**
 * NaMe — auth session hint (load in <head> to avoid subscribe/login flash on navigation)
 */
(function () {
  const KEY = "name-auth-snapshot";

  function label(value) {
    return `"${String(value || "Member").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`;
  }

  function siteBase() {
    if (!location.hostname.endsWith("github.io")) return "";
    const parts = location.pathname.split("/").filter(Boolean);
    if (!parts.length) return "";
    const first = parts[0];
    if (first.includes(".")) return "";
    return "/" + first;
  }

  function injectFavicon() {
    const href = `${siteBase()}/images/favicon.png`;
    if (document.querySelector('link[rel="icon"]')) return;
    const icon = document.createElement("link");
    icon.rel = "icon";
    icon.href = href;
    document.head.appendChild(icon);
    const apple = document.createElement("link");
    apple.rel = "apple-touch-icon";
    apple.href = href;
    document.head.appendChild(apple);
  }

  injectFavicon();

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
