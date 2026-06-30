export const IMAGE_SUBMISSION_MEDIA = new Set([
  "photography",
  "design",
  "visual-art",
]);

export function parseBodyFiles(raw) {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.filter((f) => f?.url);
  if (typeof raw === "string") {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.filter((f) => f?.url) : [];
    } catch {
      return [];
    }
  }
  return [];
}

export function bodyFigureHtml(url, alt = "") {
  const safeUrl = String(url ?? "").replace(/"/g, "&quot;");
  const safeAlt = String(alt ?? "").replace(/"/g, "&quot;");
  return `<figure class="post__figure"><img src="${safeUrl}" alt="${safeAlt}" loading="lazy" /></figure>`;
}

export function buildBodyFigures(files) {
  return parseBodyFiles(files)
    .filter((f) => f.mime?.startsWith("image/") || !f.mime)
    .map((f) => bodyFigureHtml(f.url, f.name || ""))
    .join("\n");
}

export function buildPublishedPostBody(row) {
  const escapeHtml = (text) =>
    String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");

  let body = row.description?.trim()
    ? `<p>${escapeHtml(row.description.trim())}</p>`
    : `<p>${escapeHtml(row.title)}</p>`;

  const figures = buildBodyFigures(row.body_files);
  if (figures) body += `\n${figures}`;

  if (row.file_mime === "application/pdf") {
    body += `<p><a href="${row.file_url}" target="_blank" rel="noopener">View submitted PDF</a></p>`;
  }

  return body;
}

export function collectGalleryUrls(coverUrl, bodyFiles, bodyHtml = "") {
  const images = [];
  const cover = coverUrl?.trim();
  if (cover) images.push(cover);

  for (const file of parseBodyFiles(bodyFiles)) {
    const url = file.url?.trim();
    if (url && !images.includes(url)) images.push(url);
  }

  if (bodyHtml) {
    const re = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(bodyHtml))) {
      const src = match[1]?.trim();
      if (src && !images.includes(src)) images.push(src);
    }
  }

  return images;
}
