import db from "./db.js";
import { randomUUID } from "crypto";

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

export function seedDatabase() {
const count = db.prepare("SELECT COUNT(*) AS n FROM posts").get().n;
if (count > 0) {
  return 0;
}

const now = new Date().toISOString();
const posts = [
  {
    type: "article",
    title: "Milan Fashion Week FW26 Street Style Part.2",
    meta: "Fashion — 02 Mar 2026",
    image_url:
      "https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=600&q=80",
    section: "latest",
  },
  {
    type: "article",
    title: "Luisa Beccaria FW26 Backstage at Milan Fashion Week",
    meta: "Fashion — 27 Feb 2026",
    image_url:
      "https://images.unsplash.com/photo-1496747611176-843222e1e14c?w=600&q=80",
    section: "latest",
  },
  {
    type: "article",
    title: "Milan Fashion Week FW26 Street Style Part.1",
    meta: "Fashion — 26 Feb 2026",
    image_url:
      "https://images.unsplash.com/photo-1515886657613-9f3525f0cc0b?w=600&q=80",
    section: "latest",
  },
  {
    type: "article",
    title: "The Most Refined Choice for the New Year",
    meta: "Life — 13 Feb 2026",
    image_url:
      "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=600&q=80",
    section: "latest",
  },
  {
    type: "article",
    title: "Why Delvaux? A Conversation with Casper Bosmans",
    meta: "Fashion, Art — 06 Feb 2026",
    image_url:
      "https://images.unsplash.com/photo-1539109136881-3be0616acf4b?w=600&q=80",
    section: "latest",
  },
  {
    type: "article",
    title: "Paris Fashion Week FW26 Street Style",
    meta: "Fashion — 02 Feb 2026",
    image_url:
      "https://images.unsplash.com/photo-1469334031218-e382a71abbee?w=600&q=80",
    section: "latest",
  },
  {
    type: "editorial",
    title: "Folie",
    image_url:
      "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=800&q=80",
    section: "latest",
    featured: 1,
  },
  {
    type: "editorial",
    title: "Equipoise",
    image_url:
      "https://images.unsplash.com/photo-1529625665599-99d14a288a4d?w=800&q=80",
    section: "latest",
    featured: 1,
  },
  {
    type: "editorial",
    title: "Birds Don't Cry",
    image_url:
      "https://images.unsplash.com/photo-1517841905240-472988babdf9?w=800&q=80",
    section: "latest",
    featured: 1,
  },
  {
    type: "editorial",
    title: "Primal Spectrum",
    image_url:
      "https://images.unsplash.com/photo-1488426862026-3ee34a7d66df?w=800&q=80",
    section: "latest",
  },
  {
    type: "editorial",
    title: "Silent Gaze",
    image_url:
      "https://images.unsplash.com/photo-1502716118656-6e4cc2f1a83c?w=800&q=80",
    section: "popular",
  },
  {
    type: "editorial",
    title: "Life After",
    image_url:
      "https://images.unsplash.com/photo-1524504388940-b1c1722653e1?w=800&q=80",
    section: "popular",
  },
  {
    type: "editorial",
    title: "Aurora",
    image_url:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=800&q=80",
    section: "popular",
  },
  {
    type: "editorial",
    title: "Before Identity",
    image_url:
      "https://images.unsplash.com/photo-1509963536430-18c6d71b933e?w=800&q=80",
    section: "popular",
  },
  {
    type: "film",
    title: "Silent Gaze",
    image_url:
      "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=600&q=80",
    section: "latest",
  },
  {
    type: "film",
    title: "Primal Spectrum",
    image_url:
      "https://images.unsplash.com/photo-1598899134739-652a0d4f0b09?w=600&q=80",
    section: "latest",
  },
  {
    type: "film",
    title: "Life After",
    image_url:
      "https://images.unsplash.com/photo-1574267432553-4b4628081ad4?w=600&q=80",
    section: "latest",
  },
  {
    type: "film",
    title: "Aurora",
    image_url:
      "https://images.unsplash.com/photo-1478720568477-152d9b164e63?w=600&q=80",
    section: "latest",
  },
  {
    type: "film",
    title: "The Shape of Sound",
    image_url:
      "https://images.unsplash.com/photo-1485846234645-a62644f84728?w=600&q=80",
    section: "latest",
  },
  {
    type: "film",
    title: "Before Identity",
    image_url:
      "https://images.unsplash.com/photo-1536440136628-849c177e76a1?w=600&q=80",
    section: "latest",
  },
  {
    type: "short",
    title: "Short 1",
    image_url:
      "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80",
    section: "latest",
  },
  {
    type: "short",
    title: "Short 2",
    image_url:
      "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=400&q=80",
    section: "latest",
  },
  {
    type: "short",
    title: "Short 3",
    image_url:
      "https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=400&q=80",
    section: "latest",
  },
  {
    type: "short",
    title: "Short 4",
    image_url:
      "https://images.unsplash.com/photo-1618172193626-7a4f33a7d2a8?w=400&q=80",
    section: "latest",
  },
];

const insert = db.prepare(`
  INSERT INTO posts (id, slug, type, title, meta, image_url, body, video_url, section, featured, author_id, published_at, created_at)
  VALUES (@id, @slug, @type, @title, @meta, @image_url, @body, @video_url, @section, @featured, NULL, @published_at, @created_at)
`);

const slugUsed = new Set();
for (const p of posts) {
  let base = slugify(p.title);
  let slug = base;
  let n = 2;
  while (slugUsed.has(slug)) {
    slug = `${base}-${n++}`;
  }
  slugUsed.add(slug);
  insert.run({
    id: randomUUID(),
    slug,
    type: p.type,
    title: p.title,
    meta: p.meta || null,
    image_url: p.image_url,
    body: p.body || `<p>${p.title}</p>`,
    video_url: p.video_url || null,
    section: p.section || null,
    featured: p.featured ? 1 : 0,
    published_at: now,
    created_at: now,
  });
}

console.log(`Seeded ${posts.length} posts.`);
return posts.length;
}
