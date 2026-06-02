document.addEventListener("DOMContentLoaded", async () => {
  const ok = await NaMeAdmin.init("exclusive");
  if (!ok) return;

  const form = document.getElementById("exclusive-form");
  const status = document.getElementById("exclusive-status");
  const success = document.getElementById("exclusive-success");
  const imageInput = document.getElementById("exclusive-image");
  const imageUrlInput = document.getElementById("exclusive-image-url");
  const titleInput = document.getElementById("exclusive-title");
  const metaInput = document.getElementById("exclusive-meta");

  function updatePreview() {
    const title = titleInput.value.trim() || "Title";
    const meta = metaInput.value.trim() || "—";
    document.getElementById("exclusive-preview-title").textContent = title;
    document.getElementById("exclusive-preview-meta").textContent = meta;

    const url = imageUrlInput.value.trim();
    const file = imageInput.files?.[0];
    const imgBox = document.getElementById("exclusive-preview-img");

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
  }

  [titleInput, metaInput, imageUrlInput].forEach((el) => {
    el?.addEventListener("input", updatePreview);
    el?.addEventListener("change", updatePreview);
  });
  imageInput?.addEventListener("change", updatePreview);
  updatePreview();

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

    try {
      const res = await NaMeAuth.request("/api/posts", { method: "POST", body: fd });
      const post = res.post;
      success.classList.remove("is-hidden");
      success.innerHTML = `
        <p><strong>${NaMeI18n.t(NaMeI18n.getLang(), "adminPublishSuccess")}</strong> ${NaMeAdmin.esc(post.title)}</p>
        <p>
          <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(post.slug)}" class="btn btn--primary" target="_blank">${NaMeI18n.t(NaMeI18n.getLang(), "adminViewPost")}</a>
          <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/exclusive.html") : "/exclusive.html"}" class="btn btn--ghost" target="_blank">${NaMeI18n.t(NaMeI18n.getLang(), "adminViewExclusive")}</a>
        </p>`;
      form.reset();
      updatePreview();
      loadExclusivePosts();
    } catch (err) {
      status.textContent = err.message;
    }
  });

  document.getElementById("exclusive-refresh")?.addEventListener("click", loadExclusivePosts);
  loadExclusivePosts();
});

async function loadExclusivePosts() {
  const tbody = document.getElementById("exclusive-table-body");
  const lang = NaMeI18n.getLang();
  try {
    const posts = await NaMeAuth.fetchPosts({ type: "exclusive" });
    if (!posts.length) {
      tbody.innerHTML = `<tr><td colspan="2">${NaMeAdmin.esc(NaMeI18n.t(lang, "exclusiveEmpty"))}</td></tr>`;
      return;
    }
    tbody.innerHTML = posts
      .map(
        (p) => `
      <tr>
        <td>
          <strong>${NaMeAdmin.esc(p.title)}</strong>
          <br><small class="text-dim">/${NaMeAdmin.esc(p.slug)} · ${NaMeAdmin.formatDate(p.publishedAt)}</small>
        </td>
        <td class="admin-actions">
          <a href="${typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html"}?slug=${encodeURIComponent(p.slug)}" target="_blank">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminViewPost"))}</a>
          <button type="button" class="danger" data-delete-exclusive="${p.id}">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminRemoveExclusive"))}</button>
        </td>
      </tr>`
      )
      .join("");

    tbody.querySelectorAll("[data-delete-exclusive]").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const msg = NaMeI18n.t(NaMeI18n.getLang(), "adminRemoveExclusiveConfirm");
        if (!confirm(msg)) return;
        await NaMeAuth.request(`/api/posts/${btn.dataset.deleteExclusive}`, { method: "DELETE" });
        loadExclusivePosts();
      });
    });
  } catch {
    tbody.innerHTML = `<tr><td colspan="2">${NaMeAdmin.esc(NaMeI18n.t(lang, "adminLoading"))}</td></tr>`;
  }
}
