/**
 * NaMe — Editor's Exclusive section (admin.html#exclusive) and its "New pick" drawer.
 */
let exclusiveDeclared = [];
let exclusivePosts = [];
let exclusiveFilter = "all";

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "exclusive") bootExclusive();
});
document.addEventListener("name:adminrefresh", (e) => {
  if (e.detail?.page === "exclusive") refreshExclusive();
});
document.addEventListener("name:adminsearch", (e) => {
  if (e.detail?.page === "exclusive") renderExclusive();
});
document.addEventListener("name:posts-changed", () => {
  if (NaMeAdmin.current() === "exclusive") refreshExclusive();
});
document.addEventListener("click", (event) => {
  if (!event.target.closest?.("[data-open-exclusive]")) return;
  bootExclusiveForm();
  NaMeAdmin.openDrawer("exclusive-modal", { focus: "#exclusive-title" });
});

function exclusiveKey(name) {
  return NaMeAuth.exclusiveCollectionName(name).toLowerCase();
}

function exclusiveCollections() {
  const map = new Map();
  for (const meta of exclusiveDeclared) {
    const name = NaMeAuth.exclusiveCollectionName(meta.name);
    if (name) map.set(name.toLowerCase(), name);
  }
  for (const post of exclusivePosts) {
    const name = NaMeAuth.exclusiveCollectionName(post.meta);
    if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
  }
  return [...map.values()];
}

function bootExclusive() {
  bootExclusiveForm();
  refreshExclusive();
}

async function refreshExclusive() {
  const grid = document.getElementById("exclusive-grid");
  if (grid && !exclusivePosts.length) grid.innerHTML = NaMeAdmin.emptyState(NaMeAdmin.t("adminLoading"));
  const [metas, posts] = await Promise.all([
    NaMeAuth.fetchExclusiveMetas().catch(() => exclusiveDeclared),
    NaMeAuth.fetchPosts({ type: "exclusive" }).catch(() => null),
  ]);
  exclusiveDeclared = metas || [];
  if (posts) exclusivePosts = posts;
  else if (grid) grid.innerHTML = NaMeAdmin.emptyState(NaMeAdmin.t("naLoadFailed"));
  NaMeAdmin.setCount("exclusive", exclusivePosts.length);
  renderExclusive();
}

function renderExclusive() {
  renderExclusiveCollections();
  renderExclusiveGrid();
}

function renderExclusiveCollections() {
  const el = document.getElementById("exclusive-meta-manage");
  if (!el) return;
  const t = NaMeAdmin.t;
  const esc = NaMeAdmin.esc;
  const names = exclusiveCollections();
  if (exclusiveFilter !== "all" && !names.some((n) => exclusiveKey(n) === exclusiveFilter)) exclusiveFilter = "all";
  if (!names.length) {
    el.innerHTML = NaMeAdmin.emptyState(t("exclusiveCollectionsEmpty"));
    return;
  }
  const total = exclusivePosts.length;
  const cardFor = (key, label, count, removable) => {
    const share = total ? Math.round((count / total) * 100) : 0;
    const active = exclusiveFilter === key;
    return `
      <div class="na-strip__card${active ? " is-active" : ""}">
        <button type="button" class="na-strip__hit" data-collection="${esc(key)}" aria-pressed="${active}">
          <span class="na-strip__label">${esc(label)}</span>
          <strong>${count}</strong>
          <span class="na-meter"><span style="width:${share}%"></span></span>
          <small>${esc(t(count === 1 ? "exclusivePiece" : "exclusivePieces"))}</small>
        </button>
        ${removable ? `<button type="button" class="na-strip__remove" data-delete-meta="${esc(label)}" aria-label="${esc(t("adminExclusiveMetaRemove"))}: ${esc(label)}">${NaMeAdmin.icon("x")}</button>` : ""}
      </div>`;
  };
  el.innerHTML =
    cardFor("all", t("naAll"), total, false) +
    names
      .map((name) => {
        const key = exclusiveKey(name);
        const count = exclusivePosts.filter((p) => exclusiveKey(p.meta) === key).length;
        const declared = exclusiveDeclared.some((m) => exclusiveKey(m.name) === key);
        return cardFor(key, name, count, declared && count === 0);
      })
      .join("");

  el.querySelectorAll("[data-collection]").forEach((btn) => {
    btn.addEventListener("click", () => {
      exclusiveFilter = btn.dataset.collection;
      renderExclusive();
    });
  });
  el.querySelectorAll("[data-delete-meta]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const status = document.getElementById("exclusive-meta-status");
      if (!confirm(t("adminExclusiveMetaRemoveConfirm"))) return;
      status.textContent = "";
      try {
        await NaMeAuth.deleteExclusiveMeta(btn.dataset.deleteMeta);
        await refreshExclusive();
      } catch (err) {
        status.textContent = err.message;
      }
    });
  });
}

function renderExclusiveGrid() {
  const grid = document.getElementById("exclusive-grid");
  if (!grid) return;
  const t = NaMeAdmin.t;
  const esc = NaMeAdmin.esc;
  const list = exclusivePosts.filter(
    (p) =>
      (exclusiveFilter === "all" || exclusiveKey(p.meta) === exclusiveFilter) &&
      NaMeAdmin.matches(`${p.title} ${p.slug} ${p.meta || ""}`)
  );
  if (!list.length) {
    grid.innerHTML = NaMeAdmin.emptyState(exclusivePosts.length ? t("naNoMatches") : t("exclusiveEmpty"));
    return;
  }
  grid.innerHTML = list
    .map((p) =>
      NaMeAdmin.card({
        image: p.imageUrl,
        status: p.featured ? "featured" : "live",
        statusLabel: t(p.featured ? "naStatusFeatured" : "naStatusLive"),
        tag: NaMeAuth.exclusiveCollectionName(p.meta) || t("adminExclusivePageTitle"),
        title: p.title,
        meta: NaMeAdmin.formatDate(p.publishedAt),
        actions: `
          <button type="button" class="na-btn na-btn--dark na-btn--sm" data-edit="${esc(p.id)}">${NaMeAdmin.icon("pen")}<span>${esc(t("naEdit"))}</span></button>
          <a class="na-btn na-btn--light na-btn--sm" href="${esc(NaMeAdmin.postUrl(p.slug))}" target="_blank" rel="noopener">${NaMeAdmin.icon("arrow")}<span>${esc(t("naView"))}</span></a>`,
      })
    )
    .join("");
  if (typeof bindEditButtons === "function") bindEditButtons(grid);
}

/* ---------- "New pick" drawer ---------- */

function bootExclusiveForm() {
  const form = document.getElementById("exclusive-form");
  if (!form || form.dataset.booted) return;
  form.dataset.booted = "1";
  const t = NaMeAdmin.t;
  const status = document.getElementById("exclusive-status");
  const success = document.getElementById("exclusive-success");
  const imageInput = document.getElementById("exclusive-image");
  const imageUrlInput = document.getElementById("exclusive-image-url");
  const titleInput = document.getElementById("exclusive-title");
  const metaInput = document.getElementById("exclusive-meta");

  if (typeof NaMeMetaCombo !== "undefined") {
    NaMeMetaCombo.attach(metaInput, { getNames: exclusiveCollections });
  }

  document.getElementById("exclusive-meta-add")?.addEventListener("click", async () => {
    const name = NaMeAuth.exclusiveCollectionName(metaInput.value);
    status.textContent = "";
    if (!name) {
      status.textContent = t("exclusiveMetaRequired");
      metaInput.focus();
      return;
    }
    try {
      const saved = await NaMeAuth.createExclusiveMeta(name);
      metaInput.value = saved.name;
      status.textContent = saved.created ? t("exclusiveMetaAdded") : "";
      updatePreview();
      await refreshExclusive();
    } catch (err) {
      status.textContent = err.message;
    }
  });

  function updatePreview() {
    document.getElementById("exclusive-preview-title").textContent = titleInput.value.trim() || t("adminPreviewTitle");
    document.getElementById("exclusive-preview-meta").textContent = metaInput.value.trim() || "—";
    const imgBox = document.getElementById("exclusive-preview-img");
    if (imgBox.dataset.objectUrl) {
      URL.revokeObjectURL(imgBox.dataset.objectUrl);
      delete imgBox.dataset.objectUrl;
    }
    imgBox.replaceChildren();
    const file = imageInput.files?.[0];
    const url = NaMeAdmin.safeUrl(imageUrlInput.value);
    if (!file && !imageUrlInput.value.trim()) {
      imgBox.textContent = t("adminPreviewEmpty");
      return;
    }
    if (!file && !url) {
      imgBox.textContent = t("naInvalidImageUrl");
      return;
    }
    const img = document.createElement("img");
    img.alt = "";
    if (file) {
      imgBox.dataset.objectUrl = URL.createObjectURL(file);
      img.src = imgBox.dataset.objectUrl;
    } else {
      img.src = new URL(url, location.href).href;
    }
    img.addEventListener("error", () => {
      imgBox.textContent = t("naInvalidImageUrl");
    });
    imgBox.append(img);
  }

  [titleInput, metaInput, imageUrlInput].forEach((el) => {
    el?.addEventListener("input", updatePreview);
    el?.addEventListener("change", updatePreview);
  });
  imageInput?.addEventListener("change", updatePreview);
  updatePreview();

  NaMeAdminBodyImages.init({
    textarea: document.getElementById("exclusive-body"),
    statusEl: status,
  });

  form.addEventListener("reset", () => {
    setTimeout(updatePreview, 0);
    success.classList.add("is-hidden");
    status.textContent = "";
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const submit = form.querySelector('[type="submit"]');
    if (submit?.disabled) return;
    status.textContent = "";
    success.classList.add("is-hidden");

    const metaName = NaMeAuth.exclusiveCollectionName(metaInput.value);
    if (!metaName) {
      status.textContent = t("exclusiveMetaRequired");
      return;
    }
    metaInput.value = metaName;

    const fd = new FormData(form);
    const hasFile = fd.get("image")?.size > 0;
    const hasUrl = fd.get("imageUrl")?.trim();
    if (!hasFile && !hasUrl) {
      status.textContent = t("adminImageRequired");
      return;
    }

    if (submit) submit.disabled = true;
    try {
      const res = await NaMeAuth.createPost(fd);
      const post = res.post;
      form.reset();
      document.dispatchEvent(new CustomEvent("name:form-saved", { detail: { form } }));
      updatePreview();
      success.classList.remove("is-hidden");
      const esc = NaMeAdmin.esc;
      success.innerHTML = `
        <p><strong>${esc(t("adminPublishSuccess"))}</strong> ${esc(post.title)}</p>
        <p class="na-success__actions">
          <a href="${esc(NaMeAdmin.postUrl(post.slug))}" class="na-btn na-btn--dark na-btn--sm" target="_blank" rel="noopener">${esc(t("adminViewPost"))}</a>
        </p>`;
      success.setAttribute("tabindex", "-1");
      success.focus();
      document.dispatchEvent(new CustomEvent("name:posts-changed"));
      await refreshExclusive();
    } catch (err) {
      status.textContent = err.message;
    } finally {
      if (submit) submit.disabled = false;
    }
  });
}
