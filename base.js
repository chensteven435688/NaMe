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
  const runFix = () => NaMeBase.fixLinks();
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", runFix);
  } else {
    runFix();
  }
}

/**
 * NaMe — media helpers.
 * Images stored in Supabase are served through its resize endpoint so pages
 * download a screen-sized WebP instead of the multi-megabyte original.
 * Video links are turned into the right player (file, YouTube, Vimeo).
 */
const NaMeMedia = (function () {
  const STORAGE_RE = /^(https:\/\/[a-z0-9-]+\.supabase\.co)\/storage\/v1\/object\/public\/([^?#]+)/i;
  const RESIZABLE_RE = /\.(jpe?g|png|webp|avif|bmp|heic|heif)$/i;
  const DEFAULT_WIDTHS = [480, 800, 1200, 1800];

  function resizable(url) {
    const m = STORAGE_RE.exec(String(url || "").trim());
    if (!m || !RESIZABLE_RE.test(m[2])) return null;
    return m;
  }

  /** Resized URL for a Supabase-stored image; any other URL is returned unchanged. */
  function img(url, width = 1200, quality = 72) {
    const m = resizable(url);
    if (!m) return String(url || "");
    return `${m[1]}/storage/v1/render/image/public/${m[2]}?width=${Math.round(width)}&quality=${quality}&resize=contain`;
  }

  /** srcset string for a Supabase-stored image, or "" when the URL can't be resized. */
  function srcset(url, widths = DEFAULT_WIDTHS, quality = 72) {
    if (!resizable(url)) return "";
    return widths.map((w) => `${img(url, w, quality)} ${w}w`).join(", ");
  }

  /** ` srcset="…" sizes="…"` attribute text (already escaped), or "" when not resizable. */
  function srcsetAttr(url, sizes = "100vw") {
    const set = srcset(url);
    if (!set) return "";
    const esc = (v) => String(v).replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
    return ` srcset="${esc(set)}" sizes="${esc(sizes)}"`;
  }

  /** Rewrites <img> tags inside an element/document fragment to use resized sources. */
  function optimizeImages(root, { width = 1200, sizes = "(max-width: 900px) 100vw, 1200px" } = {}) {
    if (!root?.querySelectorAll) return;
    root.querySelectorAll("img[src]").forEach((el) => {
      const src = el.getAttribute("src");
      if (!resizable(src)) return;
      el.setAttribute("src", img(src, width));
      el.setAttribute("srcset", srcset(src));
      el.setAttribute("sizes", sizes);
      if (!el.hasAttribute("loading")) el.setAttribute("loading", "lazy");
      el.setAttribute("decoding", "async");
    });
  }

  function youtubeId(u) {
    const host = u.hostname.replace(/^(www\.|m\.|music\.)/, "");
    if (host === "youtu.be") return u.pathname.split("/")[1] || "";
    if (host === "youtube.com" || host === "youtube-nocookie.com") {
      if (u.pathname === "/watch") return u.searchParams.get("v") || "";
      const m = /^\/(?:embed|shorts|live|v)\/([^/?#]+)/.exec(u.pathname);
      return m ? m[1] : "";
    }
    return "";
  }

  function youtubeStart(u) {
    const t = u.searchParams.get("t") || u.searchParams.get("start") || "";
    const m = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/.exec(t);
    if (!t || !m) return 0;
    return (Number(m[1] || 0) * 3600) + (Number(m[2] || 0) * 60) + Number(m[3] || 0);
  }

  /**
   * Classifies a video link.
   * → { kind: "youtube" | "vimeo", embed } for hosted players,
   *   { kind: "file", src } for direct video files,
   *   { kind: "link", href } for anything else (opened in a new tab).
   */
  function video(url) {
    const raw = String(url || "").trim();
    if (!raw) return null;
    let u;
    try {
      u = new URL(raw, typeof location !== "undefined" ? location.href : undefined);
    } catch {
      return null;
    }
    if (!/^https?:$/.test(u.protocol)) return null;

    const yt = youtubeId(u);
    if (/^[\w-]{6,20}$/.test(yt)) {
      const start = youtubeStart(u);
      return {
        kind: "youtube",
        embed: `https://www.youtube-nocookie.com/embed/${yt}?rel=0&playsinline=1${start ? `&start=${start}` : ""}`,
      };
    }

    const host = u.hostname.replace(/^www\./, "");
    if (host === "vimeo.com" || host === "player.vimeo.com") {
      const parts = u.pathname.split("/").filter(Boolean);
      const id = parts.find((p) => /^\d+$/.test(p));
      if (id) {
        const idx = parts.indexOf(id);
        const hash = u.searchParams.get("h") || (parts[idx + 1] && /^[a-f0-9]+$/i.test(parts[idx + 1]) ? parts[idx + 1] : "");
        return { kind: "vimeo", embed: `https://player.vimeo.com/video/${id}?dnt=1${hash ? `&h=${hash}` : ""}` };
      }
    }

    if (/\.(mp4|m4v|webm|mov|ogv|ogg|m3u8)$/i.test(u.pathname) || /\/storage\/v1\/object\//.test(u.pathname)) {
      return { kind: "file", src: u.href };
    }
    return { kind: "link", href: u.href };
  }

  return { img, srcset, srcsetAttr, optimizeImages, video };
})();

if (typeof window !== "undefined") window.NaMeMedia = NaMeMedia;
