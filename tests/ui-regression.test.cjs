const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { JSDOM } = require('jsdom');
const csstree = require('css-tree');
const root = path.resolve(__dirname, '..');
const source = (name) => fs.readFileSync(path.join(root, name), 'utf8');
const tick = () => new Promise((resolve) => setTimeout(resolve, 10));
async function page(name, url = name) {
  const dom = new JSDOM(source(name), { url: `http://localhost:8080/${url}`, runScripts: 'outside-only', pretendToBeVisual: true });
  const w = dom.window;
  w.matchMedia = () => ({ matches: false, addEventListener() {} });
  w.ResizeObserver = class { observe() {} disconnect() {} };
  w.IntersectionObserver = class { observe() {} disconnect() {} };
  w.scrollTo = () => {};
  w.confirm = () => true;
  w.alert = () => {};
  w.URL.createObjectURL = () => 'blob:test';
  w.URL.revokeObjectURL = () => {};
  w.HTMLElement.prototype.getClientRects = function () {
    return this.closest('[hidden], .is-hidden, .modal:not(.is-open)') ? [] : [{ width: 100, height: 40 }];
  };
  await tick();
  w.eval(source('i18n.js') + '\nwindow.NaMeI18n = NaMeI18n;');
  return dom;
}
const evaluate = (w, file, expose = '') => w.eval(source(file) + (expose ? `\nwindow.${expose} = ${expose};` : ''));
const boot = (w) => w.document.dispatchEvent(new w.Event('DOMContentLoaded'));
const posts = Array.from({ length: 15 }, (_, i) => ({ id: String(i), slug: `story-${i}`, title: i ? `Future study ${i}` : 'Light study', type: 'article', meta: 'Studio', body: '<p>A study in light.</p>', imageUrl: '/images/hero/hero-1.png' }));

test('new styles parse; page assets exist; HTML IDs remain unique', () => {
  for (const file of ['home-design.css', 'experience.css']) {
    const errors = [];
    csstree.parse(source(file), { onParseError: (error) => errors.push(error.message) });
    assert.deepEqual(errors, [], file);
  }
  for (const file of fs.readdirSync(root).filter((name) => name.endsWith('.html'))) {
    const dom = new JSDOM(source(file));
    const ids = [...dom.window.document.querySelectorAll('[id]')].map((el) => el.id);
    assert.equal(new Set(ids).size, ids.length, `${file}: duplicate ID`);
    for (const el of dom.window.document.querySelectorAll('script[src], link[rel="stylesheet"]')) {
      const ref = el.getAttribute('src') || el.getAttribute('href');
      if (/^https?:/.test(ref)) continue;
      assert.ok(fs.existsSync(path.join(root, ref.split('?')[0])), `${file}: ${ref}`);
    }
    dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
  }
});

test('homepage renders public stories while account verification is pending', async () => {
  const dom = await page('index.html'); const w = dom.window;
  w.NaMeAuth = { isLoggedIn: () => false, refresh: () => new Promise(() => {}), initUI() {}, fetchPosts: async () => posts, fetchExclusiveMetas: async () => [] };
  evaluate(w, 'main.js'); boot(w); await tick();
  assert.equal(w.document.querySelectorAll('.atelier-piece').length, 3);
  assert.equal(w.document.querySelector('#atelier-gallery').getAttribute('aria-busy'), 'false');
  assert.equal(w.document.querySelector('#page-loader'), null);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test('archive query filters results without triggering a language reload loop', async () => {
  const dom = await page('stories.html', 'stories.html?q=Light'); const w = dom.window;
  w.NaMeAuth = { isLoggedIn: () => false, fetchPosts: async () => posts };
  evaluate(w, 'pin-ops.js', 'NaMePinOps'); evaluate(w, 'browse.js');
  await w.loadBrowseFeed();
  assert.equal(w.document.querySelectorAll('.pin-tile').length, 1);
  assert.equal(w.document.querySelector('.card__title').textContent, 'Light study');
  w.document.querySelector('#archive-search').reset(); await tick();
  assert.equal(w.document.querySelectorAll('.pin-tile').length, 12);
  assert.equal(new URL(w.location.href).searchParams.has('q'), false);
  w.document.querySelector('.pin-ops-sentinel').click();
  assert.equal(w.document.querySelectorAll('.pin-tile').length, 15);
  assert.equal(w.document.querySelector('.pin-ops-sentinel'), null);
  assert.equal(w.document.activeElement, w.document.querySelectorAll('.pin-tile__link')[12]);
  w.document.querySelector('[data-pin-mode="saved"]').click();
  assert.equal(w.document.activeElement.dataset.pinMode, 'saved');
  assert.ok(w.document.querySelector('.browse-grid__empty'));
  w.NaMeI18n.apply('fr'); await tick();
  assert.equal(w.document.querySelectorAll('#archive-search').length, 1);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test('publishing preserves success feedback and rejects executable preview URLs', async () => {
  const dom = await page('admin-upload.html'); const w = dom.window;
  w.NaMeAdmin = { init: async () => true, esc: (value) => value };
  w.NaMeAdminBodyImages = { init() {} };
  w.NaMeAuth = { createPost: async () => ({ post: { title: 'Fixture title', slug: 'fixture' } }) };
  evaluate(w, 'admin-upload.js'); boot(w); await tick();
  const form = w.document.querySelector('#upload-form');
  const url = w.document.querySelector('#upload-image-url');
  url.value = 'javascript:alert(1)'; url.dispatchEvent(new w.Event('input'));
  assert.equal(w.document.querySelector('#preview-img img'), null);
  url.value = 'https://example.com/image.jpg'; url.dispatchEvent(new w.Event('input'));
  assert.equal(w.document.querySelector('#preview-img img').getAttribute('onerror'), null);
  w.document.querySelector('#upload-title').value = 'Fixture title';
  form.dispatchEvent(new w.Event('submit', { cancelable: true })); await tick();
  const success = w.document.querySelector('#upload-success');
  assert.equal(success.classList.contains('is-hidden'), false);
  assert.match(success.textContent, /Fixture title/);
  assert.equal(w.document.activeElement, success);
  assert.equal(form.querySelector('[type="submit"]').disabled, false);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test('dialog traps focus, makes the background inert, and restores the opener', async () => {
  const dom = await page('index.html'); const w = dom.window;
  evaluate(w, 'experience.js'); boot(w);
  const opener = w.document.querySelector('#auth-link'); opener.focus();
  const modal = w.document.querySelector('#auth-modal');
  modal.querySelector('.modal__close').addEventListener('click', () => modal.classList.remove('is-open'));
  modal.classList.add('is-open'); await tick();
  assert.equal(modal.querySelector('[role="dialog"]').getAttribute('aria-modal'), 'true');
  assert.equal(w.document.querySelector('main').inert, true);
  const first = modal.querySelector('.modal__close');
  first.focus(); w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, cancelable: true }));
  assert.equal(w.document.activeElement, modal.querySelector('#auth-login-form button'));
  w.document.dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', cancelable: true })); await tick();
  assert.equal(w.document.querySelector('main').inert, false);
  assert.equal(w.document.activeElement, opener);
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test('admin mobile drawer closes on Escape and canceled navigation preserves edits', async () => {
  const dom = await page('admin.html'); const w = dom.window;
  w.NaMeAuth = { isLoggedIn: () => false, refresh: async () => {}, initAuthModal() {}, initUI() {}, getUser: () => ({ displayName: 'Test editor' }), isAdmin: () => true, onChange() {} };
  evaluate(w, 'admin-common.js', 'NaMeAdmin');
  await w.NaMeAdmin.init('dashboard');
  const menu = w.document.querySelector('[data-admin-menu]'); menu.click();
  assert.equal(w.document.querySelector('.admin-main').inert, true);
  w.document.querySelector('.admin-sidebar').dispatchEvent(new w.KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
  assert.equal(menu.getAttribute('aria-expanded'), 'false');
  assert.equal(w.document.querySelector('.admin-main').hasAttribute('inert'), false);
  const form = w.document.querySelector('#edit-form');
  form.elements.title.dispatchEvent(new w.Event('input', { bubbles: true }));
  w.confirm = () => false;
  await w.NaMeAdmin.navigateTo('/admin.html#content');
  assert.equal(w.location.hash, '');
  form.reset();
  await w.NaMeAdmin.navigateTo('/admin.html#content');
  assert.equal(w.location.hash, '#content');
  dom.window.dispatchEvent(new dom.window.Event("pagehide"));
  dom.window.close();
});

test('reading tools toggle focus mode and update reading labels on language change', async () => {
  const dom = await page('post.html'); const w = dom.window;
  evaluate(w, 'experience.js'); boot(w);
  w.document.querySelector('#post-root').innerHTML = '<article class="post"><div class="post__toolbar"></div><div class="post__content"><p>A short test article.</p></div></article>';
  w.document.dispatchEvent(new w.CustomEvent('name:post-ready'));
  const toggle = w.document.querySelector('.reading-tools__focus');
  assert.equal(w.document.querySelectorAll('.reading-progress').length, 1);
  toggle.click();
  assert.equal(w.document.body.classList.contains('reading-focus'), true);
  assert.equal(toggle.getAttribute('aria-pressed'), 'true');
  w.NaMeI18n.apply('zh-Hant');
  assert.match(w.document.querySelector('[data-reading-minutes]').textContent, /分鐘閱讀/);
  toggle.click();
  assert.equal(w.document.body.classList.contains('reading-focus'), false);
  w.dispatchEvent(new w.Event('pagehide')); dom.window.close();
});

test('admin content filters survive content reload and show an honest empty state', async () => {
  const dom = await page('admin.html'); const w = dom.window;
  w.NaMeAdmin = { esc: (value) => value, formatDate: (value) => value };
  w.NaMeAuth = { fetchPosts: async () => posts };
  evaluate(w, 'admin.js');
  await w.loadContent();
  w.document.querySelector('#content-search').value = 'Light';
  w.applyContentFilters();
  assert.equal(w.document.querySelectorAll('#content-table-body tr').length, 1);
  await w.loadContent();
  assert.equal(w.document.querySelectorAll('#content-table-body tr').length, 1);
  w.document.querySelector('#content-search').value = 'not-in-the-archive';
  w.applyContentFilters();
  assert.match(w.document.querySelector('#content-table-body').textContent, /No matching posts/);
  w.dispatchEvent(new w.Event('pagehide')); dom.window.close();
});
