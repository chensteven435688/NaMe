/**
 * NaMe — Open Graph, Twitter cards, canonical URLs, and JSON-LD.
 *
 * Absolute share URLs use SITE_ORIGIN, the live Vercel site, including when
 * the page is opened on localhost or GitHub Pages. Story tags are filled in
 * after the post loads (see post.js). Other public pages keep the tags in
 * sync with the visible title and description when the language changes.
 */
const NaMeSeo = (function () {
  const SITE_ORIGIN = "https://name-magazine.vercel.app";
  const SITE_NAME = "NaMe Magazine";
  const DEFAULT_IMAGE_PATH = "/images/hero/hero-1.png";
  const LOGO_PATH = "/images/favicon.png";
  const BRAND_DESCRIPTION =
    "NaMe Magazine is a platform for artists before the world knows their names — photography, design, film, writing, and visual art.";
  const JSON_LD_ID = "name-seo-jsonld";

  const OG_LOCALE = {
    en: "en_US",
    ko: "ko_KR",
    it: "it_IT",
    fr: "fr_FR",
    es: "es_ES",
    ja: "ja_JP",
    "zh-Hans": "zh_CN",
    "zh-Hant": "zh_TW",
  };

  function absoluteUrl(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) return raw;
    if (raw.startsWith("//")) return `https:${raw}`;
    const path = raw.startsWith("/") ? raw : `/${raw}`;
    return `${SITE_ORIGIN}${path}`;
  }

  function shareImage(url) {
    const raw = String(url || "").trim();
    if (!raw || /^(?:javascript|data|vbscript):/i.test(raw)) {
      return absoluteUrl(DEFAULT_IMAGE_PATH);
    }
    return absoluteUrl(raw);
  }

  function upsertMeta(attr, key, content) {
    if (!content) return;
    let el = document.head.querySelector(`meta[${attr}="${key}"]`);
    if (!el) {
      el = document.createElement("meta");
      el.setAttribute(attr, key);
      document.head.appendChild(el);
    }
    el.setAttribute("content", content);
  }

  function upsertLink(rel, href) {
    let el = document.head.querySelector(`link[rel="${rel}"]`);
    if (!el) {
      el = document.createElement("link");
      el.setAttribute("rel", rel);
      document.head.appendChild(el);
    }
    el.setAttribute("href", href);
  }

  function upsertJsonLd(data) {
    let el = document.getElementById(JSON_LD_ID);
    if (!el) {
      el = document.createElement("script");
      el.id = JSON_LD_ID;
      el.type = "application/ld+json";
      document.head.appendChild(el);
    }
    el.textContent = JSON.stringify(data);
  }

  function plainText(html) {
    const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
    doc.querySelectorAll("script, style").forEach((node) => node.remove());
    return (doc.body.textContent || "").replace(/\s+/g, " ").trim();
  }

  function clip(text, max) {
    const clean = String(text || "").replace(/\s+/g, " ").trim();
    if (clean.length <= max) return clean;
    const cut = clean.slice(0, max - 1);
    const space = cut.lastIndexOf(" ");
    const base = space > 80 ? cut.slice(0, space) : cut;
    return `${base.trimEnd()}…`;
  }

  function brandDescription() {
    if (typeof NaMeI18n !== "undefined") {
      const text = NaMeI18n.t(NaMeI18n.getLang(), "pageDescription");
      if (text && text !== "pageDescription") return text;
    }
    return BRAND_DESCRIPTION;
  }

  function excerpt(post) {
    const fromBody = plainText(post?.body);
    if (fromBody) return clip(fromBody, 180);
    return brandDescription();
  }

  function postUrl(slug) {
    const clean = String(slug || "")
      .replace(/[\u0000-\u001f\u007f]/g, "")
      .trim();
    if (!clean) return `${SITE_ORIGIN}/post`;
    return `${SITE_ORIGIN}/post?slug=${encodeURIComponent(clean)}`;
  }

  function applyShare({ title, description, image, url, type }) {
    const imageUrl = shareImage(image || DEFAULT_IMAGE_PATH);
    const pageUrl = url || canonicalFromLocation();
    const desc = description || brandDescription();
    if (title) document.title = title;
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);

    upsertMeta("property", "og:site_name", SITE_NAME);
    upsertMeta("property", "og:type", type || "website");
    upsertMeta("property", "og:title", title);
    upsertMeta("property", "og:description", desc);
    upsertMeta("property", "og:url", pageUrl);
    upsertMeta("property", "og:image", imageUrl);
    upsertMeta("property", "og:image:alt", title || SITE_NAME);
    const lang = document.documentElement.lang || "en";
    upsertMeta("property", "og:locale", OG_LOCALE[lang] || "en_US");
    upsertMeta("name", "twitter:card", "summary_large_image");
    upsertMeta("name", "twitter:title", title);
    upsertMeta("name", "twitter:description", desc);
    upsertMeta("name", "twitter:image", imageUrl);
    upsertLink("canonical", pageUrl);
  }

  function canonicalFromLocation() {
    let path = location.pathname || "/";
    const base = typeof NaMeBase !== "undefined" ? NaMeBase.getBase() : "";
    if (base && path.startsWith(base)) path = path.slice(base.length) || "/";
    path = path.replace(/\/index\.html$/i, "/").replace(/\.html$/i, "");
    if (!path.startsWith("/")) path = `/${path}`;
    if (path.length > 1 && path.endsWith("/")) path = path.slice(0, -1);
    const slug = new URLSearchParams(location.search).get("slug");
    if ((path === "/post" || path.endsWith("/post")) && slug) return postUrl(slug);
    return absoluteUrl(path || "/");
  }

  function storyMetaLocked() {
    return document.documentElement.dataset.shareKind === "article";
  }

  function websiteGraph(description) {
    return {
      "@context": "https://schema.org",
      "@graph": [
        {
          "@type": "Organization",
          "@id": `${SITE_ORIGIN}/#organization`,
          name: SITE_NAME,
          url: `${SITE_ORIGIN}/`,
          logo: absoluteUrl(LOGO_PATH),
        },
        {
          "@type": "WebSite",
          "@id": `${SITE_ORIGIN}/#website`,
          name: SITE_NAME,
          url: `${SITE_ORIGIN}/`,
          description,
          inLanguage: document.documentElement.lang || "en",
          publisher: { "@id": `${SITE_ORIGIN}/#organization` },
        },
      ],
    };
  }

  function syncFromDocument() {
    if (storyMetaLocked()) return;
    const title = document.title;
    const description =
      document.querySelector('meta[name="description"]')?.getAttribute("content") ||
      brandDescription();
    const located = canonicalFromLocation();
    const existingUrl = document.querySelector('meta[property="og:url"]')?.getAttribute("content");
    const url = located.includes("?slug=")
      ? located
      : existingUrl && existingUrl.startsWith(SITE_ORIGIN)
        ? existingUrl
        : located;
    const image = document.querySelector('meta[property="og:image"]')?.getAttribute("content");
    applyShare({ title, description, image, url, type: "website" });
    if (document.body.classList.contains("page-home")) upsertJsonLd(websiteGraph(description));
  }

  function applyPost(post) {
    const headline = String(post?.title || "").trim();
    const title = headline ? `${headline} — ${SITE_NAME}` : `${SITE_NAME} — Before the Name`;
    const description = excerpt(post);
    const image = post?.imageUrl;
    const url = postUrl(post?.slug);
    document.documentElement.dataset.shareKind = "article";
    applyShare({ title, description, image, url, type: "article" });

    const data = {
      "@context": "https://schema.org",
      "@type": "Article",
      headline: headline || title,
      description,
      mainEntityOfPage: url,
      image: [shareImage(image)],
      author: {
        "@type": "Organization",
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
      },
      publisher: {
        "@type": "Organization",
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
        logo: {
          "@type": "ImageObject",
          url: absoluteUrl(LOGO_PATH),
        },
      },
      isPartOf: {
        "@type": "WebSite",
        name: SITE_NAME,
        url: `${SITE_ORIGIN}/`,
      },
    };
    const published = post?.publishedAt || post?.published_at;
    if (published && !Number.isNaN(new Date(published).getTime())) {
      data.datePublished = new Date(published).toISOString();
    }
    upsertJsonLd(data);
  }

  document.addEventListener("name:languagechange", () => {
    if (storyMetaLocked()) return;
    if (document.body.dataset.pageTitle) return;
    syncFromDocument();
  });

  return {
    SITE_ORIGIN,
    SITE_NAME,
    DEFAULT_IMAGE_PATH,
    postUrl,
    applyPost,
    syncFromDocument,
  };
})();

if (typeof window !== "undefined") window.NaMeSeo = NaMeSeo;
