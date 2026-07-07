# Digital Library — Project Handover

## 1. Project Overview

A pure front-end static web app that displays PDFs as interactive flipbooks on a realistic bookshelf. Users land on a hero page, browse a wooden bookshelf with auto-rendered PDF covers, click a book (cinematic zoom animation), and read it in a two-page spread viewer with realistic page-flip, paper texture, center binding, zoom, bookmarks, dark mode, and keyboard navigation.

**Tech stack**: Vanilla HTML/CSS/JS (ES2020+), Mozilla PDF.js 3.11.174 (PDF → canvas → JPEG data URL), StPageFlip 2.0.7 (flipbook engine), Google Fonts Inter. Zero build tools, zero backend, zero npm — deploy as static files to GitHub Pages.

## 2. Folder Structure

| Path | Purpose |
|---|---|
| `index.html` | Landing page — hero with "Open Library" CTA |
| `library.html` | Bookshelf page — search, sort, shelf grid |
| `viewer.html` | Flipbook reader — controls, zoom, bookmark, fullscreen |
| `style.css` | Landing page styles (hero, glow orbs, button) |
| `library.css` | Bookshelf styles (wooden shelves, 3D book spines, hover) |
| `viewer.css` | Viewer styles (reading desk, paper texture, binding crease, controls) |
| `script.js` | Landing page fade-in animation |
| `library.js` | Fetch books.json, render shelf, generate PDF covers, search/sort, book-open animation |
| `viewer.js` | PDF loading, page rendering, StPageFlip setup, zoom, nav, bookmarks, keyboard, auto-hide UI, resize |
| `books/books.json` | Book catalog — array of `{ title, file, cover }` objects |
| `books/*.pdf` | Actual PDF files |
| `covers/` | Empty legacy directory (covers auto-rendered from PDF page 1) |
| `assets/` | Empty — for future static assets |

## 3. How It Works (User Flow)

1. **Landing** (`index.html`): Hero page fades in with glow orbs. User clicks "Open Library".
2. **Library** (`library.html`): Shows a bookshelf. Books sit on wooden shelves with 3D spine effects. Placeholder SVG covers appear immediately, then fade-transition to PDF-rendered covers (loaded in background via PDF.js).
3. **Select a book**: Hover lifts/tilts the book with gloss reflection. Click triggers a cinematic animation — the book clone zooms to center of screen over 800ms while the background darkens, then navigates to the viewer.
4. **Viewer** (`viewer.html?book=filename.pdf`): Loading bar shows PDF download progress. First 4 pages render, then StPageFlip initializes and the book appears (remaining pages render in background). The user sees a reading desk background, two-page spread with center binding crease, paper texture overlay, and book shadow.
5. **Reading**: Flip pages via click, swipe, drag, keyboard (arrows/space/home/end), or page input. Progress auto-saves to localStorage. Bookmarks, zoom (± 0.25 steps, fit width/height), fullscreen, dark/light mode, download PDF, share link all available.
6. **Exit**: Back arrow returns to library. Returning to the same book resumes at the last-read page.

## 4. Architecture

```
index.html ← style.css + script.js
    ↓ <a href="library.html">
library.html ← library.css + library.js
    │  fetches books/books.json
    │  fetches books/*.pdf (via PDF.js for covers)
    ↓ viewer.html?book=<encoded-filename>
viewer.html ← viewer.css + viewer.js
    │  fetches books/books.json (metadata)
    │  fetches books/<file>.pdf (via PDF.js for page rendering)
    │  uses StPageFlip for the flipbook engine
    │  uses localStorage for progress + bookmarks
    ↓ <a href="library.html"> (back arrow)
```

Three independent HTML pages, each with its own CSS and JS. No shared state across pages. Cross-page communication via: `<a>` navigation, URL query parameters (`?book=`), and `localStorage` (key `flipbook_progress` holds page progress and `_bookmarks`).

The rendering pipeline: **PDF.js → offscreen `<canvas>` → `canvas.toDataURL('image/jpeg', 0.88)` → `<img>` element inside StPageFlip `.page` div**.

## 5. Key Components

**`library.js`** (~316 lines): Fetches `books/books.json`, builds bookshelf HTML with wooden shelf rows, generates SVG gradient placeholder covers (initials + gradient), renders actual PDF covers via PDF.js at 0.5 scale (cached in `pdfCovers` Map), filters by search query, sorts by title/newest/oldest, triggers staggered entrance animations, handles book-open click with Web Animations API (clone + animate to center + navigate).

**`viewer.js`** (~859 lines): The core engine. `CONFIG` object holds constants (renderScale 1.5, flippingTime 450ms, zoom range 0.5-2.5). `state` object holds all runtime state (pdfDoc, pageFlip instance, currentPage, zoom, renderedPages Map, isMobile, isDarkMode, etc.). `dom` object caches ~25 DOM refs via `cacheDOM()`.

`init()` flow: loadBookMetadata → loadPDF (with progress) → createPageElements → renderPageRange(1-4) → setupFlipbook → setupControls → setupKeyboard → setupAutoHideUI → setupResizeHandler → loadProgress → hideLoader → renderRemainingPages (no-await, background).

Key functions: `renderPage()` renders one PDF page to canvas → JPEG data URL → img element with fade-in. `getPageDimensions()` calculates page size based on container (single mobile vs two-page desktop). `setupFlipbook()` saves existing page elements before StPageFlip destroy/recreate (prevents resize flash). `applyZoom()` sets CSS `transform: scale()` on the container. `goToPage()` handles single-page vs spread-aligned navigation.

## 6. Book Loading Flow (Detailed)

1. `books/books.json` is fetched by both `library.js` (full data) and `viewer.js` (metadata only).
2. On the library page, `renderPDFCover(book)` loads the PDF via `pdfjsLib.getDocument`, renders page 1 to an offscreen canvas at scale 0.5, exports as JPEG data URL at 85% quality, caches in a `Map<filename, dataUrl>`, and updates the `<img>` src in the DOM with a fade-in transition.
3. When a user clicks a book, `openBook()` runs the animation, then navigates to `viewer.html?book=<encodeURIComponent(filename)>`.
4. On the viewer page, `loadPDF()` calls `pdfjsLib.getDocument('books/' + file)`. The `onProgress` callback updates the loading bar.
5. After PDF load, `createPageElements()` creates `<div class="page"><img></div>` × totalPages inside `#flipbook`.
6. `renderPageRange(1, 4)` renders pages 1-4 in batches of 2 (2 concurrent PDF.js renders, yields 10ms between batches). Each `renderPage(n)` gets the page, renders to canvas at 1.5× scale, exports JPEG at 88% quality, stores in `renderedPages` Map, updates the `<img>` src.
7. `setupFlipbook()` initializes StPageFlip with width/height from `getPageDimensions()`, `usePortrait: !state.isMobile`, flippingTime 450ms, maxShadowOpacity 0.55, showCover true.
8. `renderRemainingPages()` renders pages 5+ in background batches of 3 (no-await, yields 15ms between batches).
9. `loadProgress()` reads `localStorage` — if a saved page > 1 exists for this book, flips to it after 100ms.

## 7. Important Functions (One-Line Each)

**library.js**:
- `renderBooks(booksArray)` — Builds the full bookshelf HTML and inserts into the DOM with staggered entrance animations.
- `renderPDFCover(book)` — Loads PDF page 1 via PDF.js, renders to a JPEG data URL thumbnail, caches it.
- `loadPDFCovers(booksArray)` — Iterates books, renders uncached covers, fades them into the DOM.
- `openBook(el)` — Animates a cloned book element to center-screen via Web Animations API, then navigates to viewer.
- `applyFilters()` — Filters by search query, sorts by selected criterion, re-renders the shelf.

**viewer.js**:
- `init()` — Main entry: loads metadata, PDF, creates pages, renders first 4, sets up StPageFlip + controls, loads saved progress.
- `loadPDF()` — Fetches PDF via PDF.js, extracts total pages and aspect ratio, updates loading bar.
- `renderPage(n)` — Renders one PDF page to a JPEG data URL, caches it, updates the DOM `<img>` with a fade-in.
- `getPageDimensions()` — Returns optimal page {width, height, single} based on container size and mobile/desktop mode.
- `setupFlipbook()` — Creates/destroys StPageFlip instance, preserving existing page DOM elements on re-init.
- `applyZoom()` — Sets CSS `transform: scale()` on flipbook container and updates StPageFlip internal size.
- `goToPage(n)` — Navigates to a page (handles single-page vs spread-aligned jumps).
- `saveProgress()` / `loadProgress()` — Persists/restores current page in localStorage.
- `toggleBookmark()` — Sets/removes a bookmark for the current page in localStorage.

## 8. Libraries Used

**PDF.js 3.11.174** (CDN): Loads any PDF entirely in the browser. Used to render PDF pages to canvas elements, which are then exported as JPEG data URLs. Required by both `library.js` (cover thumbnails at 0.5× scale) and `viewer.js` (full pages at 1.5× scale). The worker (`pdf.worker.min.js`) runs PDF parsing in a separate thread.

**StPageFlip 2.0.7** (CDN, `page-flip`): Provides the realistic page-flip animation engine. Accepts existing DOM elements via `loadFromHTML()`, handles touch/mouse/swipe, supports single-page and two-page spread modes, fires `flip` events with the new page index. Configurable: flippingTime (450ms), maxShadowOpacity (0.55), showCover, drawShadow, etc. Only used in `viewer.js`.

**Google Fonts Inter**: Clean modern sans-serif for all UI text. Loaded via `<link>` in all three HTML pages with `display=swap`.

## 9. How to Add a New Book

1. Copy the PDF file into the `books/` directory.
2. Edit `books/books.json` and add an entry: `{ "title": "Display Title", "file": "filename.pdf" }`. The `cover` field is legacy and can be omitted.
3. The filename in `file` must match the actual file exactly, including spaces (URL encoding is handled automatically).
4. The first page of the PDF will be auto-rendered as the book's cover on the shelf — no separate cover image needed.
5. Commit both the JSON change and the PDF file, then push to GitHub Pages.

## 10. Known Issues / Limitations

- **No pan after zoom**: Zoom > 1× makes pages overflow the container with no way to pan/scroll.
- **Memory grows with page count**: Every rendered page is a JPEG data URL stored in a Map — a 200-page PDF uses ~20MB of memory. Map is never cleared.
- **Full DOM rebuild on search**: Every keystroke in the search input destroys and recreates all book elements. Fine for < 50 books, slow for 500+.
- **Page input shows left page in two-page mode**: The number input only shows the left page number, which can be confusing for users who type the right page.
- **No accessibility features**: No ARIA labels, no focus management, no screen reader support.
- **CSS animations may not run during resize**: The `.resizing` class briefly hides the flipbook during StPageFlip re-initialization.
- **`covers/` directory and `CONFIG.coversPath` are dead code**: Legacy from when covers were separate images. Currently unused.
- **Background rendering race**: If `loadProgress` jumps to a page beyond page 4, the target page image may not be rendered yet (brief blank/transparent area until the background render catches up).

## 11. Future Improvements

- Virtual page rendering: render only pages near the current spread, discard distant ones from the renderedPages Map (re-render on return).
- Canvas-based zoom with pan: replace CSS scale transform with canvas rendering + drag-to-pan.
- Incremental DOM on search: show/hide existing book elements instead of full innerHTML replacement.
- Accessibility: ARIA labels, keyboard trap in fullscreen, focus management.
- Service worker: cache PDFs and app shell for offline reading.
- PDF text layer: overlay selectable text for copy/paste and in-book search.
- Thumbnail sidebar: page thumbnails for quick navigation.
- Book info panel: show metadata (page count, file size, last read date).
- Lazy load more than 4 initial pages: render until the first two-page spread fills the viewport, not a fixed count of 4.

## 12. Quick Summary

- Three HTML pages (landing, library, viewer), each with own CSS + JS. No framework, no build tools, no backend.
- Library fetches `books/books.json`, renders a wooden bookshelf with 3D book spines. Hover lifts/tilts books with gloss reflection.
- PDF covers are auto-generated: PDF.js renders page 1 → canvas → JPEG data URL → placed in `<img>` with fade-in.
- Clicking a book triggers an 800ms Web Animations API zoom-to-center animation (clone at fixed position), then navigates to the viewer.
- Viewer loads PDF via PDF.js with progress bar. First 4 pages render before StPageFlip initializes (rest renders in background).
- StPageFlip creates the flipbook: 450ms flips, two-page spread on desktop (≥768px), single page on mobile (<768px), maxShadowOpacity 0.55.
- Reading desk background uses CSS pseudo-elements with radial gradients. Paper texture is an inline SVG fractal noise filter. Center binding crease is a CSS `::after` gradient on the flipbook.
- Zoom is CSS `transform: scale()` on the container, range 0.5–2.5×, step 0.25. StPageFlip `updateSize()` called after zoom changes.
- Progress auto-saves to localStorage on every flip. Bookmarks stored under `_bookmarks` sub-key. Dark mode preference stored separately.
- Fullscreen uses the Fullscreen API. Resize re-initializes StPageFlip with `.resizing` class (opacity: 0) to prevent visual flash.
- Keyboard shortcuts: arrows/space (flip), home/end (first/last), F (fullscreen), +/- (zoom), 0 (reset), B (bookmark), D (dark mode).
- Adding a book = copy PDF to `books/` + add entry to `books/books.json`. That's it — no code changes needed.
- PDF.js worker is configured via `pdfjsLib.GlobalWorkerOptions.workerSrc` pointing to CDN (set in an inline `<script>` after the library script tag).
- Main performance optimization: lazy page rendering (first 4 pages → book appears → rest renders in background batches of 3 with 15ms event loop yields).
- Main memory concern: `renderedPages` Map grows without bound (every page is a ~50–200KB JPEG data URL).
- StPageFlip `destroy()` removes page elements from the DOM, so `setupFlipbook()` saves them to an array before destroy and re-appends them after.
- Responsive breakpoints: 480px (4 books/row, tiny controls), 768px (5 books, single-page viewer), 1024px (6 books), 1400px (7 books), 1400+ (8 books).