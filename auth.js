/**
 * NaMe — client auth & API helpers
 */
const NaMeAuth = (function () {
  let currentUser = null;
  const listeners = new Set();
  if (typeof window !== "undefined") window.NA_ME_DEV_BYPASS = false;

  function apiBase() {
    if (typeof window.NA_ME_API_BASE === "string") return window.NA_ME_API_BASE;
    if (window.location.protocol === "file:") return "http://localhost:8080";
    if (typeof NaMeBase !== "undefined") return NaMeBase.getBase();
    return window.NA_ME_BASE || "";
  }

  async function request(path, options = {}) {
    const url = `${apiBase()}${path}`;
    const headers = { ...(options.headers || {}) };
    let body = options.body;
    if (body && !(body instanceof FormData)) {
      headers["Content-Type"] = "application/json";
      body = JSON.stringify(body);
    }
    let res;
    try {
      res = await fetch(url, {
        ...options,
        headers,
        body,
        credentials: "include",
      });
    } catch {
      throw new Error(
        "Cannot reach the server. Run: cd server && npm start — then open http://localhost:8080"
      );
    }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      if (res.status === 501) {
        throw new Error(
          "Wrong server on this port. Stop python http.server and run: cd server && npm start"
        );
      }
      throw new Error(data.error || `Request failed (${res.status})`);
    }
    return data;
  }

  function notify() {
    listeners.forEach((fn) => fn(currentUser));
    document.dispatchEvent(
      new CustomEvent("name:authchange", { detail: { user: currentUser } })
    );
  }

  async function refresh() {
    try {
      const cfg = await request("/api/dev/config");
      if (typeof window !== "undefined") {
        window.NA_ME_DEV_BYPASS = !!cfg.bypassAuth;
      }
      const data = await request("/api/auth/me");
      currentUser = data.user;
    } catch {
      if (typeof window !== "undefined") window.NA_ME_DEV_BYPASS = false;
      currentUser = null;
    }
    notify();
    return currentUser;
  }

  async function register(email, password, displayName) {
    const data = await request("/api/auth/register", {
      method: "POST",
      body: { email, password, displayName },
    });
    currentUser = data.user;
    notify();
    return currentUser;
  }

  async function login(email, password) {
    const data = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    currentUser = data.user;
    notify();
    return currentUser;
  }

  async function logout() {
    await request("/api/auth/logout", { method: "POST" });
    currentUser = null;
    notify();
  }

  function onChange(fn) {
    listeners.add(fn);
    return () => listeners.delete(fn);
  }

  function isAdmin() {
    if (typeof window !== "undefined" && window.NA_ME_DEV_BYPASS) return true;
    return currentUser?.role === "admin";
  }

  function isLoggedIn() {
    if (typeof window !== "undefined" && window.NA_ME_DEV_BYPASS) return true;
    return !!currentUser;
  }

  function getUser() {
    return currentUser;
  }

  async function fetchPosts(query = {}) {
    const params = new URLSearchParams(query);
    const data = await request(`/api/posts?${params}`);
    return data.posts;
  }

  async function fetchPost(slug) {
    const data = await request(`/api/posts/${encodeURIComponent(slug)}`);
    return data.post;
  }

  function initUI() {
    initAuthModal();

    const authLink = document.getElementById("auth-link");
    if (!authLink) return;

    const update = () => {
      const user = getUser();
      const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
      if (user) {
        authLink.textContent = user.displayName;
        authLink.href = "#";
        authLink.onclick = (e) => {
          e.preventDefault();
          if (confirm(typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "logoutConfirm") : "Log out?")) {
            logout();
          }
        };
      } else {
        authLink.textContent =
          typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "loginJoin") : "Login / Join";
        authLink.href = "#auth";
        authLink.onclick = (e) => {
          e.preventDefault();
          openAuthModal("login");
        };
      }
      const adminLink = document.getElementById("admin-link");
      if (adminLink) adminLink.hidden = !isAdmin();
    };

    onChange(update);
    update();
  }

  function initAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (!modal || modal.dataset.bound === "2") return;
    modal.dataset.bound = "2";

    modal.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        const name = tab.dataset.authTab;
        modal.querySelectorAll("[data-auth-tab]").forEach((t) =>
          t.classList.toggle("is-active", t === tab)
        );
        modal.querySelectorAll("[data-auth-panel]").forEach((p) =>
          p.classList.toggle("is-hidden", p.dataset.authPanel !== name)
        );
      });
    });

    modal.querySelectorAll("[data-close-auth]").forEach((el) => {
      el.addEventListener("click", closeAuthModal);
    });

    bindAuthForm("auth-login-form", async (_fd, form) => {
      const submitBtn = form.querySelector('[type="submit"]');
      const email = (
        form.querySelector("[data-login-email]")?.value ||
        form.querySelector('input[name="loginEmail"]')?.value ||
        form.querySelector('input[name="email"]')?.value ||
        ""
      ).trim();
      const password =
        form.querySelector("[data-login-password]")?.value ||
        form.querySelector('input[name="loginPassword"]')?.value ||
        form.querySelector('input[name="password"]')?.value ||
        "";
      if (!email || !password) {
        throw new Error("Enter email and password");
      }
      setSubmitLoading(submitBtn, true);
      try {
        await login(email, password);
        closeAuthModal();
        form.reset();
        clearAuthError();
      } finally {
        setSubmitLoading(submitBtn, false);
      }
    });

    bindAuthForm("auth-register-form", async (_fd, form) => {
      const submitBtn = form.querySelector('[type="submit"]');
      const displayName = form.querySelector("[data-register-name]")?.value?.trim() || "";
      const email = form.querySelector("[data-register-email]")?.value?.trim() || "";
      const password = form.querySelector("[data-register-password]")?.value || "";
      setSubmitLoading(submitBtn, true);
      try {
        await register(email, password, displayName);
        closeAuthModal();
        form.reset();
        clearAuthError();
      } finally {
        setSubmitLoading(submitBtn, false);
      }
    });

    document.querySelectorAll("[data-open-auth]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthModal(el.dataset.openAuth || "login");
      });
    });
  }

  function bindAuthForm(id, handler) {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAuthError();
      const fd = new FormData(form);
      try {
        await handler(fd, form);
      } catch (err) {
        showAuthError(err.message);
      }
    });
  }

  function setSubmitLoading(btn, loading) {
    if (!btn) return;
    btn.disabled = loading;
    btn.setAttribute("aria-busy", loading ? "true" : "false");
  }

  function openAuthModal(tab = "login") {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.classList.add("is-open");
    modal.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    modal.querySelector(`[data-auth-tab="${tab}"]`)?.click();
    clearAuthError();
  }

  function closeAuthModal() {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.classList.remove("is-open");
    modal.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function showAuthError(msg) {
    const el = document.getElementById("auth-error");
    if (el) {
      el.textContent = msg;
      el.hidden = false;
    }
  }

  function clearAuthError() {
    const el = document.getElementById("auth-error");
    if (el) el.hidden = true;
  }

  return {
    refresh,
    register,
    login,
    logout,
    onChange,
    isAdmin,
    isLoggedIn,
    getUser,
    fetchPosts,
    fetchPost,
    request,
    initUI,
    initAuthModal,
    openAuthModal,
    closeAuthModal,
  };
})();

// Wire auth modal on every page (including admin gate without #auth-link)
document.addEventListener("DOMContentLoaded", () => {
  NaMeAuth.initAuthModal();
});
