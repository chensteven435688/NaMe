/**
 * NaMe — member profile settings
 */
document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();

  const titleKey = document.body.dataset.pageTitle;
  const descKey = document.body.dataset.pageDescription;
  const lang = NaMeI18n.getLang();
  if (titleKey) document.title = NaMeI18n.t(lang, titleKey);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && descKey) meta.setAttribute("content", NaMeI18n.t(lang, descKey));

  await NaMeAuth.refresh();
  NaMeAuth.initUI();

  if (!NaMeAuth.isLoggedIn()) {
    const ret =
      typeof NaMeBase !== "undefined"
        ? NaMeBase.path("/profile.html")
        : "/profile.html";
    const account =
      typeof NaMeBase !== "undefined"
        ? NaMeBase.path(`/account.html?return=${encodeURIComponent(ret)}`)
        : `/account.html?return=${encodeURIComponent(ret)}`;
    window.location.replace(account);
    return;
  }

  bootProfileForm();
  NaMeAuth.onChange((user) => {
    if (!user) {
      const account =
        typeof NaMeBase !== "undefined" ? NaMeBase.path("/account.html") : "/account.html";
      window.location.replace(account);
    } else {
      fillProfileForm(user);
    }
  });
});

function bootProfileForm() {
  const form = document.getElementById("profile-form");
  if (!form || form.dataset.booted) return;
  form.dataset.booted = "1";

  const avatarInput = document.getElementById("profile-avatar-input");
  const removeBtn = document.getElementById("profile-remove-avatar");
  const status = document.getElementById("profile-status");
  const logoutBtn = document.getElementById("profile-logout");

  let pendingAvatarFile = null;
  let removeAvatar = false;

  fillProfileForm(NaMeAuth.getUser());

  avatarInput?.addEventListener("change", () => {
    const file = avatarInput.files?.[0];
    if (!file) return;
    pendingAvatarFile = file;
    removeAvatar = false;
    removeBtn.hidden = false;
    previewAvatarFile(file);
    status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "profilePhotoPending");
    status.classList.remove("is-success");
  });

  removeBtn?.addEventListener("click", () => {
    pendingAvatarFile = null;
    removeAvatar = true;
    avatarInput.value = "";
    removeBtn.hidden = true;
    renderAvatarPreview(null, NaMeAuth.getUser()?.displayName || "?");
    status.textContent = "";
  });

  logoutBtn?.addEventListener("click", () => {
    const lang = NaMeI18n.getLang();
    if (!confirm(NaMeI18n.t(lang, "logoutConfirm"))) return;
    NaMeAuth.logout();
  });

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    status.textContent = "";
    const submitBtn = form.querySelector('button[type="submit"]');
    if (submitBtn) submitBtn.disabled = true;

    try {
      const displayName = form.displayName.value.trim();
      const signature = form.signature.value.trim();
      const avatarFile = pendingAvatarFile || avatarInput?.files?.[0] || null;
      const res = await NaMeAuth.updateMyProfile({
        displayName,
        signature,
        avatarFile,
        removeAvatar,
      });
      pendingAvatarFile = null;
      removeAvatar = false;
      avatarInput.value = "";
      fillProfileForm(res.user);
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "profileSaved");
      status.classList.add("is-success");
    } catch (err) {
      status.textContent = err.message;
      status.classList.remove("is-success");
    } finally {
      if (submitBtn) submitBtn.disabled = false;
    }
  });
}

function fillProfileForm(user) {
  if (!user) return;

  const form = document.getElementById("profile-form");
  form.displayName.value = user.displayName || "";
  form.signature.value = user.signature || "";
  document.getElementById("profile-email").textContent = user.email || "—";

  const removeBtn = document.getElementById("profile-remove-avatar");
  if (removeBtn) removeBtn.hidden = !user.avatarUrl;

  renderAvatarPreview(user.avatarUrl, user.displayName);
}

function renderAvatarPreview(url, displayName) {
  const box = document.getElementById("profile-avatar-preview");
  if (!box) return;
  box.innerHTML = NaMeAuth.formatUserAvatar(
    { displayName, avatarUrl: url },
    "user-avatar user-avatar--xl"
  );
}

function previewAvatarFile(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    const box = document.getElementById("profile-avatar-preview");
    if (!box) return;
    box.innerHTML = `<img class="user-avatar user-avatar--xl" src="${e.target.result}" alt="" />`;
  };
  reader.readAsDataURL(file);
}
