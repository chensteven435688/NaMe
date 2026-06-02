/**
 * One-time: create or update admin user from env vars.
 * Usage: ADMIN_EMAIL=... ADMIN_NAME=... ADMIN_PASSWORD=... node scripts/ensure-admin.js
 */
import "dotenv/config";
import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import db from "../db.js";
import { roleForEmail } from "../middleware/auth.js";

const email = (process.env.ADMIN_EMAIL || "").trim().toLowerCase();
const displayName = process.env.ADMIN_NAME || "Admin";
const password = process.env.ADMIN_PASSWORD;

if (!email || !password) {
  console.error("Set ADMIN_EMAIL, ADMIN_NAME, and ADMIN_PASSWORD env vars.");
  process.exit(1);
}

const role = roleForEmail(email);
const hash = await bcrypt.hash(password, 10);
const existing = db.prepare("SELECT id FROM users WHERE email = ?").get(email);
const now = new Date().toISOString();

if (existing) {
  db.prepare(
    `UPDATE users SET password_hash = ?, display_name = ?, role = ? WHERE id = ?`
  ).run(hash, displayName, role, existing.id);
  console.log(`Updated user ${email} (${role})`);
} else {
  db.prepare(
    `INSERT INTO users (id, email, password_hash, display_name, role, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`
  ).run(randomUUID(), email, hash, displayName, role, now);
  console.log(`Created user ${email} (${role})`);
}
