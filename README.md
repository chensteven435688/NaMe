# NaMe Magazine

An independent art and culture magazine: a typographic editorial cover, an image-led archive, and a workspace for emerging creative voices.

## Features

- Homepage atelier: search, filter, and a story gallery, then folders for exclusive, articles, editorials, magazines, and film
- Community call-to-action banner
- Community moodboard — share, like, and comment
- Story indexes in a masonry grid, with **Latest**, **Mixed**, and **Saved**
- Saves stay in this browser (no account required)
- **Member accounts** — register, login, profile, comment, and like
- **Admin desk** — only emails listed in `ADMIN_EMAILS` can publish and moderate
- Subscribe page and member signup modal
- Responsive layout with mobile navigation
- Paper editorial palette, serif titles, and a system sans for UI text
- Visible keyboard focus, 44px controls, and reduced-motion handling
- 8 languages via `locales/*.json` (compiled into `i18n.js`)

## Editorial experience

- A large NaMe cover masthead, paper palette, precise rules, and restrained red accents.
- Public homepage and story content render independently of account verification; homepage feeds load concurrently.
- Archive search queries the server for titles, metadata, content types, and story text, twelve matches at a time. The query stays in the URL for sharing; Latest, Mixed, and Saved still work with the results.
- Explicit **Load more** replaces automatic endless loading, keeping navigation and the footer reachable.
- Story pages include estimated reading time, a reading progress line, and a reversible **Focus mode** that hides related stories and comments.
- Native scrolling, reduced-motion support, measured header offsets, and a back-to-top control. No scroll interception or animation library.
- Modal focus trapping and restoration, keyboard-operated community images, and a mobile admin drawer with Escape support.
- Admin quick actions, content result counts, persistent filters, guarded upload/edit navigation, and persistent publishing confirmation.
- New interface copy is included in all eight locale files.

The shared enhancement layer is `experience.css` + `experience.js`; homepage art direction is in `home-design.css`. Root HTML pages load the shared files. The API, database schemas, authentication providers, and authorization rules are unchanged.

## Frontend checks

Use a current Node.js release supported by the locked development dependencies:

```bash
npm ci
npm test
```

These isolated DOM tests use fabricated data and never connect to the live backend. They cover asynchronous rendering, archive search and pagination, publishing feedback, modal focus, mobile admin navigation, reading tools, and content filters, plus CSS parsing and local asset references. They do not replace browser layout or accessibility testing.

See `REFRESH-NOTES.md` for validation and known limits.

## Run locally

Install server dependencies and start the API (also serves the static site):

```bash
cd /Users/stevenchen/NaMe/server
cp .env.example .env
# Edit .env — set ADMIN_EMAILS to your editor emails
npm install
npm start
```

Visit [http://localhost:8080](http://localhost:8080).

> Opening `index.html` directly in the browser will **not** enable login, comments, or uploads. Use the server above.

## GitHub Pages

This repo is a **project site**, not your account homepage. Use:

**https://chensteven435688.github.io/NaMe/**

(`https://chensteven435688.github.io` alone will 404 — that URL is only for a repo named `chensteven435688.github.io`.)

In the repo: **Settings → Pages → Build from branch → `main` → `/ (root)`**.

`base.js` rewrites internal links for the `/NaMe/` prefix. **Login, comments, uploads, and admin still need the Node server** — GitHub Pages only hosts static HTML/CSS/JS.

## Roles

| Role | Who | Can do |
|------|-----|--------|
| **Admin** | Emails in `ADMIN_EMAILS` | Full control at `/admin.html` — dashboard, content, uploads, comments, community, users |
| **Member** | Anyone who registers | View content, comment, like, share to the community, edit their profile |

Anyone can save stories and community posts locally. Saves are not synced to the account.

### Setup admins

In `server/.env`:

```env
ADMIN_EMAILS=you@example.com,coeditor@example.com
JWT_SECRET=your-long-random-secret
```

Register with one of those emails (or log in again after adding your email) to get the **Admin** link in the header.

## Pages

| Path | Purpose |
|------|---------|
| `/` | Homepage |
| `/stories.html` | All stories |
| `/magazine.html` · `/editorial.html` · `/articles.html` · `/film.html` · `/artists.html` | Section indexes. Artists uses post type `artists` and the same meta folders as the other story indexes. |
| `/exclusive.html` | Editor's Exclusive |
| `/about.html` · `/business.html` · `/contact.html` | About, partnerships, contact |
| `/submission.html` | Creator submissions |
| `/community.html` | Community moodboard |
| `/subscribe.html` | Subscribe |
| `/account.html` | Login / join |
| `/profile.html` | Signed-in member profile |
| `/member.html?id=…` | Public member profile |
| `/post.html?slug=…` | Story, comments, and save |
| `/terms.html` · `/privacy.html` | Legal pages |

### Admin pages

- **`/admin.html`** — dashboard, content, and users
- **`/admin-upload.html`** — publish a post, with image preview
- **`/admin-exclusive.html`** — Editor's Exclusive
- **`/admin-submissions.html`** — review creator submissions
- **`/admin-comments.html`** — comment moderation
- **`/admin-community.html`** — community posts
- On any **post page**, logged-in admins see **Remove** on every comment

## API (summary)

- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me` · `PATCH /api/auth/profile`
- `GET /api/posts` — optional `type`, `section`, `featured=1`, `q` (title, meta, type, and body), `types` (comma-separated), `limit` (default 12, max 50), and `offset`. A text query or page params return `{ posts, total, limit, offset }`. Without them, `{ posts }` is the full list, newest first.
- `GET /api/posts/:slug` · `POST /api/posts` (admin) · `PATCH /api/admin/posts/:id` (admin) · `DELETE /api/posts/:id` (admin)
- `GET /api/posts/:slug/comments` · `POST /api/posts/:slug/comments` · `POST /api/comments/:id/like` · `DELETE /api/comments/:id`
- `GET /api/admin/stats` · `GET /api/admin/users` · `PATCH /api/admin/users/:id` · `DELETE /api/admin/users/:id`
- `GET /api/admin/comments` · `DELETE /api/admin/comments/:id`
- `GET /api/community/posts` · `POST /api/community/posts` · `POST /api/community/posts/:id/like` · `DELETE /api/community/posts/:id`
- `GET /sitemap.xml` — static public pages plus posts in the local SQLite catalog. The Vercel site serves the committed `sitemap.xml` instead of this route.

## Search and sharing

Public pages ship Open Graph and Twitter card tags, a canonical URL, and a shared image (`/images/hero/hero-1.png`). Absolute share URLs use `https://name-magazine.vercel.app` (`SITE_ORIGIN` in `seo.js`), including when the page is opened locally or on GitHub Pages.

Story pages (`post.html?slug=…`) replace the title, description, image, canonical URL, and Twitter tags after the post loads, and add Article JSON-LD (`headline`, `image`, `datePublished`, publisher). The description is the story text, clipped. The homepage also emits Organization and WebSite JSON-LD. Changing language updates the share title and description to match the visible page text; a loaded story keeps its own title, excerpt, and image. Clients that do not run JavaScript still see the brand card in the story page's HTML.

`robots.txt` points at the sitemap. Regenerate the committed files (what Vercel serves) with:

```bash
npm run sitemap
npm run sitemap -- --posts posts.json
npm run sitemap -- --from-api http://127.0.0.1:8080
npm run sitemap -- --from-catalog
```

`--posts` is a JSON array, or `{ "posts": [...] }`, of `{ "slug", "publishedAt" }`. `--from-api` pages through `GET /api/posts`. `--from-catalog` reads `slug` and `published_at` from the public Supabase `posts` table (`SUPABASE_URL` and `SUPABASE_PUBLISHABLE_KEY`, or the public values in `supabase.js`). No schema change is required. The Express route stays current with local SQLite without rewriting the file.

## Customize

- **Brand**: `NaMe` in the HTML pages and `locales/`
- **Images**: Upload via admin or use URLs
- **Colors and type**: CSS variables at the top of `styles.css`. The refresh at the end of that file sets UI type, focus rings, buttons, and the admin workspace
- **Homepage**: `home-design.css` loads after `styles.css`; `experience.css` supplies shared tokens and controls
- **Translations**: edit `locales/*.json`, then run `node scripts/rebuild-i18n.js` so `i18n.js` matches
- **Static pages**: `about.html`, `business.html`, `contact.html`, `submission.html`

## Structure

```
index.html        — homepage
styles.css        — site styles, including the refresh block at the end
home-design.css   — homepage overrides
post.html         — story + comments
community.html    — community moodboard
admin.html        — admin dashboard
pin-ops.js        — save, latest/mixed, masonry feeds
browse.js         — story index grids
main.js           — homepage and shared UI
auth.js           — client auth and API
i18n.js           — translation runtime
locales/          — translation source
server/           — Express API, SQLite, uploads
```
