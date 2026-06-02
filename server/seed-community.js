import db from "./db.js";
import { randomUUID } from "crypto";

export function seedCommunity() {
  const count = db.prepare("SELECT COUNT(*) AS n FROM community_posts").get().n;
  if (count > 0) return 0;

  const user = db.prepare("SELECT id FROM users LIMIT 1").get();
  const userId = user?.id || null;
  const now = new Date().toISOString();

  const samples = [
    {
      title: "Milan mood",
      caption: "Textures and tailoring from the latest street style.",
      image_url:
        "https://images.unsplash.com/photo-1483985988354-763728e3685b?w=600&q=80",
    },
    {
      title: "Studio light",
      caption: "Soft window light for portrait editorials.",
      image_url:
        "https://images.unsplash.com/photo-1515886657613-9f3525f0cc0b?w=600&q=80",
    },
    {
      title: "Night palette",
      caption: "Black, chrome, and a single red accent.",
      image_url:
        "https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=600&q=80",
    },
    {
      title: "Fabric study",
      caption: "Wool, leather, and raw denim layered.",
      image_url:
        "https://images.unsplash.com/photo-1496747611176-843222e1e14c?w=600&q=80",
    },
    {
      title: "Paris walk",
      caption: "Sunday morning along the Seine.",
      image_url:
        "https://images.unsplash.com/photo-1469334031218-e382a71abbee?w=600&q=80",
    },
    {
      title: "Beauty close-up",
      caption: "Graphic liner and bare skin.",
      image_url:
        "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=600&q=80",
    },
    {
      title: "Film still",
      caption: "Frame from an upcoming NaMe short.",
      image_url:
        "https://images.unsplash.com/photo-1574267432553-4b4628081ad4?w=600&q=80",
    },
    {
      title: "Accessories",
      caption: "Silver jewelry stacked minimal.",
      image_url:
        "https://images.unsplash.com/photo-1614850523459-c2f4c699c52e?w=600&q=80",
    },
  ];

  const insert = db.prepare(
    `INSERT INTO community_posts (id, user_id, title, caption, image_url, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  );

  for (const s of samples) {
    insert.run(
      randomUUID(),
      userId,
      s.title,
      s.caption,
      s.image_url,
      now
    );
  }

  console.log(`Seeded ${samples.length} community posts.`);
  return samples.length;
}
