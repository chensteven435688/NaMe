/**
 * NaMe — email verification callback (Supabase redirect target)
 */
document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();

  const titleKey = document.body.dataset.pageTitle;
  const descKey = document.body.dataset.pageDescription;
  const lang = NaMeI18n.getLang();
  if (titleKey) document.title = NaMeI18n.t(lang, titleKey);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && descKey) meta.setAttribute("content", NaMeI18n.t(lang, descKey));

  const title = document.getElementById("auth-callback-title");
  const text = document.getElementById("auth-callback-text");
  const hint = document.getElementById("auth-callback-hint");
  const btn = document.getElementById("auth-callback-btn");
  const status = document.getElementById("auth-callback-status");

  const loginUrl =
    typeof NaMeBase !== "undefined" ? NaMeBase.path("/account.html") : "../account.html";

  if (btn) btn.href = loginUrl;

  function t(key) {
    return NaMeI18n.t(NaMeI18n.getLang(), key);
  }

  function showLoading() {
    if (title) title.textContent = t("verifySuccessLoadingTitle");
    if (text) text.textContent = t("verifySuccessLoadingText");
    if (hint) hint.hidden = true;
    if (btn) btn.hidden = true;
    if (status) status.hidden = true;
  }

  function showSuccess() {
    if (title) title.textContent = t("verifySuccessTitle");
    if (text) text.textContent = t("verifySuccessLead");
    if (hint) {
      hint.textContent = t("verifySuccessHint");
      hint.hidden = false;
    }
    if (btn) {
      btn.textContent = t("verifySuccessLoginBtn");
      btn.hidden = false;
    }
    if (status) status.hidden = true;
    NaMeI18n.apply(NaMeI18n.getLang());
  }

  function showError(message) {
    if (title) title.textContent = t("verifySuccessErrorTitle");
    if (text) text.textContent = message || t("verifySuccessErrorText");
    if (hint) hint.hidden = true;
    if (btn) {
      btn.textContent = t("verifySuccessLoginBtn");
      btn.hidden = false;
    }
    if (status) status.hidden = true;
  }

  showLoading();

  try {
    await NaMeAuth.refresh();

    // Clear the verification code/hash from the URL without reloading.
    if (location.search || location.hash) {
      history.replaceState({}, document.title, location.pathname);
    }

    // Sign out on this tab so the user logs in on their original NaMe tab.
    if (NaMeAuth.isLoggedIn()) {
      await NaMeAuth.logout();
    }

    showSuccess();
  } catch (err) {
    showError(err.message);
  }
});
