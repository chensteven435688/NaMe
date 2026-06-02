# NaMe Magazine

A fashion editorial magazine website inspired by [PAP Magazine](https://www.pap-magazine.com/).

## Features

- Full-screen cover hero with rotating editorials
- Community call-to-action banner
- Horizontal carousels for articles, editorials, films, and shorts (loaded from API)
- **Member accounts** — register, login, comment, and like posts
- **Admin uploads** — only emails listed in `ADMIN_EMAILS` can publish content
- Subscribe newsletter section
- Member signup modal
- Responsive layout with mobile navigation
- Dark editorial aesthetic with serif typography
- 8 languages via `i18n.js`

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

## Roles

| Role | Who | Can do |
|------|-----|--------|
| **Admin** | Emails in `ADMIN_EMAILS` | Full control at `/admin.html` — dashboard, content CRUD, comments, users |
| **Member** | Anyone who registers | View content, comment, like comments, reply (one level) |

### Setup admins

In `server/.env`:

```env
ADMIN_EMAILS=you@example.com,coeditor@example.com
JWT_SECRET=your-long-random-secret
```

Register with one of those emails (or log in again after adding your email) to get the **Upload** link in the header.

## Pages

| Path | Purpose |
|------|---------|
| `/` | Homepage |
| `/about.html` | About NaMe & editor |
| `/business.html` | Partnerships & advertising |
| `/contact.html` | Contact form |
| `/submission.html` | Creator submission guidelines |
| `/community.html` | Community moodboard — share, like, and comment |
| `/terms.html` · `/privacy.html` | Legal pages |
| `/post.html?slug=…` | Story detail + comments |
| `/admin.html` | Admin dashboard (stats, content, users) |
| `/admin-upload.html` | Dedicated post upload page with live preview |
| `/admin-comments.html` | Comment moderation — remove inappropriate comments |

### Admin pages

- **`/admin-upload.html`** — full upload form with image preview; publish to homepage
- **`/admin-comments.html`** — search all comments; **Remove** inappropriate/spam/abusive posts
- **`/admin.html`** — dashboard, manage/edit/delete content, user roles
- On any **post page**, logged-in admins see **Remove** on every comment

## API (summary)

- `POST /api/auth/register` · `POST /api/auth/login` · `POST /api/auth/logout` · `GET /api/auth/me`
- `GET /api/posts` · `GET /api/posts/:slug` · `POST /api/posts` (admin) · `DELETE /api/posts/:id` (admin)
- `GET /api/admin/stats` · `GET /api/admin/users` · `PATCH /api/admin/users/:id` · `DELETE /api/admin/users/:id`
- `GET /api/admin/comments` · `DELETE /api/admin/comments/:id` (admin moderation)
- `GET /api/admin/posts/:id` · `PATCH /api/admin/posts/:id` (admin)
- `GET /api/posts/:slug/comments` · `POST /api/posts/:slug/comments` · `POST /api/comments/:id/like` · `DELETE /api/comments/:id`

## Customize

- **Brand**: `NaMe` in `index.html` and translations
- **Images**: Upload via admin or use URLs
- **Colors**: CSS variables in `styles.css`
- **Translations**: `i18n.js` (edit `aboutBody`, `businessBody`, etc. for page copy)
- **Static pages**: `about.html`, `business.html`, `contact.html`, `submission.html`

## Structure

```
index.html      — homepage
post.html       — post + comments
admin.html      — admin upload
auth.js         — client auth & API
main.js         — UI interactions + feeds
post.js         — post page logic
admin.js        — admin panel
i18n.js         — translations
styles.css      — styling
server/         — Express API, SQLite, uploads
```
