import jwt from "jsonwebtoken";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import db from "../db.js";

const COOKIE_NAME = "name_token";
const DEV_BYPASS_EMAIL = "dev-bypass@name.local";

function bypassEnabled() {
  return process.env.DEV_BYPASS_AUTH === "true";
}

function getBypassUser() {
  let row = db.prepare("SELECT * FROM users WHERE role = 'admin' LIMIT 1").get();
  if (!row) row = db.prepare("SELECT * FROM users LIMIT 1").get();
  if (!row) {
    const id = randomUUID();
    const now = new Date().toISOString();
    const hash = bcrypt.hashSync("dev-bypass-not-for-production", 10);
    db.prepare(
      `INSERT INTO users (id, email, password_hash, display_name, role, created_at)
       VALUES (?, ?, ?, ?, 'admin', ?)`
    ).run(id, DEV_BYPASS_EMAIL, hash, "Dev Bypass", now);
    row = db.prepare("SELECT * FROM users WHERE id = ?").get(id);
  } else if (row.role !== "admin") {
    db.prepare("UPDATE users SET role = 'admin' WHERE id = ?").run(row.id);
    row = { ...row, role: "admin" };
  }
  return { sub: row.id, email: row.email, role: "admin" };
}

export function isAuthBypassEnabled() {
  return bypassEnabled();
}

export function signToken(user) {
  return jwt.sign(
    { sub: user.id, email: user.email, role: user.role },
    process.env.JWT_SECRET,
    { expiresIn: "7d" }
  );
}

export function setAuthCookie(res, token) {
  res.cookie(COOKIE_NAME, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 7 * 24 * 60 * 60 * 1000,
  });
}

export function clearAuthCookie(res) {
  res.clearCookie(COOKIE_NAME);
}

export function optionalAuth(req, res, next) {
  if (bypassEnabled()) {
    req.user = getBypassUser();
    return next();
  }
  const token = req.cookies[COOKIE_NAME];
  if (!token) {
    req.user = null;
    return next();
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET);
    next();
  } catch {
    req.user = null;
    next();
  }
}

export function requireAuth(req, res, next) {
  if (bypassEnabled()) {
    req.user = getBypassUser();
    return next();
  }
  optionalAuth(req, res, () => {
    if (!req.user) {
      return res.status(401).json({ error: "Login required" });
    }
    next();
  });
}

export function requireAdmin(req, res, next) {
  if (bypassEnabled()) {
    req.user = getBypassUser();
    return next();
  }
  requireAuth(req, res, () => {
    if (req.user.role !== "admin") {
      return res.status(403).json({ error: "Admin access only" });
    }
    next();
  });
}

export function adminEmails() {
  return (process.env.ADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
}

export function roleForEmail(email) {
  return adminEmails().includes(email.toLowerCase()) ? "admin" : "member";
}
