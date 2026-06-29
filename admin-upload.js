document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init("upload");
  if (!ok) return;
  bootUpload();
});

document.addEventListener("name:adminpage", (e) => {
  if (e.detail?.page === "upload") bootUpload();
});

function bootUpload() {
  const form = document.getElementById("upload-form");
  if (!form) return;
  if (form.dataset.booted) return;
  form.dataset.booted = "1";
  const status = document.getElementById("upload-status");
  const success = document.getElementById("upload-success");
  const imageInput = document.getElementById("upload-image");
  const imageUrlInput = document.getElementById("upload-image-url");
  const titleInput = document.getElementById("upload-title");
  const metaInput = document.getElementById("upload-meta");
  const typeSelect = document.getElementById("upload-type");
  const videoWrap = document.getElementById("upload-video-wrap");

  function updatePreview() {
    const title = titleInput.value.trim() || "Title";
    const meta = metaInput.value.trim() || "—";
    const type = typeSelect.value;
    document.getElementById("preview-title").textContent = title;
    document.getElementById("preview-meta").textContent = meta;
    document.getElementById("preview-type").textContent = type;

    const url = imageUrlInput.value.trim();
    const file = imageInput.files?.[0];
    const imgBox = document.getElementById("preview-img");

    if (file) {
      const reader = new FileReader();
      reader.onload = (e) => {
        imgBox.innerHTML = `<img src="${e.target.result}" alt="" />`;
      };
      reader.readAsDataURL(file);
    } else if (url) {
      imgBox.innerHTML = `<img src="${url}" alt="" onerror="this.parentElement.innerHTML='<span>Invalid image URL</span>'" />`;
    } else {
      imgBox.innerHTML = `<span>${NaMeI18n.t(NaMeI18n.getLang(), "adminPreviewEmpty")}</span>`;
    }

    videoWrap.classList.toggle("is-hidden", type !== "film");
  }

  [titleInput, metaInput, typeSelect, imageUrlInput].forEach((el) => {
    el?.addEventListener("input", updatePreview);
    el?.addEventListener("change", updatePreview);
  });
  imageInput?.addEventListener("change", updatePreview);
  updatePreview();

  NaMeAdminBodyImages.init({
    textarea: document.getElementById("upload-body"),
    statusEl: status,
    typeSelect,
  });

  form?.addEventListener("reset", () => {
    setTimeout(updatePreview, 0);
    success.classList.add("is-hidden");
    status.textContent = "";
  });

  form?.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    success.classList.add("is-hidden");

    const fd = new FormData(form);
    const hasFile = fd.get("image")?.size > 0;
    const hasUrl = fd.get("imageUrl")?.trim();
    if (!hasFile && !hasUrl) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "adminImageRequired");
      return;
    }
    if (fd.get("featured")) fd.set("featured", "1");

    try {
      const res = await NaMeAuth.createPost(fd);
      const post = res.post;
      status.textContent = "";
      success.classList.remove("is-hidden");
      success.innerHTML = `
        <p><strong>${NaMeI18n.t(NaMeI18n.getLang(), "adminPublishSuccess")}</strong> ${NaMeAdmin.esc(post.title)}</p>
        <p>
          <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(post.slug)}" class="btn btn--primary" target="_blank">${NaMeI18n.t(NaMeI18n.getLang(), "adminViewPost")}</a>
          <button type="button" class="btn btn--ghost" id="upload-another">${NaMeI18n.t(NaMeI18n.getLang(), "adminUploadAnother")}</button>
        </p>`;
      document.getElementById("upload-another")?.addEventListener("click", () => {
        form.reset();
        success.classList.add("is-hidden");
        updatePreview();
      });
      form.reset();
      updatePreview();
    } catch (err) {
      status.textContent = err.message;
    }
  });
}
