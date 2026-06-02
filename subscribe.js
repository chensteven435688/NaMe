/**
 * NaMe — subscribe page
 */
document.addEventListener("DOMContentLoaded", () => {
  initSubscribeForm();
});

function initSubscribeForm() {
  const form = document.getElementById("subscribe-form");
  if (!form) return;

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const status = document.getElementById("subscribe-status");
    const input = form.querySelector('input[type="email"]');
    if (status) {
      status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "newsletterThanks");
    }
    if (input) input.value = "";
  });
}

document.addEventListener("name:languagechange", () => {
  const status = document.getElementById("subscribe-status");
  if (status?.textContent) {
    status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "newsletterThanks");
  }
});
