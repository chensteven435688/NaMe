/**
 * NaMe — admin session hint (load in <head> to avoid login gate flash)
 */
(function () {
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
    if (sessionStorage.getItem("name-admin-ok") === "1") {
      document.documentElement.classList.add("admin-optimistic-early");
    }
  } catch {
    /* ignore */
  }
})();
