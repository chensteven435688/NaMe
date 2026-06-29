/**
 * NaMe — client auth & API helpers
 * GitHub Pages: Supabase auth + data. Local npm start (port 8080): Express API.
 */
const NaMeAuth = (function () {
  let currentUser = null;
  const listeners = new Set();
  const AUTH_SNAPSHOT_KEY = "name-auth-snapshot";
  const MAX_POST_IMAGE_BYTES = 50 * 1024 * 1024;
  const MAX_IMAGE_BYTES = 20 * 1024 * 1024;
  const MAX_SUBMISSION_VIDEO_BYTES = 4 * 1024 * 1024 * 1024;
  const MAX_SUBMISSION_FILE_BYTES = 50 * 1024 * 1024;
  const MAX_AVATAR_BYTES = 30 * 1024 * 1024;
  const IMAGE_EXTENSIONS = new Set([
    "jpg",
    "jpeg",
    "png",
    "webp",
    "gif",
    "heic",
    "heif",
    "avif",
    "bmp",
  ]);
  if (typeof window !== "undefined") window.NA_ME_DEV_BYPASS = false;
  let profileSaveLock = 0;

  function readAuthSnapshot() {
    try {
      if (typeof window !== "undefined" && window.__NAME_AUTH_SNAPSHOT__) {
        return window.__NAME_AUTH_SNAPSHOT__;
      }
      const raw = localStorage.getItem(AUTH_SNAPSHOT_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  const cachedUser = readAuthSnapshot();
  if (cachedUser?.id) currentUser = cachedUser;

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
      avatarUrl: row.avatar_url || null,
      signature: row.signature || null,
      role: row.role,
    };
  }

  const PROFILE_PUBLIC_SELECT = "id, display_name, avatar_url, signature";

  function mapPublicAuthor(row, userId) {
    const profile = row?.profiles;
    const author = Array.isArray(profile) ? profile[0] : profile;
    return {
      id: userId || row?.user_id || author?.id,
      displayName: author?.display_name || row?.display_name || "Member",
      avatarUrl: author?.avatar_url || row?.avatar_url || null,
      signature: author?.signature || row?.signature || null,
    };
  }

  function formatUserAvatar(author, className = "user-avatar") {
    const name = author?.displayName || "Member";
    const esc = (value) =>
      String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/"/g, "&quot;");
    if (author?.avatarUrl) {
      return `<img class="${esc(className)}" src="${esc(author.avatarUrl)}" alt="${esc(name)}" loading="lazy" />`;
    }
    const initial = (name[0] || "?").toUpperCase();
    return `<span class="${esc(className)} user-avatar--initial" aria-hidden="true">${esc(initial)}</span>`;
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
      contentDate: row.content_date,
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
        avatarUrl: null,
        signature: null,
        role: "member",
      };
      return currentUser;
    }
    return null;
  }

  function isAuthPage() {
    if (typeof window === "undefined") return false;
    const file = location.pathname.split("/").filter(Boolean).pop() || "";
    return file === "account.html";
  }

  function getReturnUrl() {
    const params = new URLSearchParams(location.search);
    const ret = params.get("return");
    if (ret) {
      try {
        if (/^https?:\/\//i.test(ret)) {
          const url = new URL(ret);
          if (url.origin === location.origin) {
            return url.pathname + url.search + url.hash;
          }
        } else {
          const path = ret.startsWith("/") ? ret : `/${ret}`;
          return typeof NaMeBase !== "undefined" ? NaMeBase.path(path) : path;
        }
      } catch {
        /* ignore */
      }
    }
    return typeof NaMeBase !== "undefined" ? NaMeBase.path("/") : "/";
  }

  function authPageUrl(tab = "login", returnTo) {
    const base =
      typeof NaMeBase !== "undefined" ? NaMeBase.path("/account.html") : "/account.html";
    const url = new URL(base, window.location.origin);
    if (tab === "register") url.searchParams.set("tab", "register");
    if (returnTo) url.searchParams.set("return", returnTo);
    return `${url.pathname}${url.search}`;
  }

  function completeAuthSuccess(form) {
    form.reset();
    clearAuthMessage();
    if (isAuthPage()) {
      if (!isLoggedIn()) return;
      window.location.replace(getReturnUrl());
      return;
    }
    closeAuthModal();
  }

  function absorbAuthHashRedirect() {
    if (typeof window === "undefined" || isAuthPage()) return;
    if (location.hash !== "#auth") return;
    const tab =
      new URLSearchParams(location.search).get("tab") === "register" ? "register" : "login";
    location.replace(authPageUrl(tab, `${location.pathname}${location.search}`));
  }

  absorbAuthHashRedirect();

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
    persistAuthSnapshot(currentUser);
    listeners.forEach((fn) => fn(currentUser));
    document.dispatchEvent(
      new CustomEvent("name:authchange", { detail: { user: currentUser } })
    );
    if (document.getElementById("auth-link") || document.getElementById("mobile-auth-link")) {
      updateAuthUI();
    }
  }

  function persistAuthSnapshot(user) {
    try {
      const root = document.documentElement;
      if (user) {
        const snap = {
          id: user.id,
          email: user.email,
          displayName: user.displayName,
          avatarUrl: user.avatarUrl || null,
          role: user.role,
        };
        localStorage.setItem(AUTH_SNAPSHOT_KEY, JSON.stringify(snap));
        window.__NAME_AUTH_SNAPSHOT__ = snap;
        root.classList.add("auth-optimistic-early");
        root.classList.toggle("auth-optimistic-admin", user.role === "admin");
        root.style.setProperty(
          "--auth-user-label",
          `"${String(user.displayName || "Member").replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`
        );
      } else {
        localStorage.removeItem(AUTH_SNAPSHOT_KEY);
        delete window.__NAME_AUTH_SNAPSHOT__;
        root.classList.remove("auth-optimistic-early", "auth-optimistic-admin", "auth-ui-checked");
        root.style.removeProperty("--auth-user-label");
      }
    } catch {
      /* ignore */
    }
  }

  function markAuthUIReady() {
    document.documentElement.classList.add("auth-ui-checked");
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
    return { user: currentUser };
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
      if (!data.session?.user) {
        throw new Error("Could not establish session. Please try again.");
      }
      await loadProfile(data.session.user.id);
      if (!currentUser) {
        throw new Error("Could not load your profile. Please try again.");
      }
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
    try {
      sessionStorage.removeItem("name-admin-ok");
    } catch {
      /* ignore */
    }
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
      if (query.section) {
        if (query.section === "latest") {
          q = q.or("section.eq.latest,section.is.null");
        } else {
          q = q.eq("section", query.section);
        }
      }
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
    if (/^video\//.test(file.type)) {
      if (file.size > MAX_SUBMISSION_VIDEO_BYTES) {
        throw new Error("Video must be 4 GB or smaller");
      }
    } else if (file.size > MAX_SUBMISSION_FILE_BYTES) {
      throw new Error("Image or PDF must be 50 MB or smaller");
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
    const raw = String(text || "").trim();
    const latin = raw
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    if (latin) return latin;
    if (!raw) return "post";
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      hash = (hash * 31 + raw.charCodeAt(i)) >>> 0;
    }
    return `post-${hash.toString(36)}`;
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
        .select("*, profiles!user_id(id, display_name, email), posts(slug)")
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
        .select("*, profiles!user_id(id, display_name, email), posts(slug)")
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
        .select("*, profiles!user_id(id, display_name, email), posts(slug)")
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

  const POST_TYPES = ["article", "editorial", "film", "short", "exclusive"];
  const POST_SECTIONS = new Set(["latest", "popular"]);

  function normalizePostSection(type, section) {
    const raw = section?.toString().trim() || "";
    if (POST_SECTIONS.has(raw)) return raw;
    if (type === "exclusive") return null;
    return "latest";
  }

  function fileExtension(name) {
    const parts = String(name || "").split(".");
    return parts.length > 1 ? parts.pop().toLowerCase() : "";
  }

  function isImageUpload(file) {
    if (!file || !file.size) return false;
    if (file.type && /^image\//.test(file.type)) return true;
    return IMAGE_EXTENSIONS.has(fileExtension(file.name));
  }

  function imageContentType(file) {
    if (file.type && /^image\//.test(file.type)) return file.type;
    const ext = fileExtension(file.name);
    const map = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      webp: "image/webp",
      gif: "image/gif",
      heic: "image/heic",
      heif: "image/heif",
      avif: "image/avif",
      bmp: "image/bmp",
    };
    return map[ext] || "image/jpeg";
  }

  function mapSupabaseWriteError(error, context = "save") {
    const msg = error?.message || "Request failed";
    if (/permission denied|row-level security|not authorized|jwt/i.test(msg)) {
      return "Could not save — your session may have expired. Log out, log in again, then try again.";
    }
    if (/bucket not found/i.test(msg)) {
      if (context === "avatar") {
        return "Avatar storage is not set up. Run supabase/storage-avatars.sql in the Supabase SQL editor.";
      }
      return "Image storage is not set up. Run the matching supabase/storage-*.sql file in the Supabase SQL editor.";
    }
    return msg;
  }

  async function requireSupabaseAuth() {
    const sb = supabase();
    if (!sb) throw new Error("Supabase is not configured");

    let { data: userData, error: userError } = await sb.auth.getUser();
    if (userError || !userData?.user) {
      const { data: refreshed, error: refreshError } = await sb.auth.refreshSession();
      if (refreshError) throw new Error(mapSupabaseWriteError(refreshError));
      if (!refreshed.session?.user) {
        throw new Error("Your session expired. Please log in again.");
      }
      userData = { user: refreshed.session.user };
    }

    await loadProfile(userData.user.id);
    return { sb, user: userData.user };
  }

  async function requireSupabaseAdmin() {
    const ctx = await requireSupabaseAuth();
    if (!isAdmin()) throw new Error("Admin access required");
    return ctx;
  }

  function avatarStoragePath(imageUrl) {
    if (!imageUrl) return null;
    const marker = "/avatars/";
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return null;
    let path = decodeURIComponent(imageUrl.slice(idx + marker.length));
    const q = path.indexOf("?");
    if (q !== -1) path = path.slice(0, q);
    return path;
  }

  function isProfileSaveLocked() {
    return profileSaveLock > 0;
  }

  async function runProfileSaveLocked(fn) {
    profileSaveLock += 1;
    try {
      return await fn();
    } finally {
      profileSaveLock -= 1;
    }
  }

  async function uploadMyProfileAvatar(file) {
    if (!isLoggedIn()) throw new Error("Log in required");
    if (!useSupabase()) return null;
    if (!file?.size) return null;
    return runProfileSaveLocked(async () => {
      const { sb, user } = await requireSupabaseAuth();
      return uploadProfileAvatar(sb, user.id, file);
    });
  }

  async function uploadProfileAvatar(sb, userId, file) {
    if (!isImageUpload(file)) {
      throw new Error("Profile picture must be an image file (JPG, PNG, WEBP, HEIC, etc.)");
    }
    if (file.size > MAX_AVATAR_BYTES) {
      throw new Error("Profile picture must be 30 MB or smaller");
    }

    const ext = fileExtension(file.name) || "jpg";
    const safeExt = ext.replace(/[^a-zA-Z0-9]/g, "") || "jpg";
    const objectPath = `${userId}/avatar.${safeExt}`;
    const contentType = imageContentType(file);
    const { error: uploadError } = await sb.storage
      .from("avatars")
      .upload(objectPath, file, { contentType, upsert: true });
    if (uploadError) throw new Error(mapSupabaseWriteError(uploadError, "avatar"));

    const { data: urlData } = sb.storage.from("avatars").getPublicUrl(objectPath);
    return `${urlData.publicUrl}?v=${Date.now()}`;
  }

  async function updateMyProfile({
    displayName,
    signature,
    avatarFile,
    avatarUrl,
    removeAvatar,
  } = {}) {
    if (!isLoggedIn()) throw new Error("Log in required");

    if (displayName !== undefined && !displayName?.trim()) {
      throw new Error("Display name required");
    }
    if (signature !== undefined && signature.length > 160) {
      throw new Error("Signature must be 160 characters or fewer");
    }

    if (useSupabase()) {
      return runProfileSaveLocked(async () => {
        const { sb, user } = await requireSupabaseAuth();
        const { data: row, error: fetchError } = await sb
          .from("profiles")
          .select("avatar_url, display_name, signature")
          .eq("id", user.id)
          .single();
        if (fetchError) throw new Error(fetchError.message);

        let avatar_url = row?.avatar_url || null;
        const wantsAvatarChange =
          removeAvatar || !!avatarUrl || (avatarFile && avatarFile.size > 0);

        if (removeAvatar) {
          const oldPath = avatarStoragePath(avatar_url);
          if (oldPath) await sb.storage.from("avatars").remove([oldPath]);
          avatar_url = null;
        } else if (avatarUrl) {
          avatar_url = avatarUrl;
        } else if (avatarFile && avatarFile.size > 0) {
          if (!isImageUpload(avatarFile)) {
            throw new Error("Profile picture must be an image file (JPG, PNG, WEBP, HEIC, etc.)");
          }
          avatar_url = await uploadProfileAvatar(sb, user.id, avatarFile);
        }

        const patch = {
          display_name: (displayName ?? row.display_name ?? "").trim(),
          signature:
            signature !== undefined ? signature.trim() || null : row.signature ?? null,
        };
        if (wantsAvatarChange) {
          patch.avatar_url = avatar_url;
        }

        const { data, error } = await sb
          .from("profiles")
          .update(patch)
          .eq("id", user.id)
          .select("*")
          .single();
        if (error) throw new Error(mapSupabaseWriteError(error, "avatar"));

        currentUser = mapProfile(data);
        if (wantsAvatarChange && !removeAvatar && !currentUser?.avatarUrl) {
          throw new Error(
            "Photo uploaded but your profile did not update. Log out, log in again, then try once more."
          );
        }
        notify();
        return { user: currentUser };
      });
    }

    const fd = new FormData();
    if (displayName !== undefined) fd.append("displayName", displayName.trim());
    if (signature !== undefined) fd.append("signature", signature.trim());
    if (removeAvatar) fd.append("removeAvatar", "1");
    if (avatarFile && avatarFile instanceof File && avatarFile.size > 0) {
      fd.append("avatar", avatarFile);
    }
    const data = await request("/api/auth/profile", { method: "PATCH", body: fd });
    currentUser = data.user;
    notify();
    return data;
  }

  function postImageStoragePath(imageUrl) {
    if (!imageUrl) return null;
    const marker = "/post-images/";
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(imageUrl.slice(idx + marker.length));
  }

  async function resolvePostImageUrl(formData, sb = supabase()) {
    const file = formData.get("image");
    const imageUrl = formData.get("imageUrl")?.toString().trim() || "";

    if (file && file instanceof File && file.size > 0) {
      if (!/^image\//.test(file.type)) {
        throw new Error("Cover image must be an image file");
      }
      if (file.size > MAX_POST_IMAGE_BYTES) {
        throw new Error("Image must be 50 MB or smaller");
      }

      if (!sb) throw new Error("Supabase is not configured");
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const objectPath = `posts/${crypto.randomUUID()}.${ext.replace(/[^a-zA-Z0-9]/g, "")}`;
      const { error: uploadError } = await sb.storage
        .from("post-images")
        .upload(objectPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(mapSupabaseWriteError(uploadError));

      const { data: urlData } = sb.storage.from("post-images").getPublicUrl(objectPath);
      return urlData.publicUrl;
    }

    return imageUrl || null;
  }

  function parseContentDate(value) {
    const raw = value?.toString().trim() || "";
    if (!raw) return null;
    const parsed = new Date(`${raw}T12:00:00`);
    if (Number.isNaN(parsed.getTime())) return null;
    return parsed.toISOString();
  }

  async function uploadPostBodyImage(file) {
    if (!isAdmin()) throw new Error("Admin access required");
    if (!file || !(file instanceof File) || file.size === 0) {
      throw new Error("Choose an image file");
    }
    if (!/^image\//.test(file.type)) {
      throw new Error("Body image must be an image file");
    }
    if (file.size > MAX_POST_IMAGE_BYTES) {
      throw new Error("Image must be 50 MB or smaller");
    }

    if (useSupabase()) {
      const { sb } = await requireSupabaseAdmin();
      const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
      const objectPath = `posts/body/${crypto.randomUUID()}.${ext.replace(/[^a-zA-Z0-9]/g, "")}`;
      const { error: uploadError } = await sb.storage
        .from("post-images")
        .upload(objectPath, file, { contentType: file.type, upsert: false });
      if (uploadError) throw new Error(mapSupabaseWriteError(uploadError));

      const { data: urlData } = sb.storage.from("post-images").getPublicUrl(objectPath);
      return urlData.publicUrl;
    }

    const fd = new FormData();
    fd.append("image", file);
    const res = await request("/api/admin/upload-post-image", { method: "POST", body: fd });
    return res.url;
  }

  async function createPost(formData) {
    const type = formData.get("type")?.toString() || "";
    const title = formData.get("title")?.toString().trim() || "";
    const meta = formData.get("meta")?.toString().trim() || null;
    const body = formData.get("body")?.toString().trim() || "";
    const videoUrl = formData.get("videoUrl")?.toString().trim() || null;
    const section = normalizePostSection(type, formData.get("section"));
    const featuredVal = formData.get("featured");
    const featured = featuredVal === "1" || featuredVal === "true" || featuredVal === true;
    const contentDate = parseContentDate(formData.get("contentDate"));

    if (!type || !title) throw new Error("Type and title required");
    if (!POST_TYPES.includes(type)) throw new Error("Invalid type");

    if (useSupabase()) {
      const { sb, user } = await requireSupabaseAdmin();
      const imageUrl = await resolvePostImageUrl(formData, sb);
      if (!imageUrl) throw new Error("Add a cover image or image URL");

      const slug = await uniquePostSlug(sb, title);
      const now = new Date().toISOString();

      const { data, error } = await sb
        .from("posts")
        .insert({
          slug,
          type,
          title,
          meta,
          image_url: imageUrl,
          body: body || `<p>${escapeHtml(title)}</p>`,
          video_url: videoUrl,
          section,
          featured,
          author_id: user.id,
          content_date: contentDate,
          published_at: now,
        })
        .select("*")
        .single();
      if (error) throw new Error(mapSupabaseWriteError(error));

      return { post: mapPost(data) };
    }

    if (!isAdmin()) throw new Error("Admin access required");
    formData.set("section", section ?? "");
    return request("/api/posts", { method: "POST", body: formData });
  }

  async function deletePost(id) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { data: row, error: fetchError } = await sb
        .from("posts")
        .select("image_url")
        .eq("id", id)
        .single();
      if (fetchError) throw new Error(fetchError.message);

      const { error } = await sb.from("posts").delete().eq("id", id);
      if (error) throw new Error(error.message);

      const storagePath = postImageStoragePath(row?.image_url);
      if (storagePath) {
        await sb.storage.from("post-images").remove([storagePath]);
      }

      return { ok: true };
    }

    return request(`/api/posts/${id}`, { method: "DELETE" });
  }

  function mapAdminUser(row) {
    if (!row) return null;
    return {
      id: row.id,
      email: row.email,
      displayName: row.display_name,
      role: row.role,
      createdAt: row.created_at,
    };
  }

  function mapPostComment(row, liked = false) {
    const profile = row.profiles;
    const author = Array.isArray(profile) ? profile[0] : profile;
    const likes = row.comment_likes;
    const likeCount = Array.isArray(likes)
      ? likes[0]?.count ?? 0
      : likes?.count ?? 0;

    return {
      id: row.id,
      postId: row.post_id,
      parentId: row.parent_id,
      body: row.body,
      createdAt: row.created_at,
      author: mapPublicAuthor(row, row.user_id),
      likeCount,
      liked,
    };
  }

  function buildPostCommentTree(rows, likedSet) {
    const comments = rows.map((row) => mapPostComment(row, likedSet.has(row.id)));
    const top = comments.filter((c) => !c.parentId);
    const byParent = {};
    for (const c of comments) {
      if (c.parentId) {
        if (!byParent[c.parentId]) byParent[c.parentId] = [];
        byParent[c.parentId].push(c);
      }
    }
    for (const t of top) {
      t.replies = byParent[t.id] || [];
    }
    return top;
  }

  async function fetchPostCommentLikedSet(commentIds, userId) {
    if (!userId || !commentIds.length) return new Set();
    const sb = supabase();
    const { data, error } = await sb
      .from("comment_likes")
      .select("comment_id")
      .eq("user_id", userId)
      .in("comment_id", commentIds);
    if (error) throw new Error(error.message);
    return new Set((data || []).map((row) => row.comment_id));
  }

  async function fetchPostComments(slug) {
    if (useSupabase()) {
      const sb = supabase();
      const { data: post, error: postError } = await sb
        .from("posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (postError) throw new Error(postError.message);
      if (!post) throw new Error("Post not found");

      const { data, error } = await sb
        .from("comments")
        .select("*, profiles!user_id(id, display_name, avatar_url, signature), comment_likes(count)")
        .eq("post_id", post.id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);

      const user = getUser();
      const ids = (data || []).map((row) => row.id);
      const likedSet = await fetchPostCommentLikedSet(ids, user?.id);
      return { comments: buildPostCommentTree(data || [], likedSet) };
    }

    return request(`/api/posts/${encodeURIComponent(slug)}/comments`);
  }

  async function createPostComment(slug, { body, parentId } = {}) {
    if (!body?.trim()) throw new Error("Comment required");

    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data: post, error: postError } = await sb
        .from("posts")
        .select("id")
        .eq("slug", slug)
        .maybeSingle();
      if (postError) throw new Error(postError.message);
      if (!post) throw new Error("Post not found");

      if (parentId) {
        const { data: parent, error: parentError } = await sb
          .from("comments")
          .select("id, parent_id")
          .eq("id", parentId)
          .eq("post_id", post.id)
          .maybeSingle();
        if (parentError) throw new Error(parentError.message);
        if (!parent) throw new Error("Invalid parent comment");
        if (parent.parent_id) throw new Error("Replies only one level deep");
      }

      const { data, error } = await sb
        .from("comments")
        .insert({
          post_id: post.id,
          user_id: user.id,
          parent_id: parentId || null,
          body: body.trim(),
        })
        .select("*, profiles!user_id(id, display_name, avatar_url, signature), comment_likes(count)")
        .single();
      if (error) throw new Error(error.message);

      return { comment: mapPostComment(data, false) };
    }

    return request(`/api/posts/${encodeURIComponent(slug)}/comments`, {
      method: "POST",
      body: { body, parentId },
    });
  }

  async function togglePostCommentLike(commentId) {
    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data: existing, error: existingError } = await sb
        .from("comment_likes")
        .select("comment_id")
        .eq("user_id", user.id)
        .eq("comment_id", commentId)
        .maybeSingle();
      if (existingError) throw new Error(existingError.message);

      if (existing) {
        const { error } = await sb
          .from("comment_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("comment_id", commentId);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from("comment_likes").insert({
          user_id: user.id,
          comment_id: commentId,
        });
        if (error) throw new Error(error.message);
      }

      const { count, error: countError } = await sb
        .from("comment_likes")
        .select("*", { count: "exact", head: true })
        .eq("comment_id", commentId);
      if (countError) throw new Error(countError.message);

      return { likeCount: count ?? 0, liked: !existing };
    }

    return request(`/api/comments/${commentId}/like`, { method: "POST" });
  }

  async function deletePostComment(commentId) {
    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data: row, error: fetchError } = await sb
        .from("comments")
        .select("user_id")
        .eq("id", commentId)
        .single();
      if (fetchError) throw new Error(fetchError.message);
      if (row.user_id !== user.id && !isAdmin()) {
        throw new Error("Not allowed");
      }

      const { error } = await sb
        .from("comments")
        .delete()
        .or(`id.eq.${commentId},parent_id.eq.${commentId}`);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    return request(`/api/comments/${commentId}`, { method: "DELETE" });
  }

  function mapAdminComment(row) {
    const profile = row.profiles;
    const post = row.posts;
    const author = Array.isArray(profile) ? profile[0] : profile;
    const postRow = Array.isArray(post) ? post[0] : post;
    const likes = row.comment_likes;
    const likeCount = Array.isArray(likes)
      ? likes[0]?.count ?? 0
      : likes?.count ?? 0;

    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      parentId: row.parent_id,
      postId: row.post_id,
      postTitle: postRow?.title || "",
      postSlug: postRow?.slug || "",
      author: {
        id: author?.id || row.user_id,
        displayName: author?.display_name || "Member",
        email: author?.email || "",
      },
      likeCount,
    };
  }

  async function fetchAdminStats() {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const [postsRes, usersRes, commentsRes, rolesRes] = await Promise.all([
        sb.from("posts").select("type"),
        sb.from("profiles").select("*", { count: "exact", head: true }),
        sb.from("comments").select("*", { count: "exact", head: true }),
        sb.from("profiles").select("role"),
      ]);

      if (postsRes.error) throw new Error(postsRes.error.message);
      if (usersRes.error) throw new Error(usersRes.error.message);
      if (commentsRes.error) throw new Error(commentsRes.error.message);
      if (rolesRes.error) throw new Error(rolesRes.error.message);

      const postsByType = {};
      for (const row of postsRes.data || []) {
        postsByType[row.type] = (postsByType[row.type] || 0) + 1;
      }

      const users = usersRes.count ?? 0;
      const roles = rolesRes.data || [];
      const members = roles.filter((r) => r.role === "member").length;
      const admins = roles.filter((r) => r.role === "admin").length;

      return {
        posts: (postsRes.data || []).length,
        users,
        comments: commentsRes.count ?? 0,
        members,
        admins,
        postsByType,
      };
    }

    return request("/api/admin/stats");
  }

  async function fetchAdminUsers() {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw new Error(error.message);
      return { users: (data || []).map(mapAdminUser) };
    }

    return request("/api/admin/users");
  }

  async function updateAdminUser(id, { role, displayName } = {}) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const me = getUser();
      if (me?.id === id && role && role !== "admin") {
        throw new Error("Cannot demote yourself");
      }

      const patch = {};
      if (role !== undefined) {
        if (!["admin", "member"].includes(role)) throw new Error("Invalid role");
        patch.role = role;
      }
      if (displayName?.trim()) patch.display_name = displayName.trim();

      const { data, error } = await sb
        .from("profiles")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(error.message);
      return { user: mapAdminUser(data) };
    }

    return request(`/api/admin/users/${id}`, {
      method: "PATCH",
      body: { role, displayName },
    });
  }

  async function deleteAdminUser(id) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { error } = await sb.rpc("admin_delete_user", { target_id: id });
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    return request(`/api/admin/users/${id}`, { method: "DELETE" });
  }

  async function fetchAdminComments() {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb
        .from("comments")
        .select(
          "*, profiles!user_id(id, display_name, email), posts(title, slug), comment_likes(count)"
        )
        .order("created_at", { ascending: false })
        .limit(200);
      if (error) throw new Error(error.message);
      return { comments: (data || []).map(mapAdminComment) };
    }

    return request("/api/admin/comments");
  }

  async function deleteAdminComment(id) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { error: childError } = await sb
        .from("comments")
        .delete()
        .eq("parent_id", id);
      if (childError) throw new Error(childError.message);

      const { error } = await sb.from("comments").delete().eq("id", id);
      if (error) throw new Error(error.message);
      return { ok: true };
    }

    return request(`/api/admin/comments/${id}`, { method: "DELETE" });
  }

  async function fetchAdminPost(id) {
    if (!isAdmin()) throw new Error("Admin access required");

    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb.from("posts").select("*").eq("id", id).single();
      if (error) throw new Error(error.message);
      return { post: mapPost(data) };
    }

    return request(`/api/admin/posts/${id}`);
  }

  async function updatePost(id, formData) {
    if (!isAdmin()) throw new Error("Admin access required");

    const type = formData.get("type")?.toString() || "";
    const title = formData.get("title")?.toString().trim() || "";
    const meta = formData.get("meta")?.toString().trim() || null;
    const body = formData.get("body")?.toString().trim() || "";
    const videoUrl = formData.get("videoUrl")?.toString().trim() || null;
    const sectionRaw = formData.has("section") ? formData.get("section") : undefined;
    const newSlug = formData.get("slug")?.toString().trim() || "";
    const featuredVal = formData.get("featured");
    const featured = featuredVal === "1" || featuredVal === "true" || featuredVal === true;
    const imageUrlField = formData.get("imageUrl")?.toString().trim() || "";
    const contentDate = formData.has("contentDate")
      ? parseContentDate(formData.get("contentDate"))
      : undefined;

    if (useSupabase()) {
      const { sb } = await requireSupabaseAdmin();
      const { data: row, error: fetchError } = await sb
        .from("posts")
        .select("*")
        .eq("id", id)
        .single();
      if (fetchError) throw new Error(fetchError.message);

      let image_url = row.image_url;
      const file = formData.get("image");
      if (file && file instanceof File && file.size > 0) {
        image_url = await resolvePostImageUrl(formData, sb);
      } else if (formData.has("imageUrl")) {
        image_url = imageUrlField || null;
      }

      const postType = type || row.type;
      const section =
        sectionRaw !== undefined ? normalizePostSection(postType, sectionRaw) : row.section;

      let slug = row.slug;
      if (newSlug) {
        const normalized = newSlug.toLowerCase().replace(/[^a-z0-9-]+/g, "-");
        if (normalized && normalized !== row.slug) {
          const { data: existing } = await sb
            .from("posts")
            .select("id")
            .eq("slug", normalized)
            .neq("id", id)
            .maybeSingle();
          if (existing) throw new Error("Slug already in use");
          slug = normalized;
        }
      } else if (title && title !== row.title) {
        slug = await uniquePostSlug(sb, title);
      }

      const patch = {
        type: postType,
        title: title || row.title,
        meta: formData.has("meta") ? meta : row.meta,
        body: body || row.body,
        video_url: formData.has("videoUrl") ? videoUrl : row.video_url,
        section,
        featured,
        image_url,
        slug,
      };
      if (contentDate !== undefined) {
        patch.content_date = contentDate;
      }

      const { data, error } = await sb
        .from("posts")
        .update(patch)
        .eq("id", id)
        .select("*")
        .single();
      if (error) throw new Error(mapSupabaseWriteError(error));

      return { post: mapPost(data) };
    }

    return request(`/api/admin/posts/${id}`, { method: "PATCH", body: formData });
  }

  function mapCommunityPost(row, userId, liked = false) {
    const profile = row.profiles;
    const author = Array.isArray(profile) ? profile[0] : profile;
    const likesEmbed = row.community_likes;
    const commentsEmbed = row.community_comments;
    const likeCount = Array.isArray(likesEmbed)
      ? likesEmbed[0]?.count ?? 0
      : likesEmbed?.count ?? 0;
    const commentCount = Array.isArray(commentsEmbed)
      ? commentsEmbed[0]?.count ?? 0
      : commentsEmbed?.count ?? 0;

    return {
      id: row.id,
      title: row.title,
      caption: row.caption,
      imageUrl: row.image_url,
      createdAt: row.created_at,
      author: mapPublicAuthor(row, row.user_id),
      likeCount,
      commentCount,
      liked: !!liked,
    };
  }

  function mapCommunityComment(row) {
    return {
      id: row.id,
      body: row.body,
      createdAt: row.created_at,
      author: mapPublicAuthor(row, row.user_id),
    };
  }

  function communityImageStoragePath(imageUrl) {
    if (!imageUrl) return null;
    const marker = "/community-images/";
    const idx = imageUrl.indexOf(marker);
    if (idx === -1) return null;
    return decodeURIComponent(imageUrl.slice(idx + marker.length));
  }

  const COMMUNITY_POST_SELECT =
    "*, profiles!user_id(id, display_name, avatar_url, signature), community_likes(count), community_comments(count)";

  async function fetchCommunityLikedSet(postIds, userId) {
    if (!userId || !postIds.length) return new Set();
    const sb = supabase();
    const { data } = await sb
      .from("community_likes")
      .select("post_id")
      .eq("user_id", userId)
      .in("post_id", postIds);
    return new Set((data || []).map((l) => l.post_id));
  }

  async function fetchCommunityStats() {
    if (useSupabase()) {
      const sb = supabase();
      const [postsRes, membersRes] = await Promise.all([
        sb.from("community_posts").select("*", { count: "exact", head: true }),
        sb.from("profiles").select("*", { count: "exact", head: true }),
      ]);
      if (postsRes.error) throw new Error(postsRes.error.message);
      if (membersRes.error) throw new Error(membersRes.error.message);
      return { posts: postsRes.count ?? 0, members: membersRes.count ?? 0 };
    }

    return request("/api/community/stats");
  }

  async function fetchCommunityPosts() {
    if (useSupabase()) {
      const sb = supabase();
      const userId = getUser()?.id || null;
      const { data, error } = await sb
        .from("community_posts")
        .select(COMMUNITY_POST_SELECT)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw new Error(error.message);

      const likedSet = await fetchCommunityLikedSet(
        (data || []).map((p) => p.id),
        userId
      );
      return {
        posts: (data || []).map((row) =>
          mapCommunityPost(row, userId, likedSet.has(row.id))
        ),
      };
    }

    return request("/api/community/posts");
  }

  async function fetchCommunityPost(id) {
    if (useSupabase()) {
      const sb = supabase();
      const userId = getUser()?.id || null;
      const { data, error } = await sb
        .from("community_posts")
        .select(COMMUNITY_POST_SELECT)
        .eq("id", id)
        .single();
      if (error) throw new Error(error.message);

      const likedSet = await fetchCommunityLikedSet([id], userId);
      return { post: mapCommunityPost(data, userId, likedSet.has(id)) };
    }

    return request(`/api/community/posts/${id}`);
  }

  async function createCommunityPost(formData) {
    const title = formData.get("title")?.toString().trim() || null;
    const caption = formData.get("caption")?.toString().trim() || null;
    const file = formData.get("image");
    const imageUrlField = formData.get("imageUrl")?.toString().trim() || "";

    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      let image_url = imageUrlField || null;
      if (file && file instanceof File && file.size > 0) {
        if (!/^image\//.test(file.type)) throw new Error("Image required");
        if (file.size > MAX_IMAGE_BYTES) {
          throw new Error("Image must be 20 MB or smaller");
        }
        const ext = file.name.includes(".") ? file.name.split(".").pop() : "jpg";
        const objectPath = `${user.id}/${crypto.randomUUID()}.${ext.replace(/[^a-zA-Z0-9]/g, "")}`;
        const { error: uploadError } = await sb.storage
          .from("community-images")
          .upload(objectPath, file, { contentType: file.type, upsert: false });
        if (uploadError) throw new Error(uploadError.message);
        const { data: urlData } = sb.storage.from("community-images").getPublicUrl(objectPath);
        image_url = urlData.publicUrl;
      }

      if (!image_url) throw new Error("Image required");

      const { data, error } = await sb
        .from("community_posts")
        .insert({
          user_id: user.id,
          title,
          caption,
          image_url,
        })
        .select(COMMUNITY_POST_SELECT)
        .single();
      if (error) throw new Error(error.message);

      return { post: mapCommunityPost(data, user.id, false) };
    }

    return request("/api/community/posts", { method: "POST", body: formData });
  }

  async function toggleCommunityPostLike(id) {
    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data: existing } = await sb
        .from("community_likes")
        .select("post_id")
        .eq("user_id", user.id)
        .eq("post_id", id)
        .maybeSingle();

      if (existing) {
        const { error } = await sb
          .from("community_likes")
          .delete()
          .eq("user_id", user.id)
          .eq("post_id", id);
        if (error) throw new Error(error.message);
      } else {
        const { error } = await sb.from("community_likes").insert({
          user_id: user.id,
          post_id: id,
        });
        if (error) throw new Error(error.message);
      }

      const { count, error: countError } = await sb
        .from("community_likes")
        .select("*", { count: "exact", head: true })
        .eq("post_id", id);
      if (countError) throw new Error(countError.message);

      return { likeCount: count ?? 0, liked: !existing };
    }

    return request(`/api/community/posts/${id}/like`, { method: "POST" });
  }

  async function fetchCommunityPostComments(id) {
    if (useSupabase()) {
      const sb = supabase();
      const { data, error } = await sb
        .from("community_comments")
        .select("*, profiles!user_id(id, display_name, avatar_url, signature)")
        .eq("post_id", id)
        .order("created_at", { ascending: true });
      if (error) throw new Error(error.message);
      return { comments: (data || []).map(mapCommunityComment) };
    }

    return request(`/api/community/posts/${id}/comments`);
  }

  async function createCommunityPostComment(id, body) {
    if (!body?.trim()) throw new Error("Comment required");

    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data: post, error: postError } = await sb
        .from("community_posts")
        .select("id")
        .eq("id", id)
        .maybeSingle();
      if (postError) throw new Error(postError.message);
      if (!post) throw new Error("Not found");

      const { data, error } = await sb
        .from("community_comments")
        .insert({
          post_id: id,
          user_id: user.id,
          body: body.trim(),
        })
        .select("*, profiles!user_id(id, display_name, avatar_url, signature)")
        .single();
      if (error) throw new Error(error.message);

      return { comment: mapCommunityComment(data) };
    }

    return request(`/api/community/posts/${id}/comments`, {
      method: "POST",
      body: { body },
    });
  }

  async function deleteCommunityPost(id) {
    if (useSupabase()) {
      const sb = supabase();
      const user = getUser();
      if (!user) throw new Error("Log in required");

      const { data: row, error: fetchError } = await sb
        .from("community_posts")
        .select("user_id, image_url")
        .eq("id", id)
        .single();
      if (fetchError) throw new Error(fetchError.message);
      if (row.user_id !== user.id && !isAdmin()) {
        throw new Error("Not allowed");
      }

      const { error } = await sb.from("community_posts").delete().eq("id", id);
      if (error) throw new Error(error.message);

      const storagePath = communityImageStoragePath(row.image_url);
      if (storagePath) {
        await sb.storage.from("community-images").remove([storagePath]);
      }

      return { ok: true };
    }

    return request(`/api/community/posts/${id}`, { method: "DELETE" });
  }

  function applyAuthLinkState(link, user, lang) {
    if (!link) return;
    if (user) {
      link.textContent = user.displayName;
      link.classList.add("is-user");
      link.href =
        typeof NaMeBase !== "undefined" ? NaMeBase.path("/profile.html") : "/profile.html";
      link.onclick = null;
    } else {
      link.classList.remove("is-user");
      link.textContent =
        typeof NaMeI18n !== "undefined" ? NaMeI18n.t(lang, "loginJoin") : "Login / Join";
      link.href =
        typeof NaMeBase !== "undefined" ? NaMeBase.path("/account.html") : "account.html";
      link.onclick = null;
    }
  }

  function updateAuthUI() {
    const authLink = document.getElementById("auth-link");
    const mobileAuthLink = document.getElementById("mobile-auth-link");
    if (!authLink && !mobileAuthLink) return;

    const user = getUser();
    const lang = typeof NaMeI18n !== "undefined" ? NaMeI18n.getLang() : "en";
    applyAuthLinkState(authLink, user, lang);
    applyAuthLinkState(mobileAuthLink, user, lang);

    const adminLink = document.getElementById("admin-link");
    const mobileAdminLink = document.getElementById("mobile-admin-link");
    if (adminLink) adminLink.hidden = !isAdmin();
    if (mobileAdminLink) mobileAdminLink.hidden = !isAdmin();

    const subscribeLink = document.getElementById("header-subscribe-link");
    if (subscribeLink) subscribeLink.hidden = !!user;

    document.querySelectorAll('.header__actions a[href*="subscribe.html"], .mobile-bar a[href*="subscribe.html"]').forEach((el) => {
      el.hidden = !!user;
    });

    const hideSubmission = !!user && isAdmin();
    document
      .querySelectorAll('.header__actions a[href*="submission.html"], .mobile-bar a[href*="submission.html"]')
      .forEach((el) => {
        el.hidden = hideSubmission;
      });

    markAuthUIReady();
  }

  function initUI() {
    initAuthModal();

    const authLink = document.getElementById("auth-link");
    const mobileAuthLink = document.getElementById("mobile-auth-link");
    if (!authLink && !mobileAuthLink) return;

    const boundKey = authLink || mobileAuthLink;
    if (!boundKey.dataset.authUiBound) {
      boundKey.dataset.authUiBound = "1";
      onChange(updateAuthUI);
      document.addEventListener("name:languagechange", updateAuthUI);
    }
    updateAuthUI();
  }

  function initAuthModal() {
    const loginForm = document.getElementById("auth-login-form");
    if (!loginForm || document.body.dataset.authBound === "2") return;
    document.body.dataset.authBound = "2";

    document.querySelectorAll("[data-auth-tab]").forEach((tab) => {
      tab.addEventListener("click", () => {
        switchAuthTab(tab.dataset.authTab);
        if (isAuthPage()) {
          const url = new URL(location.href);
          if (tab.dataset.authTab === "register") url.searchParams.set("tab", "register");
          else url.searchParams.delete("tab");
          history.replaceState({}, "", `${url.pathname}${url.search}`);
        }
      });
    });

    document.querySelectorAll("[data-close-auth]").forEach((el) => {
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
        completeAuthSuccess(form);
      } finally {
        setSubmitLoading(submitBtn, false);
      }
    });

    bindAuthForm("auth-register-form", async (_fd, form) => {
      const submitBtn = form.querySelector('[type="submit"]');
      const displayName = form.querySelector("[data-register-name]")?.value?.trim() || "";
      const email = form.querySelector("[data-register-email]")?.value?.trim() || "";
      const password = form.querySelector("[data-register-password]")?.value || "";
      const passwordConfirm = form.querySelector("[data-register-password-confirm]")?.value || "";
      if (password !== passwordConfirm) {
        throw new Error(authT("authPasswordMismatch"));
      }
      const agreeTerms = form.querySelector("[data-register-agree-terms]");
      if (!agreeTerms?.checked) {
        throw new Error(authT("authMustAgreeTerms"));
      }
      const subscribe = !!form.querySelector("[data-register-subscribe]")?.checked;
      setSubmitLoading(submitBtn, true);
      try {
        const result = await register(email, password, displayName, { subscribe });
        form.reset();

        if (isLoggedIn()) {
          updateAuthUI();
          completeAuthSuccess(form);
          return;
        }

        goToSignInAfterRegister(result?.email || email);
      } finally {
        setSubmitLoading(submitBtn, false);
      }
    });

    document.querySelectorAll("[data-open-auth]").forEach((el) => {
      el.addEventListener("click", (e) => {
        e.preventDefault();
        openAuthPage(el.dataset.openAuth || "login");
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
    ensureRegisterConfirmPassword();
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

  function ensureRegisterConfirmPassword() {
    const form = document.getElementById("auth-register-form");
    if (!form || form.querySelector("[data-register-password-confirm]")) return;

    const passwordInput = form.querySelector("[data-register-password]");
    if (!passwordInput) return;

    if (form.classList.contains("auth-form--luxury")) {
      const label = document.createElement("label");
      label.className = "auth-field";
      label.innerHTML =
        '<span data-i18n="authPasswordConfirm">Confirm password</span>' +
        '<input type="password" name="registerPasswordConfirm" data-register-password-confirm autocomplete="new-password" required minlength="8" />';
      const passwordField = passwordInput.closest(".auth-field");
      if (passwordField) passwordField.after(label);
      else passwordInput.after(label);
      return;
    }

    const confirmInput = document.createElement("input");
    confirmInput.type = "password";
    confirmInput.name = "registerPasswordConfirm";
    confirmInput.dataset.registerPasswordConfirm = "1";
    confirmInput.required = true;
    confirmInput.minLength = 8;
    confirmInput.autocomplete = "new-password";
    confirmInput.setAttribute("data-i18n-placeholder", "authPasswordConfirm");
    confirmInput.placeholder = "Confirm password";
    passwordInput.after(confirmInput);
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
    document.querySelectorAll("[data-auth-tab]").forEach((t) => {
      t.classList.toggle("is-active", t.dataset.authTab === tab);
    });
    document.querySelectorAll("[data-auth-panel]").forEach((p) => {
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

  function focusLoginForm() {
    const loginForm = document.getElementById("auth-login-form");
    const passwordInput =
      loginForm?.querySelector("[data-login-password]") ||
      loginForm?.querySelector('input[name="loginPassword"]');
    passwordInput?.focus({ preventScroll: true });
  }

  function goToSignInAfterRegister(email) {
    showAuthMessage(authT("authConfirmSent"), "success");
    switchAuthTab("login");
    prefillLoginEmail(email);
    focusLoginForm();
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

  function openAuthPage(tab = "login") {
    if (isAuthPage()) {
      switchAuthTab(tab);
      clearAuthError();
      window.scrollTo({ top: 0, behavior: "smooth" });
      return;
    }
    const returnTo = `${location.pathname}${location.search}`;
    location.href = authPageUrl(tab, returnTo);
  }

  function openAuthModal(tab = "login") {
    openAuthPage(tab);
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
    updateMyProfile,
    uploadMyProfileAvatar,
    isProfileSaveLocked,
    formatUserAvatar,
    fetchPosts,
    fetchPost,
    fetchPostComments,
    createPostComment,
    togglePostCommentLike,
    deletePostComment,
    fetchMySubmissions,
    createSubmission,
    fetchAdminSubmissions,
    updateSubmission,
    publishSubmission,
    deleteSubmission,
    createPost,
    deletePost,
    updatePost,
    uploadPostBodyImage,
    fetchAdminPost,
    fetchAdminStats,
    fetchAdminUsers,
    updateAdminUser,
    deleteAdminUser,
    fetchAdminComments,
    deleteAdminComment,
    fetchCommunityStats,
    fetchCommunityPosts,
    fetchCommunityPost,
    createCommunityPost,
    toggleCommunityPostLike,
    fetchCommunityPostComments,
    createCommunityPostComment,
    deleteCommunityPost,
    request,
    initUI,
    initAuthModal,
    openAuthModal,
    openAuthPage,
    switchAuthTab,
    getReturnUrl,
    isAuthPage,
    closeAuthModal,
  };
})();

if (document.body && (document.getElementById("auth-link") || document.getElementById("mobile-auth-link"))) {
  NaMeAuth.initAuthModal();
  NaMeAuth.initUI();
}

document.addEventListener("DOMContentLoaded", async () => {
  await NaMeAuth.refresh();
  NaMeAuth.initAuthModal();
  NaMeAuth.initUI();

  const sb = typeof NaMeSupabase !== "undefined" ? NaMeSupabase.getClient() : null;
  if (sb) {
    sb.auth.onAuthStateChange(async (event) => {
      if (event === "TOKEN_REFRESHED" || event === "INITIAL_SESSION") return;
      if (NaMeAuth.isProfileSaveLocked()) return;
      await NaMeAuth.refresh();
      NaMeAuth.initUI();
    });
  }
});
