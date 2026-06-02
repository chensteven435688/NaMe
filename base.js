/**
 * NaMe — GitHub Pages base path (project sites live at /RepoName/)
 */
const NaMeBase = (function () {
  function detect() {
    if (typeof window === "undefined") return "";
    if (!location.hostname.endsWith("github.io")) return "";
    const parts = location.pathname.split("/").filter(Boolean);
    if (!parts.length) return "";
    const first = parts[0];
    if (first.includes(".")) return "";
    return "/" + first;
  }

  const base = detect();

  function path(p) {
    if (!p) return base || "/";
    if (p.startsWith("http://") || p.startsWith("https://") || p.startsWith("//")) return p;
    const hashIdx = p.indexOf("#");
    const hash = hashIdx >= 0 ? p.slice(hashIdx) : "";
    const pathOnly = hashIdx >= 0 ? p.slice(0, hashIdx) : p;
    if (!base) {
      const normalized = pathOnly.startsWith("/") ? pathOnly : "/" + pathOnly;
      return normalized + hash;
    }
    if (pathOnly === "/" || pathOnly === "") return base + "/" + hash;
    if (pathOnly.startsWith("/#")) return base + "/" + pathOnly.slice(2) + hash;
    const normalized = pathOnly.startsWith("/") ? pathOnly : "/" + pathOnly;
    return base + normalized + hash;
  }

  function fixLinks(root = document) {
    root.querySelectorAll('a[href^="/"]:not([href^="//"])').forEach((el) => {
      const href = el.getAttribute("href");
      if (!href) return;
      el.setAttribute("href", path(href));
    });
  }

  function fixHtmlLinks(html) {
    if (!base || !html) return html;
    return html.replace(/href="\/([^"]*)"/g, (_, rest) => `href="${path("/" + rest)}"`);
  }

  return { getBase: () => base, path, fixLinks, fixHtmlLinks };
})();

if (typeof window !== "undefined") {
  window.NA_ME_BASE = NaMeBase.getBase();
  document.addEventListener("DOMContentLoaded", () => NaMeBase.fixLinks());
}
