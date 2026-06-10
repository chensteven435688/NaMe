/**
 * NaMe — Supabase client (browser)
 * Publishable key is safe to expose in the frontend; protect data with RLS in Supabase.
 */
const NaMeSupabase = (function () {
  const SUPABASE_URL = "https://qmrjeljynsywqfisxygj.supabase.co";
  const SUPABASE_PUBLISHABLE_KEY =
    "sb_publishable_qv_BSdWNR2qGFiVfxh8htA_cwMHiYDr";

  let client = null;

  function getClient() {
    if (client) return client;
    const lib = typeof window !== "undefined" ? window.supabase : null;
    if (!lib?.createClient) {
      console.warn("NaMe: @supabase/supabase-js is not loaded");
      return null;
    }
    client = lib.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY);
    return client;
  }

  return {
    getClient,
    getUrl: () => SUPABASE_URL,
    getPublishableKey: () => SUPABASE_PUBLISHABLE_KEY,
  };
})();

if (typeof window !== "undefined") {
  window.NaMeSupabase = NaMeSupabase;
  NaMeSupabase.getClient();
}
