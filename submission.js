document.addEventListener("DOMContentLoaded", async () => {
  await NaMeAuth.refresh();
  NaMeAuth.initUI();
  updateGate();
  NaMeAuth.onChange(() => {
    updateGate();
    if (NaMeAuth.isLoggedIn()) loadMine();
  });

  const form = document.getElementById("submission-form");
  form?.addEventListener("submit", onSubmit);
  form?.querySelector('[name="medium"]')?.addEventListener("change", updateMediumFields);
  form?.querySelector('[name="cover"]')?.addEventListener("change", updateGalleryPreview);
  form?.querySelector('[name="bodyImages"]')?.addEventListener("change", updateGalleryPreview);
  updateMediumFields();
});

const IMAGE_MEDIA = new Set(["photography", "design", "visual-art"]);

function updateMediumFields() {
  const form = document.getElementById("submission-form");
  if (!form) return;
  const medium = form.querySelector('[name="medium"]')?.value || "";
  const isImageMedium = IMAGE_MEDIA.has(medium);
  const single = document.getElementById("submission-single-file");
  const gallery = document.getElementById("submission-gallery-fields");
  const fileInput = form.querySelector('[name="file"]');
  const coverInput = form.querySelector('[name="cover"]');

  single?.classList.toggle("is-hidden", isImageMedium);
  gallery?.classList.toggle("is-hidden", !isImageMedium);

  if (fileInput) fileInput.required = !isImageMedium;
  if (coverInput) coverInput.required = isImageMedium;

  if (!isImageMedium) updateGalleryPreview();
}

function updateGalleryPreview() {
  const form = document.getElementById("submission-form");
  const preview = document.getElementById("submission-gallery-preview");
  if (!form || !preview) return;

  const cover = form.querySelector('[name="cover"]')?.files?.[0];
  const bodyImages = [...(form.querySelector('[name="bodyImages"]')?.files || [])];
  const items = [];
  if (cover) items.push({ file: cover, label: "Cover" });
  bodyImages.forEach((file, i) => items.push({ file, label: `${i + 1}` }));

  if (!items.length) {
    preview.hidden = true;
    preview.innerHTML = "";
    return;
  }

  preview.hidden = false;
  preview.innerHTML = items
    .map(({ file, label }) => {
      const url = URL.createObjectURL(file);
      return `
        <figure class="submission-gallery__thumb">
          <img src="${escAttr(url)}" alt="" />
          <figcaption>${esc(label)}</figcaption>
        </figure>`;
    })
    .join("");
}

function updateGate() {
  const bypass = window.NA_ME_DEV_BYPASS === true;
  const loggedIn = bypass || NaMeAuth.isLoggedIn();
  document.getElementById("submission-gate")?.classList.toggle("is-hidden", loggedIn);
  document.getElementById("submission-app")?.classList.toggle("is-hidden", !loggedIn);
  if (loggedIn) loadMine();
}

async function loadMine() {
  const lang = NaMeI18n.getLang();
  const list = document.getElementById("submission-list");
  const statsEl = document.getElementById("submission-stats");
  if (!list || !statsEl) return;

  list.innerHTML = `<p class="submission-list__loading">${esc(NaMeI18n.t(lang, "submissionLoading"))}</p>`;

  try {
    const { submissions, stats } = await NaMeAuth.fetchMySubmissions();
    renderStats(stats, statsEl, lang);
    renderList(submissions, list, lang);
  } catch (err) {
    list.innerHTML = `<p class="submission-list__empty">${esc(err.message)}</p>`;
    statsEl.innerHTML = "";
  }
}

function renderStats(stats, el, lang) {
  el.innerHTML = `
    <div class="submission-stat">
      <span class="submission-stat__n">${stats.total}</span>
      <span class="submission-stat__l">${esc(NaMeI18n.t(lang, "submissionStatTotal"))}</span>
    </div>
    <div class="submission-stat">
      <span class="submission-stat__n">${stats.pending}</span>
      <span class="submission-stat__l">${esc(NaMeI18n.t(lang, "submissionStatPending"))}</span>
    </div>
    <div class="submission-stat">
      <span class="submission-stat__n">${stats.published}</span>
      <span class="submission-stat__l">${esc(NaMeI18n.t(lang, "submissionStatPublished"))}</span>
    </div>
    <div class="submission-stat">
      <span class="submission-stat__n">${stats.rejected}</span>
      <span class="submission-stat__l">${esc(NaMeI18n.t(lang, "submissionStatRejected"))}</span>
    </div>`;
}

function renderSubmissionMedia(s) {
  const images = [];
  if (s.fileMime?.startsWith("image/")) images.push({ url: s.fileUrl, label: "Cover" });
  for (const file of s.bodyFiles || []) {
    if (file.mime?.startsWith("image/") || !file.mime) {
      images.push({ url: file.url, label: "" });
    }
  }

  if (images.length > 1) {
    return `<div class="submission-item__gallery">${images
      .map(
        (img) =>
          `<img src="${escAttr(img.url)}" alt="" class="submission-item__gallery-img" />`
      )
      .join("")}</div>`;
  }
  if (s.fileMime?.startsWith("image/")) {
    return `<img src="${escAttr(s.fileUrl)}" alt="" class="submission-item__preview" />`;
  }
  if (s.fileMime?.startsWith("video/")) {
    return `<video src="${escAttr(s.fileUrl)}" controls class="submission-item__preview"></video>`;
  }
  return "";
}

function renderList(submissions, el, lang) {
  if (!submissions.length) {
    el.innerHTML = `<p class="submission-list__empty">${esc(NaMeI18n.t(lang, "submissionEmpty"))}</p>`;
    return;
  }

  el.innerHTML = submissions
    .map((s) => {
      const statusLabel = NaMeI18n.t(lang, `submissionStatus_${s.status}`);
      const date = formatDate(s.createdAt);
      const galleryCount = (s.bodyFiles || []).length;
      const fileLink = s.fileUrl
        ? `<a href="${escAttr(s.fileUrl)}" target="_blank" rel="noopener">${esc(s.fileName || "File")}${galleryCount ? ` (+${galleryCount} gallery)` : ""}</a>`
        : "";
      const liveLink =
        s.status === "published" && s.postSlug
          ? `<a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(s.postSlug)}" target="_blank" rel="noopener">${esc(NaMeI18n.t(lang, "submissionViewLive"))}</a>`
          : "";
      const note = s.adminNote
        ? `<p class="submission-item__note">${esc(NaMeI18n.t(lang, "submissionEditorNote"))}: ${esc(s.adminNote)}</p>`
        : "";

      return `
      <article class="submission-item submission-item--${escAttr(s.status)}">
        ${renderSubmissionMedia(s)}
        <div class="submission-item__head">
          <h3 class="submission-item__title">${esc(s.title)}</h3>
          <span class="submission-item__badge">${esc(statusLabel)}</span>
        </div>
        <p class="submission-item__meta">${esc(s.medium)} · ${esc(date)}</p>
        ${s.description ? `<p class="submission-item__desc">${esc(s.description)}</p>` : ""}
        <div class="submission-item__actions">${fileLink}${liveLink ? ` · ${liveLink}` : ""}</div>
        ${note}
      </article>`;
    })
    .join("");
}

async function onSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const status = document.getElementById("submission-form-status");
  const lang = NaMeI18n.getLang();
  status.textContent = "";

  if (!NaMeAuth.isLoggedIn()) {
    NaMeAuth.openAuthModal("login");
    return;
  }

  const fd = new FormData(form);
  const btn = form.querySelector('[type="submit"]');
  btn.disabled = true;

  try {
    await NaMeAuth.createSubmission(fd);
    status.textContent = NaMeI18n.t(lang, "submissionSuccess");
    form.reset();
    updateMediumFields();
    updateGalleryPreview();
    loadMine();
  } catch (err) {
    status.textContent = err.message;
  } finally {
    btn.disabled = false;
  }
}

function formatDate(iso) {
  return new Date(iso).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function esc(s) {
  const d = document.createElement("div");
  d.textContent = s ?? "";
  return d.innerHTML;
}

function escAttr(s) {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;");
}

document.addEventListener("name:languagechange", () => {
  if (NaMeAuth.isLoggedIn()) loadMine();
});
