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

/**
 * Resize/compress Supabase Storage images for list/preview use.
 * Uses /render/image (Pro plan). Falls back to the original URL on error.
 */
const NaMeImages = (function () {
  const OBJECT_PUBLIC = "/storage/v1/object/public/";
  const RENDER_PUBLIC = "/storage/v1/render/image/public/";

  const PRESETS = {
    preview: { width: 560, quality: 60, resize: "contain" },
    card: { width: 720, quality: 65, resize: "contain" },
    hero: { width: 1200, quality: 70, resize: "contain" },
  };

  function thumb(url, opts = {}) {
    if (!url || typeof url !== "string") return url || "";
    const preset = typeof opts === "string" ? PRESETS[opts] || PRESETS.card : null;
    const { width = 720, quality = 65, resize = "contain" } = preset || opts;
    try {
      const base = typeof location !== "undefined" ? location.href : "https://local.invalid";
      const u = new URL(url, base);
      if (!u.pathname.includes(OBJECT_PUBLIC)) return url;
      u.pathname = u.pathname.replace(OBJECT_PUBLIC, RENDER_PUBLIC);
      u.search = "";
      u.searchParams.set("width", String(width));
      u.searchParams.set("quality", String(quality));
      if (resize) u.searchParams.set("resize", resize);
      return u.href;
    } catch {
      return url;
    }
  }

  function imgTag(url, { preset = "card", alt = "", className = "", loading = "lazy", extra = "" } = {}) {
    const original = url || "";
    const src = thumb(original, preset);
    const fallback =
      src && src !== original
        ? ` data-full-src="${escapeAttr(original)}"`
        : "";
    const cls = className ? ` class="${escapeAttr(className)}"` : "";
    const load = loading ? ` loading="${escapeAttr(loading)}"` : "";
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}"${cls}${load}${fallback} decoding="async"${extra ? ` ${extra}` : ""} />`;
  }

  function bindFallbacks(root = document) {
    root.querySelectorAll("img[data-full-src]").forEach((img) => {
      if (img.dataset.thumbBound) return;
      img.dataset.thumbBound = "1";
      img.addEventListener(
        "error",
        () => {
          const full = img.dataset.fullSrc;
          if (full && img.getAttribute("src") !== full) {
            img.removeAttribute("data-full-src");
            img.src = full;
          }
        },
        { once: true }
      );
    });
  }

  function escapeAttr(s) {
    return String(s || "")
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  return { thumb, imgTag, bindFallbacks, PRESETS };
})();

if (typeof window !== "undefined") {
  window.NA_ME_BASE = NaMeBase.getBase();
  window.NaMeImages = NaMeImages;
  const runFix = () => NaMeBase.fixLinks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runFix);
  } else {
    runFix();
  }
}
