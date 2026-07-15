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
 * Optimized Supabase Storage images for list/preview use.
 * Uses /render/image with high enough quality to stay sharp, while
 * shrinking multi‑MB covers down for faster page loads.
 * Falls back to the original URL if a transform fails.
 */
const NaMeImages = (function () {
  const OBJECT_PUBLIC = "/storage/v1/object/public/";
  const RENDER_PUBLIC = "/storage/v1/render/image/public/";

  const PRESETS = {
    // Hover preview is ~280px wide; 560 covers 2x displays.
    preview: { width: 560, quality: 78, resize: "contain" },
    // Feed / browse cards; 960 covers typical card widths at 2x.
    card: { width: 960, quality: 78, resize: "contain" },
  };

  function thumb(url, opts = {}) {
    if (!url || typeof url !== "string") return url || "";
    const preset = typeof opts === "string" ? PRESETS[opts] || PRESETS.card : null;
    const { width = 960, quality = 78, resize = "contain" } = preset || opts;
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

  function imgTag(url, { preset = "card", alt = "", className = "", loading = "lazy", sizes = "", extra = "" } = {}) {
    const original = url || "";
    const cfg = PRESETS[preset] || PRESETS.card;
    const src = thumb(original, cfg);
    const attrs = [];
    if (className) attrs.push(`class="${escapeAttr(className)}"`);
    if (loading) attrs.push(`loading="${escapeAttr(loading)}"`);
    attrs.push('decoding="async"');

    // Responsive srcset for cards so mobile loads a smaller file.
    let srcset = "";
    if (preset === "card" && src && src !== original) {
      const w1 = Math.round(cfg.width * 0.5);
      const w2 = cfg.width;
      const u1 = thumb(original, { ...cfg, width: w1 });
      const u2 = thumb(original, { ...cfg, width: w2 });
      if (u1 && u2) {
        srcset = `${u1} ${w1}w, ${u2} ${w2}w`;
        attrs.push(`srcset="${escapeAttr(srcset)}"`);
        attrs.push(`sizes="${escapeAttr(sizes || "(max-width: 640px) 50vw, 320px")}"`);
      }
    }

    const fallback = src && src !== original ? ` data-full-src="${escapeAttr(original)}"` : "";
    if (extra) attrs.push(extra);
    return `<img src="${escapeAttr(src)}" alt="${escapeAttr(alt)}" ${attrs.join(" ")}${fallback} />`;
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
            img.removeAttribute("srcset");
            img.removeAttribute("sizes");
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
