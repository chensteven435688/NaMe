/**
 * NaMe — body image upload toolbar for admin post forms (cover + gallery)
 */
const NaMeAdminBodyImages = (function () {
  function t(key) {
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    return typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, key) : key;
  }

  function insertAtCursor(textarea, html) {
    const start = textarea.selectionStart ?? textarea.value.length;
    const end = textarea.selectionEnd ?? textarea.value.length;
    const before = textarea.value.slice(0, start);
    const after = textarea.value.slice(end);
    const spacer = before && !before.endsWith("\n") ? "\n" : "";
    textarea.value = `${before}${spacer}${html}\n${after}`;
    const pos = (before + spacer + html + "\n").length;
    textarea.focus();
    textarea.setSelectionRange(pos, pos);
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
  }

  function imageHtml(url, alt = "") {
    const safeAlt = alt.replace(/"/g, "&quot;");
    return `<figure class="post__figure"><img src="${url}" alt="${safeAlt}" loading="lazy" /></figure>`;
  }

  function extractGalleryUrls(textarea) {
    const urls = [];
    const re = /<img[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(textarea.value))) {
      const src = match[1]?.trim();
      if (src && !urls.includes(src)) urls.push(src);
    }
    return urls;
  }

  function renderPreviewGrid(grid, urls) {
    if (!urls.length) {
      grid.hidden = true;
      grid.innerHTML = "";
      return;
    }
    grid.hidden = false;
    grid.innerHTML = urls
      .map(
        (url, i) => `
        <figure class="admin-body-images__thumb">
          <img src="${url.replace(/"/g, "&quot;")}" alt="" />
          <figcaption>${i + 1}</figcaption>
        </figure>`
      )
      .join("");
  }

  function init({ textarea, statusEl, typeSelect }) {
    if (!textarea || textarea.dataset.bodyImagesBound) return;
    textarea.dataset.bodyImagesBound = "1";

    const wrap = document.createElement("div");
    wrap.className = "admin-body-images";
    wrap.innerHTML = `
      <p class="admin-body-images__label" data-i18n="adminGalleryLabel">${t("adminGalleryLabel")}</p>
      <div class="admin-body-images__toolbar">
        <label class="btn btn--ghost btn--sm admin-body-images__upload">
          <span data-i18n="adminBodyUpload">${t("adminBodyUpload")}</span>
          <input type="file" accept="image/*" multiple hidden />
        </label>
        <div class="admin-body-images__url">
          <input type="url" class="admin-body-images__url-input" placeholder="${t("adminBodyImageUrl")}" />
          <button type="button" class="btn btn--ghost btn--sm" data-insert-url>${t("adminBodyInsertUrl")}</button>
        </div>
      </div>
      <div class="admin-body-images__preview" hidden></div>
      <p class="admin-body-images__hint" data-i18n="adminBodyImageHint">${t("adminBodyImageHint")}</p>
    `;
    textarea.insertAdjacentElement("beforebegin", wrap);

    const fileInput = wrap.querySelector('input[type="file"]');
    const urlInput = wrap.querySelector(".admin-body-images__url-input");
    const insertUrlBtn = wrap.querySelector("[data-insert-url]");
    const previewGrid = wrap.querySelector(".admin-body-images__preview");

    function refreshPreview() {
      renderPreviewGrid(previewGrid, extractGalleryUrls(textarea));
    }

    function setStatus(msg) {
      if (statusEl) statusEl.textContent = msg || "";
    }

    textarea.addEventListener("input", refreshPreview);

    fileInput?.addEventListener("change", async () => {
      const files = [...(fileInput.files || [])];
      fileInput.value = "";
      if (!files.length) return;

      setStatus(t("adminBodyUploading"));
      try {
        for (const file of files) {
          const url = await NaMeAuth.uploadPostBodyImage(file);
          insertAtCursor(textarea, imageHtml(url));
        }
        refreshPreview();
        setStatus("");
      } catch (err) {
        setStatus(err.message);
      }
    });

    insertUrlBtn?.addEventListener("click", () => {
      const url = urlInput.value.trim();
      if (!url) {
        setStatus(t("adminBodyUrlRequired"));
        return;
      }
      insertAtCursor(textarea, imageHtml(url));
      urlInput.value = "";
      refreshPreview();
      setStatus("");
    });

    urlInput?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        insertUrlBtn?.click();
      }
    });

    if (typeSelect) {
      const dateLabel = wrap.closest("form")?.querySelector("[data-content-date-label]");
      const updateDateLabel = () => {
        if (!dateLabel) return;
        const isFilm = typeSelect.value === "film" || typeSelect.value === "short";
        dateLabel.textContent = t(isFilm ? "adminFilmedDate" : "adminCreatedDate");
      };
      typeSelect.addEventListener("change", updateDateLabel);
      updateDateLabel();
    }

    refreshPreview();
  }

  return { init };
})();
