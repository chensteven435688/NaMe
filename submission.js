document.addEventListener("DOMContentLoaded", async () => {
  await NaMeAuth.refresh();
  NaMeAuth.initUI();
  updateGate();
  NaMeAuth.onChange(() => {
    updateGate();
    if (NaMeAuth.isLoggedIn()) loadMine();
  });

  document.getElementById("submission-form")?.addEventListener("submit", onSubmit);
});

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

function renderList(submissions, el, lang) {
  if (!submissions.length) {
    el.innerHTML = `<p class="submission-list__empty">${esc(NaMeI18n.t(lang, "submissionEmpty"))}</p>`;
    return;
  }

  el.innerHTML = submissions
    .map((s) => {
      const statusLabel = NaMeI18n.t(lang, `submissionStatus_${s.status}`);
      const date = formatDate(s.createdAt);
      const fileLink = s.fileUrl
        ? `<a href="${escAttr(s.fileUrl)}" target="_blank" rel="noopener">${esc(s.fileName || "File")}</a>`
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
