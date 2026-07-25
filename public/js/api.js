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
 * Translate article title and content to Traditional Chinese via Gemini 2.5 Flash
 * @param {string} title
 * @param {string} content
 * @param {string} languageName
 * @returns {Promise<{translatedTitle: string, translatedContent: string, languageName: string}>}
 */
export async function translateArticle(title, content, languageName) {
  const res = await fetch('/api/translate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, content, languageName })
  });
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || 'Translation failed');
  }
  return data;
}
