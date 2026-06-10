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

  function authT(key) {
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    return typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, key) : key;
  }

  function getAuthRedirectUrl() {
    return typeof NaMeSupabase !== "undefined"
      ? NaMeSupabase.getAuthRedirectUrl()
      : `${window.location.origin}/auth/callback.html`;
  }

  async function resendConfirmationEmail(email) {
    if (!email?.trim()) {
      throw new Error(authT("authResendNeedEmail"));
    }
    if (!useSupabase()) {
      throw new Error("Email confirmation is only available on the live site.");
    }
    const sb = supabase();
    const { error } = await sb.auth.resend({
      type: "signup",
      email: email.trim(),
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    if (error) throw new Error(error.message);
  }

  async function register(email, password, displayName, options = {}) {
    const { subscribe = false } = options;
    if (!displayName?.trim()) {
      throw new Error("Display name required");
    }
    if (password.length < 8) {
      throw new Error("Password must be at least 8 characters");
    }

    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb.auth.signUp({
        email: email.trim(),
        password,
        options: {
          data: {
            display_name: displayName.trim(),
            newsletter_opt_in: !!subscribe,
          },
          emailRedirectTo: getAuthRedirectUrl(),
        },
      });
      if (error) throw new Error(error.message);
      if (data.session?.user) {
        await loadProfile(data.session.user.id);
        notify();
        return { user: currentUser };
      }
      if (data.user) {
        return { needsConfirmation: true, email: email.trim() };
      }
      throw new Error("Registration failed. Please try again.");
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
      if (error) {
        if (/confirm/i.test(error.message)) {
          throw new Error(authT("authEmailNotConfirmed"));
        }
        throw new Error(error.message);
      }
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

  const SUBMISSION_MEDIA = [
    "photography",
    "design",
    "film",
    "writing",
    "visual-art",
    "other",
  ];

  function mapSubmission(row) {
    if (!row) return null;
    const post = row.posts;
    const postSlug = Array.isArray(post) ? post[0]?.slug : post?.slug;
    return {
      id: row.id,
      title: row.title,
      medium: row.medium,
      description: row.description,
      fileUrl: row.file_url,
      fileName: row.file_name,
      fileMime: row.file_mime,
      status: row.status,
      postId: row.post_id,
      postSlug: postSlug || null,
      adminNote: row.admin_note,
      createdAt: row.created_at,
      reviewedAt: row.reviewed_at,
    };
  }

  function submissionStats(rows) {
    const stats = { total: 0, pending: 0, published: 0, rejected: 0 };
    for (const row of rows) {
      stats.total += 1;
      if (stats[row.status] !== undefined) stats[row.status] += 1;
    }
    return stats;
  }

  function isAllowedSubmissionFile(file) {
    if (!file) return false;
    return (
      /^image\//.test(file.type) ||
      file.type === "application/pdf" ||
      /^video\//.test(file.type)
    );
  }

  async function fetchMySubmissions() {
    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data, error } = await sb
        .from("submissions")
        .select("*, posts(slug)")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);

      const submissions = (data || []).map(mapSubmission);
      return { submissions, stats: submissionStats(submissions) };
    }

    return request("/api/submissions/mine");
  }

  async function createSubmission(formData) {
    const title = formData.get("title")?.toString().trim() || "";
    const medium = formData.get("medium")?.toString() || "";
    const description = formData.get("description")?.toString().trim() || "";
    const file = formData.get("file");

    if (!title) throw new Error("Title required");
    if (!SUBMISSION_MEDIA.includes(medium)) throw new Error("Select a valid medium");
    if (!file || !(file instanceof File) || !file.size) {
      throw new Error("Upload a file (image, PDF, or video)");
    }
    if (!isAllowedSubmissionFile(file)) {
      throw new Error("Allowed file types: images, PDF, or video");
    }
    if (file.size > 25 * 1024 * 1024) {
      throw new Error("File must be 25 MB or smaller");
    }

    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const ext = file.name.includes(".") ? file.name.split(".").pop() : "bin";
      const objectPath = `${user.id}/${crypto.randomUUID()}.${ext.replace(/[^a-zA-Z0-9]/g, "")}`;

      const { error: uploadError } = await sb.storage
        .from("submissions")
        .upload(objectPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(uploadError.message);

      const { data: urlData } = sb.storage.from("submissions").getPublicUrl(objectPath);
      const fileUrl = urlData.publicUrl;

      const { data, error } = await sb
        .from("submissions")
        .insert({
          user_id: user.id,
          title,
          medium,
          description: description || null,
          file_url: fileUrl,
          file_name: file.name,
          file_mime: file.type,
          status: "pending",
        })
        .select("*")
        .single();
      if (error) throw new Error(error.message);

      return { submission: mapSubmission(data) };
    }

    return request("/api/submissions", { method: "POST", body: formData });
  }

  function mapAdminSubmission(row) {
    const submission = mapSubmission(row);
    const profile = row.profiles;
    const author = Array.isArray(profile) ? profile[0] : profile;
    if (author) {
      submission.author = {
        id: author.id,
        displayName: author.display_name,
        email: author.email,
      };
    }
    return submission;
  }

  function submissionStatusCounts(submissions) {
    const counts = { pending: 0, published: 0, rejected: 0 };
    for (const s of submissions) {
      if (counts[s.status] !== undefined) counts[s.status] += 1;
    }
    return counts;
  }

  function slugifyTitle(text) {
    return (
      String(text || "")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/(^-|-$)/g, "") || "post"
    );
  }

  async function uniquePostSlug(sb, title) {
    let base = slugifyTitle(title);
    let slug = base;
    let n = 2;
    while (true) {
      const { data } = await sb.from("posts").select("id").eq("slug", slug).maybeSingle();
      if (!data) return slug;
      slug = `${base}-${n++}`;
    }
  }

  function escapeHtml(text) {
    return String(text ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function buildPublishedPostBody(row) {
    let body = row.description?.trim()
      ? `<p>${escapeHtml(row.description.trim())}</p>`
      : `<p>${escapeHtml(row.title)}</p>`;
    if (row.file_mime === "application/pdf") {
      body += `<p><a href="${row.file_url}" target="_blank" rel="noopener">View submitted PDF</a></p>`;
    }
    return body;
  }

  function submissionStoragePath(fileUrl) {
    if (!fileUrl) return null;
    const marker = "/submissions/";
    const idx = fileUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(fileUrl.slice(idx + marker.length));
  }

  async function fetchAdminSubmissions() {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb
        .from("submissions")
        .select("*, profiles(id, display_name, email), posts(slug)")
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);

      const submissions = (data || []).map(mapAdminSubmission);
      return { submissions, counts: submissionStatusCounts(submissions) };
    }

    return request("/api/admin/submissions");
  }

  async function updateSubmission(id, { status, adminNote } = {}) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      const patch = {
        reviewed_at: new Date().toISOString(),
        reviewed_by: user?.id || null,
      };
      if (status) patch.status = status;
      if (adminNote !== undefined) patch.admin_note = adminNote || null;

      const { data, error } = await sb
        .from("submissions")
        .update(patch)
        .eq("id", id)
        .select("*, profiles(id, display_name, email), posts(slug)")
        .single();
      if (error) throw new Error(error.message);

      return { submission: mapAdminSubmission(data) };
    }

    return request(`/api/admin/submissions/${id}`, {
      method: "PATCH",
      body: { status, adminNote },
    });
  }

  async function publishSubmission(id, { type, section, meta } = {}) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      const { data: row, error: fetchError } = await sb
        .from("submissions")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchError) throw new Error(fetchError.message);
      if (!row) throw new Error("Submission not found");
      if (row.status === "published" && row.post_id) {
        throw new Error("Already published");
      }

      const allowedTypes = ["article", "editorial", "film", "short"];
      const postType = allowedTypes.includes(type) ? type : "article";
      const isVideo = row.file_mime?.startsWith("video/");
      const isImage = row.file_mime?.startsWith("image/");
      const slug = await uniquePostSlug(sb, row.title);
      const now = new Date().toISOString();

      const { data: post, error: postError } = await sb
        .from("posts")
        .insert({
          slug,
          type: postType,
          title: row.title,
          meta: meta || `${row.medium} — submission`,
          image_url: isImage ? row.file_url : null,
          body: buildPublishedPostBody(row),
          video_url: isVideo ? row.file_url : null,
          section: section || "latest",
          featured: false,
          author_id: row.user_id,
          published_at: now,
        })
        .select("id, slug, type, title")
        .single();
      if (postError) throw new Error(postError.message);

      const { data: submission, error: subError } = await sb
        .from("submissions")
        .update({
          status: "published",
          post_id: post.id,
          reviewed_at: now,
          reviewed_by: user?.id || null,
        })
        .eq("id", id)
        .select("*, profiles(id, display_name, email), posts(slug)")
        .single();
      if (subError) throw new Error(subError.message);

      return { post, submission: mapAdminSubmission(submission) };
    }

    return request(`/api/admin/submissions/${id}/publish`, {
      method: "POST",
      body: { type, section, meta },
    });
  }

  async function deleteSubmission(id) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { data: row, error: fetchError } = await sb
        .from("submissions")
        .select("file_url")
        .eq("id", id)
        .single();
      if (fetchError) throw new Error(fetchError.message);

      const { error } = await sb.from("submissions").delete().eq("id", id);
      if (error) throw new Error(error.message);

      const storagePath = submissionStoragePath(row?.file_url);
      if (storagePath) {
        await sb.storage.from("submissions").remove([storagePath]);
      }

      return { ok: true };
    }

    return request(`/api/admin/submissions/${id}`, { method: "DELETE" });
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

    document.querySelectorAll('.header__actions a[href*="subscribe.html"]').forEach((el) => {
      el.hidden = !!user;
    });

    const hideSubmission = !!user && isAdmin();
    document
      .querySelectorAll('.header__actions a[href*="submission.html"], .mobile-bar a[href*="submission.html"]')
      .forEach((el) => {
        el.hidden = hideSubmission;
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
        clearAuthMessage();
      } finally {
        setSubmitLoading(submitBtn, false);
      }
    });

    bindAuthForm("auth-register-form", async (_fd, form) => {
      const submitBtn = form.querySelector('[type="submit"]');
      const displayName = form.querySelector("[data-register-name]")?.value?.trim() || "";
      const email = form.querySelector("[data-register-email]")?.value?.trim() || "";
      const password = form.querySelector("[data-register-password]")?.value || "";
      const agreeTerms = form.querySelector("[data-register-agree-terms]");
      if (!agreeTerms?.checked) {
        throw new Error(authT("authMustAgreeTerms"));
      }
      const subscribe = !!form.querySelector("[data-register-subscribe]")?.checked;
      setSubmitLoading(submitBtn, true);
      try {
        const result = await register(email, password, displayName, { subscribe });
        if (result?.needsConfirmation) {
          showAuthMessage(authT("authConfirmSent"), "success");
          switchAuthTab("login");
          prefillLoginEmail(result.email);
          form.reset();
          return;
        }
        updateAuthUI();
        closeAuthModal();
        form.reset();
        clearAuthMessage();
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

    ensureAuthFormExtras();
  }

  function applyAuthFormI18n() {
    if (typeof NaMeI18n === "undefined") return;
    NaMeI18n.apply(NaMeI18n.getLang());
  }

  function ensureAuthFormExtras() {
    ensureLoginTermsLink();
    ensureRegisterCheckboxes();
    ensureResendConfirmationControl();
    applyAuthFormI18n();
  }

  function ensureLoginTermsLink() {
    const loginForm = document.getElementById("auth-login-form");
    if (!loginForm || loginForm.querySelector("[data-auth-login-terms]")) return;

    const note = document.createElement("p");
    note.className = "auth-form__note";
    note.dataset.authLoginTerms = "1";
    note.innerHTML = '<a href="terms.html" data-i18n="terms">Terms of Service</a>';

    const resend = loginForm.querySelector(".auth-resend");
    if (resend) loginForm.insertBefore(note, resend);
    else loginForm.appendChild(note);

    if (typeof NaMeBase !== "undefined") NaMeBase.fixLinks(note);
  }

  function ensureRegisterCheckboxes() {
    const form = document.getElementById("auth-register-form");
    if (!form || form.querySelector("[data-register-agree-terms]")) return;

    form.querySelectorAll(".auth-join-links").forEach((el) => el.remove());

    const submitBtn = form.querySelector('[type="submit"]');
    if (!submitBtn) return;

    const termsLabel = document.createElement("label");
    termsLabel.className = "auth-check";
    termsLabel.innerHTML =
      '<input type="checkbox" data-register-agree-terms required />' +
      '<span data-i18n-html="authAgreeTerms">I agree to the <a href="terms.html">Terms of Service</a></span>';

    const subscribeLabel = document.createElement("label");
    subscribeLabel.className = "auth-check";
    subscribeLabel.innerHTML =
      '<input type="checkbox" data-register-subscribe />' +
      '<span data-i18n="authSubscribeOptIn">I want to subscribe</span>';

    form.insertBefore(subscribeLabel, submitBtn);
    form.insertBefore(termsLabel, subscribeLabel);

    if (typeof NaMeBase !== "undefined") NaMeBase.fixLinks(form);
  }

  function switchAuthTab(tab) {
    const modal = document.getElementById("auth-modal");
    if (!modal) return;
    modal.querySelectorAll("[data-auth-tab]").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.authTab === tab);
    });
    modal.querySelectorAll("[data-auth-panel]").forEach((p) => {
      p.classList.toggle("is-hidden", p.dataset.authPanel !== tab);
    });
  }

  function prefillLoginEmail(email) {
    const loginForm = document.getElementById("auth-login-form");
    const emailInput =
      loginForm?.querySelector("[data-login-email]") ||
      loginForm?.querySelector('input[name="loginEmail"]');
    if (emailInput && email) emailInput.value = email;
  }

  function ensureResendConfirmationControl() {
    const loginForm = document.getElementById("auth-login-form");
    if (!loginForm || loginForm.querySelector("[data-resend-confirm]")) return;

    const wrap = document.createElement("p");
    wrap.className = "auth-resend";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "auth-resend__btn";
    btn.dataset.resendConfirm = "1";
    btn.textContent = authT("authResendConfirm");
    btn.addEventListener("click", async () => {
      clearAuthMessage();
      const email = (
        loginForm.querySelector("[data-login-email]")?.value ||
        loginForm.querySelector('input[name="loginEmail"]')?.value ||
        ""
      ).trim();
      btn.disabled = true;
      try {
        await resendConfirmationEmail(email);
        showAuthMessage(authT("authResendSent"), "success");
      } catch (err) {
        showAuthError(err.message);
      } finally {
        btn.disabled = false;
      }
    });
    wrap.appendChild(btn);
    loginForm.appendChild(wrap);
  }

  function bindAuthForm(id, handler) {
    const form = document.getElementById(id);
    if (!form) return;
    form.addEventListener("submit", async (e) => {
      e.preventDefault();
      clearAuthMessage();
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

  function showAuthMessage(msg, type = "error") {
    const el = document.getElementById("auth-error");
    if (el) {
      el.textContent = msg;
      el.classList.toggle("auth-error--success", type === "success");
      el.hidden = false;
    }
  }

  function showAuthError(msg) {
    showAuthMessage(msg, "error");
  }

  function clearAuthMessage() {
    const el = document.getElementById("auth-error");
    if (el) {
      el.hidden = true;
      el.classList.remove("auth-error--success");
    }
  }

  function clearAuthError() {
    clearAuthMessage();
  }

  return {
    refresh,
    register,
    login,
    logout,
    resendConfirmationEmail,
    onChange,
    isAdmin,
    isLoggedIn,
    getUser,
    fetchPosts,
    fetchPost,
    fetchMySubmissions,
    createSubmission,
    fetchAdminSubmissions,
    updateSubmission,
    publishSubmission,
    deleteSubmission,
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
