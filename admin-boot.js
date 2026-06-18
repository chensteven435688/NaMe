/**
 * NaMe — admin session hint (load in <head> to avoid login gate flash)
 */
try {
  if (sessionStorage.getItem("name-admin-ok") === "1") {
    document.documentElement.classList.add("admin-optimistic-early");
  }
} catch {
  /* ignore */
}
