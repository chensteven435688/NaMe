/**
 * Pinterest-style page operations: save board, mixed order,
 * masonry feeds, and batched scroll so long pages stay smooth.
 */
const NaMePinOps = (function () {
  const STORE_KEY = "name.pinboard.v1";
  const BATCH = 12;
  const TYPE_I18N = {
    article: "article",
    editorial: "editorial",
    film: "film",
    short: "shorts",
  };
  const MODE_KEYS = {
    latest: "pinOpsLatest",
    mixed: "pinOpsMixed",
    saved: "pinOpsSaved",
  };

  let bound = false;
  let toastTimer = 0;

  function esc(s) {
    return String(s ?? "")
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#39;");
  }

  function t(key) {
    if (typeof NaMeI18n === "undefined") return key;
    return NaMeI18n.t(NaMeI18n.getLang(), key);
  }

  function postHref(slug) {
    const path = typeof NaMeBase !== "undefined" ? NaMeBase.path("/post.html") : "/post.html";
    return `${path}?slug=${encodeURIComponent(slug)}`;
  }

  function store() {
    try {
      const raw = JSON.parse(localStorage.getItem(STORE_KEY) || "[]");
      return Array.isArray(raw) ? raw : [];
    } catch {
      return [];
    }
  }

  function write(items) {
    try {
      localStorage.setItem(STORE_KEY, JSON.stringify(items.slice(0, 200)));
    } catch {
      /* private mode or a full disk */
    }
  }

  function isSaved(kind, key) {
    return store().some((item) => item.kind === kind && String(item.key) === String(key));
  }

  function toggle(snap) {
    const all = store();
    const idx = all.findIndex((item) => item.kind === snap.kind && String(item.key) === String(snap.key));
    if (idx >= 0) {
      all.splice(idx, 1);
      write(all);
      return false;
    }
    all.unshift({ ...snap, savedAt: Date.now() });
    write(all);
    return true;
  }

  function modeStorageKey() {
    const params = new URLSearchParams(location.search);
    params.delete("q");
    return `name.pinops.mode.${location.pathname}?${params}`;
  }

  function readMode(options) {
    const modes = options.modes || ["latest", "mixed", "saved"];
    let mode = "latest";
    try {
      mode = sessionStorage.getItem(modeStorageKey()) || "latest";
    } catch {
      mode = "latest";
    }
    return modes.includes(mode) ? mode : "latest";
  }

  function writeMode(mode) {
    try {
      sessionStorage.setItem(modeStorageKey(), mode);
    } catch {
      /* ignore */
    }
  }

  function shuffleSeed() {
    const key = "name.pinops.seed";
    try {
      const existing = Number(sessionStorage.getItem(key));
      if (existing) return existing;
      const next = Math.floor(Math.random() * 1e9) + 1;
      sessionStorage.setItem(key, String(next));
      return next;
    } catch {
      return 1;
    }
  }

  function shuffle(list) {
    const arr = list.slice();
    let seed = shuffleSeed();
    for (let i = arr.length - 1; i > 0; i -= 1) {
      seed = (seed * 1664525 + 1013904223) >>> 0;
      const j = seed % (i + 1);
      const swap = arr[i];
      arr[i] = arr[j];
      arr[j] = swap;
    }
    return arr;
  }

  function keyOf(options, item) {
    const fn = options.keyOf || ((entry) => entry.slug ?? entry.id);
    return fn(item);
  }

  function itemsFor(options, mode) {
    const live = options.items || [];
    if (mode === "mixed") return shuffle(live);
    if (mode === "saved") {
      const saved = new Set(
        store()
          .filter((item) => item.kind === options.kind)
          .map((item) => String(item.key))
      );
      return live.filter((item) => saved.has(String(keyOf(options, item))));
    }
    return live;
  }

  function savedCount(options) {
    const keys = new Set((options.items || []).map((item) => String(keyOf(options, item))));
    return store().filter((item) => item.kind === options.kind && keys.has(String(item.key))).length;
  }

  function snapshotFromButton(btn) {
    return {
      kind: btn.dataset.pinKind || "",
      key: btn.dataset.pinKey || "",
      title: btn.dataset.pinTitle || "",
      imageUrl: btn.dataset.pinImage || "",
      href: btn.dataset.pinHref || "",
      meta: btn.dataset.pinMeta || "",
      cardClass: btn.dataset.pinClass || "",
      type: btn.dataset.pinType || "",
      showType: btn.dataset.pinShowType === "1",
      authorName: btn.dataset.pinAuthor || "",
    };
  }

  function saveButton(snap) {
    const on = isSaved(snap.kind, snap.key);
    return `<button type="button" class="pin-save${on ? " is-on" : ""}" data-pin-save="1" data-pin-kind="${esc(snap.kind)}" data-pin-key="${esc(snap.key)}" data-pin-title="${esc(snap.title)}" data-pin-image="${esc(snap.imageUrl)}" data-pin-href="${esc(snap.href)}" data-pin-meta="${esc(snap.meta || "")}" data-pin-class="${esc(snap.cardClass || "")}" data-pin-type="${esc(snap.type || "")}" data-pin-show-type="${snap.showType ? "1" : ""}" data-pin-author="${esc(snap.authorName || "")}" aria-pressed="${on ? "true" : "false"}">${esc(t(on ? "pinOpsSavedBtn" : "pinOpsSave"))}</button>`;
  }

  function storySnapshot(post, opts = {}) {
    const cardClass = opts.cardClass || `card--${post.type || "article"}`;
    return {
      kind: "story",
      key: post.slug,
      title: post.title || "",
      imageUrl: post.imageUrl || "",
      href: postHref(post.slug),
      meta: opts.showMeta && post.meta ? post.meta : "",
      cardClass,
      type: post.type || "",
      showType: !!opts.showType,
    };
  }

  function storyCardHtml(post, opts = {}) {
    const cardClass = opts.cardClass || `card--${post.type || "article"}`;
    const snap = storySnapshot(post, { ...opts, cardClass });
    const meta = snap.meta ? `<p class="card__meta">${esc(snap.meta)}</p>` : "";
    const typeKey = TYPE_I18N[post.type];
    const typeLabel =
      opts.showType && typeKey ? `<span class="card__type">${esc(t(typeKey))}</span>` : "";
    return `
      <article class="card ${esc(cardClass)} pin-tile">
        <a class="pin-tile__link" href="${esc(snap.href)}">
          <div class="card__img"><img class="pin-fade" src="${esc(post.imageUrl || "")}" alt="${esc(post.title || "")}" loading="lazy" decoding="async" /></div>
          ${typeLabel}
          ${meta}
          <h3 class="card__title">${esc(post.title || "")}</h3>
        </a>
        ${saveButton(snap)}
      </article>`;
  }

  function paint(root) {
    (root || document).querySelectorAll("[data-pin-save]").forEach((btn) => {
      const on = isSaved(btn.dataset.pinKind, btn.dataset.pinKey);
      btn.classList.toggle("is-on", on);
      btn.setAttribute("aria-pressed", on ? "true" : "false");
      btn.textContent = t(on ? "pinOpsSavedBtn" : "pinOpsSave");
    });
  }

  function markImages(root) {
    root.querySelectorAll("img.pin-fade").forEach((img) => {
      const done = () => img.classList.add("is-ready");
      if (img.complete) done();
      else {
        img.addEventListener("load", done, { once: true });
        img.addEventListener("error", done, { once: true });
      }
    });
  }

  function disconnect(grid) {
    grid._pinObserver?.disconnect();
    grid._pinObserver = null;
  }

  function toast(text) {
    let el = document.getElementById("pin-ops-toast");
    if (!el) {
      el = document.createElement("div");
      el.id = "pin-ops-toast";
      el.className = "pin-ops-toast";
      el.setAttribute("role", "status");
      document.body.appendChild(el);
    }
    el.textContent = text;
    el.classList.add("is-on");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-on"), 1600);
  }

  function findBar(grid) {
    const inside = grid.querySelector(":scope > .pin-ops-bar");
    if (inside) return inside;
    const prev = grid.previousElementSibling;
    return prev?.classList.contains("pin-ops-bar") ? prev : null;
  }

  function ensureBar(grid, options) {
    let bar = findBar(grid);
    if (!bar) {
      bar = document.createElement("div");
      bar.className = "pin-ops-bar";
      bar.setAttribute("role", "group");
      bar.setAttribute("aria-label", t("pinOpsLatest"));
      bar.addEventListener("click", (e) => {
        const btn = e.target.closest("[data-pin-mode]");
        const board = bar.closest(".browse-grid, .community-feed__grid") || bar.nextElementSibling;
        if (!btn || !board?._pinOps) return;
        if (btn.dataset.pinMode === "mixed" && readMode(board._pinOps) === "mixed") {
          try {
            sessionStorage.removeItem("name.pinops.seed");
          } catch {
            /* ignore */
          }
        }
        writeMode(btn.dataset.pinMode);
        attach(board, board._pinOps);
        findBar(board)?.querySelector(`[data-pin-mode="${btn.dataset.pinMode}"]`)?.focus({ preventScroll: true });
      });
    }
    const lead = options.leadHtml ? grid.querySelector(":scope > .meta-folder-bar") : null;
    if (lead) lead.insertAdjacentElement("afterend", bar);
    else if (grid.previousElementSibling !== bar) grid.parentElement.insertBefore(bar, grid);
    return bar;
  }

  function renderBar(bar, options) {
    const modes = options.modes || ["latest", "mixed", "saved"];
    const current = readMode(options);
    const count = savedCount(options);
    bar.innerHTML = modes
      .map((mode) => {
        let label = t(MODE_KEYS[mode] || "pinOpsLatest");
        if (mode === "saved" && count) label = `${label} ${count}`;
        const on = mode === current;
        return `<button type="button" class="pin-ops-bar__btn${on ? " is-active" : ""}" data-pin-mode="${mode}" aria-pressed="${on ? "true" : "false"}">${esc(label)}</button>`;
      })
      .join("");
  }

  function paintItems(grid, items, options, mode) {
    disconnect(grid);
    const lead = options.leadHtml || "";
    if (!items.length) {
      const message =
        mode === "saved"
          ? `<p class="${options.emptyClass || "browse-grid__empty"}">${esc(t("pinOpsSavedEmpty"))}</p>`
          : options.emptyHtml || "";
      grid.innerHTML = lead + message;
      return;
    }

    grid.innerHTML = lead;
    let shown = 0;

    const step = () => {
      const slice = items.slice(shown, shown + BATCH);
      shown += slice.length;
      grid.querySelector(".pin-ops-sentinel")?.remove();
      grid.querySelector(".pin-ops-end")?.remove();
      grid.insertAdjacentHTML("beforeend", slice.map((item) => options.renderItem(item)).join(""));
      markImages(grid);
      paint(grid);
      if (shown < items.length) {
        const more = document.createElement("button");
        more.type = "button";
        more.className = "pin-ops-sentinel btn btn--ghost";
        more.textContent = t("loadMore");
        grid.appendChild(more);
        more.addEventListener("click", () => {
          const previous = grid.querySelectorAll(".pin-tile__link, .pin-card__open").length;
          step();
          const next = grid.querySelectorAll(".pin-tile__link, .pin-card__open")[previous];
          next?.focus({ preventScroll: true });
        });
        return;
      }
      if (items.length > BATCH) {
        const end = document.createElement("p");
        end.className = "pin-ops-end";
        end.textContent = t("pinOpsEnd");
        grid.appendChild(end);
      }
    };

    step();
  }

  function refreshBoards(kind) {
    document.querySelectorAll("[data-pin-board]").forEach((grid) => {
      const options = grid._pinOps;
      if (!options || options.kind !== kind || options.toolbar === false) return;
      const bar = findBar(grid);
      if (bar) renderBar(bar, options);
      if (readMode(options) === "saved") attach(grid, options);
    });
  }

  function attach(grid, options) {
    if (!grid) return;
    bind();
    options.keyOf = options.keyOf || ((item) => item.slug ?? item.id);
    grid._pinOps = options;
    grid.setAttribute("data-pin-board", options.kind || "");
    if (grid.classList.contains("browse-grid")) grid.classList.add("browse-grid--masonry");

    const mode = options.toolbar === false ? "latest" : readMode(options);
    paintItems(grid, itemsFor(options, mode), options, mode);
    if (options.toolbar === false) {
      findBar(grid)?.remove();
    } else {
      const bar = ensureBar(grid, options);
      bar.hidden = false;
      renderBar(bar, options);
    }
  }

  function detach(grid) {
    if (!grid) return;
    disconnect(grid);
    grid.classList.remove("browse-grid--masonry");
    delete grid._pinOps;
    grid.removeAttribute("data-pin-board");
    findBar(grid)?.remove();
  }

  function bind() {
    if (bound) return;
    bound = true;
    document.addEventListener(
      "click",
      (e) => {
        const btn = e.target.closest("[data-pin-save]");
        if (!btn) return;
        e.preventDefault();
        e.stopPropagation();
        const snap = snapshotFromButton(btn);
        if (!snap.kind || !snap.key) return;
        const saved = toggle(snap);
        paint(document);
        refreshBoards(snap.kind);
        if (!btn.isConnected) document.querySelector('[data-pin-mode="saved"]')?.focus({ preventScroll: true });
        toast(t(saved ? "pinOpsSavedToast" : "pinOpsRemovedToast"));
      },
      true
    );
    document.addEventListener("name:languagechange", () => {
      paint(document);
      document.querySelectorAll("[data-pin-board]").forEach((grid) => {
        const options = grid._pinOps;
        if (!options || options.toolbar === false) return;
        const bar = findBar(grid);
        if (bar) renderBar(bar, options);
      });
    });
  }

  return {
    attach,
    detach,
    saveButton,
    storySnapshot,
    storyCardHtml,
    paint,
    toast,
    esc,
  };
})();
