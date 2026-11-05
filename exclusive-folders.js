/**
 * Shared Editor's Exclusive meta folders.
 * Loaded by the homepage and the exclusive page.
 */
const EXCLUSIVE_UNCATEGORIZED = "__uncategorized__";

function exclusiveFolderEscape(value) {
  const node = document.createElement("div");
  node.textContent = value ?? "";
  return node.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
}

function exclusivePageHref(meta, pagePath) {
  const raw = pagePath || "/exclusive.html";
  const path = typeof NaMeBase !== "undefined" ? NaMeBase.path(raw) : raw;
  if (!meta) return path;
  const join = path.includes("?") ? "&" : "?";
  return `${path}${join}meta=${encodeURIComponent(meta)}`;
}

function buildExclusiveFolders(posts, declared) {
  const byKey = new Map();

  function ensure(name, createdAt, uncategorized = false) {
    const key = uncategorized ? EXCLUSIVE_UNCATEGORIZED : name.toLowerCase();
    if (!byKey.has(key)) {
      byKey.set(key, {
        name,
        posts: [],
        createdAt: createdAt || null,
        uncategorized,
      });
    } else if (createdAt && !byKey.get(key).createdAt) {
      byKey.get(key).createdAt = createdAt;
    }
    return byKey.get(key);
  }

  for (const meta of declared || []) {
    const name = NaMeAuth.exclusiveCollectionName(meta.name);
    if (!name || name.toLowerCase() === EXCLUSIVE_UNCATEGORIZED) continue;
    ensure(name, meta.createdAt);
  }

  for (const post of posts || []) {
    const name = NaMeAuth.exclusiveCollectionName(post.meta);
    if (!name) {
      ensure(EXCLUSIVE_UNCATEGORIZED, null, true).posts.push(post);
      continue;
    }
    ensure(name, null).posts.push(post);
  }

  const folders = [...byKey.values()];
  folders.sort((a, b) => {
    if (a.uncategorized) return 1;
    if (b.uncategorized) return -1;
    return latestFolderTime(b) - latestFolderTime(a);
  });
  return folders;
}

function latestFolderTime(folder) {
  const postTime = folder.posts.reduce((latest, post) => {
    const time = Date.parse(post.publishedAt || "") || 0;
    return Math.max(latest, time);
  }, 0);
  const created = Date.parse(folder.createdAt || "") || 0;
  return Math.max(postTime, created);
}

function renderExclusiveFolderCard(folder, lang, pagePath) {
  const label = folder.uncategorized
    ? NaMeI18n.t(lang, "exclusiveUncategorized")
    : folder.name;
  const href = exclusivePageHref(
    folder.uncategorized ? EXCLUSIVE_UNCATEGORIZED : folder.name,
    pagePath
  );
  const count = folder.posts.length;
  const countWord = NaMeI18n.t(lang, count === 1 ? "exclusivePiece" : "exclusivePieces");
  const images = [];
  for (const post of folder.posts || []) {
    const url = String(post?.imageUrl || "").trim();
    if (!url || images.includes(url)) continue;
    images.push(url);
    if (images.length === 3) break;
  }
  const cover = images[0]
    ? `<img src="${exclusiveFolderEscape(images[0])}" alt="" />`
    : `<span class="meta-folder__mark">${exclusiveFolderEscape(label.slice(0, 1) || "—")}</span>`;
  const extras = images.slice(1);
  const thumbs = extras.length
    ? `<div class="meta-folder__thumbs">${extras
        .map((url) => `<img src="${exclusiveFolderEscape(url)}" alt="" />`)
        .join("")}</div>`
    : "";
  return `
    <a class="meta-folder" href="${exclusiveFolderEscape(href)}">
      <div class="meta-folder__cover">${cover}</div>
      ${thumbs}
      <h2 class="meta-folder__name">${exclusiveFolderEscape(label)}</h2>
      <p class="meta-folder__count">${exclusiveFolderEscape(`${count} ${countWord}`)}</p>
    </a>`;
}
