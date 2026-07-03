/**
 * NaMe — post-registration confirmation page
 */
const RESEND_COOLDOWN_MS = 30000;

document.addEventListener("DOMContentLoaded", () => {
  NaMeI18n.init();

  const titleKey = document.body.dataset.pageTitle;
  const descKey = document.body.dataset.pageDescription;
  const lang = NaMeI18n.getLang();
  if (titleKey) document.title = NaMeI18n.t(lang, titleKey);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && descKey) meta.setAttribute("content", NaMeI18n.t(lang, descKey));

  const params = new URLSearchParams(location.search);
  const emailFromUrl = params.get("email")?.trim() || "";
  const returnTo = params.get("return");

  const emailEl = document.getElementById("register-complete-email");
  const emailField = document.getElementById("register-complete-email-field");
  const emailInput = document.getElementById("register-complete-email-input");
  const statusEl = document.getElementById("register-complete-status");
  const resendBtn = document.getElementById("register-complete-resend");
  const loginBtn = document.getElementById("register-complete-login");

  if (loginBtn && typeof NaMeAuth !== "undefined") {
    loginBtn.href = NaMeAuth.authPageUrl("login", returnTo || undefined);
    if (emailFromUrl) {
      const url = new URL(loginBtn.href, window.location.origin);
      url.searchParams.set("email", emailFromUrl);
      loginBtn.href = `${url.pathname}${url.search}`;
    }
  }

  if (emailFromUrl) {
    if (emailEl) {
      emailEl.textContent = emailFromUrl;
      emailEl.hidden = false;
    }
    if (emailInput) emailInput.value = emailFromUrl;
  } else if (emailField) {
    emailField.hidden = false;
  }

  let cooldownTimer = null;

  function t(key) {
    return NaMeI18n.t(NaMeI18n.getLang(), key);
  }

  function getEmail() {
    return (emailFromUrl || emailInput?.value || "").trim();
  }

  function setStatus(message, type = "error") {
    if (!statusEl) return;
    statusEl.textContent = message;
    statusEl.hidden = !message;
    statusEl.classList.toggle("register-complete__status--success", type === "success");
    statusEl.classList.toggle("register-complete__status--error", type === "error");
  }

  function startResendCooldown() {
    if (!resendBtn) return;
    resendBtn.disabled = true;
    clearTimeout(cooldownTimer);
    cooldownTimer = setTimeout(() => {
      resendBtn.disabled = false;
    }, RESEND_COOLDOWN_MS);
  }

  resendBtn?.addEventListener("click", async () => {
    setStatus("");
    const email = getEmail();
    if (!email) {
      setStatus(t("authResendNeedEmail"));
      emailInput?.focus();
      return;
    }

    resendBtn.disabled = true;
    try {
      await NaMeAuth.resendConfirmationEmail(email);
      setStatus(t("authResendSent"), "success");
      startResendCooldown();
    } catch (err) {
      setStatus(err.message || t("authResendNeedEmail"));
      resendBtn.disabled = false;
    }
  });

  NaMeI18n.apply(lang);
});
