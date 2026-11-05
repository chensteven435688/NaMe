#!/usr/bin/env node
/**
 * Write sitemap.xml and robots.txt for the static Vercel site.
 *
 *   node scripts/generate-sitemap.js
 *   node scripts/generate-sitemap.js --posts posts.json
 *   node scripts/generate-sitemap.js --from-api http://127.0.0.1:8080
 *   node scripts/generate-sitemap.js --from-catalog
 *   node scripts/generate-sitemap.js --out /tmp/name-sitemap
 *
 * --posts reads a JSON array, or { "posts": [...] }, of { slug, publishedAt }.
 * --from-api pages through GET /api/posts (the Express catalog).
 * --from-catalog reads slug and published_at from the public Supabase posts
 * table. Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY (or SUPABASE_ANON_KEY).
 * When those are unset, the public values in supabase.js are used.
 *
 * The files in the repo root are what https://name-magazine.vercel.app serves.
 * Express also answers GET /sitemap.xml from local SQLite at request time.
 */
const fs = require("fs");
const path = require("path");
const { buildRobots, buildSitemap } = require("./sitemap");

const root = path.join(__dirname, "..");

function readArgs(argv) {
  const opts = { postsFile: "", fromApi: "", fromCatalog: false, outDir: root };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--posts") opts.postsFile = argv[++i] || "";
    else if (arg === "--from-api") opts.fromApi = argv[++i] || "";
    else if (arg === "--from-catalog") opts.fromCatalog = true;
    else if (arg === "--out") opts.outDir = argv[++i] || "";
    else throw new Error(`Unknown argument: ${arg}`);
  }
  const sources = [opts.postsFile, opts.fromApi, opts.fromCatalog].filter(Boolean).length;
  if (sources > 1) throw new Error("Use only one of --posts, --from-api, or --from-catalog");
  if ((argv.includes("--posts") && !opts.postsFile) || (argv.includes("--from-api") && !opts.fromApi)) {
    throw new Error("Missing value for --posts or --from-api");
  }
  if (argv.includes("--out") && !opts.outDir) throw new Error("Missing value for --out");
  return opts;
}

function readPostsFile(file) {
  const data = JSON.parse(fs.readFileSync(file, "utf8"));
  const posts = Array.isArray(data) ? data : data.posts;
  if (!Array.isArray(posts)) throw new Error("Post JSON must be an array or { posts: [] }");
  return posts;
}

async function postsFromApi(base) {
  const posts = [];
  const seen = new Set();
  const limit = 50;
  let offset = 0;
  while (offset < 10000) {
    const url = new URL("/api/posts", base.endsWith("/") ? base : `${base}/`);
    url.searchParams.set("limit", String(limit));
    url.searchParams.set("offset", String(offset));
    const res = await fetch(url);
    if (!res.ok) throw new Error(`GET ${url} failed (${res.status})`);
    const data = await res.json();
    const batch = Array.isArray(data.posts) ? data.posts : [];
    if (!batch.length) break;
    let fresh = 0;
    for (const post of batch) {
      if (!post.slug || seen.has(post.slug)) continue;
      seen.add(post.slug);
      posts.push(post);
      fresh += 1;
    }
    if (!fresh || batch.length < limit) break;
    offset += batch.length;
  }
  return posts;
}

function catalogConfig() {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY;
  if (url && key) return { url, key };
  const source = fs.readFileSync(path.join(root, "supabase.js"), "utf8");
  const urlMatch = source.match(/SUPABASE_URL = "([^"]+)"/);
  const keyMatch = source.match(/SUPABASE_PUBLISHABLE_KEY =\s*"([^"]+)"/);
  if (!urlMatch || !keyMatch) {
    throw new Error("Set SUPABASE_URL and SUPABASE_PUBLISHABLE_KEY, or keep them in supabase.js");
  }
  return { url: urlMatch[1], key: keyMatch[1] };
}

async function postsFromCatalog() {
  const { url, key } = catalogConfig();
  const posts = [];
  const seen = new Set();
  const pageSize = 1000;
  let offset = 0;
  while (offset < 10000) {
    const endpoint = new URL("/rest/v1/posts", url);
    endpoint.searchParams.set("select", "slug,published_at");
    endpoint.searchParams.set("order", "published_at.desc");
    const res = await fetch(endpoint, {
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        Range: `${offset}-${offset + pageSize - 1}`,
      },
    });
    if (!res.ok) throw new Error(`Supabase posts read failed (${res.status})`);
    const batch = await res.json();
    if (!Array.isArray(batch) || !batch.length) break;
    let fresh = 0;
    for (const row of batch) {
      if (!row.slug || seen.has(row.slug)) continue;
      seen.add(row.slug);
      posts.push({ slug: row.slug, publishedAt: row.published_at });
      fresh += 1;
    }
    if (!fresh || batch.length < pageSize) break;
    offset += batch.length;
  }
  return posts;
}

async function main() {
  const opts = readArgs(process.argv.slice(2));
  let posts = [];
  if (opts.postsFile) posts = readPostsFile(opts.postsFile);
  else if (opts.fromApi) posts = await postsFromApi(opts.fromApi);
  else if (opts.fromCatalog) posts = await postsFromCatalog();

  const xml = buildSitemap({ posts });
  fs.mkdirSync(opts.outDir, { recursive: true });
  const sitemapPath = path.join(opts.outDir, "sitemap.xml");
  const robotsPath = path.join(opts.outDir, "robots.txt");
  fs.writeFileSync(sitemapPath, xml);
  fs.writeFileSync(robotsPath, buildRobots());
  const count = (xml.match(/<loc>/g) || []).length;
  console.log(`Wrote ${count} URLs (${posts.length} posts) to ${sitemapPath}`);
}

main().catch((err) => {
  console.error(err.message || err);
  process.exit(1);
});
