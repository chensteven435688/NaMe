/**
 * NaMe — dedicated account page (login / register)
 */
document.addEventListener("DOMContentLoaded", async () => {
  NaMeI18n.init();
  NaMeAuth.initAuthModal();

  const titleKey = document.body.dataset.pageTitle;
  const descKey = document.body.dataset.pageDescription;
  const lang = NaMeI18n.getLang();
  if (titleKey) document.title = NaMeI18n.t(lang, titleKey);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && descKey) meta.setAttribute("content", NaMeI18n.t(lang, descKey));

  const loginEmail = new URLSearchParams(location.search).get("email");
  if (loginEmail) {
    NaMeAuth.prefillLoginEmail(loginEmail);
    NaMeAuth.switchAuthTab("login");
  }

  await NaMeAuth.refresh();
  NaMeAuth.initUI();

  if (NaMeAuth.isLoggedIn()) {
    window.location.replace(NaMeAuth.getReturnUrl());
    return;
  }

  NaMeAuth.onChange((user) => {
    if (user) window.location.replace(NaMeAuth.getReturnUrl());
  });

  const tab = new URLSearchParams(location.search).get("tab");
  if (!loginEmail) {
    if (tab === "register") NaMeAuth.switchAuthTab("register");
    else NaMeAuth.switchAuthTab("login");
  }
});
