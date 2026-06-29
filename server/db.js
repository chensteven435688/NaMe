import Database from "better-sqlite3";
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const dataDir = path.join(__dirname, "data");
const dbPath = path.join(dataDir, "name.db");

if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });

const db = new Database(dbPath);
db.pragma("journal_mode = WAL");
db.pragma("foreign_keys = ON");

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id TEXT PRIMARY KEY,
    email TEXT UNIQUE NOT NULL COLLATE NOCASE,
    password_hash TEXT NOT NULL,
    display_name TEXT NOT NULL,
    role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('admin', 'member')),
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS posts (
    id TEXT PRIMARY KEY,
    slug TEXT UNIQUE NOT NULL,
    type TEXT NOT NULL CHECK (type IN ('article', 'editorial', 'film', 'short', 'exclusive')),
    title TEXT NOT NULL,
    meta TEXT,
    image_url TEXT,
    body TEXT,
    video_url TEXT,
    section TEXT CHECK (section IN ('latest', 'popular') OR section IS NULL),
    featured INTEGER NOT NULL DEFAULT 0,
    author_id TEXT,
    published_at TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (author_id) REFERENCES users(id)
  );

  CREATE TABLE IF NOT EXISTS comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    parent_id TEXT,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS comment_likes (
    user_id TEXT NOT NULL,
    comment_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, comment_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (comment_id) REFERENCES comments(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
  CREATE INDEX IF NOT EXISTS idx_posts_section ON posts(section);
  CREATE INDEX IF NOT EXISTS idx_comments_post ON comments(post_id);

  CREATE TABLE IF NOT EXISTS community_posts (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT,
    caption TEXT,
    image_url TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS community_likes (
    user_id TEXT NOT NULL,
    post_id TEXT NOT NULL,
    created_at TEXT NOT NULL,
    PRIMARY KEY (user_id, post_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE
  );

  CREATE TABLE IF NOT EXISTS community_comments (
    id TEXT PRIMARY KEY,
    post_id TEXT NOT NULL,
    user_id TEXT NOT NULL,
    body TEXT NOT NULL,
    created_at TEXT NOT NULL,
    FOREIGN KEY (post_id) REFERENCES community_posts(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
  );

  CREATE INDEX IF NOT EXISTS idx_community_posts_created ON community_posts(created_at);

  CREATE TABLE IF NOT EXISTS submissions (
    id TEXT PRIMARY KEY,
    user_id TEXT NOT NULL,
    title TEXT NOT NULL,
    medium TEXT NOT NULL,
    description TEXT,
    file_url TEXT NOT NULL,
    file_name TEXT,
    file_mime TEXT,
    status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'published', 'rejected')),
    post_id TEXT,
    admin_note TEXT,
    reviewed_at TEXT,
    reviewed_by TEXT,
    created_at TEXT NOT NULL,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (post_id) REFERENCES posts(id) ON DELETE SET NULL,
    FOREIGN KEY (reviewed_by) REFERENCES users(id)
  );

  CREATE INDEX IF NOT EXISTS idx_submissions_user ON submissions(user_id);
  CREATE INDEX IF NOT EXISTS idx_submissions_status ON submissions(status);
`);

function migratePostsForExclusive() {
  const info = db
    .prepare("SELECT sql FROM sqlite_master WHERE type = 'table' AND name = 'posts'")
    .get();
  if (!info?.sql || info.sql.includes("'exclusive'")) return;

  db.exec(`
    PRAGMA foreign_keys = OFF;
    BEGIN;
    CREATE TABLE posts_new (
      id TEXT PRIMARY KEY,
      slug TEXT UNIQUE NOT NULL,
      type TEXT NOT NULL CHECK (type IN ('article', 'editorial', 'film', 'short', 'exclusive')),
      title TEXT NOT NULL,
      meta TEXT,
      image_url TEXT,
      body TEXT,
      video_url TEXT,
      section TEXT CHECK (section IN ('latest', 'popular') OR section IS NULL),
      featured INTEGER NOT NULL DEFAULT 0,
      author_id TEXT,
      published_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (author_id) REFERENCES users(id)
    );
    INSERT INTO posts_new SELECT * FROM posts;
    DROP TABLE posts;
    ALTER TABLE posts_new RENAME TO posts;
    CREATE INDEX IF NOT EXISTS idx_posts_type ON posts(type);
    CREATE INDEX IF NOT EXISTS idx_posts_section ON posts(section);
    COMMIT;
    PRAGMA foreign_keys = ON;
  `);
}

migratePostsForExclusive();

function migratePostsContentDate() {
  const cols = db.prepare("PRAGMA table_info(posts)").all();
  if (!cols.some((c) => c.name === "content_date")) {
    db.exec("ALTER TABLE posts ADD COLUMN content_date TEXT");
  }
}

migratePostsContentDate();

function migrateUsersProfile() {
  const cols = db.prepare("PRAGMA table_info(users)").all();
  if (!cols.some((c) => c.name === "avatar_url")) {
    db.exec("ALTER TABLE users ADD COLUMN avatar_url TEXT");
  }
  if (!cols.some((c) => c.name === "signature")) {
    db.exec("ALTER TABLE users ADD COLUMN signature TEXT");
  }
}

migrateUsersProfile();

export default db;
