# Digital Library — Engineer Notes

## 1. Project Architecture

Three independent HTML pages, each with dedicated CSS and JS. No SPA framework, no router, no build step.

```
index.html  ──→  library.html  ──→  viewer.html?book=<file>
    │                  │                    │
    ├ style.css        ├ library.css        ├ viewer.css
    └ script.js        └ library.js         └ viewer.js
                         │                       │
                         ├ fetch books.json      ├ fetch books.json (metadata)
                         └ fetch *.pdf (covers)  └ fetch *.pdf (pages via PDF.js)
                                                    └ StPageFlip (flip engine)
                                                    └ localStorage (progress)
```

Pages communicate via `<a>` navigation, URL query parameters, and `localStorage` (key: `flipbook_progress`). No shared JS state between pages — each page is fully self-contained.

**Critical path**: `books/books.json` is the single source of truth. Both `library.js` and `viewer.js` fetch it independently. The viewer reads `?book=<filename>` from the URL to know which PDF to load.

---

## 2. Configuration

| Constant | File | Value | Purpose |
|---|---|---|---|
| `CONFIG.renderScale` | viewer.js | 1.5 | Resolution multiplier for PDF→canvas rendering (retina crispness) |
| `CONFIG.flippingTime` | viewer.js | 450 | StPageFlip animation duration in ms |
| `CONFIG.defaultZoom` | viewer.js | 1 | Default zoom level (1 = fit container) |
| `CONFIG.minZoom` | viewer.js | 0.5 | Minimum zoom (50%) |
| `CONFIG.maxZoom` | viewer.js | 2.5 | Maximum zoom (250%) |
| `CONFIG.zoomStep` | viewer.js | 0.25 | Zoom increment per click |
| `CONFIG.uiHideDelay` | viewer.js | 2500 | ms of inactivity before topbar/zoom auto-hide |
| `CONFIG.localStorageKey` | viewer.js | `'flipbook_progress'` | localStorage key for progress + bookmarks |
| `CONFIG.booksPath` | viewer.js | `'books/'` | Relative path to PDF files |
| `state.isMobile` | viewer.js | `window.innerWidth < 768` | Breakpoint for single vs two-page mode |
| `PDF.js cover scale` | library.js | 0.5 | Render resolution for cover thumbnails |
| `JPEG quality (covers)` | library.js | 0.85 | JPEG export quality for cover data URLs |
| `JPEG quality (pages)` | viewer.js | 0.88 | JPEG export quality for page data URLs |
| `Initial render batch` | viewer.js | pages 1-4 | Pages rendered before flipbook appears |
| `Background batch size` | viewer.js | 3 | Pages rendered concurrently in background |
| `Books-per-row (≥1400px)` | library.js | 8 | Max books per shelf row on wide screens |
| `Books-per-row (<480px)` | library.js | 4 | Min books per shelf row on small screens |
| `Opening animation` | library.js | 800ms | Duration of the book→viewer transition |
| `StPageFlip maxShadowOpacity` | viewer.js | 0.55 | Max darkness of the page curl shadow |
| `Shelf board height (desktop)` | library.css | 14px | Thickness of wooden shelf boards |
| `Book spine base width` | library.js | 90px | Default book width on shelf |
| `Viewer topbar height` | viewer.css | 56px | Fixed top bar height |
| `Viewer zoom controls height` | viewer.css | 48px | Fixed bottom bar height |

---

## 3. External Dependencies

| Library | CDN URL | Version | Used in | Why |
|---|---|---|---|---|
| **PDF.js** | `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js` | 3.11.174 | library.html, viewer.html | Renders PDF pages to canvas. Core rendering engine. |
| **PDF.js worker** | `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js` | 3.11.174 | library.html (inline), viewer.html (inline) | Runs PDF parsing in a separate thread. Must match PDF.js version exactly. |
| **StPageFlip** | `https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js` | 2.0.7 | viewer.html | Provides the page-flip animation engine. Handles touch/swipe/drag/mouse. |
| **Google Fonts Inter** | `https://fonts.googleapis.com/css2?family=Inter:wght@...` | — | All HTML files | UI typography. Viewer loads fewer weights (300-700) than library (300-800). |

**IMPORTANT**: CDN integrity hashes were removed because they caused silent script-load failures. If re-adding SRI hashes, update them every time the CDN version changes.

---

## 4. Execution Flow

### 4.1 Website Opens (index.html)

1. Browser parses HTML. Google Fonts preconnect + stylesheet `<link>` start loading.
2. `style.css` loads: CSS reset, `:root` variables, hero layout, hero button, footer.
3. `script.js` fires on `DOMContentLoaded`: sets `.hero-content` opacity:0 + translateY(20px), then on next `requestAnimationFrame` transitions to opacity:1 + translateY(0) over 800ms.
4. Two `.hero-glow` divs animate with `glowFloat` keyframes (8s alternate) — floating purple/blue gradient orbs.

### 4.2 Library Loads (library.html)

5. `<a href="library.html">` click navigates the browser.
6. `library.html` loads: Google Fonts, `library.css`, then `pdf.min.js` from CDN.
7. An inline `<script>` sets `pdfjsLib.GlobalWorkerOptions.workerSrc` to the worker CDN URL (MUST happen before `library.js` runs).
8. `library.js` `DOMContentLoaded` callback fires:
   - Caches DOM refs (grid, loading/empty/error states, search/sort inputs).
   - Calls `loadBooks()`.
9. `loadBooks()`: `fetch('books/books.json')` → parse JSON → for each book, `HEAD fetch('books/' + file)` for file size (stored but not displayed) → hide loading state → call `applyFilters()`.
10. `applyFilters()`: filter `books` array by search input (lowercase includes match) → sort by selected criterion → call `renderBooks(filteredBooks)`.
11. `renderBooks()`: calculate books-per-row from window width → build HTML string of `.shelf-row` > `.shelf-books` + `.shelf-board` for each row → each book is a `.book-spine` with cover `<img>` (src = cached PDF cover or SVG placeholder), gloss overlay, label → set `grid.innerHTML` → stagger `.visible` class additions (books at `index * 40ms`, shelves at `200ms + index * 80ms`) → bind click → `openBook()` → call `loadPDFCovers(booksArray)`.

### 4.3 PDF Covers Render

12. `loadPDFCovers()`: iterate books. Skip if `pdfCovers` Map already has an entry for this file.
13. `renderPDFCover(book)`: check cache → `pdfjsLib.getDocument('books/' + file)` → `pdf.getPage(1)` → create offscreen canvas at viewport scale 0.5 → `page.render()` → `canvas.toDataURL('image/jpeg', 0.85)` → cache in `pdfCovers.set(file, dataUrl)` → return dataUrl.
14. Back in `loadPDFCovers()`: query `.book-cover-img[data-file="<file>"]` in grid → set `img.style.opacity = '0'`, `img.src = dataUrl`, then on next `rAF` add `transition: opacity 0.5s ease` and set `img.style.opacity = '1'`. Result: SVG placeholder fades into real PDF cover.

### 4.4 User Clicks a Book

15. Click handler fires on `.book-spine` → calls `openBook(el)`.
16. Early return if `el.classList.contains('opening')` (prevents double-clicks).
17. Adds `class="opening"` → CSS hides original: `opacity: 0 !important; pointer-events: none`.
18. Gets `el.getBoundingClientRect()`. Deep-clones the element (`el.cloneNode(true)`). Positions clone at exact same screen coords with `position: fixed`.
19. Creates full-viewport overlay `<div>` at z-index 9998 with `background: rgba(0,0,0,0)` and `transition: background 0.5s ease`.
20. Appends clone + overlay to `document.body`.
21. On next `requestAnimationFrame`:
    - Sets overlay background to `rgba(0,0,0,0.7)` (CSS transition animates this over 500ms).
    - Calculates center target: `dx = windowWidth/2 - rect.left - rect.width/2`, `dy = windowHeight/2 - rect.top - rect.height/2`, `scale = min(windowWidth * 0.75 / rect.width, windowHeight * 0.85 / rect.height)`.
    - Calls `clone.animate()` with 5 keyframes over 800ms (identity → 30% translation/scale1.15/rotateY -5deg → 70%/1.7 → center/scale-to-fit → 108% overshoot).
    - On animation finish: 150ms delay then `window.location.href = 'viewer.html?book=' + encodeURIComponent(file)`.

### 4.5 Viewer Initializes

22. Browser navigates to `viewer.html?book=<encoded-filename>`.
23. At script parse time (before DOMContentLoaded): `loadTheme()` runs — reads `localStorage.getItem('flipbook_darkmode')`, applies `.light-mode` class on `<body>` if saved as `'false'`.
24. Loading overlay is visible (spinner + progress bar).
25. `DOMContentLoaded` fires → `init()`:
    - `cacheDOM()` — caches ~25 DOM element refs into `dom` object.
    - Reads `?book` param → `state.bookFile`. If missing, shows error overlay.
26. `await loadBookMetadata()`: fetch `books/books.json` → `books.find(b => b.file === state.bookFile)` → if found, set `dom.bookTitle.textContent` and `document.title`. Fails silently.
27. `await loadPDF()`: `pdfjsLib.getDocument('books/' + state.bookFile, { enableXfa: true })`. `onProgress` callback updates `dom.loaderFill.style.width`. On resolve: `state.pdfDoc = pdfDoc`, `state.totalPages = numPages`, `dom.totalPagesEl.textContent = totalPages`. Gets first page viewport at scale 1 → `state.pageAspectRatio = height / width`.
28. `createPageElements()`: `dom.flipbook.innerHTML = ''` → for `i = 0` to `totalPages-1`: create `<div class="page" data-page-index="i">` with `<img id="page-i" class="page-img">` inside → append to flipbook.
29. `await renderPageRange(1, Math.min(4, state.totalPages))`: pages 1-4 rendered in batches of 2 via `Promise.all`. Each `renderPage(n)` call loads PDF page, renders to canvas at 1.5× scale, exports JPEG at 88%, stores in `renderedPages` Map, sets `img.src` with fade-in.
30. `setupFlipbook()` — see Section 4.6.
31. `setupControls()`, `setupKeyboard()`, `setupAutoHideUI()`, `setupResizeHandler()`.
32. `loadProgress()`: reads localStorage → if saved page > 1 for this book, sets `state.currentPage = saved`, calls `setTimeout(() => goToPage(saved), 100)`.
33. `hideLoader()`: adds `.hidden` class (CSS opacity fade), removes from display after 500ms.
34. `renderRemainingPages()` called WITHOUT `await` — renders pages 5+ in batches of 3, yields 15ms between batches.

### 4.6 StPageFlip Initializes

35. `setupFlipbook()`:
    - If `state.pageFlip` exists (re-init on resize/fullscreen): save .page elements to `savedPages` array, call `state.pageFlip.destroy()`, set to null, re-append all saved pages to `dom.flipbook`.
    - `getPageDimensions()`: measure `dom.viewer` bounding rect. If mobile (`state.isMobile`): single page, width = min(92% container width, 92% height / aspectRatio), height = width * aspectRatio. If desktop: two-page spread with 24px gap, each page = floor((w - 24) / 2), height = width * aspectRatio (clamped to 92% container height, recalc width if clamped).
    - `pages = savedPages.length > 0 ? savedPages : dom.flipbook.querySelectorAll('.page')`.
    - `new StPageFlip.PageFlip(dom.flipbook, { width, height, size: 'fixed', flippingTime: 450, usePortrait: dims.single, startPage, maxShadowOpacity: 0.55, showCover: true, swipeDistance: 25, clickEvent: false, drawShadow: true, useMouseEvents: true, useTouchEvents: true })`.
    - `state.pageFlip.loadFromHTML(pages)`.
    - Register `'flip'` event: `e.data` = new 0-based page index. Update `state.currentPage = idx + 1`, call `updateUI()`, `saveProgress()`.
    - `applyZoom()`: set CSS `transform: scale(Z)` on `dom.flipbookContainer`, call `state.pageFlip.updateSize()`.
    - Set `state.isReady = true`.

### 4.7 User Flips a Page

36. `nextPage()` (or `prevPage()`): guard boundary → `state.pageFlip.flipNext()` / `flipPrev()`.
37. StPageFlip animates the page turn over 450ms (page curls from right edge toward left, dynamic shadow rendered during flip).
38. On animation complete: `'flip'` event fires → `updateUI()` updates page input value, progress bar width (percentage through book), bookmark button color. `saveProgress()` writes to localStorage.
39. If user types page number + Enter: `change` event → `goToPage(val)`: clamp → if mobile `turnToPage(target - 1)`, if desktop `turnToPage(Math.floor((target - 1) / 2) * 2)` (aligns to spread boundary).

### 4.8 Window Resizes

40. `setupResizeHandler()`: debounce 250ms. On fire:
    - Update `state.isMobile = window.innerWidth < 768`.
    - If `state.isReady`: add `.resizing` class to `dom.flipbookContainer` (CSS opacity:0 transition 150ms), call `setupFlipbook()` inside `requestAnimationFrame`, remove `.resizing`, call `goToPage(state.currentPage)`.

### 4.9 User Closes Viewer

41. Click back arrow (`.viewer-back-btn` — `<a href="library.html">`): browser navigates to library.
42. On return to same book later: `loadProgress()` reads localStorage → if saved page > 1, `goToPage(saved)` after 100ms.
43. If user closes tab/browser: progress was saved on every flip, so the last visited page is preserved.

---

## 5. State Management

### 5.1 Runtime State (viewer.js)

| Variable | Type | Default | Purpose |
|---|---|---|---|
| `state.pdfDoc` | `PDFDocumentProxy\|null` | null | PDF.js document object |
| `state.pageFlip` | `PageFlip\|null` | null | StPageFlip instance |
| `state.currentPage` | number | 1 | Current page (1-indexed) |
| `state.totalPages` | number | 0 | Total PDF pages |
| `state.zoom` | number | 1.0 | Current zoom level (0.5–2.5) |
| `state.renderedPages` | `Map<number,string>` | new Map() | Page number → JPEG data URL cache |
| `state.isRendering` | boolean | false | Whether a page render is in progress |
| `state.isDarkMode` | boolean | true | Dark/light mode toggle |
| `state.isFullscreen` | boolean | false | Fullscreen API state |
| `state.isMobile` | boolean | `innerWidth<768` | Single-page vs two-page mode |
| `state.isReady` | boolean | false | StPageFlip has initialized |
| `state.isUIVisible` | boolean | true | Topbar/zoom controls visible |
| `state.wasInteracting` | boolean | false | User hovering over controls (prevents auto-hide) |
| `state.bookData` | object\|null | null | Matched book entry from books.json |
| `state.bookFile` | string\|null | null | PDF filename from URL param |
| `state.pageAspectRatio` | number | 1.4 | Height/width ratio of first PDF page |

### 5.2 Runtime State (library.js)

| Variable | Type | Purpose |
|---|---|---|
| `books` | `Book[]` | Full catalog from books.json |
| `filteredBooks` | `Book[]` | Currently filtered/sorted subset |
| `pdfCovers` | `Map<string,string>` | Filename → JPEG data URL cache |

### 5.3 localStorage

Single key `'flipbook_progress'` storing JSON:
```json
{
    "filename.pdf": 12,
    "another.pdf": 5,
    "_bookmarks": {
        "filename.pdf": 8
    }
}
```
- Book filenames as keys → current page number (1-indexed).
- `_bookmarks` sub-object → book filename → bookmarked page.
- Separate key `'flipbook_darkmode'` stores `'true'` or `'false'` as string.

All localStorage access wrapped in try/catch. Failure is non-fatal (progress/bookmarks silently degrade).

---

## 6. Function Call Flow

### library.js

```
DOMContentLoaded → loadBooks()
    ├── fetch('books/books.json')
    ├── HEAD fetch each book's PDF (for size)
    └── applyFilters()
         ├── filter by search
         ├── sort by selected
         └── renderBooks(filteredBooks)
              ├── build HTML → grid.innerHTML
              ├── add .visible class (staggered)
              ├── bind click → openBook()
              └── loadPDFCovers(books)
                   └── renderPDFCover(book)  [per book, async]
                        ├── pdfjsLib.getDocument
                        ├── pdf.getPage(1)
                        └── canvas.toDataURL

openBook(el)
    ├── cloneNode + overlay
    ├── Web Animations API (animate)
    └── window.location.href = viewer.html?book=...
```

### viewer.js

```
loadTheme()  [runs at parse time]

DOMContentLoaded → init()
    ├── cacheDOM()
    ├── loadBookMetadata()
    │    └── fetch('books/books.json')
    ├── loadPDF()
    │    └── pdfjsLib.getDocument (onProgress updates loader)
    ├── createPageElements()
    ├── renderPageRange(1, 4)
    │    └── renderPage(n)  [batches of 2]
    │         ├── pdfDoc.getPage(n)
    │         ├── page.render(canvas)
    │         └── canvas.toDataURL → img.src
    ├── setupFlipbook()
    │    ├── getPageDimensions()
    │    ├── new PageFlip() + loadFromHTML()
    │    ├── register 'flip' event → updateUI() + saveProgress()
    │    └── applyZoom()
    ├── setupControls()
    │    └── binds buttons → zoomIn/Out, goToPage, etc.
    ├── setupKeyboard()
    │    └── keydown → nextPage, prevPage, zoom, etc.
    ├── setupAutoHideUI()
    │    └── mousemove/touch → showUI/scheduleHide
    ├── setupResizeHandler()
    │    └── resize → setupFlipbook() + goToPage()
    ├── loadProgress()
    │    └── localStorage → goToPage(saved)
    ├── hideLoader()
    └── renderRemainingPages()  [no await]
         └── renderPage(n)  [batches of 3]

goToPage(n)
    ├── if mobile: pageFlip.turnToPage(n-1)
    └── if desktop: pageFlip.turnToPage(spreadStart)

zoomIn/Out/Reset/FitWidth/FitPage
    └── applyZoom()
         ├── transform: scale(Z) on container
         └── pageFlip.updateSize()
```

---

## 7. Current Bugs

### 7.1 No Pan After Zoom (viewer)

**Bug**: When `state.zoom > 1`, the CSS `transform: scale()` makes pages overflow the container. There is no scroll or drag-to-pan mechanism, so content is clipped on the right and bottom edges.

**Root cause**: `applyZoom()` only scales the container — it doesn't adjust the container's scroll or add a panning mechanism. StPageFlip's `updateSize()` doesn't handle overflow.

### 7.2 renderedPages Map Memory Leak

**Bug**: `state.renderedPages` grows unboundedly with PDF page count. Every page JPEG data URL (~50–200KB) is retained for the session lifetime. A 200-page PDF can consume 20+ MB of memory.

**Root cause**: No eviction strategy. The map is never cleared. There's no upper bound check.

### 7.3 Full innerHTML Rebuild on Search (library)

**Bug**: Every keystroke in the search input calls `renderBooks()` which sets `grid.innerHTML = ''` and rebuilds ALL book DOM elements. For large collections (>100 books), this causes visible jank.

**Root cause**: `applyFilters()` always calls `renderBooks()` with no optimization for incremental DOM updates.

### 7.4 Background Render Race with Saved Progress

**Bug**: If `loadProgress()` finds a saved page > 4 and calls `goToPage(saved)` after 100ms, the target page may not be rendered yet (only pages 1-4 are done). StPageFlip shows a blank/transparent area until the background render completes.

**Root cause**: `renderRemainingPages()` runs asynchronously without await, and `loadProgress()` fires the `goToPage` with a fixed 100ms delay regardless of whether the target page has rendered.

### 7.5 Stale Data After Full-Screen Orientation Change

**Bug**: `fullscreenchange` listener calls `setupFlipbook()` after 300ms setTimeout. If a resize event fires during the same period (e.g., mobile orientation + fullscreen), two `setupFlipbook()` calls can overlap, causing a double-init flash.

**Root cause**: `fullscreenchange` uses a standalone setTimeout not synchronized with the resize debounce timer.

### 7.6 `covers/` Directory and `CONFIG.coversPath` Are Dead Code

**Bug**: `CONFIG.coversPath` is defined in viewer.js line 20 but never referenced anywhere. The `covers/` directory exists but is empty. This is confusing for new developers.

**Root cause**: Legacy from an earlier version that used separate cover image files. The feature was replaced by auto-rendered PDF covers but the config and directory were never removed.

### 7.7 Page Input Ambiguity in Two-Page Mode

**Bug**: In two-page mode, the page number input only shows the left page number. A user who types the right page number will be taken to the wrong spread.

**Root cause**: `state.currentPage` is always the left page index in two-page mode. The input reflects this directly without indicating it represents the left page.

### 7.8 No-loading-state for File Size HEAD Requests (library)

**Bug**: `loadBooks()` sends HEAD requests for every book to get Content-Length. These are awaited via `Promise.allSettled` and can slow down the initial library load, especially with many books or slow networks. The file size data is never displayed in the UI.

**Root cause**: Feature was started (file size fetching) but never integrated into the UI.

---

## 8. Known Assumptions

1. **Folder structure**: `books/` directory is at the same level as HTML files (relative path `'books/'` is hardcoded).
2. **PDF format**: All PDF files are valid, readable by PDF.js, and their first page is a meaningful cover.
3. **Browser support**: ES2020 (async/await, Map, Promise.allSettled, Arrow functions, template literals), `requestAnimationFrame`, `DOMContentLoaded`, Fullscreen API, `localStorage`, CSS custom properties, `backdrop-filter`, Web Animations API (`Element.animate`), `ResizeObserver` NOT assumed (uses event-based resize).
4. **Network**: Google Fonts CDN, jsDelivr, and Cloudflare CDN are always accessible. No offline fallback.
5. **GitHub Pages**: Files are served from the repository root. No path prefix (works in both root and subdirectory deployments).
6. **PDF.js worker**: Must be loaded from a CDN (cannot be a local file due to worker blob URL restrictions in some browsers). The `workerSrc` is set in an inline `<script>` that runs AFTER the PDF.js library script but BEFORE any PDF operations.
7. **Environment**: User is not in private browsing mode that blocks localStorage (handled via try/catch, but progress/bookmarks silently fail).
8. **PDF page count**: Known synchronously after `getDocument` resolves (`numPages` property is available immediately).
9. **Single-book demo**: Current `books.json` has one entry. The code handles multiple books, but only one PDF exists.
10. **Window innerWidth**: Available at module load time (used for initial `isMobile` calculation before DOMContentLoaded).

---

## 9. Developer Warnings

### DO NOT change these things without understanding the consequences:

1. **DO NOT add SRI integrity hashes to CDN script tags** — The project intentionally removed them because they caused silent script-load failures (the CDN occasionally served slightly different files than the hash expected). If you must add SRI, verify the hash against the exact file served by the CDN at the specific version.

2. **DO NOT move PDF.js worker configuration** — The `pdfjsLib.GlobalWorkerOptions.workerSrc` assignment must happen BETWEEN the PDF.js library `<script>` load and any code that uses `pdfjsLib`. The viewer.html has it in an inline `<script>` between the CDN script and `viewer.js`. The library.html has it similarly positioned.

3. **DO NOT remove the `lib/page-flip` node scheme** — StPageFlip's `loadFromHTML()` expects actual DOM elements. If you change `createPageElements()` to generate pages differently (e.g., using `<canvas>` instead of `<img>`), you must verify StPageFlip can still wrap them.

4. **DO NOT assume `state.isMobile` is static** — It's recalculated on every resize. Any code that branches on `state.isMobile` must handle both modes at any time.

5. **DO NOT save .page elements before destroy without re-appending them** — `StPageFlip.destroy()` removes all child elements from the container. The `setupFlipbook()` function saves them to an array first and re-appends them. If you skip this, page elements (with all rendered images) are lost.

6. **DO NOT change the batch rendering to render all pages synchronously** — The key performance optimization is that only pages 1-4 render before the book appears. Rendering all pages before `setupFlipbook()` would add 10-30 seconds of loading time for large PDFs.

7. **DO NOT remove the `await new Promise(r => setTimeout(r, N))` yields** — These small yields between render batches keep the event loop responsive. Without them, the UI freezes during page rendering.

---

## 10. Maintenance Guide

### 10.1 Adding a New Feature

1. **If it's a control (button)**: Add HTML button in `viewer.html` with an ID, add SVG icon, add CSS using the existing `.ctrl-btn` class, add the ID to `cacheDOM()` in `viewer.js`, implement the handler function, register it in `setupControls()` (and `setupKeyboard()` if keyboard shortcut needed).
2. **If it's a UI element**: Add HTML in the appropriate page, add CSS in the corresponding CSS file using existing CSS variables, implement logic in the corresponding JS file.
3. **If it's a new data source**: Add the data file (e.g., JSON), fetch it in the JS file, process and integrate into the existing data flow.

### 10.2 Replacing PDF.js

1. Update the CDN URL in BOTH `library.html` and `viewer.html` (two places, plus the worker URL).
2. Update the worker URL in the inline `<script>` on both pages.
3. If the new version has API changes: check `getDocument()`, `getPage()`, `getViewport()`, `page.render()` signatures. The project only uses these four APIs plus `numPages`.
4. Test with: PDF loading, page rendering (both cover at 0.5× and full at 1.5×), loading progress callback.

### 10.3 Replacing StPageFlip

1. Update the CDN URL in `viewer.html`.
2. If the replacement has a different API: the project uses `PageFlip(container, config)`, `loadFromHTML(htmlElements)`, `flipNext()`, `flipPrev()`, `turnToPage(index)`, `updateSize()`, `destroy()`, and the `'flip'` event with `e.data` = page index. You need to provide equivalents for all of these.
3. The config object includes: `width`, `height`, `size`, `flippingTime`, `usePortrait`, `startPage`, `maxShadowOpacity`, `showCover`, `swipeDistance`, `clickEvent`, `drawShadow`, `useMouseEvents`, `useTouchEvents`.
4. Test: flip animation, touch/swipe, two-page spread mode, single-page mode, resize, programmatic navigation, zoom interaction.

### 10.4 Changing the Bookshelf UI

1. Most bookshelf HTML is generated in `library.js` `renderBooks()` — the HTML template literal. Edit this to change the structure.
2. All bookshelf CSS is in `library.css`. Key classes: `.books-grid`, `.shelf-row`, `.shelf-books`, `.shelf-board`, `.book-spine`, `.book-spine-cover`, `.book-spine-gloss`, `.book-spine-label`.
3. Books-per-row logic is in `library.js` `renderBooks()` — the `if/else chain` checking `window.innerWidth`.
4. Entrance animations are in `library.css` (`.book-spine.visible`, `.shelf-board.visible`) and `library.js` `renderBooks()` (setTimeout stagger).

### 10.5 Changing the Viewer UI

1. Viewer HTML is in `viewer.html` — edit the toolbar, controls, etc.
2. Viewer CSS is in `viewer.css` — key sections: desk background (`.book-viewer::before/::after`), topbar (`.viewer-topbar`), zoom controls (`.zoom-controls`), progress bar (`.progress-bar`), flipbook container (`.flipbook-container`), page cells (`.flipbook .page`), center binding (`.flipbook::after`).
3. Viewer JS logic is in `viewer.js` — controls are wired in `setupControls()`.
4. Control visibility (auto-hide) is in `setupAutoHideUI()` — uses CSS `.hidden` class on topbar and zoom controls.

### 10.6 Updating Dependencies

1. **PDF.js**: Update URL in library.html line 13, viewer.html line 164, and worker URL in viewer.html line 167 and library.html line 81.
2. **StPageFlip**: Update URL in viewer.html line 165.
3. **Google Fonts**: Update `<link href="...">` in all three HTML files.
4. **Always test after updating**: Load a book, flip pages, zoom, resize, fullscreen — verify nothing is broken.

---

## 11. Quick Debug Guide

### 11.1 `StPageFlip is not defined`

**Probable cause**: StPageFlip CDN failed to load, or the script tag is after `viewer.js`.

**Diagnosis**: Open browser DevTools → Network tab → check if `page-flip.browser.min.js` loaded (status 200). If not loaded or blocked, check for ad blockers, network issues, or CDN outage.

**Fix**: Verify the CDN URL in `viewer.html` line 165. Ensure the script tag is BEFORE `viewer.js` (line 169). If the CDN is down, vendor the file locally.

### 11.2 `pdfjsLib is not defined`

**Probable cause**: PDF.js CDN failed to load, or the worker configuration script runs before the library load.

**Diagnosis**: Check Network tab for `pdf.min.js` status. Check Console for the specific error message and line number.

**Fix**: Verify CDN URLs in both `library.html` and `viewer.html`. The `pdf.min.js` script must load BEFORE the inline `<script>` that sets `GlobalWorkerOptions.workerSrc`.

### 11.3 PDF Not Loading

**Probable cause**: Wrong filename, wrong path, or the file doesn't exist.

**Diagnosis**: Check the `?book=` URL parameter in the viewer. Check the filename in `books/books.json`. Check that the actual PDF file exists in the `books/` directory with the exact same name (including spaces).

**Fix**: Correct the filename in `books/books.json` to match the actual file. Filenames with spaces are supported — write them exactly as-is. The `encodeURIComponent()` in the library handles URL encoding.

### 11.4 Blank Pages in the Viewer

**Probable cause**: Page rendering failed (PDF.js error), or the page hasn't rendered yet (background rendering hasn't caught up).

**Diagnosis**: Check Console for `Failed to render page N` warnings. Check the Network tab for PDF loading. Check if the page number is beyond what's been rendered — the status bar shows rendering progress.

**Fix**: If PDF.js errors, check the PDF file validity. If it's a race condition (user flips to a page faster than background rendering), wait for the render to complete (it should appear within <500ms). If pages remain blank, check `renderPage()` error handling.

### 11.5 Missing Books on the Shelf

**Probable cause**: `books/books.json` failed to load, or search filter is hiding them.

**Diagnosis**: Check Console for fetch errors. Check the Network tab for `books.json` status. Clear the search input and reset the sort dropdown. Check the `loading-state`, `empty-state`, or `error-state` visibility.

**Fix**: Ensure `books/books.json` is valid JSON and exists at the correct path. Ensure at least one book entry has a matching PDF file.

### 11.6 Broken Paths on GitHub Pages

**Probable cause**: The project is deployed to a subdirectory (e.g., `username.github.io/repo-name/`) but the code uses relative paths from the root.

**Diagnosis**: Check the browser URL bar. If the path is `https://username.github.io/repo-name/library.html`, then all relative paths like `books/books.json` resolve correctly relative to the HTML file's location.

**Fix**: All paths in the project are relative to the HTML file that makes the request (e.g., `library.html` requests `books/books.json` which resolves to `repo-name/books/books.json`). This is correct for both root and subdirectory deployments. If paths are broken, use browser DevTools → Network tab to see the full URL being requested.

### 11.7 The Flipbook Shows One Page on Desktop

**Probable cause**: The `isMobile` breakpoint is incorrectly triggered.

**Diagnosis**: Check `state.isMobile` in the viewer console. Check the window width.

**Fix**: The breakpoint is `window.innerWidth < 768` for mobile/single-page mode. On any resize, `state.isMobile` is recalculated and `setupFlipbook()` is called. If the viewport is ≥768px, `isMobile` should be `false` and `usePortrait: false` in StPageFlip config.

### 11.8 Zoom Changes Don't Affect the Display

**Probable cause**: `applyZoom()` isn't being called, or the CSS transform is overridden.

**Diagnosis**: Inspect `.flipbook-container` in DevTools Elements panel. Check if `style="transform: scale(1.5)"` is present. Check if any CSS rule is overriding it with `!important`.

**Fix**: `applyZoom()` sets `dom.flipbookContainer.style.transform` directly as an inline style. This has highest specificity. If it's not applying, check that `state.zoom` has the expected value and that `applyZoom()` is called.

### 11.9 Book Opening Animation Plays But Doesn't Navigate

**Probable cause**: The `onfinish` callback of the Web Animation didn't fire, or the animation was cancelled.

**Diagnosis**: Check the Console for errors. Check if the clone element remains in the DOM after the animation.

**Fix**: The Web Animations API `onfinish` may not fire if the element is removed from the DOM during the animation (e.g., user navigates away manually). If the animation is interrupted, the clone and overlay remain in the DOM — they're cleaned up when the new page loads. If `onfinish` consistently doesn't fire, check browser compatibility (Chrome 84+, Firefox 75+, Safari 13.1+).
