/**
 * FeedAPI - Backend API communication layer
 */

const BASE = '';

async function request(endpoint, params = {}) {
  const url = new URL(endpoint, window.location.origin);
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok) {
    throw new Error(data.error || `Request failed (${res.status})`);
  }
  return data;
}

/**
 * Parse an RSS feed URL and return normalized feed data
 * @param {string} url - The RSS feed URL
 * @returns {Promise<{title, description, link, image, items[]}>}
 */
export async function parseFeed(url) {
  return request('/api/feed/parse', { url });
}

/**
 * Preview feed with Gemini translation
 */
export async function previewFeedApi(url, targetLanguage = 'zh-TW') {
  const res = await fetch('/api/feed/preview', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ url, targetLanguage })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Failed to preview feed');
  }
  return data;
}

/**
 * Discover RSS feeds from a website URL
 * @param {string} url - The website URL
 * @returns {Promise<{feeds: [{url, title, type}]}>}
 */
export async function discoverFeed(url) {
  return request('/api/feed/discover', { url });
}

/**
 * Get favicon URL for a website
 * @param {string} siteUrl - The website URL
 * @returns {string} favicon URL
 */
export function getFaviconUrl(siteUrl) {
  try {
    const hostname = new URL(siteUrl).hostname;
    return `https://www.google.com/s2/favicons?domain=${hostname}&sz=64`;
  } catch {
    return '';
  }
}

/**
 * Translate article title and content using Gemini 2.5 Flash
 * @param {string} title
 * @param {string} content
 * @param {string} languageName
 * @param {string} targetLanguage
 * @returns {Promise<{translatedTitle: string, translatedContent: string, languageName: string}>}
 */
export async function translateArticle(title, content, languageName, targetLanguage = 'zh-TW') {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, languageName, targetLanguage })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Translation failed');
  }
  return data;
}

// ─── Multi-User Firestore REST API Client ────────────

export async function fetchUserData(userId) {
  return request('/api/user/data', { userId });
}

export async function saveUserSettings(userId, settings) {
  const res = await fetch('/api/user/settings', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, settings })
  });
  return res.json();
}

export async function saveUserFolder(userId, folder, action = 'save') {
  const res = await fetch('/api/user/folder', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, folder, action })
  });
  return res.json();
}

export async function saveUserSubscription(userId, feed, action = 'save') {
  const res = await fetch('/api/user/subscription', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, feed, action })
  });
  return res.json();
}

export async function saveUserReadState(userId, feedId, lastReadArticleId, readArticleIds) {
  const res = await fetch('/api/user/read-state', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, feedId, lastReadArticleId, readArticleIds })
  });
  return res.json();
}
