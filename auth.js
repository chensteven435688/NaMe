/**
 * NaMe — client auth & API helpers
 * GitHub Pages: Supabase auth + data. Local npm start (port 8080): Express API.
 */
const NaMeAuth = (function () {
  let currentUser = null;
  const listeners = new Set();
  if (typeof window !== "undefined") window.NA_ME_DEV_BYPASS = false;

  function supabase() {
    return typeof NaMeSupabase !== "undefined" ? NaMeSupabase.getClient() : null;
  }

  function useSupabase() {
    const sb = supabase();
    if (!sb) return false;
    const host = window.location.hostname;
    const port = window.location.port;
    if ((host === "localhost" || host === "127.0.0.1") && port === "8080") return false;
    return true;
  }

  function mapProfile(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
    };
  }

  function mapPost(row) {
    if (!row) return null;
    return {
      id: row.id,
      slug: row.slug,
      type: row.type,
      title: row.title,
      meta: row.meta,
      imageUrl: row.image_url,
      body: row.body,
      videoUrl: row.video_url,
      section: row.section,
      featured: !!row.featured,
      publishedAt: row.published_at,
    };
  }

  async function loadProfile(userId) {
    const sb = supabase();
    if (!sb) return null;

    const { data, error } = await sb.from("profiles").select("*").eq("id", userId).single();
    if (data) {
      currentUser = mapProfile(data);
      return currentUser;
    }

    if (error) console.warn("NaMe: could not load profile", error.message);

    const { data: authData } = await sb.auth.getUser();
    const user = authData?.user;
    if (user?.id === userId) {
      currentUser = {
        id: user.id,
        email: user.email || "",
        displayName:
          user.user_metadata?.display_name ||
          user.email?.split("@")[0] ||
          "Member",
        role: "member",
      };
      return currentUser;
    }
    return null;
  }

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

  async function absorbAuthCallback() {
    if (!useSupabase()) return;
    const sb = supabase();
    const params = new URLSearchParams(window.location.search);
    const code = params.get("code");
    if (code) {
      const { error } = await sb.auth.exchangeCodeForSession(code);
      if (error) throw error;
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }

  async function refresh() {
    if (useSupabase()) {
      try {
        await absorbAuthCallback();
        const sb = supabase();
        const { data } = await sb.auth.getSession();
        if (data.session?.user) {
          await loadProfile(data.session.user.id);
        } else {
          currentUser = null;
        }
      } catch {
        currentUser = null;
      }
      notify();
      return currentUser;
    }

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
    if (!displayName?.trim()) {
      throw new Error("Display name required");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (useSupabase()) {
      const sb = supabase();
      const redirectTo =
        typeof NaMeSupabase !== "undefined"
          ? NaMeSupabase.getAuthRedirectUrl()
          : `${window.location.origin}/auth/callback.html`;
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: { display_name: displayName.trim() },
          emailRedirectTo: redirectTo,
        },
      });
      if (error) throw new Error(error.message);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        notify();
        return currentUser;
      }
      throw new Error(
        "Account created. Check your email to confirm, then log in."
      );
    }

    const data = await request("/api/auth/register", {
      method: "POST",
      body: { email, password, displayName },
    });
    currentUser = data.user;
    notify();
    return currentUser;
  }

  async function login(email, password) {
    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (error) throw new Error(error.message);
      await loadProfile(data.user.id);
      notify();
      return currentUser;
    }

    const data = await request("/api/auth/login", {
      method: "POST",
      body: { email, password },
    });
    currentUser = data.user;
    notify();
    return currentUser;
  }

  async function logout() {
    if (useSupabase()) {
      const sb = supabase();
      await sb.auth.signOut();
      currentUser = null;
      notify();
      return;
    }

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
    if (useSupabase()) {
      const sb = supabase();
      let q = sb.from("posts").select("*").order("published_at", { ascending: false });
      if (query.type) q = q.eq("type", query.type);
      if (query.section) q = q.eq("section", query.section);
      if (query.featured === "1" || query.featured === 1) q = q.eq("featured", true);
      const { data, error } = await q;
      if (error) throw new Error(error.message);
      return (data || []).map(mapPost);
    }

    const params = new URLSearchParams(query);
    const data = await request(`/api/posts?${params}`);
    return data.posts;
  }

  async function fetchPost(slug) {
    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb
        .from("posts")
        .select("*")
        .eq("slug", slug)
        .maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) throw new Error("Not found");
      return mapPost(data);
    }

    const data = await request(`/api/posts/${encodeURIComponent(slug)}`);
    return data.post;
  }

  function updateAuthUI() {
    const authLink = document.getElementById("auth-link");
    if (!authLink) return;

    const user = getUser();
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    if (user) {
      authLink.textContent = user.displayName;
      authLink.classList.add("is-user");
      authLink.href = "#";
      authLink.onclick = (e) => {
        e.preventDefault();
        if (confirm(typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "logoutConfirm") : "Log out?")) {
          logout();
        }
      };
    } else {
      authLink.classList.remove("is-user");
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

    const subscribeLink = document.getElementById("header-subscribe-link");
    if (subscribeLink) subscribeLink.hidden = !!user;

    document.querySelectorAll('.mobile-bar a[href*="subscribe.html"]').forEach((el) => {
      el.hidden = !!user;
    });
  }

  function initUI() {
    initAuthModal();

    const authLink = document.getElementById("auth-link");
    if (!authLink) return;

    if (!authLink.dataset.authUiBound) {
      authLink.dataset.authUiBound = "1";
      onChange(updateAuthUI);
    }
    updateAuthUI();
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
        updateAuthUI();
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

// Wire auth on every page (including admin gate without #auth-link)
document.addEventListener("DOMContentLoaded", async () => {
  NaMeAuth.initAuthModal();
  await NaMeAuth.refresh();
  NaMeAuth.initUI();

  const sb = typeof NaMeSupabase !== "undefined" ? NaMeSupabase.getClient() : null;
  if (sb) {
    sb.auth.onAuthStateChange(async () => {
      await NaMeAuth.refresh();
      NaMeAuth.initUI();
    });
  }
});
