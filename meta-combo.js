/**
 * Type-to-filter meta picker. Suggestions come from getNames().
 */
const NaMeMetaCombo = (function () {
  function escapeHtml(value) {
    const node = document.createElement("div");
    node.textContent = value ?? "";
    return node.innerHTML.replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  function attach(input, { getNames, onPick } = {}) {
    if (!input || input.dataset.combo) return;
    input.dataset.combo = "1";

    const wrap = document.createElement("div");
    wrap.className = "meta-combo";
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);

    const list = document.createElement("ul");
    list.className = "meta-combo__list";
    list.hidden = true;
    list.setAttribute("role", "listbox");
    wrap.appendChild(list);

    input.setAttribute("role", "combobox");
    input.setAttribute("aria-autocomplete", "list");
    input.setAttribute("aria-expanded", "false");

    let matches = [];
    let active = -1;
    let picking = false;

    function close() {
      list.hidden = true;
      input.setAttribute("aria-expanded", "false");
      active = -1;
    }

    function highlight() {
      list.querySelectorAll("[role='option']").forEach((option, index) => {
        option.classList.toggle("is-active", index === active);
        if (index === active) option.scrollIntoView({ block: "nearest" });
      });
    }

    function open(items) {
      matches = items;
      active = -1;
      if (!items.length) {
        close();
        return;
      }
      list.innerHTML = items
        .map(
          (name, index) =>
            `<li role="option" data-index="${index}">${escapeHtml(name)}</li>`
        )
        .join("");
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }

    function filter() {
      if (picking) return;
      const query = input.value.trim().toLowerCase();
      const names = typeof getNames === "function" ? getNames() : [];
      const items = (query
        ? names.filter((name) => name.toLowerCase().includes(query))
        : names
      ).slice(0, 12);
      open(items);
    }

    function choose(name) {
      picking = true;
      input.value = name;
      close();
      input.dispatchEvent(new Event("input", { bubbles: true }));
      input.dispatchEvent(new Event("change", { bubbles: true }));
      picking = false;
      if (typeof onPick === "function") onPick(name);
    }

    input.addEventListener("focus", filter);
    input.addEventListener("input", filter);
    input.addEventListener("keydown", (event) => {
      if (event.key === "ArrowDown" || event.key === "ArrowUp") {
        if (list.hidden) filter();
        if (!matches.length) return;
        event.preventDefault();
        active =
          event.key === "ArrowDown"
            ? Math.min(matches.length - 1, active + 1)
            : Math.max(0, active - 1);
        highlight();
        return;
      }
      if (event.key === "Enter" && !list.hidden && matches.length) {
        event.preventDefault();
        choose(matches[active >= 0 ? active : 0]);
        return;
      }
      if (event.key === "Escape") close();
    });
    list.addEventListener("mousedown", (event) => {
      const option = event.target.closest("[data-index]");
      if (!option) return;
      event.preventDefault();
      choose(matches[Number(option.dataset.index)]);
    });
    document.addEventListener("click", (event) => {
      if (!wrap.contains(event.target)) close();
    });

    return { close };
  }

  async function loadNames(scope = "post") {
    if (typeof NaMeAuth === "undefined") return [];
    const exclusive = scope === "exclusive";
    const [metas, posts] = await Promise.all([
      (exclusive ? NaMeAuth.fetchExclusiveMetas() : NaMeAuth.fetchPostMetas()).catch(() => []),
      NaMeAuth.fetchPosts(exclusive ? { type: "exclusive" } : {}).catch(() => []),
    ]);
    const map = new Map();
    const clean = (value) => NaMeAuth.exclusiveCollectionName(value);
    for (const meta of metas) {
      const name = clean(meta.name);
      if (name) map.set(name.toLowerCase(), name);
    }
    for (const post of posts) {
      if (!exclusive && post.type === "exclusive") continue;
      const name = clean(post.meta);
      if (name && !map.has(name.toLowerCase())) map.set(name.toLowerCase(), name);
    }
    return [...map.values()];
  }

  return { attach, loadNames };
})();
