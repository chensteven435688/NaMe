let allSubmissions = [];

document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init("submissions");
  if (!ok) return;
  bootSubmissions();
});

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "submissions") bootSubmissions();
});

function bootSubmissions() {
  const grid = document.getElementById("submissions-grid");
  if (!grid) return;

  if (!grid.dataset.booted) {
    grid.dataset.booted = "1";
    document.getElementById("submissions-refresh")?.addEventListener("click", loadSubmissions);
    document.getElementById("submissions-filter")?.addEventListener("change", renderGrid);
    document.getElementById("publish-form")?.addEventListener("submit", onPublish);
    document.querySelectorAll("[data-close-publish]").forEach((el) => {
      el.addEventListener("click", closePublishModal);
    });
  }

  loadSubmissions();
}

async function loadSubmissions() {
  const grid = document.getElementById("submissions-grid");
  const lang = NaMeI18n.getLang();
  grid.innerHTML = `<p>${NaMeAdmin.esc(NaMeI18n.t(lang, "adminLoading"))}</p>`;

  try {
    const data = await NaMeAuth.fetchAdminSubmissions();
    allSubmissions = data.submissions || [];
    renderCounts(data.counts || {});
    renderGrid();
  } catch (err) {
    grid.innerHTML = `<p>${NaMeAdmin.esc(err.message)}</p>`;
  }
}

function renderCounts(counts) {
  const el = document.getElementById("submissions-counts");
  if (!el) return;
  const lang = NaMeI18n.getLang();
  const parts = [
    ["pending", NaMeI18n.t(lang, "submissionStatus_pending")],
    ["published", NaMeI18n.t(lang, "submissionStatus_published")],
    ["rejected", NaMeI18n.t(lang, "submissionStatus_rejected")],
  ];
  el.textContent = parts.map(([k, label]) => `${label}: ${counts[k] || 0}`).join(" · ");
}

function renderGrid() {
  const grid = document.getElementById("submissions-grid");
  const filter = document.getElementById("submissions-filter")?.value || "";
  const lang = NaMeI18n.getLang();
  let list = [...allSubmissions];
  if (filter) list = list.filter((s) => s.status === filter);

  if (!list.length) {
    grid.innerHTML = `<p class="admin-submissions-empty">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminSubmissionsEmpty"))}</p>`;
    return;
  }

  grid.innerHTML = list.map((s) => renderCard(s, lang)).join("");

  grid.querySelectorAll("[data-publish]").forEach((btn) => {
    btn.addEventListener("click", () => openPublishModal(btn.dataset.publish));
  });
  grid.querySelectorAll("[data-reject]").forEach((btn) => {
    btn.addEventListener("click", () => rejectSubmission(btn.dataset.reject));
  });
  grid.querySelectorAll("[data-delete-submission]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSubmission(btn.dataset.deleteSubmission));
  });
}

function renderCard(s, lang) {
  const statusLabel = NaMeI18n.t(lang, `submissionStatus_${s.status}`);
  const preview = s.fileMime?.startsWith("image/")
    ? `<img src="${NaMeAdmin.esc(s.fileUrl)}" alt="" class="admin-submission-card__img" />`
    : s.fileMime?.startsWith("video/")
      ? `<video src="${NaMeAdmin.esc(s.fileUrl)}" controls class="admin-submission-card__video"></video>`
      : `<a href="${NaMeAdmin.esc(s.fileUrl)}" target="_blank" rel="noopener" class="admin-submission-card__file">${NaMeAdmin.esc(s.fileName || "PDF")}</a>`;

  const live = s.postSlug
    ? `<a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(s.postSlug)}" target="_blank" rel="noopener">${NaMeAdmin.esc(NaMeI18n.t(lang, "submissionViewLive"))}</a>`
    : "";

  return `
    <article class="admin-submission-card admin-submission-card--${NaMeAdmin.esc(s.status)}">
      <div class="admin-submission-card__media">${preview}</div>
      <div class="admin-submission-card__body">
        <div class="admin-submission-card__head">
          <h3>${NaMeAdmin.esc(s.title)}</h3>
          <span class="submission-item__badge">${NaMeAdmin.esc(statusLabel)}</span>
        </div>
        <p class="admin-submission-card__meta">
          ${NaMeAdmin.esc(s.medium)} · ${NaMeAdmin.esc(s.author?.displayName || "")} · ${NaMeAdmin.esc(s.author?.email || "")}
        </p>
        <p class="admin-submission-card__date">${NaMeAdmin.formatDate(s.createdAt)}</p>
        ${s.description ? `<p class="admin-submission-card__desc">${NaMeAdmin.esc(s.description)}</p>` : ""}
        ${s.adminNote ? `<p class="admin-submission-card__note">${NaMeAdmin.esc(s.adminNote)}</p>` : ""}
        <div class="admin-submission-card__actions">
          ${s.status === "pending" ? `
            <button type="button" class="btn btn--primary btn--sm" data-publish="${NaMeAdmin.esc(s.id)}">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminPublishSubmissionBtn"))}</button>
            <button type="button" class="btn btn--ghost btn--sm" data-reject="${NaMeAdmin.esc(s.id)}">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminRejectSubmission"))}</button>
          ` : ""}
          ${live}
          <button type="button" class="btn btn--ghost btn--sm danger" data-delete-submission="${NaMeAdmin.esc(s.id)}">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminDeleteSubmission"))}</button>
        </div>
      </div>
    </article>`;
}

function openPublishModal(id) {
  const s = allSubmissions.find((x) => x.id === id);
  if (!s) return;
  document.getElementById("publish-submission-id").value = id;
  document.getElementById("publish-modal-summary").textContent = `${s.title} — ${s.author?.displayName || ""}`;
  document.getElementById("publish-meta").value = `${s.medium} — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  const typeSelect = document.querySelector("#publish-form select[name=type]");
  if (typeSelect) {
    typeSelect.value = s.medium === "film" ? "film" : s.medium === "photography" ? "editorial" : "article";
  }
  document.getElementById("publish-status").textContent = "";
  const modal = document.getElementById("publish-modal");
  modal.classList.add("is-open");
  modal.setAttribute("aria-hidden", "false");
  document.body.style.overflow = "hidden";
}

function closePublishModal() {
  const modal = document.getElementById("publish-modal");
  modal.classList.remove("is-open");
  modal.setAttribute("aria-hidden", "true");
  document.body.style.overflow = "";
}

async function onPublish(e) {
  e.preventDefault();
  const lang = NaMeI18n.getLang();
  const statusEl = document.getElementById("publish-status");
  const id = document.getElementById("publish-submission-id").value;
  const fd = new FormData(e.target);

  try {
    const res = await NaMeAuth.publishSubmission(id, {
      type: fd.get("type"),
      section: fd.get("section"),
      meta: fd.get("meta"),
    });
    statusEl.textContent = `${NaMeI18n.t(lang, "adminPublishSuccess")} ${res.post.title}`;
    setTimeout(() => {
      closePublishModal();
      loadSubmissions();
    }, 600);
  } catch (err) {
    statusEl.textContent = err.message;
  }
}

async function rejectSubmission(id) {
  const lang = NaMeI18n.getLang();
  const note = prompt(NaMeI18n.t(lang, "adminRejectNotePrompt"));
  if (note === null) return;

  try {
    await NaMeAuth.updateSubmission(id, { status: "rejected", adminNote: note || null });
    loadSubmissions();
  } catch (err) {
    alert(err.message);
  }
}

async function deleteSubmission(id) {
  const lang = NaMeI18n.getLang();
  if (!confirm(NaMeI18n.t(lang, "adminDeleteSubmissionConfirm"))) return;

  try {
    await NaMeAuth.deleteSubmission(id);
    loadSubmissions();
  } catch (err) {
    alert(err.message);
  }
}
