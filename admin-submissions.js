/**
 * NaMe — reader submissions section (admin.html#submissions) and review drawer
 */
let allSubmissions = [];
let submissionCounts = {};
let submissionFilter = "all";
let publishMetaNames = [];

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "submissions") bootSubmissions();
});
document.addEventListener("name:adminrefresh", (e) => {
  if (e.detail?.page === "submissions") loadSubmissions();
});
document.addEventListener("name:adminsearch", (e) => {
  if (e.detail?.page === "submissions") renderGrid();
});

function setSubmissionFilter(value) {
  submissionFilter = value || "all";
}

function bootSubmissions() {
  const grid = document.getElementById("submissions-grid");
  if (!grid) return;
  if (!grid.dataset.booted) {
    grid.dataset.booted = "1";
    document.getElementById("publish-form")?.addEventListener("submit", onPublish);
    document.getElementById("reject-form")?.addEventListener("submit", onReject);
    document.getElementById("publish-delete")?.addEventListener("click", () =>
      deleteSubmission(document.getElementById("publish-submission-id").value)
    );
    const publishMeta = document.getElementById("publish-meta");
    if (publishMeta && typeof NaMeMetaCombo !== "undefined") {
      NaMeMetaCombo.attach(publishMeta, { getNames: () => publishMetaNames });
    }
  }
  loadSubmissions();
}

async function loadSubmissions() {
  const grid = document.getElementById("submissions-grid");
  if (!grid) return;
  if (!allSubmissions.length) grid.innerHTML = NaMeAdmin.emptyState(NaMeAdmin.t("adminLoading"));
  try {
    const data = await NaMeAuth.fetchAdminSubmissions();
    allSubmissions = data.submissions || [];
    submissionCounts = data.counts || {};
    const total = allSubmissions.length;
    NaMeAdmin.setCount("submissions", submissionCounts.pending || 0);
    NaMeAdmin.setPlan(total - (submissionCounts.pending || 0), total);
    renderGrid();
  } catch (err) {
    grid.innerHTML = NaMeAdmin.emptyState(err.message);
  }
}

function submissionImages(s) {
  const images = [];
  if (s.fileMime?.startsWith("image/")) images.push(s.fileUrl);
  for (const file of s.bodyFiles || []) {
    if (file.mime?.startsWith("image/") || !file.mime) images.push(file.url);
  }
  return images;
}

function renderGrid() {
  const grid = document.getElementById("submissions-grid");
  if (!grid) return;
  const t = NaMeAdmin.t;
  const esc = NaMeAdmin.esc;
  const searched = allSubmissions.filter((s) =>
    NaMeAdmin.matches(`${s.title} ${s.medium} ${s.description || ""} ${s.author?.displayName || ""} ${s.author?.email || ""}`)
  );
  const statuses = ["pending", "published", "rejected"];
  NaMeAdmin.renderSegment(
    document.getElementById("submissions-filters"),
    [
      { value: "all", label: t("naAll"), count: searched.length },
      ...statuses.map((status) => ({
        value: status,
        label: t(`submissionStatus_${status}`),
        count: searched.filter((s) => s.status === status).length,
      })),
    ],
    submissionFilter,
    (value) => {
      submissionFilter = value;
      renderGrid();
    }
  );

  const list = searched.filter((s) => submissionFilter === "all" || s.status === submissionFilter);
  if (!list.length) {
    grid.innerHTML = NaMeAdmin.emptyState(t("adminSubmissionsEmpty"));
    return;
  }

  grid.innerHTML = list
    .map((s) => {
      const images = submissionImages(s);
      const live = s.postSlug
        ? `<a class="na-btn na-btn--light na-btn--sm" href="${esc(NaMeAdmin.postUrl(s.postSlug))}" target="_blank" rel="noopener">${NaMeAdmin.icon("arrow")}<span>${esc(t("naView"))}</span></a>`
        : `<button type="button" class="na-btn na-btn--danger na-btn--sm" data-delete-submission="${esc(s.id)}">${NaMeAdmin.icon("trash")}<span>${esc(t("adminDeleteSubmission"))}</span></button>`;
      return NaMeAdmin.card({
        image: images[0],
        status: s.status,
        statusLabel: t(`submissionStatus_${s.status}`),
        tag: s.medium,
        title: s.title,
        meta: `${s.author?.displayName || ""} · ${NaMeAdmin.timeAgo(s.createdAt)}`,
        extra: s.description ? `<p class="na-item__desc">${esc(s.description)}</p>` : "",
        actions: `
          <button type="button" class="na-btn na-btn--dark na-btn--sm" data-review="${esc(s.id)}">${esc(t(s.status === "pending" ? "naReview" : "naDetails"))}</button>
          ${live}`,
      });
    })
    .join("");

  grid.querySelectorAll("[data-review]").forEach((btn) => {
    btn.addEventListener("click", () => openPublishModal(btn.dataset.review));
  });
  grid.querySelectorAll("[data-delete-submission]").forEach((btn) => {
    btn.addEventListener("click", () => deleteSubmission(btn.dataset.deleteSubmission));
  });
}

function renderReview(s) {
  const t = NaMeAdmin.t;
  const esc = NaMeAdmin.esc;
  const images = submissionImages(s).map(NaMeAdmin.safeUrl).filter(Boolean);
  let media = "";
  if (images.length) {
    media = `<div class="na-review__gallery">${images.map((url) => `<img src="${esc(url)}" alt="" loading="lazy" />`).join("")}</div>`;
  } else if (s.fileMime?.startsWith("video/") && NaMeAdmin.safeUrl(s.fileUrl)) {
    media = `<video src="${esc(NaMeAdmin.safeUrl(s.fileUrl))}" controls class="na-review__video"></video>`;
  } else if (NaMeAdmin.safeUrl(s.fileUrl)) {
    media = `<a class="na-btn na-btn--light na-btn--sm" href="${esc(NaMeAdmin.safeUrl(s.fileUrl))}" target="_blank" rel="noopener">${NaMeAdmin.icon("file")}<span>${esc(s.fileName || "PDF")}</span></a>`;
  }
  return `
    ${media}
    <div class="na-review__head">
      <h3>${esc(s.title)}</h3>
      ${NaMeAdmin.pill(s.status, t(`submissionStatus_${s.status}`))}
    </div>
    <p class="na-person">
      <span class="na-avatar na-avatar--sm" aria-hidden="true">${esc(NaMeAdmin.initials(s.author?.displayName || s.author?.email))}</span>
      <span class="na-person__text"><strong>${esc(s.author?.displayName || "")}</strong><small>${esc(s.author?.email || "")}</small></span>
    </p>
    <p class="na-dim">${esc(s.medium)} · ${esc(NaMeAdmin.formatDate(s.createdAt))}</p>
    ${s.description ? `<p class="na-review__desc">${esc(s.description)}</p>` : ""}
    ${s.adminNote ? `<p class="na-review__note">${esc(s.adminNote)}</p>` : ""}`;
}

function openPublishModal(id) {
  const s = allSubmissions.find((x) => x.id === id);
  if (!s) return;
  const pending = s.status === "pending";
  document.getElementById("publish-submission-id").value = id;
  document.getElementById("publish-modal-summary").innerHTML = renderReview(s);
  const publishForm = document.getElementById("publish-form");
  const rejectForm = document.getElementById("reject-form");
  publishForm.reset();
  rejectForm.reset();
  publishForm.hidden = !pending;
  rejectForm.hidden = !pending;
  document.getElementById("publish-meta").value = `${s.medium} — ${new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}`;
  if (typeof NaMeMetaCombo !== "undefined") {
    NaMeMetaCombo.loadNames("post").then((names) => {
      publishMetaNames = names;
    });
  }
  const typeSelect = publishForm.querySelector("select[name=type]");
  if (typeSelect) {
    typeSelect.value = s.medium === "film" ? "film" : s.medium === "photography" ? "editorial" : "article";
  }
  document.getElementById("publish-status").textContent = "";
  NaMeAdmin.openDrawer("publish-modal", { focus: pending ? "#publish-form select" : "#publish-delete" });
}

function closePublishModal() {
  NaMeAdmin.closeDrawer("publish-modal");
}

async function onPublish(e) {
  e.preventDefault();
  const t = NaMeAdmin.t;
  const statusEl = document.getElementById("publish-status");
  const id = document.getElementById("publish-submission-id").value;
  const fd = new FormData(e.target);
  const submit = e.target.querySelector("[type=submit]");
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    const res = await NaMeAuth.publishSubmission(id, {
      type: fd.get("type"),
      section: fd.get("section"),
      meta: fd.get("meta"),
    });
    statusEl.textContent = `${t("adminPublishSuccess")} ${res.post.title}`;
    document.dispatchEvent(new CustomEvent("name:posts-changed"));
    setTimeout(() => {
      closePublishModal();
      loadSubmissions();
    }, 600);
  } catch (err) {
    statusEl.textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}

async function onReject(e) {
  e.preventDefault();
  const id = document.getElementById("publish-submission-id").value;
  const note = document.getElementById("reject-note").value.trim();
  const submit = e.target.querySelector("[type=submit]");
  if (submit.disabled) return;
  submit.disabled = true;
  try {
    await NaMeAuth.updateSubmission(id, { status: "rejected", adminNote: note || null });
    closePublishModal();
    NaMeAdmin.announce(NaMeAdmin.t("submissionStatus_rejected"));
    loadSubmissions();
  } catch (err) {
    document.getElementById("publish-status").textContent = err.message;
  } finally {
    submit.disabled = false;
  }
}

async function deleteSubmission(id) {
  if (!id || !confirm(NaMeAdmin.t("adminDeleteSubmissionConfirm"))) return;
  try {
    await NaMeAuth.deleteSubmission(id);
    closePublishModal();
    loadSubmissions();
  } catch (err) {
    alert(err.message);
  }
}
