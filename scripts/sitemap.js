/**
 * Sitemap and robots text for NaMe Magazine.
 * Canonical URLs use the live Vercel origin and extensionless paths
 * (vercel.json cleanUrls). Story URLs match NaMeSeo.postUrl in seo.js.
 */
const SITE_ORIGIN = "https://name-magazine.vercel.app";

const STATIC_PATHS = [
  "/",
  "/stories",
  "/archive",
  "/magazine",
  "/editorial",
  "/articles",
  "/film",
  "/artists",
  "/exclusive",
  "/about",
  "/business",
  "/contact",
  "/community",
  "/submission",
  "/subscribe",
  "/terms",
  "/privacy",
];

function xmlEscape(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function pageUrl(pathname) {
  if (!pathname || pathname === "/") return `${SITE_ORIGIN}/`;
  return `${SITE_ORIGIN}${pathname.startsWith("/") ? pathname : `/${pathname}`}`;
}

function cleanSlug(slug) {
  return String(slug || "")
    .replace(/[\u0000-\u001f\u007f]/g, "")
    .trim();
}

function postUrl(slug) {
  const clean = cleanSlug(slug);
  if (!clean) return "";
  return `${SITE_ORIGIN}/post?slug=${encodeURIComponent(clean)}`;
}

function lastmodFor(value) {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toISOString().slice(0, 10);
}

function buildSitemap({ posts = [] } = {}) {
  const urls = STATIC_PATHS.map((pathname) => ({ loc: pageUrl(pathname) }));
  const seen = new Set(urls.map((entry) => entry.loc));

  for (const post of posts) {
    const loc = postUrl(post.slug);
    if (!loc || seen.has(loc)) continue;
    seen.add(loc);
    const entry = { loc };
    const lastmod = lastmodFor(post.publishedAt || post.published_at);
    if (lastmod) entry.lastmod = lastmod;
    urls.push(entry);
  }

  const body = urls
    .map((entry) => {
      const lastmod = entry.lastmod ? `\n    <lastmod>${xmlEscape(entry.lastmod)}</lastmod>` : "";
      return `  <url>\n    <loc>${xmlEscape(entry.loc)}</loc>${lastmod}\n  </url>`;
    })
    .join("\n");

  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`;
}

function buildRobots() {
  return `User-agent: *\nAllow: /\n\nSitemap: ${SITE_ORIGIN}/sitemap.xml\n`;
}

module.exports = {
  SITE_ORIGIN,
  STATIC_PATHS,
  pageUrl,
  postUrl,
  buildSitemap,
  buildRobots,
};
