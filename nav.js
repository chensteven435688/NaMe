/**
 * NaMe — main nav (mobile menu + About dropdown)
 */
const NaMeNav = (function () {
  function initDropdowns() {
    document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
      const toggle = dropdown.querySelector(".nav-dropdown__toggle");
      if (!toggle || toggle.dataset.bound) return;
      toggle.dataset.bound = "1";

      const path = location.pathname;
      if (
        path.endsWith("/about.html") ||
        path.endsWith("/business.html") ||
        path.endsWith("/contact.html")
      ) {
        dropdown.classList.add("is-active");
      }

      dropdown.querySelectorAll(".nav-dropdown__menu a").forEach((link) => {
        if (link.pathname === path) link.classList.add("is-current");
      });

      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = dropdown.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });
    });

    document.addEventListener("click", (e) => {
      if (window.matchMedia("(min-width: 900px)").matches) return;
      document.querySelectorAll("[data-nav-dropdown].is-open").forEach((dropdown) => {
        if (!dropdown.contains(e.target)) {
          dropdown.classList.remove("is-open");
          dropdown
            .querySelector(".nav-dropdown__toggle")
            ?.setAttribute("aria-expanded", "false");
        }
      });
    });
  }

  function initMobileMenu() {
    const btn = document.getElementById("menu-btn");
    const nav = document.getElementById("main-nav");
    if (!btn || !nav || btn.dataset.navBound) return;
    btn.dataset.navBound = "1";

    btn.addEventListener("click", () => {
      const open = nav.classList.toggle("is-open");
      btn.setAttribute("aria-expanded", String(open));
      if (!open) {
        nav.querySelectorAll("[data-nav-dropdown].is-open").forEach((dropdown) => {
          dropdown.classList.remove("is-open");
          dropdown
            .querySelector(".nav-dropdown__toggle")
            ?.setAttribute("aria-expanded", "false");
        });
      }
    });

    nav.querySelectorAll("a").forEach((link) => {
      link.addEventListener("click", () => {
        nav.classList.remove("is-open");
        btn.setAttribute("aria-expanded", "false");
        nav.querySelectorAll("[data-nav-dropdown].is-open").forEach((dropdown) => {
          dropdown.classList.remove("is-open");
          dropdown
            .querySelector(".nav-dropdown__toggle")
            ?.setAttribute("aria-expanded", "false");
        });
      });
    });
  }

  function init() {
    initDropdowns();
    initMobileMenu();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => NaMeNav.init());
