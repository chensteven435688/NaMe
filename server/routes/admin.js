import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "../db.js";
import { requireAdmin, roleForEmail } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const uploadsDir = path.join(__dirname, "..", "uploads");

function publicUser(row) {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
    createdAt: row.created_at,
  };
}

function publicPost(row) {
  return {
    id: row.id,
    slug: row.slug,
    type: row.type,
    title: row.title,
    meta: row.meta,
    imageUrl: row.image_url,
    body: row.body,
    videoUrl: row.video_url,
    section: row.section,
    featured: !!row.featured,
    publishedAt: row.published_at,
    createdAt: row.created_at,
  };
}

export function registerAdminRoutes(app, { upload, uniqueSlug }) {
  app.get("/api/admin/stats", requireAdmin, (_req, res) => {
    const posts = db.prepare("SELECT COUNT(*) AS n FROM posts").get().n;
    const users = db.prepare("SELECT COUNT(*) AS n FROM users").get().n;
    const comments = db.prepare("SELECT COUNT(*) AS n FROM comments").get().n;
    const members = db
      .prepare("SELECT COUNT(*) AS n FROM users WHERE role = 'member'")
      .get().n;
    const byType = db
      .prepare("SELECT type, COUNT(*) AS n FROM posts GROUP BY type")
      .all();
    res.json({
      posts,
      users,
      comments,
      members,
      admins: users - members,
      postsByType: Object.fromEntries(byType.map((r) => [r.type, r.n])),
    });
  });

  app.get("/api/admin/users", requireAdmin, (_req, res) => {
    const rows = db
      .prepare("SELECT * FROM users ORDER BY created_at DESC")
      .all();
    res.json({ users: rows.map(publicUser) });
  });

  app.patch("/api/admin/users/:id", requireAdmin, (req, res) => {
    const row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "User not found" });
    const { role, displayName } = req.body;
    if (role !== undefined) {
      if (!["admin", "member"].includes(role)) {
        return res.status(400).json({ error: "Invalid role" });
      }
      if (row.id === req.user.sub && role !== "admin") {
        return res.status(400).json({ error: "Cannot demote yourself" });
      }
      db.prepare("UPDATE users SET role = ? WHERE id = ?").run(role, row.id);
    }
    if (displayName?.trim()) {
      db.prepare("UPDATE users SET display_name = ? WHERE id = ?").run(
        displayName.trim(),
        row.id
      );
    }
    const updated = db.prepare("SELECT * FROM users WHERE id = ?").get(row.id);
    res.json({ user: publicUser(updated) });
  });

  app.delete("/api/admin/users/:id", requireAdmin, (req, res) => {
    if (req.params.id === req.user.sub) {
      return res.status(400).json({ error: "Cannot delete your own account" });
    }
    const row = db.prepare("SELECT id FROM users WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "User not found" });
    db.prepare("DELETE FROM users WHERE id = ?").run(req.params.id);
    res.json({ ok: true });
  });

  app.delete("/api/admin/comments/:id", requireAdmin, (req, res) => {
    const row = db.prepare("SELECT id FROM comments WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Comment not found" });
    db.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?").run(
      req.params.id,
      req.params.id
    );
    res.json({ ok: true });
  });

  app.get("/api/admin/comments", requireAdmin, (_req, res) => {
    const rows = db
      .prepare(
        `SELECT c.*, u.display_name, u.email, p.title AS post_title, p.slug AS post_slug
         FROM comments c
         JOIN users u ON u.id = c.user_id
         JOIN posts p ON p.id = c.post_id
         ORDER BY c.created_at DESC
         LIMIT 200`
      )
      .all();
    res.json({
      comments: rows.map((r) => ({
        id: r.id,
        body: r.body,
        createdAt: r.created_at,
        parentId: r.parent_id,
        postId: r.post_id,
        postTitle: r.post_title,
        postSlug: r.post_slug,
        author: {
          id: r.user_id,
          displayName: r.display_name,
          email: r.email,
        },
        likeCount: db
          .prepare("SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = ?")
          .get(r.id).n,
      })),
    });
  });

  app.get("/api/admin/posts/:id", requireAdmin, (req, res) => {
    const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });
    res.json({ post: publicPost(row) });
  });

  app.patch("/api/admin/posts/:id", requireAdmin, upload.single("image"), (req, res) => {
    const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Not found" });

    const {
      type,
      title,
      meta,
      body,
      videoUrl,
      section,
      featured,
      imageUrl,
      slug: newSlug,
    } = req.body;

    let image_url = row.image_url;
    if (req.file) {
      if (row.image_url?.startsWith("/uploads/")) {
        const oldPath = path.join(__dirname, "..", row.image_url);
        if (fs.existsSync(oldPath)) fs.unlinkSync(oldPath);
      }
      image_url = `/uploads/${req.file.filename}`;
    } else if (imageUrl !== undefined) {
      image_url = imageUrl || null;
    }

    const updates = {
      type: type ?? row.type,
      title: title?.trim() ?? row.title,
      meta: meta !== undefined ? meta || null : row.meta,
      body: body ?? row.body,
      video_url: videoUrl !== undefined ? videoUrl || null : row.video_url,
      section: section !== undefined ? section || null : row.section,
      featured:
        featured !== undefined
          ? featured === "1" || featured === "true" || featured === true
            ? 1
            : 0
          : row.featured,
      image_url,
      slug: row.slug,
    };

    if (newSlug?.trim()) {
      const slug = newSlug.trim().toLowerCase().replace(/[^a-z0-9-]+/g, "-");
      if (slug && slug !== row.slug) {
        if (db.prepare("SELECT 1 FROM posts WHERE slug = ? AND id != ?").get(slug, row.id)) {
          return res.status(409).json({ error: "Slug already in use" });
        }
        updates.slug = slug;
      }
    } else if (title && title.trim() !== row.title) {
      updates.slug = uniqueSlug(title.trim(), row.id);
    }

    db.prepare(
      `UPDATE posts SET
        type = ?, title = ?, meta = ?, image_url = ?, body = ?,
        video_url = ?, section = ?, featured = ?, slug = ?
       WHERE id = ?`
    ).run(
      updates.type,
      updates.title,
      updates.meta,
      updates.image_url,
      updates.body,
      updates.video_url,
      updates.section,
      updates.featured,
      updates.slug,
      row.id
    );

    const updated = db.prepare("SELECT * FROM posts WHERE id = ?").get(row.id);
    res.json({ post: publicPost(updated) });
  });
}

export function syncUserRole(userRow) {
  if (!userRow) return userRow;
  if (roleForEmail(userRow.email) === "admin" && userRow.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(userRow.id);
    userRow.role = "admin";
  }
  return userRow;
}
