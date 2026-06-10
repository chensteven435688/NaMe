/**
 * NaMe — Supabase client (browser)
 * Publishable key is safe to expose in the frontend; protect data with RLS in Supabase.
 */
const NaMeSupabase = (function () {
  const SUPABASE_URL = "https://qmrjeljynsywqfisxygj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_qv_BSdWNR2qGFiVfxh8htA_cwMHiYDr";

  let client = null;

  function getAuthRedirectUrl() {
    if (typeof window === "undefined") return "";
    const base = typeof NaMeBase !== "undefined" ? NaMeBase.getBase() : "";
    return `${window.location.origin}${base}/auth/callback.html`;
  }

  function getClient() {
    if (client) return client;
    const lib = typeof window !== "undefined" ? window.supabase : null;
    if (!lib?.createClient) {
      console.warn("NaMe: @supabase/supabase-js is not loaded");
      return null;
    }
    client = lib.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
      auth: {
        flowType: "pkce",
        detectSessionInUrl: true,
        persistSession: true,
        autoRefreshToken: true,
        storage: window.localStorage,
      },
    });
    return client;
  }

  return {
    getClient,
    getAuthRedirectUrl,
    getUrl: () => SUPABASE_URL,
    getPublishableKey: () => SUPABASE_PUBLISHABLE_KEY,
  };
})();

if (typeof window !== "undefined") {
  window.NaMeSupabase = NaMeSupabase;
  NaMeSupabase.getClient();
}
