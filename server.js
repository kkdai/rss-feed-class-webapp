import express from 'express';
import Parser from 'rss-parser';
import * as cheerio from 'cheerio';
import path from 'path';
import { fileURLToPath } from 'url';
import { Firestore } from '@google-cloud/firestore';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const app = express();
const PORT = process.env.PORT || 8080;
const REQUEST_TIMEOUT_MS = 10000;
const USER_AGENT = 'FeedFlow/1.0 (+https://github.com/feedflow/feedflow)';

// Initialize Firestore
let db = null;
try {
  db = new Firestore({
    projectId: process.env.GCP_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || 'line-vertex',
  });
  console.log('Firestore DB initialized successfully.');
} catch (err) {
  console.warn('Firestore DB initialization warning:', err.message);
}

const parser = new Parser({
  customFields: {
    item: [
      ['media:content', 'mediaContent', { keepArray: true }],
      ['media:thumbnail', 'mediaThumbnail', { keepArray: true }],
      ['enclosure', 'enclosure'],
      ['content:encoded', 'contentEncoded'],
      ['dc:creator', 'dcCreator']
    ]
  }
});

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

/**
 * Fetch helper with custom User-Agent and AbortController timeout (10s)
 */
async function fetchWithTimeout(urlStr, options = {}) {
  const { timeoutMs = REQUEST_TIMEOUT_MS, headers = {}, ...restOptions } = options;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(urlStr, {
      ...restOptions,
      headers: {
        'User-Agent': USER_AGENT,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,application/rss+xml;q=0.9,application/atom+xml;q=0.9,*/*;q=0.8',
        ...headers
      },
      signal: controller.signal
    });
    return response;
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new Error(`Request timed out after ${timeoutMs / 1000} seconds`);
    }
    throw err;
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Normalizes input URL string
 */
function normalizeUrl(inputUrl) {
  if (!inputUrl) return null;
  let str = inputUrl.trim();
  if (!/^https?:\/\//i.test(str)) {
    str = 'https://' + str;
  }
  try {
    return new URL(str).href;
  } catch {
    return null;
  }
}

/**
 * Extract thumbnail URL from an RSS item using fallback priority:
 * 1. media:content
 * 2. media:thumbnail
 * 3. enclosure (if image type or image extension)
 * 4. First <img> tag inside item content/description
 */
function extractThumbnail(item) {
  // 1. media:content
  if (item.mediaContent) {
    const list = Array.isArray(item.mediaContent) ? item.mediaContent : [item.mediaContent];
    for (const media of list) {
      if (!media) continue;
      if (typeof media === 'string' && /^https?:\/\//i.test(media)) return media;
      if (media.$ && media.$.url) {
        const medium = media.$.medium || '';
        const type = media.$.type || '';
        if (!medium || medium === 'image' || type.startsWith('image/')) {
          return media.$.url;
        }
      }
      if (media.url && /^https?:\/\//i.test(media.url)) return media.url;
    }
  }

  // 2. media:thumbnail
  if (item.mediaThumbnail) {
    const list = Array.isArray(item.mediaThumbnail) ? item.mediaThumbnail : [item.mediaThumbnail];
    for (const thumb of list) {
      if (!thumb) continue;
      if (typeof thumb === 'string' && /^https?:\/\//i.test(thumb)) return thumb;
      if (thumb.$ && thumb.$.url) return thumb.$.url;
      if (thumb.url && /^https?:\/\//i.test(thumb.url)) return thumb.url;
    }
  }

  // 3. enclosure
  if (item.enclosure) {
    const enc = item.enclosure;
    const url = enc.url || (enc.$ && enc.$.url);
    const type = enc.type || (enc.$ && enc.$.type) || '';
    if (url && (type.startsWith('image/') || /\.(jpg|jpeg|png|gif|webp|svg)(\?.*)?$/i.test(url))) {
      return url;
    }
  }

  // 4. First <img> tag in content / contentEncoded / description
  const htmlContent = item.contentEncoded || item['content:encoded'] || item.content || item.description || '';
  if (htmlContent) {
    try {
      const $ = cheerio.load(htmlContent);
      const firstImgSrc = $('img').first().attr('src');
      if (firstImgSrc && /^https?:\/\//i.test(firstImgSrc)) {
        return firstImgSrc;
      }
    } catch {
      const match = htmlContent.match(/<img[^>]+src=["']([^"']+)["']/i);
      if (match && /^https?:\/\//i.test(match[1])) {
        return match[1];
      }
    }
  }

  return '';
}

/**
 * Extract concise summary text from item properties
 */
function extractSummary(item) {
  if (item.summary && typeof item.summary === 'string' && item.summary.trim()) {
    return item.summary.trim();
  }
  if (item.contentSnippet && typeof item.contentSnippet === 'string' && item.contentSnippet.trim()) {
    return item.contentSnippet.trim();
  }
  const rawHtml = item.description || item.content || item.contentEncoded || '';
  if (rawHtml) {
    try {
      const $ = cheerio.load(rawHtml);
      return $.text().trim().substring(0, 300);
    } catch {
      return rawHtml.replace(/<[^>]+>/g, '').trim().substring(0, 300);
    }
  }
  return '';
}

/**
 * Helper to safely test parsing XML text into feed object
 */
async function tryParseFeed(xmlString) {
  try {
    const feed = await parser.parseString(xmlString);
    if (feed && (feed.title || (feed.items && feed.items.length > 0))) {
      return feed;
    }
  } catch {
    // Not valid feed XML
  }
  return null;
}

/**
 * Detect language of text
 */
function detectLanguage(title = '', text = '') {
  const sample = (title + ' ' + text).substring(0, 500);
  if (!sample.trim()) return { code: 'zh-TW', name: '繁體中文', isTraditionalChinese: true };

  // Check Japanese Kana (Hiragana / Katakana)
  if (/[\u3040-\u309F\u30A0-\u30FF]/.test(sample)) {
    return { code: 'ja', name: '日文', isTraditionalChinese: false };
  }

  // Check Korean Hangul
  if (/[\uAC00-\uD7AF\u1100-\u11FF]/.test(sample)) {
    return { code: 'ko', name: '韓文', isTraditionalChinese: false };
  }

  // Check CJK character count
  const cjkMatches = sample.match(/[\u4E00-\u9FA5]/g) || [];
  const totalLetters = sample.replace(/[\s\d\p{P}]/gu, '').length || 1;
  const cjkRatio = cjkMatches.length / totalLetters;

  if (cjkRatio < 0.15) {
    // English / Western language
    return { code: 'en', name: '英文', isTraditionalChinese: false };
  }

  // CJK text - distinguish Simplified Chinese vs Traditional Chinese
  const simplifiedChars = /[简体国广时为经体发关个来线对这动会与书产]/g;
  const traditionalChars = /[繁體國廣時為經體發關個來線對這動會與書產]/g;

  const simpCount = (sample.match(simplifiedChars) || []).length;
  const tradCount = (sample.match(traditionalChars) || []).length;

  if (simpCount > tradCount) {
    return { code: 'zh-CN', name: '簡體中文', isTraditionalChinese: false };
  }

  return { code: 'zh-TW', name: '繁體中文', isTraditionalChinese: true };
}

const LANG_TARGET_NAMES = {
  'zh-TW': 'Traditional Chinese (繁體中文)',
  'en': 'English',
  'ja': 'Japanese (日本語)'
};

/**
 * Translate title and content using Gemini 2.5 Flash
 */
async function translateTextWithGemini(textToTranslate, titleToTranslate, targetLang = 'zh-TW') {
  const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY is not set on the server.');
  }

  const targetLangName = LANG_TARGET_NAMES[targetLang] || 'Traditional Chinese (繁體中文)';

  const prompt = `You are a professional translator. Translate the following title and text into natural ${targetLangName}.
Return ONLY a valid JSON object with keys "translatedTitle" and "translatedContent". Preserve HTML structure in translatedContent if HTML tags exist. Do not wrap output in markdown code blocks.

Title to translate:
${titleToTranslate || ''}

Content to translate:
${textToTranslate || ''}`;

  const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${apiKey}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
      generationConfig: {
        responseMimeType: 'application/json',
      }
    })
  });

  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`Gemini API error ${response.status}: ${errText}`);
  }

  const data = await response.json();
  const rawJsonStr = data.candidates?.[0]?.content?.parts?.[0]?.text || '{}';
  return JSON.parse(rawJsonStr);
}

/**
 * POST /api/translate
 * Request body: { title, content, languageName, targetLanguage }
 */
app.post('/api/translate', async (req, res) => {
  const { title, content, languageName, targetLanguage } = req.body || {};
  try {
    const result = await translateTextWithGemini(content, title, targetLanguage || 'zh-TW');
    return res.json({
      translatedTitle: result.translatedTitle || title,
      translatedContent: result.translatedContent || content,
      languageName: languageName || '外文'
    });
  } catch (err) {
    console.error('Translation error:', err.message);
    return res.status(500).json({ error: err.message });
  }
});

// ─── Multi-User Firestore Endpoints ────────────────

/**
 * GET /api/user/data?userId=...
 */
app.get('/api/user/data', async (req, res) => {
  const userId = req.query.userId || req.headers['x-user-id'] || 'default-user';
  if (!db) {
    return res.json({ storage: 'local', userId });
  }

  try {
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();

    const foldersSnap = await userRef.collection('folders').get();
    const subsSnap = await userRef.collection('subscriptions').get();
    const readsSnap = await userRef.collection('read_states').get();

    const settings = userDoc.exists ? (userDoc.data().settings || {}) : {};
    const folders = foldersSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    const feeds = subsSnap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const readStates = {};
    readsSnap.docs.forEach(doc => {
      readStates[doc.id] = doc.data();
    });

    return res.json({
      storage: 'firestore',
      userId,
      settings,
      folders,
      feeds,
      readStates
    });
  } catch (err) {
    console.warn('Firestore user fetch failed, fallback to local:', err.message);
    return res.json({ storage: 'local', userId, error: err.message });
  }
});

/**
 * POST /api/user/settings
 */
app.post('/api/user/settings', async (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || 'default-user';
  const { settings } = req.body || {};

  if (db && settings) {
    try {
      await db.collection('users').doc(userId).set({
        settings,
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore settings update error:', err.message);
    }
  }

  return res.json({ success: true, settings });
});

/**
 * POST /api/user/folder
 */
app.post('/api/user/folder', async (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || 'default-user';
  const { folder, action } = req.body || {};

  if (db && folder && folder.id) {
    try {
      const ref = db.collection('users').doc(userId).collection('folders').doc(folder.id);
      if (action === 'delete') {
        await ref.delete();
      } else {
        await ref.set(folder, { merge: true });
      }
    } catch (err) {
      console.warn('Firestore folder write error:', err.message);
    }
  }

  return res.json({ success: true });
});

/**
 * POST /api/user/subscription
 */
app.post('/api/user/subscription', async (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || 'default-user';
  const { feed, action } = req.body || {};

  if (db && feed && feed.id) {
    try {
      const ref = db.collection('users').doc(userId).collection('subscriptions').doc(feed.id);
      if (action === 'delete') {
        await ref.delete();
      } else {
        await ref.set(feed, { merge: true });
      }
    } catch (err) {
      console.warn('Firestore subscription write error:', err.message);
    }
  }

  return res.json({ success: true });
});

/**
 * POST /api/user/read-state
 */
app.post('/api/user/read-state', async (req, res) => {
  const userId = req.body.userId || req.headers['x-user-id'] || 'default-user';
  const { feedId, lastReadArticleId, readArticleIds } = req.body || {};

  if (db && feedId) {
    try {
      const ref = db.collection('users').doc(userId).collection('read_states').doc(feedId);
      await ref.set({
        feedId,
        lastReadArticleId: lastReadArticleId || '',
        readArticleIds: readArticleIds || [],
        updatedAt: new Date().toISOString()
      }, { merge: true });
    } catch (err) {
      console.warn('Firestore read-state write error:', err.message);
    }
  }

  return res.json({ success: true });
});

/**
 * POST /api/feed/preview
 * Rich feed preview with Gemini translation for feed details & top sample items
 */
app.post('/api/feed/preview', async (req, res) => {
  const { url: rawUrl, targetLanguage = 'zh-TW' } = req.body || {};

  if (!rawUrl) {
    return res.status(400).json({ error: 'Query parameter "url" is required.' });
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({ error: 'Invalid URL format provided.' });
  }

  try {
    const response = await fetchWithTimeout(targetUrl);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch feed (HTTP ${response.status}: ${response.statusText})`
      });
    }

    const xmlData = await response.text();
    const feed = await parser.parseString(xmlData);

    const title = feed.title || 'Untitled Feed';
    const description = feed.description || feed.snippet || '';
    const sampleItems = (feed.items || []).slice(0, 3).map(item => {
      const itemTitle = item.title || 'Untitled';
      const itemSummary = extractSummary(item);
      const langInfo = detectLanguage(itemTitle, itemSummary);
      return {
        title: itemTitle,
        summary: itemSummary,
        pubDate: item.pubDate || item.isoDate || item.date || '',
        languageName: langInfo.name,
        isTraditionalChinese: langInfo.isTraditionalChinese
      };
    });

    let translatedTitle = title;
    let translatedDescription = description;
    let isTranslated = false;

    // Check if Gemini translation is available
    const apiKey = process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '';
    if (apiKey) {
      try {
        const transResult = await translateTextWithGemini(description, title, targetLanguage);
        if (transResult && transResult.translatedTitle) {
          translatedTitle = transResult.translatedTitle;
          translatedDescription = transResult.translatedContent || description;
          isTranslated = true;
        }
      } catch (err) {
        console.warn('Preview translation error:', err.message);
      }

      // Also translate sample item titles in parallel
      await Promise.allSettled(sampleItems.map(async (item) => {
        if (!item.isTraditionalChinese) {
          try {
            const itemTrans = await translateTextWithGemini('', item.title, targetLanguage);
            if (itemTrans && itemTrans.translatedTitle) {
              item.translatedTitle = itemTrans.translatedTitle;
            }
          } catch {
            // Ignore single item translation failure
          }
        }
      }));
    }

    return res.json({
      title,
      description,
      translatedTitle,
      translatedDescription,
      isTranslated,
      targetLanguage,
      link: feed.link || targetUrl,
      itemCount: feed.items?.length || 0,
      sampleArticles: sampleItems
    });
  } catch (err) {
    return res.status(500).json({ error: `Failed to preview feed: ${err.message}` });
  }
});

/**
 * GET /api/feed/parse?url=<url>
 */
app.get('/api/feed/parse', async (req, res) => {
  const { url: rawUrl } = req.query;

  if (!rawUrl) {
    return res.status(400).json({ error: 'Query parameter "url" is required.' });
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({ error: 'Invalid URL format provided.' });
  }

  try {
    const response = await fetchWithTimeout(targetUrl);
    if (!response.ok) {
      return res.status(response.status).json({
        error: `Failed to fetch feed (HTTP ${response.status}: ${response.statusText})`
      });
    }

    const xmlData = await response.text();
    const feed = await parser.parseString(xmlData);

    const normalizedFeed = {
      title: feed.title || '',
      description: feed.description || feed.snippet || '',
      link: feed.link || targetUrl,
      image: typeof feed.image === 'string' ? feed.image : (feed.image?.url || feed.itunes?.image || ''),
      items: (feed.items || []).map((item, idx) => {
        const categories = Array.isArray(item.categories)
          ? item.categories.map(c => typeof c === 'string' ? c : (c?._ || c?.name || '')).filter(Boolean)
          : [];

        const title = item.title || 'Untitled';
        const summary = extractSummary(item);
        const content = item.contentEncoded || item['content:encoded'] || item.content || item.description || '';
        const langInfo = detectLanguage(title, summary || content);

        return {
          id: item.guid || item.id || item.link || `item-${idx}-${Date.now()}`,
          title,
          link: item.link || '',
          content,
          summary,
          pubDate: item.pubDate || item.isoDate || item.date || '',
          author: item.creator || item.dcCreator || item.author || item['dc:creator'] || '',
          thumbnail: extractThumbnail(item),
          categories,
          languageCode: langInfo.code,
          languageName: langInfo.name,
          isTraditionalChinese: langInfo.isTraditionalChinese
        };
      })
    };

    return res.json(normalizedFeed);
  } catch (err) {
    return res.status(500).json({
      error: `Error parsing RSS feed: ${err.message}`
    });
  }
});

/**
 * GET /api/feed/discover?url=<url>
 */
app.get('/api/feed/discover', async (req, res) => {
  const { url: rawUrl } = req.query;

  if (!rawUrl) {
    return res.status(400).json({ error: 'Query parameter "url" is required.' });
  }

  const targetUrl = normalizeUrl(rawUrl);
  if (!targetUrl) {
    return res.status(400).json({ error: 'Invalid URL format provided.' });
  }

  const discoveredFeeds = [];
  const addedUrls = new Set();

  function addFeed(feedUrl, title, type) {
    try {
      const normalized = new URL(feedUrl, targetUrl).href;
      if (!addedUrls.has(normalized)) {
        addedUrls.add(normalized);
        discoveredFeeds.push({
          url: normalized,
          title: title || 'RSS Feed',
          type: type || 'rss'
        });
      }
    } catch {
      // Ignore invalid candidate URLs
    }
  }

  try {
    // 1. First try parsing directly as RSS feed
    const initialRes = await fetchWithTimeout(targetUrl);
    if (initialRes.ok) {
      const content = await initialRes.text();
      const directFeed = await tryParseFeed(content);
      if (directFeed) {
        addFeed(
          targetUrl,
          directFeed.title || 'Discovered Feed',
          'rss'
        );
        return res.json({ feeds: discoveredFeeds });
      }

      // 2. Fetch HTML and look for link[rel=alternate][type=rss/atom]
      const $ = cheerio.load(content);
      const linkElements = $('link[rel*="alternate"]').get();

      for (const el of linkElements) {
        const type = ($(el).attr('type') || '').toLowerCase();
        const href = $(el).attr('href');
        const title = $(el).attr('title');

        if (href && (type.includes('rss') || type.includes('atom') || type.includes('xml'))) {
          const feedType = type.includes('atom') ? 'atom' : 'rss';
          addFeed(href, title || `${feedType.toUpperCase()} Feed`, feedType);
        }
      }
    }
  } catch {
    // Continue searching common paths if main URL fetch or HTML parsing fails
  }

  // 3. Try common paths (/feed, /rss, /atom.xml, /feed.xml, /rss.xml, /index.xml) if no feeds found
  if (discoveredFeeds.length === 0) {
    const commonPaths = ['/feed', '/rss', '/atom.xml', '/feed.xml', '/rss.xml', '/index.xml'];
    const origin = new URL(targetUrl).origin;

    const probePromises = commonPaths.map(async (pathStr) => {
      const candidateUrl = new URL(pathStr, origin).href;
      if (addedUrls.has(candidateUrl)) return;

      try {
        const resp = await fetchWithTimeout(candidateUrl);
        if (resp.ok) {
          const body = await resp.text();
          const parsed = await tryParseFeed(body);
          if (parsed) {
            const isAtom = body.includes('<feed') && body.includes('http://www.w3.org/2005/Atom');
            addFeed(candidateUrl, parsed.title || `${pathStr} Feed`, isAtom ? 'atom' : 'rss');
          }
        }
      } catch {
        // Ignored candidate failure
      }
    });

    await Promise.allSettled(probePromises);
  }

  return res.json({ feeds: discoveredFeeds });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

app.listen(PORT, () => {
  console.log(`FeedFlow server running on port ${PORT}`);
});
