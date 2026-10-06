/**
 * NaMe — main nav (mobile menu + dropdowns)
 */
const NaMeNav = (function () {
  const NAV_GROUPS = {
    about: ["about.html", "business.html", "contact.html"],
    stories: ["stories.html", "magazine.html", "editorial.html", "articles.html", "film.html"],
  };

  function pageName(path) {
    const name = path.split("/").filter(Boolean).pop() || "";
    return name || "index.html";
  }

  function pathMatches(path, file) {
    return path.endsWith("/" + file) || path.endsWith(file) || pageName(path) === file;
  }

  function initDropdowns() {
    document.querySelectorAll("[data-nav-dropdown]").forEach((dropdown) => {
      const toggle = dropdown.querySelector(".nav-dropdown__toggle");
      if (!toggle || toggle.dataset.bound) return;
      toggle.dataset.bound = "1";
      dropdown.addEventListener("keydown", (event) => {
        if (event.key !== "Escape") return;
        event.stopPropagation();
        dropdown.classList.remove("is-open");
        toggle.setAttribute("aria-expanded", "false");
        // Move outside the dropdown so focus-within does not keep its menu open.
        document.getElementById("menu-btn")?.offsetParent
          ? document.getElementById("menu-btn").focus()
          : document.querySelector(".logo")?.focus();
      });

      let path = location.pathname;
      const base = typeof NaMeBase !== "undefined" ? NaMeBase.getBase() : "";
      if (base && path.startsWith(base)) path = path.slice(base.length) || "/";

      const group = dropdown.dataset.navDropdown;
      const pages = NAV_GROUPS[group] || [];
      if (pages.some((file) => pathMatches(path, file))) {
        dropdown.classList.add("is-active");
      }

      dropdown.querySelectorAll(".nav-dropdown__menu a").forEach((link) => {
        const href = link.getAttribute("href")?.split("#")[0] || "";
        if (pathMatches(path, href)) link.classList.add("is-current");
      });

      toggle.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        const open = dropdown.classList.toggle("is-open");
        toggle.setAttribute("aria-expanded", String(open));
      });

      const main = dropdown.querySelector(".nav-dropdown__main");
      if (main && main.tagName !== "A") {
        main.addEventListener("click", () => {
          if (!window.matchMedia("(max-width: 899px)").matches) return;
          const open = dropdown.classList.toggle("is-open");
          toggle.setAttribute("aria-expanded", String(open));
        });
      }
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
    btn.setAttribute("aria-controls", nav.id);
    nav.addEventListener("keydown", (event) => {
      if (event.key !== "Escape") return;
      nav.classList.remove("is-open");
      btn.setAttribute("aria-expanded", "false");
      btn.focus();
    });

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

  const SECTION_PAGES = {
    "exclusive.html": "exclusive",
    "articles.html": "article",
    "editorial.html": "editorial",
    "magazine.html": "magazine",
    "film.html": "film",
  };

  function linkFile(href) {
    return (href || "").split(/[?#]/)[0].split("/").filter(Boolean).pop() || "";
  }

  async function hideEmptySectionLinks() {
    if (typeof NaMeAuth === "undefined" || !NaMeAuth.fetchPostIndex) return;
    let sections;
    try {
      sections = NaMeAuth.publishedSections(await NaMeAuth.fetchPostIndex());
    } catch {
      return;
    }

    document.querySelectorAll("a[href]").forEach((link) => {
      const key = SECTION_PAGES[linkFile(link.getAttribute("href"))];
      if (!key || sections[key]) return;
      link.hidden = true;
      link.classList.add("is-empty-section");
    });

    document.querySelectorAll(".stories-categories").forEach((nav) => {
      const visible = [...nav.querySelectorAll("a")].some((link) => !link.hidden);
      if (!visible) {
        nav.hidden = true;
        nav.classList.add("is-empty-section");
      }
    });
  }

  function init() {
    initDropdowns();
    initMobileMenu();
    hideEmptySectionLinks();
  }

  return { init };
})();

document.addEventListener("DOMContentLoaded", () => NaMeNav.init());
