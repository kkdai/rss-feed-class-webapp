# Paginated Article Browsing

## Problem

The main article list (`#articlesContainer`) currently renders every filtered
article in one continuously-scrolling column. The user wants the same
swipe-to-paginate interaction already used in the "Add Feed" preview carousel
applied to the real article browsing views: each page shows exactly 5
articles, and swiping up/down moves to the next/previous page.

## Scope

Applies to:
- All article sections: All Articles, Today, any Folder, any single Feed.
- All 4 existing view modes: `magazine`, `list`, `title`, `cards`.

Not in scope: article detail/reader view, the Add Feed preview carousel
(already has this behavior), backend/API changes.

## Mechanics

Reuses the pattern already implemented for the Add Feed preview carousel:

- Articles for the current view are grouped into pages of 5 (last page may
  have fewer).
- `#articlesContainer` becomes a fixed-height (`flex:1` of `.main-content`,
  unchanged), `overflow: hidden` viewport.
- An inner wrapper (`#articlesPagesInner`) contains one page `<div>` per
  group of 5 (`height: 100%; flex-shrink: 0`), laid out in a column, and is
  positioned via `transform: translateY(-currentPage * 100%)` with a CSS
  transition, identical to `#previewCarouselInner`.
- Content within a page is **not scrollable** — 5 cards must visually fit
  the page height (compressed/clamped as needed), matching how the preview
  carousel forces its 5 sample items into a fixed block.

## Interaction

- **Touch**: `touchstart`/`touchend` on the container; vertical swipe
  distance > 40px determines direction (swipe up → next page, swipe down →
  previous page). Same threshold as the existing preview carousel.
- **Mouse wheel**: a `wheel` event with `deltaY` beyond a small threshold
  triggers one page change (up = next, down = previous). Debounced/throttled
  so a single scroll gesture doesn't skip multiple pages.
- **Buttons**: explicit prev/next page buttons rendered near the page
  indicator, for click-only users. Disabled (not hidden) at the first/last
  page.
- No wraparound: at the first page, swipe-down/prev is a no-op; at the last
  page, swipe-up/next is a no-op.

## Page indicator

A small indicator (e.g. "2/5") shown in the articles container, following
the same visual treatment as `#previewPageIndicator` in the preview
carousel.

## State management

- New `state.currentPage` (0-indexed), owned by `app.js`'s existing `state`
  object.
- Reset to `0` whenever:
  - The current view changes (`navigateTo`, folder click, feed click).
  - The `showReadArticles` setting changes (changes the filtered article
    set).
  - `refreshFeeds()` completes (new articles may change the list).
- `renderArticles()` is the single place that (re)computes the page groups
  from the filtered article list and re-renders the current page; it will
  clamp `state.currentPage` if it's now out of range (e.g. list shrank).

## Explicitly unaffected

- **Click-to-open**: article cards still bind their existing click handler
  per card; opening the reader is unchanged.
- **Auto-translation**: `autoTranslateArticles(articles)` continues to run
  in the background over the *entire* filtered article list (not just the
  visible page), same as today. Translated cards update in place if they're
  currently visible.
- **Read/unread logic**: unchanged; read filtering happens before pagination
  grouping, exactly as it happens before rendering today.

## Files touched

- `public/js/app.js`: `renderArticles()` reworked to group into pages and
  render the sliding structure; new pagination state, swipe/wheel/button
  handlers; page-reset calls added at the view/filter/refresh entry points
  listed above.
- `public/css/style.css`: new rules for the paginated container, per-page
  wrapper, page indicator, and prev/next buttons. Existing `.articles-list`
  view-mode styles (`view-magazine`, `view-list`, `view-title`,
  `view-cards`) continue to apply within each page's card group.

No backend/API changes.
