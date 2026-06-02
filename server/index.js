import "dotenv/config";
import express from "express";
import cookieParser from "cookie-parser";
import bcrypt from "bcryptjs";
import multer from "multer";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import { randomUUID } from "crypto";
import db from "./db.js";
import {
  signToken,
  setAuthCookie,
  clearAuthCookie,
  optionalAuth,
  requireAuth,
  requireAdmin,
  roleForEmail,
} from "./middleware/auth.js";
import { registerAdminRoutes, syncUserRole } from "./routes/admin.js";
import { registerCommunityRoutes } from "./routes/community.js";
import { registerSubmissionRoutes } from "./routes/submissions.js";
import { seedCommunity } from "./seed-community.js";
import { isAuthBypassEnabled } from "./middleware/auth.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const rootDir = path.join(__dirname, "..");
const uploadsDir = path.join(__dirname, "uploads");

if (!process.env.JWT_SECRET) {
  console.warn("Warning: JWT_SECRET not set. Using dev default.");
  process.env.JWT_SECRET = "dev-only-change-in-production-32chars!";
}

if (!fs.existsSync(uploadsDir)) fs.mkdirSync(uploadsDir, { recursive: true });

// Auto-seed if empty
import { seedDatabase } from "./seed.js";
seedDatabase();
seedCommunity();

const app = express();
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(uploadsDir));
app.use(express.static(rootDir));

const storage = multer.diskStorage({
  destination: uploadsDir,
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname) || ".jpg";
    cb(null, `${randomUUID()}${ext}`);
  },
});
const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\//.test(file.mimetype)) cb(null, true);
    else cb(new Error("Images only"));
  },
});

const submissionUpload = multer({
  storage,
  limits: { fileSize: 25 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /^image\//.test(file.mimetype) ||
      file.mimetype === "application/pdf" ||
      /^video\//.test(file.mimetype);
    if (ok) cb(null, true);
    else cb(new Error("Allowed file types: images, PDF, or video"));
  },
});

function slugify(text) {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function uniqueSlug(title, excludeId = null) {
  let base = slugify(title) || "post";
  let slug = base;
  let n = 2;
  while (true) {
    const existing = excludeId
      ? db.prepare("SELECT 1 FROM posts WHERE slug = ? AND id != ?").get(slug, excludeId)
      : db.prepare("SELECT 1 FROM posts WHERE slug = ?").get(slug);
    if (!existing) break;
    slug = `${base}-${n++}`;
  }
  return slug;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    role: row.role,
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
  };
}

// ─── Auth ───
app.post("/api/auth/register", async (req, res) => {
  const { email, password, displayName } = req.body;
  if (!email || !password || !displayName) {
    return res.status(400).json({ error: "Email, password, and display name required" });
  }
  if (password.length < 8) {
    return res.status(400).json({ error: "Password must be at least 8 characters" });
  }
  const normalized = email.trim().toLowerCase();
  if (db.prepare("SELECT id FROM users WHERE email = ?").get(normalized)) {
    return res.status(409).json({ error: "Email already registered" });
  }
  const id = randomUUID();
  const role = roleForEmail(normalized);
  const hash = await bcrypt.hash(password, 10);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, normalized, hash, displayName.trim(), role, now);
  let user = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  user = syncUserRole(user);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.status(201).json({ user: publicUser(user) });
});

app.post("/api/auth/login", async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ error: "Email and password required" });
  }
  let user = db
    .prepare("SELECT * FROM users WHERE email = ?")
    .get(email.trim().toLowerCase());
  if (!user || !(await bcrypt.compare(String(password), user.password_hash))) {
    return res.status(401).json({ error: "Invalid email or password" });
  }
  user = syncUserRole(user);
  const token = signToken(user);
  setAuthCookie(res, token);
  res.json({ user: publicUser(user) });
});

app.post("/api/auth/logout", (_req, res) => {
  clearAuthCookie(res);
  res.json({ ok: true });
});

app.get("/api/auth/me", optionalAuth, (req, res) => {
  if (!req.user) return res.json({ user: null });
  let row = db.prepare("SELECT * FROM users WHERE id = ?").get(req.user.sub);
  row = syncUserRole(row);
  res.json({ user: publicUser(row) });
});

app.get("/api/dev/config", (_req, res) => {
  res.json({ bypassAuth: process.env.DEV_BYPASS_AUTH === "true" });
});

registerAdminRoutes(app, { upload, uniqueSlug });
registerCommunityRoutes(app, { upload });
registerSubmissionRoutes(app, { submissionUpload, uniqueSlug });

// ─── Posts ───
app.get("/api/posts", (req, res) => {
  const { type, section, featured } = req.query;
  let sql = "SELECT * FROM posts WHERE 1=1";
  const params = [];
  if (type) {
    sql += " AND type = ?";
    params.push(type);
  }
  if (section) {
    sql += " AND section = ?";
    params.push(section);
  }
  if (featured === "1") {
    sql += " AND featured = 1";
  }
  sql += " ORDER BY published_at DESC";
  const rows = db.prepare(sql).all(...params);
  res.json({ posts: rows.map(publicPost) });
});

app.get("/api/posts/:slug", (req, res) => {
  const row = db.prepare("SELECT * FROM posts WHERE slug = ?").get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Not found" });
  res.json({ post: publicPost(row) });
});

app.post("/api/posts", requireAdmin, upload.single("image"), (req, res) => {
  const { type, title, meta, body, videoUrl, section, featured } = req.body;
  if (!type || !title) {
    return res.status(400).json({ error: "Type and title required" });
  }
  const allowed = ["article", "editorial", "film", "short", "exclusive"];
  if (!allowed.includes(type)) {
    return res.status(400).json({ error: "Invalid type" });
  }
  const imageUrl = req.file ? `/uploads/${req.file.filename}` : req.body.imageUrl || null;
  const id = randomUUID();
  const slug = uniqueSlug(title);
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO posts (id, slug, type, title, meta, image_url, body, video_url, section, featured, author_id, published_at, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(
    id,
    slug,
    type,
    title.trim(),
    meta || null,
    imageUrl,
    body || `<p>${title}</p>`,
    videoUrl || null,
    section || null,
    featured === "1" || featured === "true" ? 1 : 0,
    req.user.sub,
    now,
    now
  );
  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(id);
  res.status(201).json({ post: publicPost(row) });
});

app.delete("/api/posts/:id", requireAdmin, (req, res) => {
  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.image_url?.startsWith("/uploads/")) {
    const filePath = path.join(__dirname, row.image_url);
    if (fs.existsSync(filePath)) fs.unlinkSync(filePath);
  }
  db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  res.json({ ok: true });
});

// ─── Comments ───
function commentWithMeta(row, userId) {
  const likes = db
    .prepare("SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = ?")
    .get(row.id).n;
  const liked = userId
    ? !!db
        .prepare("SELECT 1 FROM comment_likes WHERE comment_id = ? AND user_id = ?")
        .get(row.id, userId)
    : false;
  return {
    id: row.id,
    postId: row.post_id,
    parentId: row.parent_id,
    body: row.body,
    createdAt: row.created_at,
    author: {
      id: row.user_id,
      displayName: row.display_name,
    },
    likeCount: likes,
    liked,
  };
}

app.get("/api/posts/:slug/comments", optionalAuth, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const rows = db
    .prepare(
      `SELECT c.*, u.display_name
       FROM comments c
       JOIN users u ON u.id = c.user_id
       WHERE c.post_id = ?
       ORDER BY c.created_at ASC`
    )
    .all(post.id);
  const userId = req.user?.sub || null;
  const comments = rows.map((r) => commentWithMeta(r, userId));
  const top = comments.filter((c) => !c.parentId);
  const byParent = {};
  for (const c of comments) {
    if (c.parentId) {
      if (!byParent[c.parentId]) byParent[c.parentId] = [];
      byParent[c.parentId].push(c);
    }
  }
  for (const t of top) {
    t.replies = byParent[t.id] || [];
  }
  res.json({ comments: top });
});

app.post("/api/posts/:slug/comments", requireAuth, (req, res) => {
  const post = db.prepare("SELECT id FROM posts WHERE slug = ?").get(req.params.slug);
  if (!post) return res.status(404).json({ error: "Post not found" });
  const { body, parentId } = req.body;
  if (!body?.trim()) return res.status(400).json({ error: "Comment required" });
  if (parentId) {
    const parent = db
      .prepare("SELECT id, parent_id FROM comments WHERE id = ? AND post_id = ?")
      .get(parentId, post.id);
    if (!parent) return res.status(400).json({ error: "Invalid parent comment" });
    if (parent.parent_id) {
      return res.status(400).json({ error: "Replies only one level deep" });
    }
  }
  const id = randomUUID();
  const now = new Date().toISOString();
  db.prepare(
    `INSERT INTO comments (id, post_id, user_id, parent_id, body, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(id, post.id, req.user.sub, parentId || null, body.trim(), now);
  const row = db
    .prepare(
      `SELECT c.*, u.display_name FROM comments c JOIN users u ON u.id = c.user_id WHERE c.id = ?`
    )
    .get(id);
  res.status(201).json({ comment: commentWithMeta(row, req.user.sub) });
});

app.delete("/api/comments/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM comments WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Not found" });
  if (row.user_id !== req.user.sub && req.user.role !== "admin") {
    return res.status(403).json({ error: "Not allowed" });
  }
  db.prepare("DELETE FROM comments WHERE id = ? OR parent_id = ?").run(
    req.params.id,
    req.params.id
  );
  res.json({ ok: true });
});

app.post("/api/comments/:id/like", requireAuth, (req, res) => {
  const comment = db.prepare("SELECT id FROM comments WHERE id = ?").get(req.params.id);
  if (!comment) return res.status(404).json({ error: "Not found" });
  const existing = db
    .prepare("SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?")
    .get(req.user.sub, req.params.id);
  if (existing) {
    db.prepare("DELETE FROM comment_likes WHERE user_id = ? AND comment_id = ?").run(
      req.user.sub,
      req.params.id
    );
  } else {
    db.prepare(
      "INSERT INTO comment_likes (user_id, comment_id, created_at) VALUES (?, ?, ?)"
    ).run(req.user.sub, req.params.id, new Date().toISOString());
  }
  const likeCount = db
    .prepare("SELECT COUNT(*) AS n FROM comment_likes WHERE comment_id = ?")
    .get(req.params.id).n;
  const liked = !!db
    .prepare("SELECT 1 FROM comment_likes WHERE user_id = ? AND comment_id = ?")
    .get(req.user.sub, req.params.id);
  res.json({ likeCount, liked });
});

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: err.message || "Server error" });
});

const port = Number(process.env.PORT) || 8080;
app.listen(port, () => {
  console.log(`NaMe server at http://localhost:${port}`);
  if (isAuthBypassEnabled()) {
    console.warn("⚠ DEV_BYPASS_AUTH is ON — login and admin checks are disabled");
  }
  const admins = (process.env.ADMIN_EMAILS || "").split(",").filter(Boolean);
  if (admins.length) {
    console.log(`Admin emails: ${admins.join(", ")}`);
  } else {
    console.log("Set ADMIN_EMAILS in server/.env to allow uploads.");
  }
});
