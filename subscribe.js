/**
 * NaMe — subscribe page & newsletter signup
 */
document.addEventListener("DOMContentLoaded", () => {
  initSubscribeForm();
});

function useSupabaseNewsletter() {
  if (typeof NaMeSupabase === "undefined") return false;
  if (window.location.hostname === "localhost" || window.location.protocol === "file:") {
    return false;
  }
  return !!NaMeSupabase.getClient();
}

async function saveNewsletterEmail(email) {
  const normalized = email.trim().toLowerCase();
  if (!normalized) throw new Error("Enter an email address");

  const sb = NaMeSupabase.getClient();
  const userId = typeof NaMeAuth !== "undefined" ? NaMeAuth.getUser()?.id : null;

  const { error } = await sb.from("newsletter_subscribers").upsert(
    {
      email: normalized,
      user_id: userId || null,
      source: "subscribe_page",
      opted_in: true,
      updated_at: new Date().toISOString(),
    },
    { onConflict: "email" }
  );

  if (error) throw new Error(error.message);

  if (userId) {
    await sb.from("profiles").update({ newsletter_opt_in: true }).eq("id", userId);
  }
}

function initSubscribeForm() {
  const form = document.getElementById("subscribe-form");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const status = document.getElementById("subscribe-status");
    const input = form.querySelector('input[type="email"]');
    const email = input?.value?.trim() || "";
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";

    if (status) {
      status.textContent = "";
      status.classList.remove("subscribe-form__status--error");
    }

    try {
      if (useSupabaseNewsletter()) {
        await saveNewsletterEmail(email);
      }
      if (status) {
        status.textContent = NaMeI18n.t(lang, "newsletterThanks");
      }
      if (input) input.value = "";
    } catch (err) {
      if (status) {
        status.textContent = err.message || "Could not subscribe. Try again.";
        status.classList.add("subscribe-form__status--error");
      }
    }
  });
}

document.addEventListener("name:languagechange", () => {
  const status = document.getElementById("subscribe-status");
  if (status?.textContent && !status.classList.contains("subscribe-form__status--error")) {
    status.textContent = NaMeI18n.t(NaMeI18n.getLang(), "newsletterThanks");
  }
});
