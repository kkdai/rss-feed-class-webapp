/**
 * Store - localStorage persistence layer for FeedFlow
 * Manages folders, feeds, articles, read states, and settings
 */

const KEYS = {
  FOLDERS: 'ff_folders',
  FEEDS: 'ff_feeds',
  ARTICLES: 'ff_articles',
  READ: 'ff_read',
  SETTINGS: 'ff_settings',
  TRANSLATIONS: 'ff_translations',
  USER_ID: 'ff_user_id',
};

function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function getUserId() {
  try {
    const params = new URLSearchParams(window.location.search);
    if (params.has('userId')) {
      const paramUid = params.get('userId').trim();
      if (paramUid) {
        localStorage.setItem(KEYS.USER_ID, paramUid);
        return paramUid;
      }
    }
  } catch {}

  let userId = localStorage.getItem(KEYS.USER_ID);
  if (!userId) {
    userId = 'default-user';
    localStorage.setItem(KEYS.USER_ID, userId);
  }
  return userId;
}

export function setUserId(newUserId) {
  if (newUserId) {
    localStorage.setItem(KEYS.USER_ID, newUserId);
  }
}

function load(key, fallback) {
  try {
    const data = localStorage.getItem(key);
    return data ? JSON.parse(data) : fallback;
  } catch {
    return fallback;
  }
}

function save(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
}

// ── Folders ────────────────────────────────────────

export function getFolders() {
  return load(KEYS.FOLDERS, []);
}

export function createFolder(name) {
  const folders = getFolders();
  const folder = { id: uid(), name, order: folders.length, createdAt: Date.now() };
  folders.push(folder);
  save(KEYS.FOLDERS, folders);
  return folder;
}

export function renameFolder(id, name) {
  const folders = getFolders();
  const f = folders.find(f => f.id === id);
  if (f) f.name = name;
  save(KEYS.FOLDERS, folders);
}

export function deleteFolder(id) {
  const folders = getFolders().filter(f => f.id !== id);
  save(KEYS.FOLDERS, folders);
  // Move feeds in this folder to uncategorized
  const feeds = getFeeds();
  feeds.forEach(f => { if (f.folderId === id) f.folderId = ''; });
  save(KEYS.FEEDS, feeds);
}

// ── Feeds ──────────────────────────────────────────

export function getFeeds() {
  return load(KEYS.FEEDS, []);
}

export function getFeed(id) {
  return getFeeds().find(f => f.id === id);
}

export function addFeed(feedData) {
  const feeds = getFeeds();
  // Check if already subscribed
  if (feeds.some(f => f.url === feedData.url)) {
    return null; // Already exists
  }
  const feed = {
    id: uid(),
    title: feedData.title || 'Untitled Feed',
    url: feedData.url,
    siteUrl: feedData.siteUrl || feedData.link || '',
    description: feedData.description || '',
    folderId: feedData.folderId || '',
    favicon: feedData.favicon || '',
    image: feedData.image || '',
    addedAt: Date.now(),
    lastFetchedAt: null,
  };
  feeds.push(feed);
  save(KEYS.FEEDS, feeds);
  return feed;
}

export function updateFeed(id, updates) {
  const feeds = getFeeds();
  const idx = feeds.findIndex(f => f.id === id);
  if (idx >= 0) {
    feeds[idx] = { ...feeds[idx], ...updates };
    save(KEYS.FEEDS, feeds);
    return feeds[idx];
  }
  return null;
}

export function removeFeed(id) {
  const feeds = getFeeds().filter(f => f.id !== id);
  save(KEYS.FEEDS, feeds);
  // Also remove cached articles
  const articles = load(KEYS.ARTICLES, {});
  delete articles[id];
  save(KEYS.ARTICLES, articles);
}

export function moveFeedToFolder(feedId, folderId) {
  const feeds = getFeeds();
  const f = feeds.find(f => f.id === feedId);
  if (f) f.folderId = folderId;
  save(KEYS.FEEDS, feeds);
}

// ── Articles ───────────────────────────────────────

export function getArticlesForFeed(feedId) {
  const all = load(KEYS.ARTICLES, {});
  return all[feedId] || [];
}

export function saveArticlesForFeed(feedId, articles) {
  const all = load(KEYS.ARTICLES, {});
  all[feedId] = articles;
  save(KEYS.ARTICLES, all);
}

export function getAllArticles() {
  const all = load(KEYS.ARTICLES, {});
  const feeds = getFeeds();
  const result = [];
  for (const feed of feeds) {
    const articles = all[feed.id] || [];
    articles.forEach(a => {
      result.push({
        ...a,
        feedId: feed.id,
        feedTitle: feed.title,
        feedFavicon: feed.favicon,
      });
    });
  }
  // Sort by date descending
  result.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return result;
}

export function getArticlesForFolder(folderId) {
  const feeds = getFeeds().filter(f => f.folderId === folderId);
  const all = load(KEYS.ARTICLES, {});
  const result = [];
  for (const feed of feeds) {
    const articles = all[feed.id] || [];
    articles.forEach(a => {
      result.push({
        ...a,
        feedId: feed.id,
        feedTitle: feed.title,
        feedFavicon: feed.favicon,
      });
    });
  }
  result.sort((a, b) => new Date(b.pubDate) - new Date(a.pubDate));
  return result;
}

export function getTodayArticles() {
  const now = Date.now();
  const oneDayAgo = now - 24 * 60 * 60 * 1000;
  return getAllArticles().filter(a => new Date(a.pubDate).getTime() > oneDayAgo);
}

// ── Read State ─────────────────────────────────────

export function getReadSet() {
  return new Set(load(KEYS.READ, []));
}

export function isRead(articleId) {
  return getReadSet().has(articleId);
}

export function markAsRead(articleId) {
  const readSet = getReadSet();
  readSet.add(articleId);
  save(KEYS.READ, [...readSet]);
}

export function markMultipleAsRead(articleIds) {
  const readSet = getReadSet();
  articleIds.forEach(id => readSet.add(id));
  save(KEYS.READ, [...readSet]);
}

export function getUnreadCount(articles) {
  const readSet = getReadSet();
  return articles.filter(a => !readSet.has(a.id)).length;
}

// ── Settings ───────────────────────────────────────

const DEFAULT_SETTINGS = {
  viewMode: 'magazine', // magazine, list, title, cards
  density: 'comfortable', // comfortable, compact
  showReadArticles: true,
  markReadOnScroll: false,
  uiLanguage: 'zh-TW', // 'zh-TW', 'en', 'ja'
  targetLanguage: 'zh-TW', // 'zh-TW', 'en', 'ja'
};

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...load(KEYS.SETTINGS, {}) };
}

export function updateSettings(updates) {
  const settings = getSettings();
  Object.assign(settings, updates);
  save(KEYS.SETTINGS, settings);
  return settings;
}

// ── Utilities & Firestore Sync ──────────────────────

export function syncWithFirestore(userData) {
  if (!userData) return;
  if (userData.settings) {
    updateSettings(userData.settings);
  }
  if (userData.folders && userData.folders.length > 0) {
    save(KEYS.FOLDERS, userData.folders);
  }
  if (userData.feeds && userData.feeds.length > 0) {
    save(KEYS.FEEDS, userData.feeds);
  }
  if (userData.readStates) {
    const allReadIds = new Set(getReadSet());
    Object.values(userData.readStates).forEach(st => {
      if (st.readArticleIds && Array.isArray(st.readArticleIds)) {
        st.readArticleIds.forEach(id => allReadIds.add(id));
      }
    });
    save(KEYS.READ, [...allReadIds]);
  }
}

export function clearAllData() {
  Object.values(KEYS).forEach(k => localStorage.removeItem(k));
}

export { uid };

// ── Translations ───────────────────────────────────

export function getTranslation(articleId) {
  const all = load(KEYS.TRANSLATIONS, {});
  return all[articleId] || null;
}

export function saveTranslation(articleId, translationData) {
  const all = load(KEYS.TRANSLATIONS, {});
  all[articleId] = translationData;
  save(KEYS.TRANSLATIONS, all);
}
