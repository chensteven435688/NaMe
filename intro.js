/**
 * NaMe — homepage intro.
 * Shown once per browser session (see the inline script in index.html <head>).
 * Phases: wordmark + counter that follows real loading → red band opens from a
 * middle strip to full screen → the whole layer slides up → removed.
 * Vanilla JS + Web Animations API; no libraries.
 */
(function () {
  "use strict";

  var root = document.documentElement;
  var layer = document.querySelector(".intro");
  var MIN_MS = 1500;
  var CAP_MS = 6000; // the intro is always gone by about this point
  var REVEAL_MS = 2520; // strip + hold + fill + slide-up, see reveal()
  var SEEN_KEY = "name-intro-seen";

  if (window.__nameIntroFallback) clearTimeout(window.__nameIntroFallback);

  var finished = false;
  function finish() {
    if (finished) return;
    finished = true;
    try { sessionStorage.setItem(SEEN_KEY, "1"); } catch (e) {}
    root.setAttribute("data-intro", "skip");
    root.classList.remove("intro-lock");
    if (layer && layer.parentNode) layer.parentNode.removeChild(layer);
    document.dispatchEvent(new Event("name:intro-done"));
  }

  // Repeat visit, reduced motion, or no layer: make sure nothing is left behind.
  if (!layer || root.getAttribute("data-intro") === "skip") {
    finish();
    return;
  }

  var count = layer.querySelector(".intro__count");
  var rule = layer.querySelector(".intro__rule");
  var band = layer.querySelector(".intro__band");
  var start = performance.now();

  // Real loading: web fonts plus the window load event (stylesheets, page images).
  var total = 0;
  var done = 0;
  function track(promise) {
    total += 1;
    promise.then(tick, tick);
  }
  function tick() { done += 1; }

  if (document.fonts && document.fonts.ready) track(document.fonts.ready);
  track(new Promise(function (resolve) {
    if (document.readyState === "complete") resolve();
    else window.addEventListener("load", resolve, { once: true });
  }));

  var shown = 0;
  var capped = false;
  var revealing = false;
  // Stop waiting early enough that the reveal ends by CAP_MS.
  var safety = setTimeout(function () { capped = true; }, CAP_MS - REVEAL_MS);
  // Hard stop: even if the reveal never completes, never leave the page covered.
  var hardStop = setTimeout(finish, CAP_MS + 500);

  function round(n) { return Math.round(n * 100) / 100; }
  function pad(n) { return ("00" + n).slice(-3); }

  function frame(now) {
    if (finished || revealing) return;
    var target = capped ? 100 : (total ? (done / total) * 100 : 100);
    // Ease the displayed number toward the real value; never run ahead of it.
    shown += (target - shown) * 0.08;
    if (target - shown < 0.4) shown = target;
    var value = Math.floor(shown);
    if (count) count.textContent = pad(value);
    if (rule) rule.style.width = round(shown) + "%";

    var elapsed = now - start;
    if ((shown >= 100 && elapsed >= MIN_MS) || capped) {
      if (count) count.textContent = "100";
      if (rule) rule.style.width = "100%";
      reveal();
      return;
    }
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);

  function reveal() {
    revealing = true;
    clearTimeout(safety);
    if (!band || typeof band.animate !== "function" || typeof layer.animate !== "function") {
      finish();
      return;
    }
    var strip = band.animate(
      [
        { clipPath: "inset(50% 0% 50% 0%)" },
        { clipPath: "inset(41% 0% 41% 0%)" }
      ],
      { duration: 520, easing: "cubic-bezier(0.65, 0, 0.35, 1)", fill: "forwards" }
    );
    strip.finished
      .then(function () {
        return band.animate(
          [
            { clipPath: "inset(41% 0% 41% 0%)" },
            { clipPath: "inset(0% 0% 0% 0%)" }
          ],
          { duration: 680, delay: 380, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "forwards" }
        ).finished;
      })
      .then(function () {
        return layer.animate(
          [
            { transform: "translateY(0%)" },
            { transform: "translateY(-100%)" }
          ],
          { duration: 820, delay: 120, easing: "cubic-bezier(0.76, 0, 0.24, 1)", fill: "forwards" }
        ).finished;
      })
      .then(function () {
        clearTimeout(hardStop);
        finish();
      }, finish);
  }
})();
