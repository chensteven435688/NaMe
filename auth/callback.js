document.addEventListener("DOMContentLoaded", async () => {
  const title = document.getElementById("auth-callback-title");
  const text = document.getElementById("auth-callback-text");
  const btn = document.getElementById("auth-callback-btn");
  const home =
    typeof NaMeBase !== "undefined" ? NaMeBase.path("./") : "../index.html";

  if (btn) btn.href = home;

  try {
    await NaMeAuth.refresh();
    const user = NaMeAuth.getUser();

    if (user) {
      title.textContent = "Welcome to NaMe";
      text.textContent = `${user.displayName}, your email is verified. Taking you home…`;
      setTimeout(() => {
        window.location.href = home;
      }, 2000);
      return;
    }

    title.textContent = "Email verified";
    text.textContent = "Your account is ready. You can log in now.";
    if (btn) {
      btn.hidden = false;
      btn.textContent = "Log in to NaMe";
      btn.href =
        typeof NaMeBase !== "undefined" ? NaMeBase.path("/account.html") : "../account.html";
    }
    setTimeout(() => {
      window.location.href =
        typeof NaMeBase !== "undefined" ? NaMeBase.path("/account.html") : "../account.html";
    }, 3500);
  } catch (err) {
    title.textContent = "Verification issue";
    text.textContent = err.message || "Please try logging in from the homepage.";
    if (btn) {
      btn.hidden = false;
      btn.textContent = "Back to NaMe";
    }
  }
});
