/**
 * NaMe — static pages (About, Business, Contact, etc.)
 */
document.addEventListener("DOMContentLoaded", async () => {
  await NaMeAuth.refresh();
  NaMeI18n.init();
  NaMeAuth.initUI();
  initContactForm();
  setPageMeta();
  if (document.getElementById("browse-grid") && typeof loadBrowseFeed === "function") {
    await loadBrowseFeed();
  }
});

function setPageMeta() {
  const titleKey = document.body.dataset.pageTitle;
  const descKey = document.body.dataset.pageDescription;
  const lang = NaMeI18n.getLang();
  if (titleKey) document.title = NaMeI18n.t(lang, titleKey);
  const meta = document.querySelector('meta[name="description"]');
  if (meta && descKey) meta.setAttribute("content", NaMeI18n.t(lang, descKey));
}

function initContactForm() {
  const form = document.getElementById("contact-form");
  if (!form) return;
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const status = document.getElementById("contact-status");
    if (status) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "contactFormThanks");
    }
    form.reset();
  });
}

document.addEventListener("name:languagechange", () => setPageMeta());
