# NaMe Magazine

A fashion editorial magazine website inspired by [PAP Magazine](https://www.pap-magazine.com/).

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
| `/magazine.html` · `/editorial.html` · `/articles.html` · `/film.html` | Section indexes |
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
- `GET /api/posts` · `GET /api/posts/:slug` · `POST /api/posts` (admin) · `PATCH /api/admin/posts/:id` (admin) · `DELETE /api/posts/:id` (admin)
- `GET /api/posts/:slug/comments` · `POST /api/posts/:slug/comments` · `POST /api/comments/:id/like` · `DELETE /api/comments/:id`
- `GET /api/admin/stats` · `GET /api/admin/users` · `PATCH /api/admin/users/:id` · `DELETE /api/admin/users/:id`
- `GET /api/admin/comments` · `DELETE /api/admin/comments/:id`
- `GET /api/community/posts` · `POST /api/community/posts` · `POST /api/community/posts/:id/like` · `DELETE /api/community/posts/:id`

## Customize

- **Brand**: `NaMe` in the HTML pages and `locales/`
- **Images**: Upload via admin or use URLs
- **Colors and type**: CSS variables at the top of `styles.css`. The refresh at the end of that file sets UI type, focus rings, buttons, and the admin workspace
- **Homepage**: `home-design.css` loads after `styles.css` and overrides the homepage only
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
