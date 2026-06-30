import test from "node:test";
import assert from "node:assert/strict";
import { once } from "node:events";
import { app } from "../index.js";

process.env.DEV_BYPASS_AUTH = "true";
process.env.JWT_SECRET = "test-secret-at-least-32-characters-long";

const PNG_1X1 = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64"
);

let baseUrl;
let server;

test.before(async () => {
  server = app.listen(0);
  await once(server, "listening");
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

test.after(async () => {
  await new Promise((resolve, reject) => {
    server.close((err) => (err ? reject(err) : resolve()));
  });
});

function makeImage(name) {
  return new File([PNG_1X1], name, { type: "image/png" });
}

test("image submission stores cover + gallery and publishes Instagram-style post", async () => {
  const fd = new FormData();
  fd.set("title", "Test Gallery Editorial");
  fd.set("medium", "photography");
  fd.set("description", "Three looks from the shoot.");
  fd.set("cover", makeImage("cover.png"));
  fd.append("bodyImages", makeImage("body1.png"));
  fd.append("bodyImages", makeImage("body2.png"));

  const createRes = await fetch(`${baseUrl}/api/submissions`, {
    method: "POST",
    body: fd,
  });
  const createText = await createRes.text();
  assert.equal(createRes.status, 201, createText);
  const { submission } = JSON.parse(createText);
  assert.equal(submission.fileMime, "image/png");
  assert.equal(submission.bodyFiles.length, 2);

  const publishRes = await fetch(
    `${baseUrl}/api/admin/submissions/${submission.id}/publish`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type: "editorial", section: "latest", meta: "Test — editorial" }),
    }
  );
  const publishText = await publishRes.text();
  assert.equal(publishRes.status, 200, publishText);
  const { post } = JSON.parse(publishText);
  assert.ok(post.slug);

  const postRes = await fetch(`${baseUrl}/api/posts/${encodeURIComponent(post.slug)}`);
  assert.equal(postRes.status, 200);
  const { post: published } = await postRes.json();
  assert.ok(published.imageUrl, "cover image required");
  assert.match(published.body, /post__figure/);
  assert.match(published.body, /uploads\//);
  assert.match(published.body, /Three looks from the shoot/);
});

test("admin can create post with cover and body gallery HTML", async () => {
  const coverFd = new FormData();
  coverFd.set("type", "editorial");
  coverFd.set("title", "Admin Gallery Post");
  coverFd.set("meta", "Fashion — test");
  coverFd.set("section", "latest");
  coverFd.set(
    "body",
    '<p>Story text</p>\n<figure class="post__figure"><img src="/uploads/test-body.jpg" alt="" loading="lazy" /></figure>'
  );
  coverFd.set("image", makeImage("admin-cover.png"));

  const createRes = await fetch(`${baseUrl}/api/posts`, {
    method: "POST",
    body: coverFd,
  });
  const adminText = await createRes.text();
  assert.equal(createRes.status, 201, adminText);
  const { post } = JSON.parse(adminText);
  assert.ok(post.imageUrl);
  assert.match(post.body, /post__figure/);

  const postRes = await fetch(`${baseUrl}/api/posts/${encodeURIComponent(post.slug)}`);
  const { post: fetched } = await postRes.json();
  assert.equal(fetched.title, "Admin Gallery Post");
  assert.ok(fetched.imageUrl);
});

test("non-image submission still accepts single file", async () => {
  const fd = new FormData();
  fd.set("title", "Written piece");
  fd.set("medium", "writing");
  fd.set("description", "An essay.");
  fd.set("file", new File(["hello"], "essay.pdf", { type: "application/pdf" }));

  const createRes = await fetch(`${baseUrl}/api/submissions`, {
    method: "POST",
    body: fd,
  });
  const createText = await createRes.text();
  assert.equal(createRes.status, 201, createText);
  const { submission } = JSON.parse(createText);
  assert.equal(submission.fileMime, "application/pdf");
  assert.equal(submission.bodyFiles.length, 0);
});
