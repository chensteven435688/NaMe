import { randomUUID } from "crypto";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import db from "../db.js";
import { requireAuth, requireAdmin } from "../middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ALLOWED_MEDIA = [
  "photography",
  "design",
  "film",
  "writing",
  "visual-art",
  "other",
];

function publicSubmission(row, user = null) {
  return {
    id: row.id,
    title: row.title,
    medium: row.medium,
    description: row.description,
    fileUrl: row.file_url,
    fileName: row.file_name,
    fileMime: row.file_mime,
    status: row.status,
    postId: row.post_id,
    postSlug: row.post_slug || null,
    adminNote: row.admin_note,
    createdAt: row.created_at,
    reviewedAt: row.reviewed_at,
    ...(user
      ? {
          author: {
            id: user.id,
            displayName: user.display_name,
            email: user.email,
          },
        }
      : {}),
  };
}

export function registerSubmissionRoutes(app, { submissionUpload, uniqueSlug }) {
  app.get("/api/submissions/mine", requireAuth, (req, res) => {
    const rows = db
      .prepare(
        `SELECT s.*, p.slug AS post_slug
         FROM submissions s
         LEFT JOIN posts p ON p.id = s.post_id
         WHERE s.user_id = ?
         ORDER BY s.created_at DESC`
      )
      .all(req.user.sub);

    const stats = db
      .prepare(
        `SELECT
           COUNT(*) AS total,
           SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) AS pending,
           SUM(CASE WHEN status = 'published' THEN 1 ELSE 0 END) AS published,
           SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END) AS rejected
         FROM submissions WHERE user_id = ?`
      )
      .get(req.user.sub);

    res.json({
      submissions: rows.map((r) => publicSubmission(r)),
      stats: {
        total: stats.total || 0,
        pending: stats.pending || 0,
        published: stats.published || 0,
        rejected: stats.rejected || 0,
      },
    });
  });

  app.post("/api/submissions", requireAuth, submissionUpload.single("file"), (req, res) => {
    const { title, medium, description } = req.body;
    if (!title?.trim()) {
      return res.status(400).json({ error: "Title required" });
    }
    if (!medium || !ALLOWED_MEDIA.includes(medium)) {
      return res.status(400).json({ error: "Select a valid medium" });
    }
    if (!req.file) {
      return res.status(400).json({ error: "Upload a file (image, PDF, or video)" });
    }

    const id = randomUUID();
    const now = new Date().toISOString();
    db.prepare(
      `INSERT INTO submissions
        (id, user_id, title, medium, description, file_url, file_name, file_mime, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?)`
    ).run(
      id,
      req.user.sub,
      title.trim(),
      medium,
      description?.trim() || null,
      `/uploads/${req.file.filename}`,
      req.file.originalname,
      req.file.mimetype,
      now
    );

    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(id);
    res.status(201).json({ submission: publicSubmission(row) });
  });

  app.get("/api/admin/submissions", requireAdmin, (req, res) => {
    const { status } = req.query;
    let sql = `
      SELECT s.*, u.display_name, u.email, p.slug AS post_slug
      FROM submissions s
      JOIN users u ON u.id = s.user_id
      LEFT JOIN posts p ON p.id = s.post_id
      WHERE 1=1`;
    const params = [];
    if (status) {
      sql += " AND s.status = ?";
      params.push(status);
    }
    sql += " ORDER BY s.created_at DESC LIMIT 200";
    const rows = db.prepare(sql).all(...params);

    const counts = db
      .prepare(`SELECT status, COUNT(*) AS n FROM submissions GROUP BY status`)
      .all();

    res.json({
      submissions: rows.map((r) =>
        publicSubmission(r, {
          id: r.user_id,
          display_name: r.display_name,
          email: r.email,
        })
      ),
      counts: Object.fromEntries(counts.map((c) => [c.status, c.n])),
    });
  });

  app.patch("/api/admin/submissions/:id", requireAdmin, (req, res) => {
    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Submission not found" });

    const { status, adminNote } = req.body;
    if (status && !["pending", "published", "rejected"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const now = new Date().toISOString();
    db.prepare(
      `UPDATE submissions SET
        status = COALESCE(?, status),
        admin_note = COALESCE(?, admin_note),
        reviewed_at = ?,
        reviewed_by = ?
       WHERE id = ?`
    ).run(
      status || null,
      adminNote !== undefined ? adminNote || null : null,
      now,
      req.user.sub,
      row.id
    );

    const updated = db
      .prepare(
        `SELECT s.*, u.display_name, u.email, p.slug AS post_slug
         FROM submissions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN posts p ON p.id = s.post_id
         WHERE s.id = ?`
      )
      .get(row.id);

    res.json({
      submission: publicSubmission(updated, {
        id: updated.user_id,
        display_name: updated.display_name,
        email: updated.email,
      }),
    });
  });

  app.post("/api/admin/submissions/:id/publish", requireAdmin, (req, res) => {
    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Submission not found" });
    if (row.status === "published" && row.post_id) {
      return res.status(400).json({ error: "Already published" });
    }

    const { type, section, meta } = req.body;
    const allowedTypes = ["article", "editorial", "film", "short"];
    const postType = allowedTypes.includes(type) ? type : "article";

    const isVideo = row.file_mime?.startsWith("video/");
    const isImage = row.file_mime?.startsWith("image/");
    let postBody = row.description?.trim()
      ? `<p>${escapeHtml(row.description.trim())}</p>`
      : `<p>${escapeHtml(row.title)}</p>`;

    if (row.file_mime === "application/pdf") {
      postBody += `<p><a href="${row.file_url}" target="_blank" rel="noopener">View submitted PDF</a></p>`;
    }

    const postId = randomUUID();
    const slug = uniqueSlug(row.title);
    const now = new Date().toISOString();

    db.prepare(
      `INSERT INTO posts (id, slug, type, title, meta, image_url, body, video_url, section, featured, author_id, published_at, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
    ).run(
      postId,
      slug,
      postType,
      row.title,
      meta || `${row.medium} — submission`,
      isImage ? row.file_url : null,
      postBody,
      isVideo ? row.file_url : null,
      section || "latest",
      row.user_id,
      now,
      now
    );

    db.prepare(
      `UPDATE submissions SET status = 'published', post_id = ?, reviewed_at = ?, reviewed_by = ? WHERE id = ?`
    ).run(postId, now, req.user.sub, row.id);

    const post = db.prepare("SELECT * FROM posts WHERE id = ?").get(postId);
    const submission = db
      .prepare(
        `SELECT s.*, u.display_name, u.email, p.slug AS post_slug
         FROM submissions s
         JOIN users u ON u.id = s.user_id
         LEFT JOIN posts p ON p.id = s.post_id
         WHERE s.id = ?`
      )
      .get(row.id);

    res.json({
      post: { id: post.id, slug: post.slug, type: post.type, title: post.title },
      submission: publicSubmission(submission, {
        id: submission.user_id,
        display_name: submission.display_name,
        email: submission.email,
      }),
    });
  });

  app.delete("/api/admin/submissions/:id", requireAdmin, (req, res) => {
    const row = db.prepare("SELECT * FROM submissions WHERE id = ?").get(req.params.id);
    if (!row) return res.status(404).json({ error: "Submission not found" });
    if (row.file_url?.startsWith("/uploads/")) {
      const filePath = path.join(__dirname, "..", row.file_url);
      if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
    }
    db.prepare("DELETE FROM submissions WHERE id = ?").run(row.id);
    res.json({ ok: true });
  });
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
