/**
 * FeedFlow - Main Application
 * RSS Reader inspired by Feedly Classic
 */

import * as Store from './store.js';
import * as API from './api.js';
import { t } from './i18n.js';

// ─── DOM References ─────────────────────────────────

const $ = id => document.getElementById(id);
const $$ = sel => document.querySelectorAll(sel);

const DOM = {
  overlay: $('overlay'),
  sidebar: $('sidebar'),
  mainContent: $('mainContent'),
  menuBtn: $('menuBtn'),
  currentViewTitle: $('currentViewTitle'),
  viewModeBtn: $('viewModeBtn'),
  viewModeDropdown: $('viewModeDropdown'),
  markAllReadBtn: $('markAllReadBtn'),
  refreshBtn: $('refreshBtn'),
  settingsBtn: $('settingsBtn'),
  articlesContainer: $('articlesContainer'),
  articlesList: $('articlesList'),
  loadingState: $('loadingState'),
  emptyState: $('emptyState'),
  noArticlesState: $('noArticlesState'),
  articleReader: $('articleReader'),
  readerContent: $('readerContent'),
  readerBackBtn: $('readerBackBtn'),
  readerOpenBtn: $('readerOpenBtn'),
  readerSource: $('readerSource'),
  // Sidebar
  navAll: $('navAll'),
  navToday: $('navToday'),
  allCount: $('allCount'),
  todayCount: $('todayCount'),
  foldersList: $('foldersList'),
  uncategorizedSection: $('uncategorizedSection'),
  uncategorizedList: $('uncategorizedList'),
  addFolderBtn: $('addFolderBtn'),
  addFeedBtnSidebar: $('addFeedBtnSidebar'),
  addFeedBtnEmpty: $('addFeedBtnEmpty'),
  // Add Feed Modal
  addFeedModal: $('addFeedModal'),
  closeAddFeedModal: $('closeAddFeedModal'),
  feedUrlInput: $('feedUrlInput'),
  discoverFeedBtn: $('discoverFeedBtn'),
  feedDiscoveryResults: $('feedDiscoveryResults'),
  feedPreview: $('feedPreview'),
  folderSelectGroup: $('folderSelectGroup'),
  folderSelect: $('folderSelect'),
  addFeedFooter: $('addFeedFooter'),
  cancelAddFeed: $('cancelAddFeed'),
  confirmAddFeed: $('confirmAddFeed'),
  // Add Folder Modal
  addFolderModal: $('addFolderModal'),
  closeAddFolderModal: $('closeAddFolderModal'),
  folderNameInput: $('folderNameInput'),
  cancelAddFolder: $('cancelAddFolder'),
  confirmAddFolder: $('confirmAddFolder'),
  // Settings Modal
  settingsModal: $('settingsModal'),
  closeSettingsModal: $('closeSettingsModal'),
  cancelSettings: $('cancelSettings'),
  confirmSettings: $('confirmSettings'),
  uiLanguageSelect: $('uiLanguageSelect'),
  targetLanguageSelect: $('targetLanguageSelect'),
  userIdDisplay: $('userIdDisplay'),
  // Confirm Modal
  confirmModal: $('confirmModal'),
  confirmTitle: $('confirmTitle'),
  confirmMessage: $('confirmMessage'),
  confirmCancel: $('confirmCancel'),
  confirmOk: $('confirmOk'),
  // Toast
  toastContainer: $('toastContainer'),
};

// ─── App State ──────────────────────────────────────

const state = {
  currentView: 'all',        // 'all', 'today', 'folder:{id}', 'feed:{id}'
  currentArticle: null,
  isRefreshing: false,
  pendingFeedUrl: null,       // For add-feed flow
  pendingFeedData: null,
};

// ─── Initialization ─────────────────────────────────

async function init() {
  const userId = Store.getUserId();
  bindEvents();
  applyViewMode();
  applyUiTranslations();

  renderSidebar();
  loadCurrentView();

  // Async Firestore multi-user sync in background
  try {
    const remoteData = await API.fetchUserData(userId);
    if (remoteData && remoteData.storage === 'firestore') {
      Store.syncWithFirestore(remoteData);
      applyUiTranslations();
      renderSidebar();
      loadCurrentView();
    }
  } catch (err) {
    console.warn('Firestore background sync note:', err.message);
  }
}

// ─── Event Binding ──────────────────────────────────

function bindEvents() {
  // Sidebar toggle
  DOM.menuBtn.addEventListener('click', toggleSidebar);
  DOM.overlay.addEventListener('click', closeSidebar);

  // Navigation
  DOM.navAll.addEventListener('click', () => navigateTo('all'));
  DOM.navToday.addEventListener('click', () => navigateTo('today'));

  // View mode
  DOM.viewModeBtn.addEventListener('click', toggleViewDropdown);
  document.addEventListener('click', (e) => {
    if (!DOM.viewModeDropdown.contains(e.target) && e.target !== DOM.viewModeBtn && !DOM.viewModeBtn.contains(e.target)) {
      DOM.viewModeDropdown.classList.add('hidden');
    }
  });
  $$('[data-view-mode]').forEach(btn => {
    btn.addEventListener('click', () => {
      setViewMode(btn.dataset.viewMode);
      DOM.viewModeDropdown.classList.add('hidden');
    });
  });

  // Actions
  DOM.markAllReadBtn.addEventListener('click', markAllAsRead);
  DOM.refreshBtn.addEventListener('click', refreshFeeds);
  DOM.settingsBtn.addEventListener('click', openSettingsModal);

  // Settings Modal
  DOM.closeSettingsModal.addEventListener('click', closeSettingsModal);
  DOM.cancelSettings.addEventListener('click', closeSettingsModal);
  DOM.confirmSettings.addEventListener('click', handleConfirmSettings);
  DOM.settingsModal.querySelector('.modal-backdrop').addEventListener('click', closeSettingsModal);

  // Article reader
  DOM.readerBackBtn.addEventListener('click', closeReader);
  DOM.readerOpenBtn.addEventListener('click', () => {
    if (state.currentArticle?.link) {
      window.open(state.currentArticle.link, '_blank');
    }
  });

  // Add Feed
  DOM.addFeedBtnSidebar.addEventListener('click', openAddFeedModal);
  DOM.addFeedBtnEmpty.addEventListener('click', openAddFeedModal);
  DOM.closeAddFeedModal.addEventListener('click', closeAddFeedModal);
  DOM.discoverFeedBtn.addEventListener('click', handleDiscoverFeed);
  DOM.cancelAddFeed.addEventListener('click', closeAddFeedModal);
  DOM.confirmAddFeed.addEventListener('click', handleConfirmAddFeed);
  DOM.feedUrlInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleDiscoverFeed();
  });

  // Add Folder
  DOM.addFolderBtn.addEventListener('click', openAddFolderModal);
  DOM.closeAddFolderModal.addEventListener('click', closeAddFolderModal);
  DOM.cancelAddFolder.addEventListener('click', closeAddFolderModal);
  DOM.confirmAddFolder.addEventListener('click', handleConfirmAddFolder);
  DOM.folderNameInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') handleConfirmAddFolder();
  });

  // Modal backdrop clicks
  DOM.addFeedModal.querySelector('.modal-backdrop').addEventListener('click', closeAddFeedModal);
  DOM.addFolderModal.querySelector('.modal-backdrop').addEventListener('click', closeAddFolderModal);
  DOM.confirmModal.querySelector('.modal-backdrop').addEventListener('click', closeConfirmModal);
  DOM.confirmCancel.addEventListener('click', closeConfirmModal);

  // Swipe back gesture for reader
  let touchStartX = 0;
  DOM.articleReader.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
  }, { passive: true });
  DOM.articleReader.addEventListener('touchend', (e) => {
    const diff = e.changedTouches[0].clientX - touchStartX;
    if (diff > 80 && touchStartX < 50) { // Swipe right from left edge
      closeReader();
    }
  }, { passive: true });
}

// ─── Settings Modal & UI Translation ────────────────

function applyUiTranslations() {
  const settings = Store.getSettings();
  const lang = settings.uiLanguage || 'zh-TW';

  if (DOM.navAll) DOM.navAll.querySelector('.nav-label').textContent = t('allArticles', lang);
  if (DOM.navToday) DOM.navToday.querySelector('.nav-label').textContent = t('today', lang);
  
  const foldersHeader = $('foldersSection')?.querySelector('.nav-section-header span');
  if (foldersHeader) foldersHeader.textContent = t('folders', lang);

  const feedsHeader = $('uncategorizedSection')?.querySelector('.nav-section-header span');
  if (feedsHeader) feedsHeader.textContent = t('feeds', lang);

  if (DOM.addFeedBtnSidebar) DOM.addFeedBtnSidebar.querySelector('span').textContent = t('addFeed', lang);
  if (DOM.addFeedBtnEmpty) DOM.addFeedBtnEmpty.querySelector('span').textContent = t('addFeed', lang);

  const settingsTitle = $('settingsModalTitle');
  if (settingsTitle) settingsTitle.textContent = t('settingsTitle', lang);

  if ($('lblUiLanguage')) $('lblUiLanguage').textContent = t('uiLanguage', lang);
  if ($('lblTargetLanguage')) $('lblTargetLanguage').textContent = t('targetLanguage', lang);

  if (DOM.cancelSettings) DOM.cancelSettings.textContent = t('cancel', lang);
  if (DOM.confirmSettings) DOM.confirmSettings.textContent = t('save', lang);
}

function openSettingsModal() {
  const settings = Store.getSettings();
  const userId = Store.getUserId();

  DOM.userIdDisplay.textContent = `User ID: ${userId}`;
  DOM.uiLanguageSelect.value = settings.uiLanguage || 'zh-TW';
  DOM.targetLanguageSelect.value = settings.targetLanguage || 'zh-TW';

  DOM.settingsModal.classList.remove('hidden');
}

function closeSettingsModal() {
  DOM.settingsModal.classList.add('hidden');
}

async function handleConfirmSettings() {
  const uiLanguage = DOM.uiLanguageSelect.value;
  const targetLanguage = DOM.targetLanguageSelect.value;
  const userId = Store.getUserId();

  const newSettings = Store.updateSettings({ uiLanguage, targetLanguage });

  // Sync to Firestore
  API.saveUserSettings(userId, newSettings).catch(err => console.warn('Firestore settings save error:', err));

  closeSettingsModal();
  applyUiTranslations();
  renderSidebar();
  loadCurrentView();

  showToast(t('settingsTitle', uiLanguage) + ' ' + t('save', uiLanguage), 'success');
}

// ─── Sidebar ────────────────────────────────────────

function toggleSidebar() {
  DOM.sidebar.classList.toggle('open');
  DOM.overlay.classList.toggle('active');
  document.body.style.overflow = DOM.sidebar.classList.contains('open') ? 'hidden' : '';
}

function closeSidebar() {
  DOM.sidebar.classList.remove('open');
  DOM.overlay.classList.remove('active');
  document.body.style.overflow = '';
}

function renderSidebar() {
  const folders = Store.getFolders();
  const feeds = Store.getFeeds();
  const readSet = Store.getReadSet();
  const allArticles = Store.getAllArticles();
  const todayArticles = Store.getTodayArticles();

  // Update counts
  const allUnread = allArticles.filter(a => !readSet.has(a.id)).length;
  const todayUnread = todayArticles.filter(a => !readSet.has(a.id)).length;
  DOM.allCount.textContent = allUnread || '';
  DOM.todayCount.textContent = todayUnread || '';

  // Render folders
  let foldersHtml = '';
  for (const folder of folders) {
    const folderFeeds = feeds.filter(f => f.folderId === folder.id);
    const folderArticles = Store.getArticlesForFolder(folder.id);
    const folderUnread = folderArticles.filter(a => !readSet.has(a.id)).length;

    foldersHtml += `
      <div class="folder-group" data-folder-id="${folder.id}">
        <button class="nav-item folder-item ${state.currentView === 'folder:' + folder.id ? 'active' : ''}"
                data-view="folder:${folder.id}">
          <span class="nav-icon">📁</span>
          <span class="nav-label">${escHtml(folder.name)}</span>
          <span class="nav-badge">${folderUnread || ''}</span>
          <button class="icon-btn icon-btn-xs folder-toggle" data-folder-id="${folder.id}" title="Toggle">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 12 15 18 9"/></svg>
          </button>
        </button>
        <div class="folder-feeds" id="folderFeeds_${folder.id}">
          ${folderFeeds.map(feed => renderFeedNavItem(feed, readSet)).join('')}
        </div>
      </div>`;
  }
  DOM.foldersList.innerHTML = foldersHtml;

  // Render uncategorized feeds
  const uncategorized = feeds.filter(f => !f.folderId);
  if (uncategorized.length > 0) {
    DOM.uncategorizedSection.style.display = '';
    DOM.uncategorizedList.innerHTML = uncategorized.map(f => renderFeedNavItem(f, readSet)).join('');
  } else {
    DOM.uncategorizedSection.style.display = 'none';
  }

  // Bind folder click events
  DOM.foldersList.querySelectorAll('[data-view^="folder:"]').forEach(el => {
    el.addEventListener('click', (e) => {
      // Don't navigate if clicking toggle button
      if (e.target.closest('.folder-toggle')) return;
      navigateTo(el.dataset.view);
    });
  });

  // Bind folder toggle
  DOM.foldersList.querySelectorAll('.folder-toggle').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const folderId = btn.dataset.folderId;
      const feedsEl = $('folderFeeds_' + folderId);
      if (feedsEl) feedsEl.classList.toggle('collapsed');
      btn.classList.toggle('rotated');
    });
  });

  // Bind feed click events
  document.querySelectorAll('[data-view^="feed:"]').forEach(el => {
    el.addEventListener('click', (e) => {
      if (e.target.closest('.feed-delete-btn')) return;
      navigateTo(el.dataset.view);
    });
  });

  // Bind feed delete
  document.querySelectorAll('.feed-delete-btn').forEach(btn => {
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      const feedId = btn.dataset.feedId;
      const feed = Store.getFeed(feedId);
      showConfirm(`Remove "${feed?.title || 'this feed'}"?`, 'This will remove the feed and its cached articles.', () => {
        Store.removeFeed(feedId);
        renderSidebar();
        if (state.currentView === 'feed:' + feedId) navigateTo('all');
        showToast('Feed removed', 'info');
      });
    });
  });

  // Bind folder long-press / context for delete
  DOM.foldersList.querySelectorAll('.folder-item').forEach(el => {
    el.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      const folderId = el.dataset.view.replace('folder:', '');
      const folder = Store.getFolders().find(f => f.id === folderId);
      showConfirm(`Delete folder "${folder?.name}"?`, 'Feeds will be moved to uncategorized.', () => {
        Store.deleteFolder(folderId);
        renderSidebar();
        if (state.currentView === 'folder:' + folderId) navigateTo('all');
        showToast('Folder deleted', 'info');
      });
    });
  });

  // Update active state
  updateActiveNav();
}

function renderFeedNavItem(feed, readSet) {
  const articles = Store.getArticlesForFeed(feed.id);
  const unread = articles.filter(a => !readSet.has(a.id)).length;
  const favicon = feed.favicon || API.getFaviconUrl(feed.siteUrl || feed.url);

  return `
    <button class="nav-item feed-nav-item ${state.currentView === 'feed:' + feed.id ? 'active' : ''}"
            data-view="feed:${feed.id}">
      <img class="feed-favicon" src="${escAttr(favicon)}" alt="" loading="lazy"
           onerror="this.style.display='none'">
      <span class="nav-label">${escHtml(feed.title)}</span>
      <span class="nav-badge">${unread || ''}</span>
      <button class="icon-btn icon-btn-xs feed-delete-btn" data-feed-id="${feed.id}" title="Remove">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
      </button>
    </button>`;
}

function updateActiveNav() {
  document.querySelectorAll('.nav-item').forEach(el => {
    el.classList.toggle('active', el.dataset.view === state.currentView);
  });
}

// ─── Navigation ─────────────────────────────────────

function navigateTo(view) {
  state.currentView = view;
  closeSidebar();
  updateActiveNav();
  loadCurrentView();
}

function loadCurrentView() {
  const view = state.currentView;
  let articles = [];
  let title = 'All Articles';

  if (view === 'all') {
    articles = Store.getAllArticles();
    title = 'All Articles';
  } else if (view === 'today') {
    articles = Store.getTodayArticles();
    title = 'Today';
  } else if (view.startsWith('folder:')) {
    const folderId = view.replace('folder:', '');
    const folder = Store.getFolders().find(f => f.id === folderId);
    articles = Store.getArticlesForFolder(folderId);
    title = folder?.name || 'Folder';
  } else if (view.startsWith('feed:')) {
    const feedId = view.replace('feed:', '');
    const feed = Store.getFeed(feedId);
    const rawArticles = Store.getArticlesForFeed(feedId);
    articles = rawArticles.map(a => ({
      ...a,
      feedId,
      feedTitle: feed?.title || '',
      feedFavicon: feed?.favicon || API.getFaviconUrl(feed?.siteUrl || feed?.url || ''),
    }));
    title = feed?.title || 'Feed';
  }

  DOM.currentViewTitle.textContent = title;
  renderArticles(articles);
  renderSidebar(); // Update counts
}

// ─── Article Rendering ─────────────────────────────

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
}

function renderArticleCard(article, viewMode, isRead) {
  const timeAgo = formatTimeAgo(article.pubDate);
  const readClass = isRead ? 'read' : '';
  const favicon = article.feedFavicon || '';
  const langBadge = (article.isTraditionalChinese === false && article.languageName)
    ? `<span class="lang-badge">${escHtml(article.languageName)}</span>`
    : '';

  const translation = Store.getTranslation(article.id);
  const displayTitle = translation ? translation.translatedTitle : article.title;
  const displaySnippet = translation ? truncate(stripHtml(translation.translatedContent), 120) : truncate(stripHtml(article.summary || article.content), 120);
  const translatedBadge = translation ? `<span class="translated-badge">✨ 繁中</span>` : '';

  switch (viewMode) {
    case 'magazine':
      return `
        <div class="article-card ${readClass}" data-article-id="${escAttr(article.id)}">
          <div class="article-content">
            <h3 class="article-title">${escHtml(displayTitle)}</h3>
            <p class="article-snippet">${escHtml(displaySnippet)}</p>
            <div class="article-meta">
              ${favicon ? `<img class="article-meta-favicon" src="${escAttr(favicon)}" alt="" onerror="this.style.display='none'" style="width:16px;height:16px;border-radius:2px;">` : ''}
              <span class="article-source">${escHtml(article.feedTitle || '')}</span>
              <span class="article-time">${timeAgo}</span>
              ${langBadge}
              ${translatedBadge}
            </div>
          </div>
          ${article.thumbnail ? `<img class="article-thumbnail" src="${escAttr(article.thumbnail)}" alt="" loading="lazy" onerror="this.style.display='none'">` : ''}
        </div>`;

    case 'list':
      return `
        <div class="article-card ${readClass}" data-article-id="${escAttr(article.id)}">
          ${favicon ? `<img class="article-favicon" src="${escAttr(favicon)}" alt="" onerror="this.style.display='none'">` : ''}
          <span class="article-title">${escHtml(displayTitle)}</span>
          ${langBadge}
          <span class="article-date">${timeAgo}</span>
        </div>`;

    case 'title':
      return `
        <div class="article-card ${readClass}" data-article-id="${escAttr(article.id)}">
          <span class="article-title">${escHtml(displayTitle)}</span>
          ${langBadge}
        </div>`;

    case 'cards':
      return `
        <div class="article-card ${readClass}" data-article-id="${escAttr(article.id)}">
          ${article.thumbnail ? `
            <div class="article-thumbnail-wrapper">
              <img class="article-thumbnail" src="${escAttr(article.thumbnail)}" alt="" loading="lazy" onerror="this.parentElement.style.display='none'">
            </div>` : ''}
          <div class="article-content">
            <h3 class="article-title">${escHtml(displayTitle)}</h3>
            <p class="article-snippet">${escHtml(displaySnippet)}</p>
            <div class="article-meta">
              ${favicon ? `<img class="article-meta-favicon" src="${escAttr(favicon)}" alt="" onerror="this.style.display='none'" style="width:16px;height:16px;border-radius:2px;">` : ''}
              <span class="article-source">${escHtml(article.feedTitle || '')}</span>
              <span class="article-time">${timeAgo}</span>
              ${langBadge}
              ${translatedBadge}
            </div>
          </div>
        </div>`;

    default:
      return '';
  }
}

// ─── View Mode ──────────────────────────────────────

function toggleViewDropdown() {
  DOM.viewModeDropdown.classList.toggle('hidden');
}

function setViewMode(mode) {
  Store.updateSettings({ viewMode: mode });
  applyViewMode();
  loadCurrentView();
}

function applyViewMode() {
  const { viewMode } = Store.getSettings();
  $$('[data-view-mode]').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.viewMode === viewMode);
  });
}

// ─── Article Reader ─────────────────────────────────

async function openArticle(article) {
  state.currentArticle = article;

  // Mark as read
  Store.markAsRead(article.id);

  // Update the card in the list
  const card = DOM.articlesList.querySelector(`[data-article-id="${CSS.escape(article.id)}"]`);
  if (card) card.classList.add('read');

  const pubDate = new Date(article.pubDate);
  const dateStr = pubDate.toLocaleDateString('zh-TW', {
    year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });

  DOM.readerSource.textContent = article.feedTitle || '';

  const isNonTraditionalChinese = article.isTraditionalChinese === false;
  let showingTranslation = isNonTraditionalChinese;
  let translation = Store.getTranslation(article.id);

  function renderReaderBody() {
    const titleToUse = (showingTranslation && translation) ? translation.translatedTitle : article.title;
    const bodyToUse = (showingTranslation && translation) ? translation.translatedContent : (article.content || article.summary || '<p>No content available.</p>');

    let toggleBtnHtml = '';
    if (isNonTraditionalChinese) {
      if (showingTranslation && translation) {
        toggleBtnHtml = `<button class="lang-toggle-btn" id="langToggleBtn">🌐 顯示原文 (${escHtml(article.languageName || '外文')})</button>`;
      } else if (!showingTranslation && translation) {
        toggleBtnHtml = `<button class="lang-toggle-btn" id="langToggleBtn">✨ 顯示 Gemini 繁中翻譯</button>`;
      } else {
        toggleBtnHtml = `<button class="lang-toggle-btn" id="langToggleBtn">✨ 正在使用 Gemini 翻譯成繁中...</button>`;
      }
    }

    DOM.readerContent.innerHTML = `
      <div class="reader-meta">
        <h1 class="title">${escHtml(titleToUse)}</h1>
        <div class="details">
          ${isNonTraditionalChinese ? `<span class="lang-badge">${escHtml(article.languageName || '外文')}</span>` : ''}
          ${(showingTranslation && translation) ? `<span class="translated-badge">✨ Gemini 繁中</span>` : ''}
          ${article.author ? `<span>${escHtml(article.author)}</span>` : ''}
          <span>${dateStr}</span>
          ${article.feedTitle ? `<span class="source">${escHtml(article.feedTitle)}</span>` : ''}
          ${toggleBtnHtml}
        </div>
      </div>
      <div class="reader-body">
        ${bodyToUse}
      </div>
      <div class="reader-footer">
        <a href="${escAttr(article.link)}" target="_blank" rel="noopener noreferrer" class="btn btn-secondary reader-open-link">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
          Open in Browser
        </a>
      </div>`;

    DOM.readerContent.querySelectorAll('.reader-body a').forEach(a => {
      a.setAttribute('target', '_blank');
      a.setAttribute('rel', 'noopener noreferrer');
    });

    const toggleBtn = $('langToggleBtn');
    if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
        showingTranslation = !showingTranslation;
        renderReaderBody();
      });
    }
  }

  // Initial render
  renderReaderBody();

  // Show reader
  DOM.articleReader.classList.add('open');
  document.body.style.overflow = 'hidden';
  DOM.articleReader.scrollTop = 0;

  // Update sidebar counts
  renderSidebar();

  // Auto-fetch translation if non-Traditional Chinese and not translated yet
  if (isNonTraditionalChinese && !translation) {
    try {
      const targetLang = Store.getSettings().targetLanguage || 'zh-TW';
      const res = await API.translateArticle(article.title, article.content || article.summary, article.languageName, targetLang);
      if (res && res.translatedTitle) {
        translation = {
          translatedTitle: res.translatedTitle,
          translatedContent: res.translatedContent
        };
        Store.saveTranslation(article.id, translation);
        if (state.currentArticle?.id === article.id) {
          renderReaderBody();
          loadCurrentView();
        }
      }
    } catch (err) {
      console.warn('Translation failed or GEMINI_API_KEY missing:', err.message);
      const toggleBtn = $('langToggleBtn');
      if (toggleBtn) {
        toggleBtn.textContent = `⚠️ 翻譯失敗 (點擊重試)`;
        toggleBtn.onclick = () => openArticle(article);
      }
    }
  }
}

function closeReader() {
  DOM.articleReader.classList.remove('open');
  document.body.style.overflow = '';
  state.currentArticle = null;
}

// ─── Feed Management ────────────────────────────────

function openAddFeedModal() {
  closeSidebar();
  DOM.addFeedModal.classList.remove('hidden');
  DOM.feedUrlInput.value = '';
  DOM.feedDiscoveryResults.classList.add('hidden');
  DOM.feedPreview.classList.add('hidden');
  DOM.folderSelectGroup.style.display = 'none';
  DOM.addFeedFooter.style.display = 'none';
  state.pendingFeedUrl = null;
  state.pendingFeedData = null;
  populateFolderSelect();
  setTimeout(() => DOM.feedUrlInput.focus(), 100);
}

function closeAddFeedModal() {
  DOM.addFeedModal.classList.add('hidden');
  state.pendingFeedUrl = null;
  state.pendingFeedData = null;
}

function populateFolderSelect() {
  const folders = Store.getFolders();
  DOM.folderSelect.innerHTML = '<option value="">— No Folder —</option>' +
    folders.map(f => `<option value="${escAttr(f.id)}">${escHtml(f.name)}</option>`).join('');
}

async function handleDiscoverFeed() {
  const url = DOM.feedUrlInput.value.trim();
  if (!url) return;

  DOM.discoverFeedBtn.disabled = true;
  DOM.discoverFeedBtn.textContent = '...';
  DOM.feedDiscoveryResults.classList.add('hidden');
  DOM.feedPreview.classList.add('hidden');
  DOM.addFeedFooter.style.display = 'none';

  try {
    const result = await API.discoverFeed(url);

    if (result.feeds && result.feeds.length > 0) {
      if (result.feeds.length === 1) {
        // Single feed found, show preview directly
        await previewFeed(result.feeds[0].url);
      } else {
        // Multiple feeds found, show selection
        showDiscoveryResults(result.feeds);
      }
    } else {
      showToast('No RSS feeds found at this URL', 'error');
    }
  } catch (error) {
    showToast(`Error: ${error.message}`, 'error');
  } finally {
    DOM.discoverFeedBtn.disabled = false;
    DOM.discoverFeedBtn.textContent = 'Search';
  }
}

function showDiscoveryResults(feeds) {
  DOM.feedDiscoveryResults.innerHTML = `
    <p class="discovery-label">Found ${feeds.length} feeds:</p>
    ${feeds.map(f => `
      <button class="discovery-item" data-feed-url="${escAttr(f.url)}">
        <span class="discovery-item-title">${escHtml(f.title)}</span>
        <span class="discovery-item-url">${escHtml(f.url)}</span>
      </button>`).join('')}`;
  DOM.feedDiscoveryResults.classList.remove('hidden');

  DOM.feedDiscoveryResults.querySelectorAll('.discovery-item').forEach(item => {
    item.addEventListener('click', () => previewFeed(item.dataset.feedUrl));
  });
}

async function previewFeed(feedUrl) {
  DOM.feedPreview.innerHTML = '<div class="spinner spinner-sm"></div>';
  DOM.feedPreview.classList.remove('hidden');
  DOM.feedDiscoveryResults.classList.add('hidden');

  try {
    const feedData = await API.parseFeed(feedUrl);
    state.pendingFeedUrl = feedUrl;
    state.pendingFeedData = feedData;

    const settings = Store.getSettings();
    const targetLang = settings.targetLanguage || 'zh-TW';

    let displayTitle = feedData.title;
    let displayDesc = feedData.description || '';

    // If feed preview is in foreign language, translate preview using Gemini 2.5 Flash
    if (displayTitle || displayDesc) {
      try {
        const transRes = await API.translateArticle(displayTitle, displayDesc, 'Feed Preview', targetLang);
        if (transRes && transRes.translatedTitle) {
          displayTitle = `${transRes.translatedTitle} (${feedData.title})`;
          displayDesc = transRes.translatedContent || displayDesc;
        }
      } catch (err) {
        console.warn('Feed preview translation skipped:', err.message);
      }
    }

    const itemCount = feedData.items?.length || 0;
    DOM.feedPreview.innerHTML = `
      <div class="feed-preview-card">
        <div class="feed-preview-header">
          <img class="feed-preview-favicon" src="${escAttr(API.getFaviconUrl(feedData.link || feedUrl))}"
               alt="" onerror="this.style.display='none'">
          <div>
            <h3 class="feed-preview-title">${escHtml(displayTitle)}</h3>
            <p class="feed-preview-desc">${escHtml(truncate(displayDesc, 120))}</p>
          </div>
        </div>
        <div class="feed-preview-stats">
          <span>${itemCount} articles</span>
          <span>${escHtml(feedUrl)}</span>
        </div>
      </div>`;

    DOM.folderSelectGroup.style.display = '';
    DOM.addFeedFooter.style.display = '';
  } catch (error) {
    DOM.feedPreview.innerHTML = `<p class="error-text">Failed to load feed: ${escHtml(error.message)}</p>`;
    showToast('Failed to parse feed', 'error');
  }
}

async function handleConfirmAddFeed() {
  if (!state.pendingFeedUrl || !state.pendingFeedData) return;

  const feedData = state.pendingFeedData;
  const folderId = DOM.folderSelect.value;
  const userId = Store.getUserId();

  const feed = Store.addFeed({
    title: feedData.title,
    url: state.pendingFeedUrl,
    siteUrl: feedData.link,
    description: feedData.description,
    image: feedData.image,
    folderId,
    favicon: API.getFaviconUrl(feedData.link || state.pendingFeedUrl),
  });

  if (!feed) {
    showToast('Already subscribed to this feed', 'error');
    return;
  }

  // Save articles locally
  if (feedData.items?.length > 0) {
    Store.saveArticlesForFeed(feed.id, feedData.items);
  }

  Store.updateFeed(feed.id, { lastFetchedAt: Date.now() });

  // Sync to Firestore multi-user DB
  API.saveUserSubscription(userId, feed, 'save').catch(err => console.warn('Firestore sub sync error:', err));

  closeAddFeedModal();
  renderSidebar();
  loadCurrentView();
  
  const lang = Store.getSettings().uiLanguage || 'zh-TW';
  showToast(t('subscribedTo', lang) + ` "${feed.title}"`, 'success');
}

// ─── Folder Management ──────────────────────────────

function openAddFolderModal() {
  DOM.addFolderModal.classList.remove('hidden');
  DOM.folderNameInput.value = '';
  setTimeout(() => DOM.folderNameInput.focus(), 100);
}

function closeAddFolderModal() {
  DOM.addFolderModal.classList.add('hidden');
}

function handleConfirmAddFolder() {
  const name = DOM.folderNameInput.value.trim();
  const userId = Store.getUserId();
  const lang = Store.getSettings().uiLanguage || 'zh-TW';

  if (!name) {
    showToast(t('folderName', lang), 'error');
    return;
  }

  const folder = Store.createFolder(name);
  API.saveUserFolder(userId, folder, 'save').catch(err => console.warn('Firestore folder sync error:', err));

  closeAddFolderModal();
  renderSidebar();
  showToast(t('folderCreated', lang), 'success');
}

// ─── Mark All Read ──────────────────────────────────

function markAllAsRead() {
  let articles = [];
  const view = state.currentView;
  const userId = Store.getUserId();
  const lang = Store.getSettings().uiLanguage || 'zh-TW';

  if (view === 'all') {
    articles = Store.getAllArticles();
  } else if (view === 'today') {
    articles = Store.getTodayArticles();
  } else if (view.startsWith('folder:')) {
    const folderId = view.replace('folder:', '');
    articles = Store.getArticlesForFolder(folderId);
  } else if (view.startsWith('feed:')) {
    const feedId = view.replace('feed:', '');
    articles = Store.getArticlesForFeed(feedId);
  }

  if (articles.length === 0) return;

  const ids = articles.map(a => a.id);
  Store.markMultipleAsRead(ids);

  // Group read articles by feedId and sync read position / read states to Firestore
  const feeds = Store.getFeeds();
  feeds.forEach(feed => {
    const feedArticles = Store.getArticlesForFeed(feed.id);
    const readSet = Store.getReadSet();
    const readIds = feedArticles.filter(a => readSet.has(a.id)).map(a => a.id);
    const lastRead = feedArticles[0]?.id || '';
    if (readIds.length > 0) {
      API.saveUserReadState(userId, feed.id, lastRead, readIds).catch(err => console.warn('Firestore read state sync error:', err));
    }
  });

  renderSidebar();
  loadCurrentView();
  showToast(t('allMarkedRead', lang), 'success');
}

// ─── Refresh Feeds ──────────────────────────────────

async function refreshFeeds() {
  if (state.isRefreshing) return;
  state.isRefreshing = true;

  const feeds = Store.getFeeds();
  if (feeds.length === 0) {
    state.isRefreshing = false;
    return;
  }

  // Animate refresh button
  DOM.refreshBtn.classList.add('spinning');
  showToast('Refreshing feeds...', 'info');

  let successCount = 0;
  let errorCount = 0;

  for (const feed of feeds) {
    try {
      const feedData = await API.parseFeed(feed.url);
      if (feedData.items?.length > 0) {
        // Merge with existing articles (preserve read state by keeping IDs stable)
        const existing = Store.getArticlesForFeed(feed.id);
        const existingIds = new Set(existing.map(a => a.id));
        const newItems = feedData.items.filter(item => !existingIds.has(item.id));
        const merged = [...newItems, ...existing].slice(0, 200); // Keep max 200 per feed
        Store.saveArticlesForFeed(feed.id, merged);
      }
      Store.updateFeed(feed.id, { lastFetchedAt: Date.now() });
      successCount++;
    } catch {
      errorCount++;
    }
  }

  DOM.refreshBtn.classList.remove('spinning');
  state.isRefreshing = false;

  renderSidebar();
  loadCurrentView();

  if (errorCount > 0) {
    showToast(`Refreshed ${successCount} feeds (${errorCount} errors)`, 'warning');
  } else {
    showToast(`Refreshed ${successCount} feeds`, 'success');
  }
}

// ─── Confirm Dialog ─────────────────────────────────

let confirmCallback = null;

function showConfirm(title, message, onConfirm) {
  DOM.confirmTitle.textContent = title;
  DOM.confirmMessage.textContent = message;
  confirmCallback = onConfirm;
  DOM.confirmModal.classList.remove('hidden');
}

function closeConfirmModal() {
  DOM.confirmModal.classList.add('hidden');
  confirmCallback = null;
}

DOM.confirmOk.addEventListener('click', () => {
  if (confirmCallback) confirmCallback();
  closeConfirmModal();
});

// ─── Toast Notifications ────────────────────────────

function showToast(message, type = 'info') {
  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  toast.innerHTML = `
    <span class="toast-icon">${icons[type] || icons.info}</span>
    <span class="toast-message">${escHtml(message)}</span>`;

  DOM.toastContainer.appendChild(toast);

  // Trigger animation
  requestAnimationFrame(() => toast.classList.add('show'));

  // Auto-dismiss
  setTimeout(() => {
    toast.classList.remove('show');
    toast.addEventListener('transitionend', () => toast.remove());
  }, 3000);
}

// ─── Utility Functions ──────────────────────────────

function escHtml(str) {
  if (!str) return '';
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escAttr(str) {
  if (!str) return '';
  return str.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/'/g, '&#39;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function stripHtml(html) {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return div.textContent || div.innerText || '';
}

function truncate(str, maxLen) {
  if (!str) return '';
  if (str.length <= maxLen) return str;
  return str.slice(0, maxLen).trimEnd() + '…';
}

function formatTimeAgo(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return 'just now';
  if (diffMins < 60) return `${diffMins}m`;
  if (diffHours < 24) return `${diffHours}h`;
  if (diffDays < 7) return `${diffDays}d`;
  if (diffDays < 365) return date.toLocaleDateString('zh-TW', { month: 'short', day: 'numeric' });
  return date.toLocaleDateString('zh-TW', { year: 'numeric', month: 'short', day: 'numeric' });
}

// ─── Bootstrap ──────────────────────────────────────

document.addEventListener('DOMContentLoaded', init);
