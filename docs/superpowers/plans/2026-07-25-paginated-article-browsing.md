# Paginated Article Browsing Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Convert the main article list (`#articlesContainer`) from continuous scrolling into swipe/scroll-to-paginate browsing, 5 articles per page, across all sections (All/Today/Folder/Feed) and all 4 view modes (magazine/list/title/cards).

**Architecture:** `renderArticles()` in `public/js/app.js` groups the filtered article array into chunks of 5 and renders one `.articles-page` block per chunk inside a sliding wrapper (`transform: translateY(-page*100%)`), reusing the same slide mechanic already implemented for the Add-Feed preview carousel. New handlers respond to touch swipe, mouse wheel, and prev/next buttons to change `state.currentPage`. Existing per-view-mode CSS (`.view-magazine`, `.view-list`, `.view-title`, `.view-cards`) is preserved unchanged by keeping the `.articles-list.view-X` element nested one level inside each `.articles-page`.

**Tech Stack:** Vanilla JS (ES modules), no build step, no bundler. No test framework exists in this repo — verification uses ad-hoc Playwright scripts run against a local `node server.js`, the same approach already used and proven earlier in this project's debugging session. These scripts are throwaway (kept in `/tmp` or an equivalent scratch dir, not committed).

## Global Constraints

- No backend/API changes — this is a pure front-end (`public/`) change.
- Follow the existing codebase convention of one large `app.js` / `style.css` — do not split into new modules.
- Preserve all 4 existing view-mode CSS blocks (`view-magazine`, `view-list`, `view-title`, `view-cards`) unchanged; only add new rules, don't rewrite existing selectors.
- Page size is fixed at 5 articles per page (not configurable).
- No page wraparound: first/last page are hard stops.
- Playwright (`npx playwright@1.56.1` or later, `chromium` browser) is available in this environment (already downloaded during prior debugging in this session) — reuse it for verification; do not add it as a project dependency (`package.json` stays untouched).

---

### Task 1: Pagination CSS

**Files:**
- Modify: `public/css/style.css` (in the "Articles Container & Views" section, around the existing `.articles-container` / `.articles-list` rules, roughly lines 440–459 as of commit `c2d8bbf`)

**Interfaces:**
- Produces (CSS classes later tasks depend on): `.articles-container` (existing, modified), `.articles-pages-inner` (new — the sliding wrapper), `.articles-page` (new — one per 5-article chunk), `.articles-page-nav` (new — prev/next + indicator overlay), `.articles-page-btn` (new), `.articles-page-indicator` (new). `.articles-list` (existing selector) keeps its current meaning but is now expected to be nested one level inside `.articles-page`, not the direct child of `.articles-container`.

- [ ] **Step 1: Locate and replace the `.articles-container` rule**

Find this existing block in `public/css/style.css`:

```css
.articles-container {
  flex: 1;
  overflow-y: auto;
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-bottom));
  padding-left: max(16px, var(--safe-left));
  padding-right: max(16px, var(--safe-right));
}
```

Replace it with (only change: `overflow-y: auto` → `overflow: hidden`, and add `position: relative` so the page-nav overlay can be absolutely positioned inside it):

```css
.articles-container {
  flex: 1;
  overflow: hidden;
  padding: 16px;
  padding-bottom: calc(16px + var(--safe-bottom));
  padding-left: max(16px, var(--safe-left));
  padding-right: max(16px, var(--safe-right));
  position: relative;
}
```

- [ ] **Step 2: Add pagination rules directly after the `.articles-list` rule**

Immediately after the existing:

```css
.articles-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-width: 1200px;
  margin: 0 auto;
}
```

insert this new block:

```css
/* Article Pagination (swipe/scroll, 5 per page) */
.articles-pages-inner {
  height: 100%;
  display: flex;
  flex-direction: column;
  transition: transform 0.3s ease;
}

.articles-page {
  height: 100%;
  flex-shrink: 0;
  overflow: hidden;
  display: flex;
  flex-direction: column;
}

.articles-page .articles-list {
  flex: 1;
  min-height: 0;
  overflow: hidden;
}

/* Cards view normally uses a responsive grid; while paginated it becomes a
   single flex column so all 5 cards can share the fixed page height evenly. */
.articles-page .articles-list.view-cards {
  display: flex;
  flex-direction: column;
}

.articles-page .article-card {
  flex: 1 1 0;
  min-height: 0;
  overflow: hidden;
}

.articles-page-nav {
  position: absolute;
  bottom: calc(12px + var(--safe-bottom));
  left: 50%;
  transform: translateX(-50%);
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  border-radius: 999px;
  background: var(--glass-bg);
  backdrop-filter: blur(20px);
  -webkit-backdrop-filter: blur(20px);
  border: 1px solid var(--border-color);
  z-index: 5;
}

.articles-page-nav.hidden {
  display: none;
}

.articles-page-btn {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: none;
  background: var(--bg-elevated);
  color: var(--text-primary);
  font-size: 16px;
  line-height: 1;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
}

.articles-page-btn:disabled {
  opacity: 0.35;
  cursor: default;
}

.articles-page-indicator {
  font-size: var(--text-xs);
  color: var(--text-secondary);
  min-width: 36px;
  text-align: center;
}
```

- [ ] **Step 3: Sanity-check the CSS file parses**

Run: `node -e "require('fs').readFileSync('public/css/style.css','utf8')" && echo OK`
Expected: `OK` (this just confirms the file is readable/well-formed as text; CSS has no syntax checker in this repo, visual verification happens in Task 5).

- [ ] **Step 4: Commit**

```bash
git add public/css/style.css
git commit -m "feat: add pagination CSS for article browsing"
```

---

### Task 2: Pagination nav markup + DOM refs

**Files:**
- Modify: `public/index.html` (inside `#articlesContainer`, around line 124–150 as of commit `c2d8bbf`)
- Modify: `public/js/app.js` (the `const DOM = {...}` block, around line 26–27 as of commit `c2d8bbf`)

**Interfaces:**
- Consumes: `.articles-page-nav`, `.articles-page-btn`, `.articles-page-indicator` CSS classes from Task 1.
- Produces: `DOM.articlesPageNav`, `DOM.articlesPrevPageBtn`, `DOM.articlesNextPageBtn`, `DOM.articlesPageIndicator` — element references later tasks use to update text/disabled state and bind click handlers.

- [ ] **Step 1: Add the nav markup to index.html**

Find this line in `public/index.html`:

```html
      <div id="articlesList" class="articles-list view-magazine"></div>
```

Add the new nav block immediately **after** it (still inside the closing `</div>` of `#articlesContainer`):

```html
      <div id="articlesList" class="articles-list view-magazine"></div>

      <div id="articlesPageNav" class="articles-page-nav hidden">
        <button id="articlesPrevPageBtn" class="articles-page-btn" aria-label="Previous page" type="button">‹</button>
        <span id="articlesPageIndicator" class="articles-page-indicator"></span>
        <button id="articlesNextPageBtn" class="articles-page-btn" aria-label="Next page" type="button">›</button>
      </div>
```

- [ ] **Step 2: Add DOM references in app.js**

Find this line in `public/js/app.js`:

```js
  articlesContainer: $('articlesContainer'),
  articlesList: $('articlesList'),
```

Replace with:

```js
  articlesContainer: $('articlesContainer'),
  articlesList: $('articlesList'),
  articlesPageNav: $('articlesPageNav'),
  articlesPrevPageBtn: $('articlesPrevPageBtn'),
  articlesNextPageBtn: $('articlesNextPageBtn'),
  articlesPageIndicator: $('articlesPageIndicator'),
```

- [ ] **Step 3: Verify the page loads without console errors**

Start the server: `node server.js &` (from repo root; wait ~2s for "FeedFlow server running on port 8080")

Run this Playwright script (save anywhere, e.g. `/tmp/verify_task2.mjs`, then `node /tmp/verify_task2.mjs`):

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let errored = false;
  page.on('pageerror', err => { errored = true; console.log('[pageerror]', err.message); });
  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  const navExists = await page.evaluate(() => !!document.getElementById('articlesPageNav'));
  console.log('articlesPageNav exists:', navExists);
  console.log('No page errors:', !errored);
  await browser.close();
})();
```

(If `playwright` isn't resolvable from that path, `cd` into any directory with `node_modules/playwright` installed first — it was already installed once during this project's debugging session; reuse that install rather than adding it to `package.json`.)

Expected output: `articlesPageNav exists: true` and `No page errors: true`.

Stop the server afterward: `kill %1` (or find/kill the `node server.js` PID).

- [ ] **Step 4: Commit**

```bash
git add public/index.html public/js/app.js
git commit -m "feat: add article pagination nav markup and DOM refs"
```

---

### Task 3: Rework `renderArticles()` to paginate

**Files:**
- Modify: `public/js/app.js`:
  - The `state` object (around line 91–99 as of commit `c2d8bbf`)
  - `renderArticles(articles)` (around line 621–671 as of commit `c2d8bbf`)

**Interfaces:**
- Consumes: `DOM.articlesList`, `DOM.articlesPageNav`, `DOM.articlesPrevPageBtn`, `DOM.articlesNextPageBtn`, `DOM.articlesPageIndicator` (Task 2). `renderArticleCard(article, viewMode, isRead)` (existing, unchanged, returns an HTML string for one card).
- Produces: `state.currentPage` (0-indexed number, new field on the existing `state` object) — Task 4's swipe/wheel/button handlers and Task 5's view-reset calls read and write this. `applyArticlesPageTransform()` — new function, applies the current `state.currentPage` to the DOM (transform + indicator text + button disabled state); Task 4 calls this after changing `state.currentPage`.

- [ ] **Step 1: Add `currentPage` to app state**

Find:

```js
const state = {
  currentView: 'all',        // 'all', 'today', 'folder:{id}', 'feed:{id}'
  currentArticle: null,
  isRefreshing: false,
  pendingFeedUrl: null,       // For add-feed flow
  pendingFeedData: null,
  previewArticles: [],
  previewPageIndex: 0,
};
```

Replace with:

```js
const state = {
  currentView: 'all',        // 'all', 'today', 'folder:{id}', 'feed:{id}'
  currentArticle: null,
  isRefreshing: false,
  pendingFeedUrl: null,       // For add-feed flow
  pendingFeedData: null,
  previewArticles: [],
  previewPageIndex: 0,
  currentPage: 0,             // Current page (0-indexed) in the paginated article list
};
```

- [ ] **Step 2: Replace `renderArticles()`**

Find the full existing function:

```js
function renderArticles(articles) {
  const settings = Store.getSettings();
  const readSet = Store.getReadSet();
  const feeds = Store.getFeeds();

  // Filter: show/hide read articles
  if (!settings.showReadArticles) {
    articles = articles.filter(a => !readSet.has(a.id));
  }

  // Show appropriate state
  if (feeds.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    DOM.noArticlesState.classList.add('hidden');
    DOM.articlesList.innerHTML = '';
    return;
  }

  DOM.emptyState.classList.add('hidden');

  if (articles.length === 0) {
    DOM.noArticlesState.classList.remove('hidden');
    DOM.articlesList.innerHTML = '';
    return;
  }

  DOM.noArticlesState.classList.add('hidden');

  // Set view mode class
  DOM.articlesList.className = `articles-list view-${settings.viewMode}`;

  // Render articles based on view mode
  const html = articles.map(article => {
    const isArticleRead = readSet.has(article.id);
    return renderArticleCard(article, settings.viewMode, isArticleRead);
  }).join('');

  DOM.articlesList.innerHTML = html;

  // Bind article click events
  DOM.articlesList.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', () => {
      const articleId = card.dataset.articleId;
      const article = articles.find(a => a.id === articleId);
      if (article) openArticle(article);
    });
  });

  // Auto-translate non-Traditional Chinese articles displayed in the main list view
  autoTranslateArticles(articles);
}
```

Replace it with:

```js
const ARTICLES_PAGE_SIZE = 5;

function renderArticles(articles) {
  const settings = Store.getSettings();
  const readSet = Store.getReadSet();
  const feeds = Store.getFeeds();

  // Filter: show/hide read articles
  if (!settings.showReadArticles) {
    articles = articles.filter(a => !readSet.has(a.id));
  }

  // Show appropriate state
  if (feeds.length === 0) {
    DOM.emptyState.classList.remove('hidden');
    DOM.noArticlesState.classList.add('hidden');
    DOM.articlesList.innerHTML = '';
    DOM.articlesPageNav.classList.add('hidden');
    return;
  }

  DOM.emptyState.classList.add('hidden');

  if (articles.length === 0) {
    DOM.noArticlesState.classList.remove('hidden');
    DOM.articlesList.innerHTML = '';
    DOM.articlesPageNav.classList.add('hidden');
    return;
  }

  DOM.noArticlesState.classList.add('hidden');

  // Group into pages of 5, clamping state.currentPage to the valid range
  const totalPages = Math.ceil(articles.length / ARTICLES_PAGE_SIZE);
  if (state.currentPage >= totalPages) state.currentPage = totalPages - 1;
  if (state.currentPage < 0) state.currentPage = 0;

  DOM.articlesList.className = 'articles-pages-inner';

  let pagesHtml = '';
  for (let p = 0; p < totalPages; p++) {
    const pageArticles = articles.slice(p * ARTICLES_PAGE_SIZE, p * ARTICLES_PAGE_SIZE + ARTICLES_PAGE_SIZE);
    const cardsHtml = pageArticles.map(article => {
      const isArticleRead = readSet.has(article.id);
      return renderArticleCard(article, settings.viewMode, isArticleRead);
    }).join('');
    pagesHtml += `<div class="articles-page"><div class="articles-list view-${settings.viewMode}">${cardsHtml}</div></div>`;
  }
  DOM.articlesList.innerHTML = pagesHtml;

  applyArticlesPageTransform();

  // Bind article click events
  DOM.articlesList.querySelectorAll('.article-card').forEach(card => {
    card.addEventListener('click', () => {
      const articleId = card.dataset.articleId;
      const article = articles.find(a => a.id === articleId);
      if (article) openArticle(article);
    });
  });

  // Auto-translate non-Traditional Chinese articles displayed in the main list view
  autoTranslateArticles(articles);
}

function applyArticlesPageTransform() {
  const totalPages = DOM.articlesList.querySelectorAll('.articles-page').length;
  DOM.articlesList.style.transform = `translateY(-${state.currentPage * 100}%)`;

  DOM.articlesPageNav.classList.toggle('hidden', totalPages <= 1);
  DOM.articlesPageIndicator.textContent = `${state.currentPage + 1} / ${totalPages}`;
  DOM.articlesPrevPageBtn.disabled = state.currentPage <= 0;
  DOM.articlesNextPageBtn.disabled = state.currentPage >= totalPages - 1;
}

function goToArticlesPage(delta) {
  const totalPages = DOM.articlesList.querySelectorAll('.articles-page').length;
  const newPage = state.currentPage + delta;
  if (newPage < 0 || newPage >= totalPages) return;
  state.currentPage = newPage;
  applyArticlesPageTransform();
}
```

- [ ] **Step 3: Verify pagination grouping renders correctly**

Start the server: `node server.js &` (wait ~2s)

Run this Playwright script (`node /tmp/verify_task3.mjs`), which seeds 12 synthetic Traditional-Chinese articles directly into `localStorage` (bypassing RSS parsing, and using Traditional Chinese text so the background auto-translate step finds nothing to do) and checks the page grouping:

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.stack || err.message));

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });

  await page.evaluate(() => {
    const feed = { id: 'feed1', title: '測試來源', url: 'https://example.com/feed', folderId: '', favicon: '', addedAt: Date.now(), lastFetchedAt: null };
    localStorage.setItem('ff_feeds', JSON.stringify([feed]));
    const articles = [];
    for (let i = 1; i <= 12; i++) {
      articles.push({
        id: 'art' + i,
        title: '測試文章標題 ' + i,
        summary: '這是測試文章的摘要內容 ' + i,
        pubDate: new Date(Date.now() - i * 60000).toISOString(),
      });
    }
    localStorage.setItem('ff_articles', JSON.stringify({ feed1: articles }));
  });

  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  const pageCount = await page.evaluate(() => document.querySelectorAll('.articles-page').length);
  const firstPageCardCount = await page.evaluate(() => document.querySelectorAll('.articles-page:nth-child(1) .article-card').length);
  const indicatorText = await page.textContent('#articlesPageIndicator');
  const navHidden = await page.evaluate(() => document.getElementById('articlesPageNav').classList.contains('hidden'));

  console.log('Total pages (expect 3, since 12 articles / 5 per page):', pageCount);
  console.log('Cards on first page (expect 5):', firstPageCardCount);
  console.log('Indicator text (expect "1 / 3"):', JSON.stringify(indicatorText));
  console.log('Nav hidden (expect false):', navHidden);

  await browser.close();
})();
```

Expected output:
```
Total pages (expect 3, since 12 articles / 5 per page): 3
Cards on first page (expect 5): 5
Indicator text (expect "1 / 3"): "1 / 3"
Nav hidden (expect false): false
```

Stop the server: `kill %1`

- [ ] **Step 4: Commit**

```bash
git add public/js/app.js
git commit -m "feat: paginate renderArticles into 5-article pages"
```

---

### Task 4: Swipe, wheel, and button page navigation

**Files:**
- Modify: `public/js/app.js`:
  - `bindEvents()` (around line 252–289 as of commit `c2d8bbf`, specifically near the end where LINE Login events are bound)

**Interfaces:**
- Consumes: `goToArticlesPage(delta)`, `DOM.articlesContainer`, `DOM.articlesPrevPageBtn`, `DOM.articlesNextPageBtn` (Task 2 and Task 3).
- Produces: nothing new consumed by later tasks — this task is a leaf (touch/wheel/button wiring only).

- [ ] **Step 1: Add the paging event bindings**

Find this block in `bindEvents()`:

```js
  // LINE Login Events
  if (DOM.lineLoginBtnTop) DOM.lineLoginBtnTop.addEventListener('click', triggerLineOpenIdLogin);
  if (DOM.lineLoginModalBtn) DOM.lineLoginModalBtn.addEventListener('click', triggerLineOpenIdLogin);
```

Add immediately after it:

```js

  // Article Pagination: swipe (touch), wheel (desktop), and prev/next buttons
  let articlesTouchStartY = 0;
  let articlesWheelLocked = false;

  DOM.articlesContainer.addEventListener('touchstart', (e) => {
    articlesTouchStartY = e.touches[0].clientY;
  }, { passive: true });

  DOM.articlesContainer.addEventListener('touchend', (e) => {
    const endY = e.changedTouches[0].clientY;
    const diffY = articlesTouchStartY - endY;
    if (Math.abs(diffY) > 40) {
      goToArticlesPage(diffY > 0 ? 1 : -1);
    }
  }, { passive: true });

  DOM.articlesContainer.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) < 10) return;
    e.preventDefault();
    if (articlesWheelLocked) return;
    articlesWheelLocked = true;
    goToArticlesPage(e.deltaY > 0 ? 1 : -1);
    setTimeout(() => { articlesWheelLocked = false; }, 400);
  }, { passive: false });

  DOM.articlesPrevPageBtn.addEventListener('click', () => goToArticlesPage(-1));
  DOM.articlesNextPageBtn.addEventListener('click', () => goToArticlesPage(1));
```

- [ ] **Step 2: Verify swipe, wheel, and button navigation all change pages**

Start the server: `node server.js &` (wait ~2s)

Run this Playwright script (`node /tmp/verify_task4.mjs`) — it reuses the same 12-article seed as Task 3's verification, then exercises all three navigation methods:

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.stack || err.message));

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const feed = { id: 'feed1', title: '測試來源', url: 'https://example.com/feed', folderId: '', favicon: '', addedAt: Date.now(), lastFetchedAt: null };
    localStorage.setItem('ff_feeds', JSON.stringify([feed]));
    const articles = [];
    for (let i = 1; i <= 12; i++) {
      articles.push({ id: 'art' + i, title: '測試文章標題 ' + i, summary: '摘要 ' + i, pubDate: new Date(Date.now() - i * 60000).toISOString() });
    }
    localStorage.setItem('ff_articles', JSON.stringify({ feed1: articles }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  console.log('--- Indicator before any navigation (expect "1 / 3") ---');
  console.log(await page.textContent('#articlesPageIndicator'));

  console.log('--- Click next button (expect "2 / 3") ---');
  await page.click('#articlesNextPageBtn');
  await page.waitForTimeout(100);
  console.log(await page.textContent('#articlesPageIndicator'));

  console.log('--- Click next button again (expect "3 / 3", next button disabled) ---');
  await page.click('#articlesNextPageBtn');
  await page.waitForTimeout(100);
  console.log(await page.textContent('#articlesPageIndicator'));
  console.log('next button disabled:', await page.evaluate(() => document.getElementById('articlesNextPageBtn').disabled));

  console.log('--- Click next again past the last page (expect still "3 / 3", no-op) ---');
  await page.click('#articlesNextPageBtn');
  await page.waitForTimeout(100);
  console.log(await page.textContent('#articlesPageIndicator'));

  console.log('--- Click prev button (expect "2 / 3") ---');
  await page.click('#articlesPrevPageBtn');
  await page.waitForTimeout(100);
  console.log(await page.textContent('#articlesPageIndicator'));

  console.log('--- Wheel scroll down (deltaY positive, expect "3 / 3") ---');
  await page.hover('#articlesContainer');
  await page.mouse.wheel(0, 100);
  await page.waitForTimeout(500);
  console.log(await page.textContent('#articlesPageIndicator'));

  console.log('--- Wheel scroll up (deltaY negative, expect "2 / 3") ---');
  await page.mouse.wheel(0, -100);
  await page.waitForTimeout(500);
  console.log(await page.textContent('#articlesPageIndicator'));

  await browser.close();
})();
```

Expected output (in order):
```
1 / 3
2 / 3
3 / 3
next button disabled: true
3 / 3
2 / 3
3 / 3
2 / 3
```

Stop the server: `kill %1`

- [ ] **Step 3: Commit**

```bash
git add public/js/app.js
git commit -m "feat: add swipe, wheel, and button navigation for article pages"
```

---

### Task 5: Reset page on view change and refresh; end-to-end verification

**Files:**
- Modify: `public/js/app.js`:
  - `navigateTo(view)` (around line 554–559 as of commit `c2d8bbf`)
  - `refreshFeeds()` (around line 1255–1301 as of commit `c2d8bbf`)

**Interfaces:**
- Consumes: `state.currentPage` (Task 3).
- Produces: nothing new — this is the final integration task.

- [ ] **Step 1: Reset `currentPage` in `navigateTo`**

Find:

```js
function navigateTo(view) {
  state.currentView = view;
  closeSidebar();
  updateActiveNav();
  loadCurrentView();
}
```

Replace with:

```js
function navigateTo(view) {
  state.currentView = view;
  state.currentPage = 0;
  closeSidebar();
  updateActiveNav();
  loadCurrentView();
}
```

- [ ] **Step 2: Reset `currentPage` in `refreshFeeds`**

Find (near the end of `refreshFeeds()`):

```js
  DOM.refreshBtn.classList.remove('spinning');
  state.isRefreshing = false;

  renderSidebar();
  loadCurrentView();
```

Replace with:

```js
  DOM.refreshBtn.classList.remove('spinning');
  state.isRefreshing = false;
  state.currentPage = 0;

  renderSidebar();
  loadCurrentView();
```

- [ ] **Step 3: End-to-end verification**

Start the server: `node server.js &` (wait ~2s)

Run this Playwright script (`node /tmp/verify_task5.mjs`) — seeds two feeds with 12 total articles across "All Articles", navigates to a page other than 1, switches view, and confirms the page resets:

```js
const { chromium } = require('playwright');
(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  page.on('pageerror', err => console.log('[pageerror]', err.stack || err.message));

  await page.goto('http://localhost:8080/', { waitUntil: 'networkidle' });
  await page.evaluate(() => {
    const feeds = [
      { id: 'feed1', title: '來源一', url: 'https://example.com/feed1', folderId: '', favicon: '', addedAt: Date.now(), lastFetchedAt: null },
      { id: 'feed2', title: '來源二', url: 'https://example.com/feed2', folderId: '', favicon: '', addedAt: Date.now(), lastFetchedAt: null },
    ];
    localStorage.setItem('ff_feeds', JSON.stringify(feeds));
    const mk = (prefix, n) => {
      const arr = [];
      for (let i = 1; i <= n; i++) {
        arr.push({ id: prefix + i, title: prefix + '文章 ' + i, summary: '摘要 ' + i, pubDate: new Date(Date.now() - i * 60000).toISOString() });
      }
      return arr;
    };
    localStorage.setItem('ff_articles', JSON.stringify({ feed1: mk('f1_', 8), feed2: mk('f2_', 4) }));
  });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForTimeout(300);

  console.log('--- All Articles: 12 total -> 3 pages, go to page 2 ---');
  await page.click('#articlesNextPageBtn');
  await page.waitForTimeout(100);
  console.log('Indicator (expect "2 / 3"):', await page.textContent('#articlesPageIndicator'));

  console.log('--- Switch to Today view, page should reset to 1 ---');
  await page.click('#navToday');
  await page.waitForTimeout(200);
  console.log('Indicator after view switch (expect starts with "1 /"):', await page.textContent('#articlesPageIndicator'));

  console.log('--- Switch back to All, go to last page, then trigger refreshFeeds via API to confirm reset ---');
  await page.click('#navAll');
  await page.waitForTimeout(200);
  await page.click('#articlesNextPageBtn');
  await page.click('#articlesNextPageBtn');
  await page.waitForTimeout(100);
  console.log('Indicator before refresh (expect "3 / 3"):', await page.textContent('#articlesPageIndicator'));

  await browser.close();
})();
```

Expected output:
```
Indicator (expect "2 / 3"): 2 / 3
Indicator after view switch (expect starts with "1 /"): 1 / 1
Indicator before refresh (expect "3 / 3"): 3 / 3
```

(Note: "Today" view only contains articles from the last 24 hours; the seeded articles are all within the last few minutes, so all 12 qualify but they're deduplicated per-feed the same way as "All" — if the count differs from "1 / 1", that's fine as long as the page number is reset to `1 / N`, which is what this step actually verifies.)

Stop the server: `kill %1`

- [ ] **Step 4: Manual visual check across all 4 view modes**

This step has no scripted assertion — swiping/scrolling behavior and 5-cards-compressed-into-one-screen layout needs a human eye. With the server still running (`node server.js &`), open `http://localhost:8080/` in a real browser, use the view-mode dropdown (top bar) to check `magazine`, `list`, `title`, and `cards` modes each show pagination working (swipe or scroll wheel changes pages, indicator updates, 5 items visible without a page-internal scrollbar). Report back if any view mode looks visually broken (e.g. cards overlapping, text illegible) so CSS in Task 1 can be adjusted.

- [ ] **Step 5: Commit**

```bash
git add public/js/app.js
git commit -m "feat: reset article page on view change and refresh"
```

---

## After all tasks

Deployment to Cloud Run (`gcloud run deploy feedflow --source . --region asia-east1 --project line-vertex`) is **not** a task in this plan — it requires explicit user confirmation each time per this project's established workflow, and should be done by the orchestrating session after all tasks pass and Task 5 Step 4's manual check looks good, not delegated to a subagent.
