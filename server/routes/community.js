import { randomUUID } from "crypto";
import db from "../db.js";
import { optionalAuth, requireAuth, requireAdmin } from "../middleware/auth.js";

function publicCommunityPost(row, userId) {
  const likeCount = db
    .prepare("SELECT COUNT(*) AS n FROM community_likes WHERE post_id = ?")
    .get(row.id).n;
  const commentCount = db
    .prepare("SELECT COUNT(*) AS n FROM community_comments WHERE post_id = ?")
    .get(row.id).n;
  const liked = userId
    ? !!db
        .prepare("SELECT 1 FROM community_likes WHERE post_id = ? AND user_id = ?")
        .get(row.id, userId)
    : false;

  return {
    id: row.id,
    title: row.title,
    caption: row.caption,
    imageUrl: row.image_url,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      displayName: row.display_name || "NaMe Member",
      avatarUrl: row.avatar_url || null,
      signature: row.signature || null,
    },
    likeCount,
    commentCount,
    liked,
  };
}

export function registerCommunityRoutes(app, { upload }) {
  app.get("/api/community/stats", (_req, res) => {
    const posts = db.prepare("SELECT COUNT(*) AS n FROM community_posts").get().n;
    const members = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    res.json({ posts, members });
  });

  app.get("/api/community/posts", optionalAuth, (req, res) => {
    const userId = req.user?.sub || null;
    const rows = db
      .prepare(
        `SELECT p.*, u.display_name, u.avatar_url, u.signature
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC
         LIMIT 100`
      )
      .all();
    res.json({ posts: rows.map((r) => publicCommunityPost(r, userId)) });
  });

  app.get("/api/community/posts/:id", optionalAuth, (req, res) => {
    const userId = req.user?.sub || null;
    const row = db
      .prepare(
        `SELECT p.*, u.display_name, u.avatar_url, u.signature
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.id = ?`
      )
      .get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ post: publicCommunityPost(row, userId) });
  });

  app.get("/api/users/:id/community-posts", optionalAuth, (req, res) => {
    const viewerId = req.user?.sub || null;
    const userExists = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!userExists) return res.status(404).json({ error: "Member not found" });
    const rows = db
      .prepare(
        `SELECT p.*, u.display_name, u.avatar_url, u.signature
         FROM community_posts p
         LEFT JOIN users u ON u.id = p.user_id
         WHERE p.user_id = ?
         ORDER BY p.created_at DESC
         LIMIT 100`
      )
      .all(req.params.id);
    res.json({ posts: rows.map((r) => publicCommunityPost(r, viewerId)) });
  });

  app.post("/api/community/posts", requireAuth, upload.single("image"), (req, res) => {
    const { title, caption, imageUrl } = req.body;
    const image_url = req.file
      ? `/uploads/${req.file.filename}`
      : imageUrl?.trim() || null;
    if (!image_url) {
      return res.status(400).json({ error: "Image required" });
    }
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO community_posts (id, user_id, title, caption, image_url, created_at)
       VALUES (?, ?, ?, ?, ?, ?)`
    ).run(
      id,
      req.user.sub,
      title?.trim() || null,
      caption?.trim() || null,
      image_url,
      now
    );
    const row = db
      .prepare(
        `SELECT p.*, u.display_name, u.avatar_url, u.signature FROM community_posts p
         LEFT JOIN users u ON u.id = p.user_id WHERE p.id = ?`
      )
      .get(id);
    res.status(201).json({ post: publicCommunityPost(row, req.user.sub) });
  });

  app.post("/api/community/posts/:id/like", requireAuth, (req, res) => {
    const post = db.prepare("SELECT id FROM community_posts WHERE id = ?").get(req.params.id);
    if (!post) return res.status(404).json({ error: "Not found" });
    const existing = db
      .prepare("SELECT 1 FROM community_likes WHERE user_id = ? AND post_id = ?")
      .get(req.user.sub, req.params.id);
    if (existing) {
      db.prepare("DELETE FROM community_likes WHERE user_id = ? AND post_id = ?").run(
        req.user.sub,
        req.params.id
      );
    } else {
      db.prepare(
        "INSERT INTO community_likes (user_id, post_id, created_at) VALUES (?, ?, ?)"
      ).run(req.user.sub, req.params.id, new Date().toISOString());
    }
    const likeCount = db
      .prepare("SELECT COUNT(*) AS n FROM community_likes WHERE post_id = ?")
      .get(req.params.id).n;
    const liked = !!db
      .prepare("SELECT 1 FROM community_likes WHERE user_id = ? AND post_id = ?")
      .get(req.user.sub, req.params.id);
    res.json({ likeCount, liked });
  });

  app.get("/api/community/posts/:id/comments", optionalAuth, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, u.display_name, u.avatar_url, u.signature
         FROM community_comments c
         JOIN users u ON u.id = c.user_id
         WHERE c.post_id = ?
         ORDER BY c.created_at ASC`
      )
      .all(req.params.id);
    res.json({
      comments: rows.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        author: {
          id: r.user_id,
          displayName: r.display_name,
          avatarUrl: r.avatar_url || null,
          signature: r.signature || null,
        },
      })),
    });
  });

  app.post("/api/community/posts/:id/comments", requireAuth, (req, res) => {
    const post = db.prepare("SELECT id FROM community_posts WHERE id = ?").get(req.params.id);
    if (!post) return res.status(404).json({ error: "Not found" });
    const { body } = req.body;
    if (!body?.trim()) return res.status(400).json({ error: "Comment required" });
    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO community_comments (id, post_id, user_id, body, created_at)
       VALUES (?, ?, ?, ?, ?)`
    ).run(id, post.id, req.user.sub, body.trim(), now);
    const row = db
      .prepare(
        `SELECT c.*, u.display_name, u.avatar_url, u.signature FROM community_comments c
         JOIN users u ON u.id = c.user_id WHERE c.id = ?`
      )
      .get(id);
    res.status(201).json({
      comment: {
        id: row.id,
        body: row.body,
        createdAt: row.created_at,
        author: {
          id: row.user_id,
          displayName: row.display_name,
          avatarUrl: row.avatar_url || null,
          signature: row.signature || null,
        },
      },
    });
  });

  app.delete("/api/community/comments/:id", requireAuth, (req, res) => {
    const row = db.prepare("SELECT * FROM community_comments WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.user_id !== req.user.sub && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }
    db.prepare("DELETE FROM community_comments WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/community/posts/:id", requireAuth, (req, res) => {
    const row = db.prepare("SELECT * FROM community_posts WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    if (row.user_id !== req.user.sub && req.user.role !== "admin") {
      return res.status(403).json({ error: "Not allowed" });
    }
    db.prepare("DELETE FROM community_posts WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });
}
