/** Shared progressive enhancements. No scroll hijacking or animation framework. */
(() => {
  const t = (key) => typeof NaMeI18n === 'undefined' ? key : NaMeI18n.t(NaMeI18n.getLang(), key);
  const focusables = (root) => [...root.querySelectorAll('a[href], button, input, select, textarea, [tabindex]:not([tabindex="-1"])')]
    .filter((el) => !el.disabled && !el.closest('[inert]') && el.getClientRects().length);
  let activeModal = null;
  let returnFocus = null;
  let inerted = [];
  let oldOverflow = '';

  function restoreBackground() {
    inerted.forEach((el) => { el.inert = false; });
    inerted = [];
  }

  function syncModal() {
    const open = [...document.querySelectorAll('.modal.is-open')].filter((el) => el.getClientRects().length).pop() || null;
    if (open === activeModal) return;
    restoreBackground();
    if (!open) {
      activeModal = null;
      document.body.style.overflow = oldOverflow;
      if (returnFocus?.isConnected && returnFocus.getClientRects().length) returnFocus.focus({ preventScroll: true });
      returnFocus = null;
      return;
    }
    if (!activeModal) {
      returnFocus = document.activeElement;
      // Existing open handlers already lock scrolling; closed state is normally empty.
      oldOverflow = document.body.style.overflow === 'hidden' ? '' : document.body.style.overflow;
    }
    activeModal = open;
    const panel = open.querySelector('[role="dialog"]') || open;
    panel.setAttribute('role', 'dialog');
    panel.setAttribute('aria-modal', 'true');
    panel.tabIndex = -1;
    const heading = panel.querySelector('h1, h2, h3');
    if (heading && !panel.hasAttribute('aria-labelledby')) {
      heading.id ||= `${open.id || 'name-dialog'}-heading`;
      panel.setAttribute('aria-labelledby', heading.id);
    }
    let branch = open;
    while (branch.parentElement && branch !== document.body) {
      [...branch.parentElement.children].forEach((el) => {
        if (el !== branch && !el.inert && !['SCRIPT', 'STYLE', 'LINK'].includes(el.tagName)) {
          el.inert = true;
          inerted.push(el);
        }
      });
      branch = branch.parentElement;
    }
    document.body.style.overflow = 'hidden';
    (focusables(panel)[0] || panel).focus({ preventScroll: true });
  }

  function scanControls() {
    document.querySelectorAll('.modal input:not([type="hidden"]), .modal textarea').forEach((input) => {
      if (!input.labels?.length && !input.hasAttribute('aria-label')) {
        const key = input.dataset.i18nPlaceholder;
        input.setAttribute('aria-label', key ? t(key) : input.placeholder || input.name || input.type);
        if (key) input.dataset.i18nAria = key;
      }
    });
    document.querySelectorAll('.modal__close').forEach((button) => {
      if (!button.hasAttribute('aria-label')) button.setAttribute('aria-label', t('close'));
    });
    document.querySelectorAll('[id$="-status"], #upload-success, #auth-error').forEach((el) => {
      if (!el.hasAttribute('role')) el.setAttribute('role', 'status');
      el.setAttribute('aria-atomic', 'true');
    });
  }

  let progress;
  let progressArticle;
  let topButton;
  let scrollPending = false;
  function updateScroll() {
    scrollPending = false;
    if (topButton) topButton.hidden = window.scrollY < 600;
    if (progress && progressArticle) {
      const rect = progressArticle.getBoundingClientRect();
      const distance = Math.max(1, rect.height - window.innerHeight);
      const fraction = Math.min(1, Math.max(0, -rect.top / distance));
      progress.style.transform = `scaleX(${fraction})`;
    }
  }
  function scheduleScroll() {
    if (!scrollPending) { scrollPending = true; requestAnimationFrame(updateScroll); }
  }

  function readingTools() {
    const toolbar = document.querySelector('.post__toolbar');
    if (!toolbar || toolbar.querySelector('.reading-tools')) return;
    const text = document.querySelector('.post__content')?.textContent.trim() || '';
    const tools = document.createElement('div');
    tools.className = 'reading-tools';
    if (text) {
      const time = document.createElement('span');
      const cjk = (text.match(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu) || []).length;
      const words = text.replace(/[\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}]/gu, '').trim().split(/\s+/).filter(Boolean).length;
      time.dataset.readingMinutes = Math.max(1, Math.ceil(words / 220 + cjk / 500));
      time.textContent = `${time.dataset.readingMinutes} ${t('readingTime')}`;
      tools.append(time);
    }
    const focus = document.createElement('button');
    focus.type = 'button';
    focus.className = 'reading-tools__focus';
    focus.textContent = t('readingFocus');
    focus.dataset.i18n = 'readingFocus';
    focus.setAttribute('aria-pressed', 'false');
    focus.addEventListener('click', () => {
      const on = document.body.classList.toggle('reading-focus');
      focus.setAttribute('aria-pressed', String(on));
      scheduleScroll();
    });
    tools.append(focus);
    toolbar.append(tools);
    progressArticle = document.querySelector('.post');
    if (!progress) {
      progress = document.createElement('div');
      progress.className = 'reading-progress';
      progress.setAttribute('aria-hidden', 'true');
      document.body.append(progress);
    }
    new ResizeObserver(scheduleScroll).observe(progressArticle);
    scheduleScroll();
  }

  document.addEventListener('DOMContentLoaded', () => {
    const main = document.querySelector('main, .admin-main');
    if (main) {
      main.id ||= 'main-content';
      main.tabIndex = -1;
      if (!document.querySelector('.skip-link')) {
        const skip = document.createElement('a');
        skip.className = 'skip-link'; skip.href = `#${main.id}`; skip.textContent = 'Skip to content';
        document.body.prepend(skip);
      }
    }
    const header = document.getElementById('header');
    if (header) new ResizeObserver(() => {
      document.documentElement.style.setProperty('--header-h', `${Math.ceil(header.getBoundingClientRect().height)}px`);
    }).observe(header);
    if (!document.body.classList.contains('page-admin')) {
      topButton = document.createElement('button');
      topButton.type = 'button'; topButton.className = 'back-to-top'; topButton.hidden = true;
      topButton.textContent = '↑'; topButton.setAttribute('aria-label', t('backToTop'));
      topButton.dataset.i18nAria = 'backToTop';
      topButton.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'instant' : 'smooth' });
        document.querySelector('.logo')?.focus({ preventScroll: true });
      });
      document.body.append(topButton);
    }
    window.addEventListener('scroll', scheduleScroll, { passive: true });
    window.addEventListener('resize', scheduleScroll, { passive: true });
    scanControls();
    const modalObserver = new MutationObserver((records) => {
      if (records.some((record) => record.target.classList?.contains('modal') ||
          [...record.addedNodes, ...record.removedNodes].some((node) => node.nodeType === 1 && node.matches('.modal')))) {
        scanControls(); syncModal();
      }
    });
    const observeModals = () => modalObserver.observe(document.body, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'aria-hidden'] });
    observeModals();
    window.addEventListener('pagehide', () => modalObserver.disconnect());
    window.addEventListener('pageshow', observeModals);
    document.addEventListener('keydown', (event) => {
      if (!activeModal) return;
      if (event.key === 'Escape') {
        activeModal.querySelector('.modal__close')?.click();
        event.preventDefault();
      } else if (event.key === 'Tab') {
        const list = focusables(activeModal);
        const first = list[0], last = list[list.length - 1];
        if (!first) { event.preventDefault(); return; }
        if (event.shiftKey && (document.activeElement === first || !list.includes(document.activeElement))) {
          event.preventDefault(); last.focus();
        } else if (!event.shiftKey && (document.activeElement === last || !list.includes(document.activeElement))) {
          event.preventDefault(); first.focus();
        }
      }
    });
  });
  document.addEventListener('name:post-ready', readingTools);
  document.addEventListener('name:adminpage', scanControls);
  document.addEventListener('name:languagechange', () => {
    scanControls();
    document.querySelectorAll('[data-reading-minutes]').forEach((el) => { el.textContent = `${el.dataset.readingMinutes} ${t('readingTime')}`; });
  });
})();
