# Digital Library — Interactive Flipbook Platform

## Technical Design Document (TDD)

---

# 1. Project Overview

## 1.1 What the Project Is

The **Digital Library** is a pure front-end, static-file web application that lets users browse a visual bookshelf of PDF documents and read them through an interactive, realistic page-flip reader. It is a single-page-application (SPA)-like experience with three sequential screens: a landing page, a book library (bookshelf), and a flipbook reader.

The application is designed to run without any backend server, build tools, package managers, or runtime dependencies beyond the browser. It is deployable as-is to GitHub Pages or any static file host.

## 1.2 What Problems It Solves

- Provides a premium, immersive reading experience for PDF documents in a web browser
- Eliminates the need for separate cover images — first page of each PDF is auto-rendered as the book cover via PDF.js
- Offers a realistic bookshelf metaphor instead of a generic grid or file list for browsing books
- Requires zero backend, database, or API — everything is client-side
- Works offline once loaded (all processing is local in the browser)
- Supports responsive two-page spreads on desktop and single-page scrolling on mobile
- Persists reading progress and bookmarks using localStorage
- Is fully deployable with just a git push to GitHub Pages

## 1.3 Overall Architecture

The application follows a multi-page static site architecture: Landing Page (index.html) → Library Page (library.html) → Viewer Page (viewer.html). Each page is a standalone HTML file that loads its own CSS and JavaScript. Communication between pages happens through: URL navigation via <a> tags, URL query parameters (?book=filename.pdf), and localStorage for reading progress and bookmarks.

There is no shared JavaScript state between pages. The books/books.json file is the only data source, fetched by both library.js and viewer.js.

## 1.4 Technologies Used

- **HTML5**: Page structure and semantic markup
- **CSS3**: All styling, layout, animations, responsive design (3 separate files, one per page)
- **Vanilla JavaScript (ES2020+)**: All interactivity, rendering, state management
- **Mozilla PDF.js 3.11.174**: Rendering PDF documents to canvas, extracting page images
- **StPageFlip (page-flip) 2.0.7**: Realistic page-flip animation and interaction engine
- **Google Fonts (Inter)**: Typography across all pages
- **SVG**: All icons (inline in HTML), paper texture noise filter, placeholder book covers

Why each technology was chosen:
- **Vanilla JS**: Zero build step, easier debugging, compatible with GitHub Pages, maximum control over the PDF→canvas→image rendering pipeline
- **PDF.js**: Industry standard, provides direct page rendering API, runs entirely in the browser, CDN-delivered
- **StPageFlip**: Lightweight (no dependencies), hardware-accelerated 60 FPS, two-page spread support, touch/mouse/swipe built-in, accepts existing DOM elements
- **Inter**: Highly legible at all sizes, free, clean modern aesthetic
- **Inline SVGs**: No external icon dependency, zero HTTP requests, instantly rendered, customizable

---

# 2. Folder Structure

## 2.1 Root Directory

```
/
├── index.html              # Landing page
├── library.html            # Library/bookshelf page
├── viewer.html             # Flipbook reader page
├── style.css               # Landing page styles
├── library.css             # Library page styles
├── viewer.css              # Viewer page styles
├── script.js               # Landing page JavaScript
├── library.js              # Library page JavaScript
├── viewer.js               # Viewer page JavaScript
├── books/
│   ├── books.json          # Book catalog data
│   └── reverie yearbook farwell.pdf  # Example PDF
├── covers/                 # Empty — legacy, no longer used
├── assets/                 # Empty — reserved for future static assets
├── README.md               # Project documentation
└── TDD.md                  # This document
```

## 2.2 File-by-File Explanation

### index.html (Landing Page)
The entry point. Contains a hero section with decorative gradient glow, an "Interactive Flipbook Library" badge, the "Digital Library" title, a subtitle, and an "Open Library" CTA linking to library.html. Includes a fixed footer. Loads Google Fonts, style.css, and script.js.
- **Why**: Provides a polished branded entry experience before entering the functional library.

### library.html (Library Page)
The bookshelf browsing interface. Fixed topbar with logo (links to index.html), search input with inline SVG search icon, sort dropdown (Title, Newest, Oldest). Main content has header with title and book count, then state containers (loading, empty, error), and #books-grid where the shelf is rendered. Loads Google Fonts, library.css, PDF.js from CDN, configures the PDF.js worker, loads library.js.
- **Why**: The catalog/browsing interface where users discover and select books.

### viewer.html (Viewer Page)
The flipbook reader. Error overlay (hidden), loading overlay with spinner+progress bar, fixed topbar (back button, book title, page nav buttons, bookmark/dark mode/fullscreen), thin progress bar, reading area (#book-viewer → #flipbook-container → #flipbook where pages are injected), bottom zoom controls bar (zoom out, level %, zoom in, fit width, fit page, download, share), toast notification. Loads Google Fonts, viewer.css, PDF.js + StPageFlip from CDN.
- **Why**: The core reading experience — all PDF rendering, page-flip, controls, and state management lives here.

### style.css (Landing Styles)
CSS for index.html only: universal reset, :root CSS variables, base typography, hero section layout, footer, responsive mobile overrides.
- **Why**: Each page loads its own independent CSS file.

### library.css (Library Styles)
CSS for library.html only: own reset and :root variables (slightly different dark shade vs style.css), body with radial gradient background, topbar with backdrop-filter blur, search/sort styling, loading/empty/error states, spinner, bookshelf layout (.books-grid, .shelf-row, .shelf-books, .shelf-board wood gradient), book spine 3D effects (.book-spine-cover::after thickness, .book-spine-gloss overlay, label), hover lift/tilt/gloss, opening class, entrance animations, responsive breakpoints.
- **Why**: All bookshelf-specific styling including the complex wood texture and 3D book spines.

### viewer.css (Viewer Styles)
CSS for viewer.html only: reset, :root (viewer-specific), html/body fixed to 100% with overflow:hidden, reading desk via .book-viewer::before (gradients, dark/light variants), vignette via ::after box-shadow, light-mode variable overrides, error overlay, loading overlay, topbar with backdrop blur and .hidden class, control buttons, page indicator input, progress bar, flipbook-container with zoom transform transition, .resizing class, .page with paper texture SVG noise filter overlay ::before, center binding crease .flipbook::after (dark and light mode), book shadow beneath spread, drop-shadow on .flipbook, .stp-cover shadows, zoom controls bar with .hidden, toast with animations, responsive breakpoints.
- **Why**: All viewer-specific styling including reading desk, paper texture, binding crease, controls.

### script.js (Landing Script)
A single DOMContentLoaded handler. Selects .hero-content, sets opacity:0 and translateY(20px), then on next requestAnimationFrame transitions to opacity:1 and translateY(0) over 0.8s.
- **Why**: Provides the subtle entrance animation without complicating CSS.

### library.js (Library Script)
Self-contained module in a DOMContentLoaded async handler. Responsibilities: fetch books/books.json, HEAD-request file sizes, render bookshelf HTML, generate SVG placeholder covers, render PDF covers via PDF.js with caching, search/sort filtering, book-open animation with Web Animations API.
- **Why**: All library logic — data fetching, rendering, interactivity, cover generation.

### viewer.js (Viewer Script)
~859 lines, the most complex file. Top-level CONFIG and state objects, DOM caching. Responsibilities: load book metadata, load PDF via PDF.js, create page DOM elements, batch-render pages (first 4 sync, rest async), init StPageFlip, manage zoom, page navigation, localStorage progress/bookmarks, fullscreen, dark/light mode, download PDF, share link, toasts, keyboard shortcuts, auto-hide UI, resize handling.
- **Why**: The core flipbook engine — all viewer logic.

### books/books.json
The book catalog. JSON array of objects with fields: title (display name), file (PDF filename relative to books/, must match exactly), cover (legacy unused field).
- **Why**: The sole data source. Editing this file + adding a PDF is how books are added.

### books/reverie yearbook farwell.pdf
Example PDF. Filename contains spaces, handled via encodeURIComponent.
- **Why**: Demonstrates how PDFs are stored.

### covers/ (Empty)
Legacy directory from an earlier version where separate cover images were stored. Currently empty. CONFIG.coversPath in viewer.js exists but is never referenced.
- **Why**: Backwards compatibility — removing it breaks nothing.

### assets/ (Empty)
Reserved for future static assets (favicons, OG images, custom fonts).
- **Why**: Placeholder for future expansion.

## 2.3 How Files Communicate

```
index.html --<link>--→ style.css
index.html --<script>→ script.js

library.html --<link>--→ library.css
library.html --<script>→ library.js
library.js ---fetch---→ books/books.json
library.js ---fetch---→ books/*.pdf (HEAD for size, full for cover render)

viewer.html --<link>--→ viewer.css
viewer.html --<script>→ viewer.js
viewer.js ---fetch---→ books/books.json (metadata only)
viewer.js ---fetch---→ books/*.pdf (PDF.js rendering)
```

Each HTML page is completely independent. No shared CSS or JS. Cross-page communication:
1. Simple <a> navigation: index.html ↔ library.html ↔ viewer.html
2. URL query parameter: viewer.html?book=<encoded-filename>
3. localStorage key "flipbook_progress": shared progress + bookmarks data


---

# 3. Complete User Journey

## 3.1 Landing Page Load

1. User navigates to index.html. Browser loads the HTML, preconnects to Google Fonts, loads Inter font CSS from fonts.googleapis.com, loads style.css.
2. Hero section renders immediately: dark background (#0a0a12), two glowing gradient orbs that float with the glowFloat keyframe animation (8s infinite alternate), centered content stack.
3. script.js fires on DOMContentLoaded: selects .hero-content, sets opacity:0 + translateY(20px) via inline style, then on the next animation frame adds transition: opacity 0.8s ease, transform 0.8s ease and sets opacity:1 + translateY(0). The hero fades in and slides up over 800ms.
4. User sees: badge "Interactive Flipbook Library" with glassmorphism styling, gradient text title "Digital Library", subtitle, purple gradient "Open Library" button with hover glow effect, floating glow orbs in background, fixed footer at bottom.

## 3.2 Entering the Library

5. User clicks "Open Library" button — a simple <a href="library.html"> navigation.
6. library.html loads: Google Fonts preconnect, library.css, PDF.js CDN script, then an inline <script> that sets pdfjsLib.GlobalWorkerOptions.workerSrc to the CDN worker URL, then library.js.
7. Loading state is visible: CSS spinner + "Loading books..." text.
8. library.js DOMContentLoaded: caches all DOM refs, calls loadBooks().
9. loadBooks(): fetches books/books.json, parses JSON into `books` array. For each book, sends a HEAD fetch to books/<file> to get Content-Length (stored but currently unused in UI). Hides loading state. Calls applyFilters().
10. applyFilters(): reads search input (empty initially) and sort select (default "Title"). Filters books array by search query, sorts by title. Calls renderBooks(filteredBooks).
11. renderBooks(): calculates books-per-row from window.innerWidth (4-8). Builds HTML string: for each row of books, creates a .shelf-row > .shelf-books (flex) + .shelf-board (wooden shelf). Each book is a .book-spine div with CSS custom property --book-width (90px ± up to 12px variation by title char code), containing .book-spine-cover > img (cover src from cache or placeholder SVG) + .book-spine-gloss + .book-spine-label. Sets grid.innerHTML to this HTML.
12. On next requestAnimationFrame, staggers entrance: each .book-spine gets .visible class at index*40ms delays (fade+slide up). Each .shelf-board at 200ms+index*80ms. Binds click → openBook() on each spine. Calls loadPDFCovers(booksArray) for background PDF cover rendering.

## 3.3 Cover Rendering

13. loadPDFCovers() iterates books, skips already-cached ones (pdfCovers Map). Calls renderPDFCover(book) for each uncached book.
14. renderPDFCover(): returns cached value if present. Calls pdfjsLib.getDocument("books/<file>"), gets pdf.getPage(1), creates offscreen canvas at scale 0.5, renders page with white background, exports as JPEG dataUrl at 85% quality, caches in pdfCovers Map, returns dataUrl.
15. Back in loadPDFCovers(): queries .book-cover-img[data-file="<file>"] in the grid, for each matching img sets opacity:0, sets src to dataUrl, on next rAF adds transition opacity 0.5s ease and sets opacity:1. The placeholder SVG fades into the PDF cover.

## 3.4 Selecting a Book

16. User hovers: CSS .book-spine:hover lifts the book (translateY(-16) scale(1.05) rotateY(-3deg)), z-index:20 brings it above neighbors, gloss fades in (opacity 0→1), title label fades in from below, cover image scales 1→1.04, hover shadow expands.
17. User clicks: openBook(el) fires. Returns early if .opening class already present. Adds .opening class (hides original with opacity:0). Gets bounding rect. Deep-clones the element. Positions clone at same coordinates with position:fixed. Creates overlay div with rgba(0,0,0,0) background, appends both to body.
18. On next rAF: overlay background transitions to rgba(0,0,0,0.7) over 0.5s. Calculates center target (dx, dy) and scale to fit 75% width / 85% height. Starts Element.animate() on clone with 5 keyframes over 800ms: identity→30% towards center scale 1.15 rotateY -5deg→70% scale 1.7→center scale(viewport fit)→slightly larger scale*1.08. Easing: cubic-bezier(0.34, 1.56, 0.64, 1). On finish: 150ms delay, then window.location.href = "viewer.html?book=" + encodeURIComponent(file).

## 3.5 Viewer Loading

19. Browser navigates to viewer.html?book=... Loading overlay visible (spinner + progress bar).
20. viewer.js loads: loadTheme() runs immediately (reads localStorage flipbook_darkmode, applies light-mode class if saved). DOMContentLoaded fires init().
21. init(): cacheDOM(). Reads ?book= param → state.bookFile. If missing, shows error overlay. Otherwise enters try:
22. await loadBookMetadata(): fetches books/books.json, finds matching entry by file field, sets dom.bookTitle.textContent and document.title.
23. await loadPDF(): pdfjsLib.getDocument("books/<file>", {enableXfa:true}). onProgress updates loader bar. On resolve: stores pdfDoc, totalPages, gets page 1 viewport to calculate pageAspectRatio.
24. createPageElements(): dom.flipbook.innerHTML = "", creates totalPages divs with class "page" and <img> inside, appends to flipbook.
25. await renderPageRange(1, min(4, totalPages)): renders pages 1-4 in batches of 2 via Promise.all. Updates loader bar after each batch. Yields to event loop between batches.
26. setupFlipbook() (see Section 6). setupControls(), setupKeyboard(), setupAutoHideUI(), setupResizeHandler().
27. loadProgress(): reads localStorage "flipbook_progress", if saved page > 1 and <= totalPages, sets state.currentPage and after 100ms calls goToPage(saved).
28. hideLoader(): adds .hidden class to loader (CSS fade out), removes from display after 500ms.
29. renderRemainingPages() called without await — renders pages 5+ in background batches of 3.

## 3.6 Reading Interaction

30. User sees the two-page spread on desktop or single page on mobile. Paper texture overlay visible. Center binding crease visible on desktop. Book shadow beneath.
31. User clicks Next (or → or Space): nextPage() → state.pageFlip.flipNext(). StPageFlip animates the page curl (right page flips left), 450ms. on("flip") fires with new index → state.currentPage set, updateUI() runs (page input, progress bar, bookmark state), saveProgress() writes to localStorage.
32. User types page number in input + Enter: change event → parseInt, validate, goToPage(val). On mobile: turnToPage(target-1). On desktop: turnToPage(Math.floor((target-1)/2)*2) for spread alignment.
33. Zoom: zoomIn/zoomOut adjust state.zoom by ±0.25 clamped [0.5, 2.5]. applyZoom() sets CSS transform:scale(Z) on .flipbook-container with transform-origin center, calls state.pageFlip.updateSize().
34. Fit Width: mobile = containerWidth*0.92 / dims.width; desktop = 1 (spread already fills width).
35. Fit Page: mobile or desktop = containerHeight*0.88 / dims.height.
36. Bookmark: toggleBookmark() reads/writes localStorage under _bookmarks key. If current page matches bookmark, removes it (shows toast "Bookmark removed"). Otherwise saves it (shows toast "Bookmarked page N"). Bookmark button SVG turns accent color when active.
37. Dark Mode: toggleDarkMode() toggles state.isDarkMode, toggles .light-mode class on body, saves to localStorage. All CSS variables swap from dark to warm paper tones.
38. Fullscreen: toggleFullscreen() calls requestFullscreen/exitFullscreen. On fullscreenchange event, calls setupFlipbook() after 300ms to re-layout.
39. Auto-hide UI: after 2500ms of inactivity, .hidden class is added to topbar and zoom-controls (slide out up/down). Mouse move or touch shows them again.
40. Keyboard shortcuts: ArrowRight/Space (next), ArrowLeft (prev), Home (first), End (last), F (fullscreen), +/- (zoom), 0 (reset), B (bookmark), D (dark mode), Esc (exit fullscreen).

## 3.7 Closing the Book

41. User clicks back arrow (<a href="library.html">) or browser back button → returns to library.html.
42. On next visit to same book: loadProgress() reads saved page from localStorage → if saved > 1, jumps to that page after 100ms → reader resumes where user left off.

---

# 4. Application Flow

## 4.1 Navigation Flow Diagram

```
index.html (script.js) ── Open Library button ──→ library.html (library.js) ── click book with animation ──→ viewer.html?book=X (viewer.js) ── back arrow ──→ library.html
```

## 4.2 Data Movement

- **books/books.json → library.js → DOM**: library.js fetches the JSON, builds HTML string from the array, sets innerHTML on #books-grid
- **books/*.pdf → library.js → DOM (covers)**: library.js loads PDF via PDF.js, renders page 1 to canvas, exports JPEG data URL, sets img.src on book-cover-img elements
- **books/*.pdf → viewer.js → DOM (pages)**: viewer.js loads PDF via PDF.js, renders each page to canvas, exports JPEG data URL, sets img.src on page-<N> elements
- **localStorage → viewer.js**: reading progress (book→page mapping) and bookmarks (_bookmarks→book→page) persisted in "flipbook_progress" key
- **URL parameter library.html → viewer.js**: encodeURIComponent(filename) passed as ?book= query param, decoded by URLSearchParams


---

# 5. PDF Rendering Pipeline

## 5.1 books.json Loading (Library Page)

1. library.js calls loadBooks() on DOMContentLoaded
2. Fetch GET "books/books.json" with no special headers
3. Response parsed as JSON via res.json() → books array
4. For each book, a HEAD fetch to "books/<file>" gets Content-Length (stored on book object as book.size, currently unused in UI display)
5. loading state hidden, applyFilters() called with the books array

## 5.2 books.json Loading (Viewer Page)

1. viewer.js calls loadBookMetadata() during init()
2. Fetch GET "books/books.json", parsed as JSON
3. Array searched via books.find(b => b.file === state.bookFile) → state.bookData
4. If found: dom.bookTitle.textContent = title, document.title = title + " — Digital Library"
5. Failure is non-critical (catches silently — viewer still works, just shows "Book Title" placeholder)

## 5.3 PDF Loading (Viewer Page)

1. loadPDF() is called during init()
2. pdfjsLib.getDocument("books/" + state.bookFile, { enableXfa: true }) initiates loading
3. The onProgress callback fires as the PDF bytes download from the server: (loaded/total)*100 → sets dom.loaderFill.style.width = pct + "%"
4. Returns a promise that resolves to a PDFDocumentProxy object (stored as state.pdfDoc)
5. state.totalPages = pdfDoc.numPages (displayed in UI as denominator)
6. First page's viewport at scale 1 is obtained to calculate pageAspectRatio = viewport.height / viewport.width (used for dimension calculations throughout)

## 5.4 Page Element Creation

1. createPageElements() runs after PDF loading
2. dom.flipbook.innerHTML = "" (clears previous, important on resize)
3. for i = 0 to totalPages-1: creates <div class="page" data-page-index="i"> with inner <img id="page-i" class="page-img" alt="Page {i+1}" draggable="false">
4. All divs appended to dom.flipbook

## 5.5 Page Rendering

1. renderPage(pageNum) is called for each page (1-indexed)
2. Checks state.renderedPages Map — if page already rendered, returns cached data URL immediately (idempotent)
3. Gets the page: await state.pdfDoc.getPage(pageNum)
4. Gets viewport at CONFIG.renderScale (1.5) — higher than display resolution for crisp rendering on retina screens
5. Creates offscreen <canvas>, gets 2D context with alpha:false (no transparency, saves memory)
6. Sets canvas dimensions to viewport width/height
7. Calls page.render({ canvasContext, viewport, intent: "print" }).promise — renders PDF page to canvas
8. Exports canvas as JPEG data URL at 88% quality (good balance of quality vs file size; JPEG is much smaller than PNG for document pages)
9. Stores data URL in state.renderedPages Map with page number as key
10. Queries the img element by id ("page-{pageNum-1}") in the DOM
11. If found: sets img.src = dataUrl, sets img.style.opacity = 0, then on next rAF adds transition:opacity 0.3s and sets opacity = 1 (fade-in effect)
12. Cleans up canvas by setting width = height = 0 (releases GPU memory)
13. On error: console.warn with page number, returns null (page stays blank but doesn't break the reader)

## 5.6 Batching Strategy

- renderPageRange(start, end): renders pages in batches of 2 concurrently via Promise.all. After each batch, updates loader progress bar. Yields to event loop (setTimeout 10ms) between batches for UI responsiveness.
- First call: renderPageRange(1, min(4, totalPages)) — renders the first spread (4 pages) synchronously before showing the book
- renderRemainingPages(): starts at page 5, renders in batches of 3 concurrently, yields 15ms between batches. Called without await (fire-and-forget) so the book UI appears immediately.

## 5.7 Cover Thumbnail Creation (Library Page)

1. renderPDFCover(book): checks pdfCovers Map cache first (returns cached if present)
2. pdfjsLib.getDocument("books/" + book.file) — loads entire PDF
3. pdf.getPage(1) — gets first page
4. Viewport at scale 0.5 — lower resolution for cover thumbnails on the bookshelf
5. Offscreen canvas, 2D context with alpha:false
6. ctx.fillStyle = "#fff", ctx.fillRect to fill white background (PDFs may have transparent backgrounds)
7. page.render({ canvasContext, viewport }).promise
8. canvas.toDataURL("image/jpeg", 0.85) — JPEG at 85% quality
9. Canvas cleanup: width=height=0
10. Cached in pdfCovers Map: key = book.file, value = dataURL
11. Returns dataURL

## 5.8 Rendering Cache

- state.renderedPages (Map<number, string>) in viewer.js: key = page number (1-indexed), value = JPEG data URL. Persists for the lifetime of the viewer page session. Never cleared — grows with page count. Each data URL is roughly 50-200KB for a typical A4 page at scale 1.5 and 88% JPEG quality.
- pdfCovers (Map<string, string>) in library.js: key = book filename, value = JPEG data URL of cover. Persists for the lifetime of the library page session. Never cleared.

## 5.9 Lazy Loading

- Library page: covers are loaded asynchronously in the background after the bookshelf renders. SVG placeholders are shown immediately, then fade-transitioned to PDF covers as they finish rendering.
- Viewer page: only the first 4 pages are rendered before the flipbook is shown. Pages 5+ render in the background. When the user flips to an unrendered page, the page shows briefly transparent/empty until its render completes (typically < 100ms per page on modern hardware).


---

# 6. Flipbook Pipeline

## 6.1 StPageFlip Initialization

setupFlipbook() is called once during initial load (after first 4 pages render) and on every resize/fullscreen change. Complete flow:

1. If state.pageFlip already exists (re-initialization on resize/fullscreen):
   - Save all .page elements from dom.flipbook into a savedPages array (Array.from)
   - Call state.pageFlip.destroy() — StPageFlip removes its internal structure
   - Set state.pageFlip = null
   - Re-append each saved page to dom.flipbook via appendChild (StPageFlip.destroy removes them from the DOM)
2. Call getPageDimensions() to calculate optimal page size (see below)
3. Determine the pages collection: use savedPages if re-initializing, otherwise use dom.flipbook.querySelectorAll(".page")
4. Create new StPageFlip.PageFlip instance:

```javascript
state.pageFlip = new StPageFlip.PageFlip(dom.flipbook, {
    width: dims.width,          // Single page width in pixels
    height: dims.height,        // Page height in pixels
    size: "fixed",              // Pages have fixed dimensions
    flippingTime: 450,           // Page flip animation duration in ms
    usePortrait: dims.single,   // true for mobile/single-page, false for desktop two-page
    startPage: max(0, min(currentPage-1, totalPages-1)),  // 0-based page index
    maxShadowOpacity: 0.55,      // Maximum darkness of the page curl shadow
    showCover: true,             // Treat first page as front cover
    mobileScrollSupport: true,   // Allow scroll on mobile
    swipeDistance: 25,           // Minimum swipe distance in px to trigger flip
    clickEvent: false,           // Disable click-to-flip (we use buttons + swipe)
    drawShadow: true,            // Draw page flip shadow
    forwardShadow: true,         // Draw shadow on forward flips
    useMouseEvents: true,        // Enable mouse drag to flip
    useTouchEvents: true,        // Enable touch/swipe to flip
});
```

5. Call state.pageFlip.loadFromHTML(pages) — StPageFlip wraps each .page div in its internal structure for animation
6. Register the "flip" event handler:
   - Fires whenever a page turn animation completes
   - e.data = new page index (0-based)
   - In two-page mode: index is the left page of the spread (always even)
   - In single-page mode: index is the current page
   - state.currentPage = index + 1
   - updateUI() refreshes page input, progress bar, bookmark icon
   - saveProgress() writes current position to localStorage
7. Call applyZoom() to set initial CSS transform scale on .flipbook-container
8. Set state.isReady = true

## 6.2 Page Dimension Calculation

getPageDimensions() computes the pixel dimensions for each page based on the current viewport:

**Single Page Mode (state.isMobile = true, viewport < 768px):**
- w = viewer container width, h = viewer container height
- pw = Math.min(w * 0.92, (h / pageAspectRatio) * 0.92)
  - Width is constrained by either 92% of container width (horizontal fit) or 92% of height divided by aspect ratio (vertical fit)
  - For a portrait PDF (aspectRatio ~1.4) in a landscape-ish viewport, the height term is usually smaller = width is height-constrained
- ph = pw * pageAspectRatio — height derived from width to maintain aspect ratio
- Returns { width, height, single: true }

**Two-Page Spread Mode (state.isMobile = false, viewport >= 768px):**
- gap = 24px (space between the two pages)
- spreadW = w - gap (total width available for both pages)
- pw = Math.floor(spreadW / 2) — each page gets half the available width
- ph = pw * pageAspectRatio
- If ph exceeds 92% of container height:
  - ph = h * 0.92 (clamp to available height)
  - pw = Math.floor(ph / pageAspectRatio) (recalculate width to maintain aspect ratio)
- Returns { width: pw, height: ph, single: false }

## 6.3 Page Turning

- **flipNext()**: turns the current rightmost page (or single page on mobile) forward. The page curls from the right edge toward the left. In two-page mode, only the right page of the current spread flips (revealing the next page on the right side).
- **flipPrev()**: turns backward. The page curls from the left edge toward the right.
- **turnToPage(index)**: jumps directly to a page index (0-based). On mobile: direct jump. On desktop: aligns to spread boundary via Math.floor((target-1)/2)*2.
- All flip methods animate over 450ms (CONFIG.flippingTime).
- After each flip completes, the "flip" event fires with the new index.

## 6.4 Page Shadows

- StPageFlip handles the dynamic page curl shadow during flips internally
- maxShadowOpacity: 0.55 — the shadow gradient on the curling page reaches at most 55% opacity
- drawShadow: true — shadows are rendered during flips
- forwardShadow: true — shadows render on forward flips specifically
- CSS: .stp-cover class adds a subtle box-shadow to the active page spread (0 0 40px rgba(0,0,0,0.4) dark, 0 0 30px rgba(0,0,0,0.1) light mode)
- CSS: .flipbook has filter: drop-shadow(0 4px 20px rgba(0,0,0,0.3)) for ambient book shadow

## 6.5 Center Binding Crease

Applied via CSS ::after pseudo-element on .flipbook itself:

```css
.flipbook::after {
    content: "";
    position: absolute;
    top: 50%; left: 50%;
    transform: translate(-50%, -50%);
    width: 2px;
    height: 95%;
    background: linear-gradient(180deg, transparent 0%, rgba(0,0,0,0.2) 20%, rgba(0,0,0,0.35) 40%, rgba(0,0,0,0.35) 60%, rgba(0,0,0,0.2) 80%, transparent 100%);
    z-index: 5;
    pointer-events: none;
    opacity: 0.6;
}
```

This creates the illusion of a book binding crease in the center of the two-page spread. It extends 95% of the page height with a gradient that is darker in the middle and fades at the top/bottom. In light mode, the shadow opacity reduces to simulate paper (0.06→0.12 gradient).

## 6.6 Open-Book Layout

The book is laid out as a horizontal spread:
- .book-viewer is the full reading area (position:fixed between topbar+progress and zoom-controls)
- .flipbook-container is positioned center via flexbox (align-items:center, justify-content:center) and sized 100%×100%
- .flipbook holds the .page elements
- Each .page is sized by StPageFlip based on the configured width/height
- On desktop (usePortrait: false), StPageFlip displays two pages side by side
- On mobile (usePortrait: true), StPageFlip displays a single page

## 6.7 Portrait PDF → Landscape Open Book Conversion

A PDF in portrait orientation (height > width, aspectRatio ~1.414) displayed on desktop in two-page spread mode:
- Each page keeps its portrait aspect ratio
- Two pages are placed side by side, forming a landscape spread (wider than tall)
- The spread width = 2 * pageWidth + gap, which roughly equals the container width
- The center binding crease visually separates the two pages
- The result resembles a physical open book or magazine


---

# 7. UI Architecture

## 7.1 Landing Page (index.html)

- **Hero (.hero)**: Full viewport height, flex centered, uses z-index layering
- **Background (.hero-bg)**: Absolutely positioned with two .hero-glow divs that are radial-gradient circles animated with glowFloat (8s ease-in-out infinite alternate)
- **Content (.hero-content)**: Centered text column, max-width 640px
- **Badge (.hero-badge)**: Glassmorphism pill (backdrop-filter: blur(10px), semi-transparent bg, border)
- **Title (.hero-title)**: clamp(3rem, 10vw, 5.5rem) responsive font size, gradient text via background-clip
- **Subtitle (.hero-subtitle)**: Lighter color, 1.0-1.2rem font size
- **Button (.hero-btn)**: Purple gradient with hover effect (lift 2px, shadow expands), uses ::before for hover overlay
- **Footer (.footer)**: Fixed bottom, centered text, text-tertiary color

## 7.2 Library Page (library.html)

- **Topbar (.topbar)**: Fixed top, backdrop-filter blur, glassmorphism, contains logo-link to index.html, search input, sort select
- **Search (.search-input)**: Full-width input with inline SVG search icon positioned left, accent-colored focus ring, transitions
- **Sort (.sort-select)**: Native select with custom dropdown arrow SVG via background-image, custom styled options
- **Library Header**: "Browse Library" title, book count text
- **State Containers**: loading-state (spinner + "Loading books..."), empty-state (search icon + "No books found"), error-state (X icon + error message + retry button). Only one visible at a time.
- **Books Grid (#books-grid)**: Flex column container of .shelf-row elements
- **Shelf Rows**: Each row has .shelf-books (flex row, align-items:flex-end) and .shelf-board (wooden shelf)
- **Book Spine (.book-spine)**: Fixed width via --book-width variable, flex-shrink:0, 3D appearance
- **Book Cover (.book-spine-cover)**: Contains cover <img>, ::after for 3D right-edge thickness (6px shadow gradient), overflow:hidden
- **Gloss (.book-spine-gloss)**: Diagonal gradient overlay with mix-blend-mode:overlay, opacity 0 on default, 1 on hover
- **Label (.book-spine-label)**: Title text at bottom, hidden by default (opacity 0, translateY 4px), visible on hover
- **Footer**: Same as landing page but NOT fixed (scrolls with content)

## 7.3 Viewer Page (viewer.html)

- **Error Overlay (#error-page)**: Positioned fixed, z-index 1000, centered content, shown on load failure. Has "Back to Library" link and "Retry" button.
- **Loading Overlay (#loading-spinner)**: Positioned fixed, z-index 999, fade out via CSS transition when .hidden. Contains spinner ring, "Loading book..." text, progress bar track/fill.
- **Topbar (#viewer-topbar)**: Fixed top, height 56px, backdrop-filter blur, slides up out of view with .hidden class (translateY(-100%), opacity 0). Contains:
  - Left section: back arrow link to library.html, book title (truncated with ellipsis)
  - Center section: First, Prev buttons; page indicator (input + separator + total span); Next, Last buttons
  - Right section: Bookmark, Dark Mode, Fullscreen buttons
- **Progress Bar (#progress-bar)**: Fixed at top (below topbar), 3px height, gradient fill, shows percentage text
- **Reading Area (#book-viewer)**: Fixed between topbar+progress and zoom-controls, flex center, reading desk background
- **Flipbook Container (#flipbook-container)**: Centers .flipbook, applies zoom CSS transform
- **Flipbook (#flipbook)**: Holds .page elements, has StPageFlip wrapper, drop-shadow, center binding crease
- **Pages (.page)**: flex-center content, dark background (#1a1a20), paper texture ::before overlay (SVG fractal noise), images inside with object-fit:contain
- **Zoom Controls (#zoom-controls)**: Fixed bottom, height 48px, backdrop-filter blur, slides down with .hidden. Contains: zoom out, zoom level text, zoom in, fit width, fit page, download PDF, share link. Separators between groups.
- **Toast (#toast)**: Positioned above zoom controls, glassmorphism, auto-dismissing with slide-in/out CSS animations

## 7.4 Navigation

- First/Prev/Next/Last buttons: direct StPageFlip API calls
- Page input: keyboard-enter triggers goToPage()
- Keyboard: ArrowRight/ArrowLeft/Space/Home/End
- Touch: swipe (StPageFlip handles via useTouchEvents)
- Mouse drag: StPageFlip handles via useMouseEvents

## 7.5 Search

- Real-time search on input event (no debounce — triggers on every keystroke)
- Case-insensitive substring match against book title
- Re-renders the entire bookshelf on each keystroke (full innerHTML replacement)
- Books-per-row is recalculated on each render (handles resize)

## 7.6 Bookmark

- Stored in localStorage under flipbook_progress → "_bookmarks" → book file → page number
- Toggle on/off: same button sets or removes the bookmark
- Visual indicator: bookmark icon turns accent color when current page is bookmarked
- Toast feedback: "Bookmarked page N" / "Bookmark removed"

## 7.7 Dark Mode

- Default: dark mode (--bg: #0a0a12, dark desk gradients, white text)
- Toggle: adds/removes .light-mode class on <body>
- Light mode: warm paper theme (--bg: #f0eeeb, beige desk, dark text)
- Persisted in localStorage under "flipbook_darkmode" key
- Applied on page load (loadTheme() runs before DOMContentLoaded)

## 7.8 Fullscreen

- Uses Fullscreen API: document.documentElement.requestFullscreen() / document.exitFullscreen()
- On fullscreenchange event: re-initializes StPageFlip after 300ms for new viewport dimensions
- Fullscreen state tracked in state.isFullscreen


---

# 8. Animation System

## 8.1 Landing Page Entrance

| Property | Value |
|---|---|
| Trigger | DOMContentLoaded |
| Element | .hero-content |
| JS/CSS | CSS, applied via JS |
| Initial state | opacity:0, transform:translateY(20px) |
| Final state | opacity:1, transform:translateY(0) |
| Duration | 800ms |
| Easing | ease |
| Purpose | Subtle fade-in on page load |

## 8.2 Landing Page Glow Orbs

| Property | Value |
|---|---|
| Trigger | Page load (CSS animation) |
| Elements | .hero-glow, .glow-2 |
| JS/CSS | CSS @keyframes glowFloat |
| Animation | translate(0,0) scale(1) → translate(40px,-30px) scale(1.1) |
| Duration | 8s (alternating, continuous) |
| Easing | ease-in-out |
| Delay | 0s (first), -4s (second — out of phase) |
| Purpose | Ambient floating light effect |

## 8.3 Library Entrance (Books Stagger)

| Property | Value |
|---|---|
| Trigger | renderBooks() → rAF |
| Elements | .book-spine, .shelf-board |
| JS/CSS | CSS class toggle via JS setTimeout |
| Initial state | opacity:0, transform:translateY(20px) (books); opacity:0 (shelves) |
| Final state | opacity:1, transform:translateY(0) |
| Duration | 500ms opacity, 500ms transform (books); 600ms opacity (shelves) |
| Stagger | 40ms between each book; shelves after 200ms base + 80ms stagger |
| Purpose | Sequential reveal of books on the shelf |

## 8.4 Book Hover Effects

| Property | Value |
|---|---|
| Trigger | :hover on .book-spine |
| JS/CSS | Pure CSS |
| Transform | translateY(-16px) scale(1.05) rotateY(-3deg) |
| z-index | 20 (above neighbors) |
| Transition | 0.45s cubic-bezier(0.34, 1.56, 0.64, 1) |
| Sub-effects | Gloss opacity 0→1 (0.45s), label opacity+translateY (0.3s), cover img scale 1→1.04 (0.45s), box-shadow expands |
| Purpose | 3D lift effect when browsing books |

## 8.5 Opening Animation (Book Click)

| Property | Value |
|---|---|
| Trigger | Click on .book-spine |
| JS/CSS | Web Animations API (JS) |
| Implementation | Clone element at fixed position, animate to center |
| Duration | 800ms animation + 150ms delay before navigation |
| Easing | cubic-bezier(0.34, 1.56, 0.64, 1) — overshoot |
| Keyframes | 0%: identity; 30%: 30% to center, scale 1.15, rotateY -5deg, brightness 1.2; 60%: 70% to center, scale 1.7, rotateY -3deg, brightness 1.4; 85%: centered, scale to fit, brightness 1.6; 100%: scale slightly larger (1.08x), brightness 1.8 |
| Backdrop | Overlay transitions from transparent to rgba(0,0,0,0.7) over 0.5s |
| Purpose | Cinematic zoom-into-book transition from shelf to reader |

## 8.6 Page Flip Animation

| Property | Value |
|---|---|
| Trigger | flipNext(), flipPrev(), turnToPage(), swipe, drag |
| JS/CSS | StPageFlip internal (hardware-accelerated CSS transforms) |
| Duration | 450ms (CONFIG.flippingTime) |
| Shadow | Dynamic page curl shadow, max 55% opacity |
| Purpose | Realistic page turning |

## 8.7 Page Fade-In (Render)

| Property | Value |
|---|---|
| Trigger | renderPage() completes |
| JS/CSS | CSS transition applied via JS |
| Initial state | opacity:0 |
| Final state | opacity:1 |
| Duration | 300ms |
| Easing | ease |
| Purpose | Smooth reveal of newly rendered PDF pages |

## 8.8 Cover Fade-In (Library)

| Property | Value |
|---|---|
| Trigger | loadPDFCovers() replaces placeholder |
| JS/CSS | CSS transition applied via JS |
| Initial state | opacity:0 |
| Final state | opacity:1 |
| Duration | 500ms |
| Easing | ease |
| Purpose | Smooth cover replacement from SVG placeholder to rendered PDF image |

## 8.9 Loading Spinner

| Property | Value |
|---|---|
| Trigger | Page load |
| JS/CSS | CSS @keyframes spin |
| Animation | 360° rotation |
| Duration | 0.8s linear infinite |
| Purpose | Indicate ongoing background activity |

## 8.10 UI Auto-Hide (Viewer)

| Property | Value |
|---|---|
| Trigger | 2500ms of no mouse/touch/scroll activity |
| JS/CSS | CSS class toggle (.hidden) via JS timer |
| Animation | Topbar: translateY(-100%) + opacity 0; Zoom: translateY(100%) + opacity 0 |
| Duration | 300ms ease |
| Reversal | On mousemove, touchstart, scroll |

## 8.11 Toast Notification

| Property | Value |
|---|---|
| Trigger | showToast() called |
| JS/CSS | CSS @keyframes toastIn + toastOut |
| Animation | toastIn: opacity 0→1, translateY(10px)→0 over 0.3s; toastOut: opacity 1→0, translateY(0)→(-10px) over 0.3s after 2s delay |
| Purpose | Non-intrusive feedback for bookmark, share, copy actions |

---

# 9. Responsive Design

## 9.1 Breakpoints

The project uses three breakpoints: 1024px, 768px, 480px.

### Desktop (>= 1024px)
- Library: 7-8 books per row, book covers 90px×230px
- Viewer: Two-page spread with center binding crease, full control bars visible
- Full keyboard navigation

### Tablet (768px - 1023px)
- Library: 6 books per row, book covers 80px×200px
- Viewer: Still two-page spread (breakpoint is 768px), slightly smaller controls
- Topbar controls compacted (gap reduced, button size smaller)

### Mobile Portrait (480px - 767px)
- Library: 5 books per row, book covers 65px×170px
- Viewer: Single page (isMobile = true for < 768px), controls compacted
- Book title truncated to 120px max-width
- Hover lift reduced: translateY(-16px) → translateY(-10px) scale(1.03) rotateY(-2deg)

### Small Mobile (< 480px)
- Library: 4 books per row, book covers 50px×130px
- Viewer: First and last page buttons hidden (only prev/next shown)
- Book title hidden
- Zoom controls: some buttons hidden (nth-child selectors)
- Shelf gaps minimized

## 9.2 Viewer Mode Switching

- state.isMobile = window.innerWidth < 768, recalculated on resize
- Single page mode: mobile → usePortrait=true, turnToPage() uses direct index
- Two-page mode: desktop → usePortrait=false, turnToPage() aligns to spread boundary
- getPageDimensions() uses isMobile to choose single vs spread calculation

## 9.3 Resize Handling (Library)

- Window resize triggers re-render of bookshelf after 300ms debounce
- Books-per-row recalculated based on new window width
- Full innerHTML replacement on every resize

## 9.4 Resize Handling (Viewer)

- Window resize triggers after 250ms debounce
- state.isMobile recalculated
- StPageFlip re-initialized with new dimensions (setupFlipbook called within requestAnimationFrame)
- .flipbook-container gets .resizing class during re-init (opacity: 0 for 150ms transition, prevents visual flash)
- Current page restored via goToPage after rebuild


---

# 10. JavaScript Architecture

## 10.1 script.js (20 lines)

**Structure**: Top-level module pattern (no IIFE, no export). Single DOMContentLoaded listener.

**Function**: Anonymous callback.
- **Called by**: DOMContentLoaded event
- **Returns**: undefined
- **Side effects**: Mutates .hero-content inline styles
- **Input**: None (reads DOM)
- **Logic**:
  1. querySelector(".hero-content") → heroContent
  2. If exists: set heroContent.style.opacity = "0", heroContent.style.transform = "translateY(20px)"
  3. requestAnimationFrame: set transition CSS + opacity "1" + translateY "0"

## 10.2 library.js (316 lines)

**Structure**: Top-level async IIFE wrapped in DOMContentLoaded listener. All functions are closures inside the callback (they share the books, filteredBooks, pdfCovers variables).

**Variables** (closure scope):
- `books`: Full book catalog from books.json (never reassigned after load)
- `filteredBooks`: Currently filtered/sorted subset of books
- `pdfCovers`: Map<string, string> caching rendered PDF cover data URLs

**Functions**:

### generateCoverPlaceholder(title)
- **Called by**: renderBooks
- **Input**: title string
- **Returns**: base64 SVG data URL string
- **Logic**: Hash the title characters to pick a gradient palette, extract first 2 initials, build SVG with gradient rect + initials text, base64 encode

### renderPDFCover(book)
- **Called by**: loadPDFCovers
- **Input**: book object { title, file }
- **Returns**: Promise<string|null> (data URL or null)
- **Side effects**: Adds entry to pdfCovers Map; loads PDF from network
- **Logic**: Check cache → load PDF via pdfjsLib → get page 1 → render to canvas at 0.5 scale → export JPEG → cache → return dataUrl

### getBookWidth(title, index)
- **Called by**: renderBooks
- **Input**: title string, index number
- **Returns**: number (pixel width, 84-96)
- **Logic**: base 90 + (charCodeAt(0) % 5 - 2) * 6

### renderBooks(booksArray)
- **Called by**: applyFilters, resize handler
- **Input**: array of book objects
- **Returns**: undefined
- **Side effects**: Replaces grid.innerHTML, triggers entrance animations, binds click handlers, starts cover rendering
- **Logic**: Calculate books-per-row from window width → build HTML string of shelf rows → set innerHTML → stagger .visible class additions → bind click→openBook → call loadPDFCovers

### loadPDFCovers(booksArray)
- **Called by**: renderBooks
- **Input**: array of book objects
- **Returns**: Promise<void> (async)
- **Side effects**: Mutates img.src in DOM
- **Logic**: For each book not in cache → await renderPDFCover → query matching img elements → fade-in new src

### openBook(el)
- **Called by**: Click handler on .book-spine
- **Input**: DOM element (the clicked .book-spine)
- **Returns**: undefined (but initiates navigation)
- **Side effects**: Navigates away from page; creates and animates DOM elements (clone, overlay)
- **Logic**: Early return if opening → add .opening class → clone element → position clone at coords → create overlay → rAF → darken overlay → calculate center transform → animate with Web Animations API → on finish → navigate to viewer.html

### applyFilters()
- **Called by**: searchInput input event, sortSelect change event, loadBooks, resize handler
- **Input**: None (reads from DOM: searchInput.value, sortSelect.value)
- **Returns**: undefined
- **Side effects**: Sets filteredBooks, calls renderBooks, updates count text
- **Logic**: Filter books by search query (lowercase includes) → sort by selected criterion → renderBooks(filtered) → update count display

### loadBooks()
- **Called by**: DOMContentLoaded callback (immediately invoked)
- **Input**: None
- **Returns**: Promise<void> (async)
- **Side effects**: Sets books variable, hides loading state, shows error state on failure
- **Logic**: Fetch books.json → parse → HEAD-request file sizes → hide loading → applyFilters

## 10.3 viewer.js (859 lines)

**Structure**: Top-level module with CONFIG (Object.freeze-like), state (mutable), dom (populated by cacheDOM), and function definitions. loadTheme() runs synchronously at parse time. init() registered as DOMContentLoaded listener.

### CONFIG object
Application-wide constants:
- renderScale: 1.5 (canvas resolution multiplier)
- flippingTime: 450ms (StPageFlip animation duration)
- defaultZoom: 1, minZoom: 0.5, maxZoom: 2.5, zoomStep: 0.25
- localStorageKey: "flipbook_progress"
- uiHideDelay: 2500ms
- booksPath: "books/"
- coversPath: "covers/" (unused legacy)

### state object
Mutable application state:
- pdfDoc: PDFDocumentProxy | null
- pageFlip: StPageFlip.PageFlip instance | null
- currentPage: number (1-indexed)
- totalPages: number
- zoom: number
- renderedPages: Map<number, string>
- isRendering: boolean
- isDarkMode: boolean
- isFullscreen: boolean
- isMobile: boolean (window.innerWidth < 768)
- isReady: boolean (StPageFlip initialized)
- isUIVisible: boolean
- uiHideTimer: null
- wasInteracting: boolean
- bookData: object | null
- bookFile: string | null
- pageAspectRatio: number (height/width)

### $, dom, cacheDOM()
- $ is shorthand for document.getElementById
- dom object cached by cacheDOM() which assigns ~25 DOM references
- Called once at start of init()

### init()
- **Called by**: DOMContentLoaded event
- **Returns**: Promise<void> (async)
- **Logic**: cacheDOM → read ?book param → guard → try: loadBookMetadata → loadPDF → createPageElements → renderPageRange(1-4) → setupFlipbook → setupControls → setupKeyboard → setupAutoHideUI → setupResizeHandler → loadProgress → hideLoader → renderRemainingPages (no-await) → catch → showError

### loadBookMetadata()
- **Called by**: init
- **Returns**: Promise<void> (async, catches errors silently)
- **Side effects**: Sets dom.bookTitle.textContent, document.title, state.bookData
- **Logic**: Fetch books.json → find matching book → update UI

### loadPDF()
- **Called by**: init
- **Returns**: Promise<void> (async)
- **Side effects**: Sets state.pdfDoc, state.totalPages, state.pageAspectRatio, updates dom.totalPagesEl, updates loader progress
- **Logic**: pdfjsLib.getDocument → onProgress → await promise → extract metadata → get first page viewport for aspect ratio

### createPageElements()
- **Called by**: init, resize (indirectly via setupFlipbook cleanup)
- **Returns**: undefined
- **Side effects**: Clears and recreates all .page elements in dom.flipbook
- **Logic**: dom.flipbook.innerHTML = "" → for each page: create div.page > img.page-img → append

### renderPageRange(startPage, endPage)
- **Called by**: init
- **Input**: start and end page numbers (1-indexed)
- **Returns**: Promise<void>
- **Logic**: Batch pages by 2, render each batch concurrently via Promise.all, update loader bar, yield 10ms between batches

### renderRemainingPages()
- **Called by**: init (no await — fire and forget)
- **Returns**: Promise<void>
- **Logic**: If totalPages <= 4, return. Batch pages 5+ by 3, render concurrently, yield 15ms between batches

### renderPage(pageNum)
- **Called by**: renderPageRange, renderRemainingPages
- **Input**: page number (1-indexed)
- **Returns**: Promise<string | null> (data URL)
- **Side effects**: Updates renderedPages Map, sets img.src on DOM element, triggers opacity transition
- **Logic**: Check cache → getPage → getViewport at 1.5x → create canvas → render PDF → toDataURL JPEG 88% → cache → update img with fade-in → cleanup canvas

### getPageDimensions()
- **Called by**: setupFlipbook, applyZoom, zoomFitWidth, zoomFitPage
- **Returns**: { width: number, height: number, single: boolean }
- **Logic**: Measure container → if mobile: single page with min(92% width, height/AR*92%) → else: two-page spread with gap 24px, clamp height to 92%, recalculate width if clamped

### setupFlipbook()
- **Called by**: init, resize handler, fullscreenchange handler
- **Returns**: undefined
- **Side effects**: Destroys old StPageFlip instance, creates new one, sets state.isReady = true
- **Logic**: Save existing .page elements → destroy old flipbook → re-append pages → getPageDimensions → new PageFlip(config) → loadFromHTML(pages) → register flip event → applyZoom → set isReady

### applyZoom()
- **Called by**: setupFlipbook, zoomIn, zoomOut, zoomReset, zoomFitWidth, zoomFitPage
- **Returns**: undefined
- **Side effects**: Sets CSS transform, updates zoom level display, calls pageFlip.updateSize
- **Logic**: Set transform:scale(Z) on .flipbook-container → update dom.zoomLevel textContent → set .flipbook dimensions → call pageFlip.updateSize

### zoomIn(), zoomOut(), zoomReset()
- **Called by**: Button clicks, keyboard shortcuts
- **Logic**: Increment/decrement/reset state.zoom (clamped), call applyZoom

### zoomFitWidth(), zoomFitPage()
- **Called by**: Button clicks
- **Logic**: Calculate zoom to fit width or height based on container dimensions and page dimensions, apply

### updateUI()
- **Called by**: flip event, goToPage
- **Side effects**: Updates page input, progress bar, bookmark button color

### goToPage(pageNum)
- **Called by**: loadProgress, first/last page, page input, keyboard
- **Logic**: Clamp page number → if mobile: turnToPage(target-1) → if desktop: turnToPage(spreadStart) → update state and UI

### nextPage(), prevPage(), firstPage(), lastPage()
- **Called by**: Button clicks, keyboard shortcuts
- **Logic**: Guard for bounds, call pageFlip.flipNext/flipPrev or goToPage(1/totalPages)

### saveProgress(), loadProgress()
- **Called by**: flip event (save), init (load)
- **Logic**: Read/write localStorage "flipbook_progress" with { [bookFile]: pageNumber }
- loadProgress: if saved > 1 and ≤ totalPages, setTimeout → goToPage(saved) after 100ms

### getBookmarkedPage(), toggleBookmark()
- **getBookmarkedPage**: Reads localStorage _bookmarks → returns page number or null
- **toggleBookmark**: If current page is bookmarked → remove → show "removed" toast. Else → save → show "bookmarked N" toast. Updates button color.

### toggleFullscreen()
- **Called by**: Button, keyboard
- **Logic**: requestFullscreen / exitFullscreen

### fullscreenchange listener
- Re-initializes StPageFlip after 300ms for new viewport

### toggleDarkMode(), loadTheme()
- **toggleDarkMode**: Toggles state and body class, saves to localStorage
- **loadTheme**: Runs at parse time, reads saved preference, applies class

### downloadPDF()
- **Called by**: Download button
- **Logic**: Creates temporary <a> with href to PDF file, triggers click, removes

### shareLink()
- **Called by**: Share button
- **Logic**: If navigator.share available → use Web Share API. Else → copy to clipboard via navigator.clipboard.writeText. Shows toast on success/failure.

### showToast(message)
- **Called by**: toggleBookmark, shareLink
- **Logic**: Clears previous timer → sets text → shows with CSS animation → hides after 2500ms

### setupControls()
- **Called by**: init
- **Logic**: Adds click event listeners to all control buttons

### setupKeyboard()
- **Called by**: init
- **Logic**: Adds keydown listener with switch on key codes. Ignores when INPUT/textarea is focused (except Enter on page-input).

### setupAutoHideUI()
- **Called by**: init
- **Logic**: On mousemove/touchstart/scroll: show topbar+zoom, reset timer. After 2500ms inactivity: hide. Stay visible when hovering over controls.

### setupResizeHandler()
- **Called by**: init
- **Logic**: On resize: debounce 250ms → update isMobile → add .resizing class → rAF → setupFlipbook → remove .resizing → goToPage(currentPage)

### showError(message), hideLoader()
- **showError**: Shows error overlay, sets message text, hides loader
- **hideLoader**: Adds .hidden class to loader (CSS fade), removes from display after 500ms


---

# 11. CSS Architecture (continued)

## 11.1 CSS Variables

Each CSS file declares its own :root variables independently. Key variables across files:

**Shared naming convention**: --bg-primary, --text-primary, --accent, --radius-*, --transition, --font.
**File-specific additions**:
- library.css: --shelf-wood-top, --shelf-wood-bottom
- viewer.css: --topbar-height (56px), --progress-height (3px), --zoom-controls-height (48px)

Dark mode in viewer.css uses body.light-mode class to override --bg, --text, --surface, --border etc. Library and landing page do not have light mode.

## 11.2 Layout

- Landing: Full viewport hero, flex centered, fixed footer
- Library: Fixed topbar, scrollable content area, flex column bookshelf
- Viewer: Fixed topbar + progress + reading area + zoom controls — four fixed-position stacked bars forming a frame. Reading area is the remaining space.

## 11.3 Bookshelf CSS

- .books-grid: flex column, gap 8px
- .shelf-row: flex column (books sit above shelf board)
- .shelf-books: flex row with align-items:flex-end (books stand on the shelf), gap 6px, min-height 240px, padding 0 12px
- .shelf-board: 14px height, wooden gradient (linear-gradient 180deg from #4a3424 to #2d1d14 to #1a1210), layered box-shadows for 3D depth, ::after for wood grain (repeating-linear-gradient)
- .book-spine: relative, flex-shrink:0, cursor pointer, transition transform 0.45s with overshoot easing
- .book-spine-cover: --book-width × 230px default, dark background (#16161f), rounded corners 3px, right-shadow (3px 0 12px) for depth, ::after for spine thickness (6px dark gradient on right edge)
- .book-spine-gloss: absolute overlay, diagonal gradient (105deg, transparent 30% → white 40-44% → transparent 50%), mix-blend-mode:overlay, opacity 0 → 1 on hover
- .book-spine-label: absolute bottom 8px, truncated text (ellipsis), white shadow, hidden by default (opacity 0, translateY 4px), appears on hover

## 11.4 Reading Desk CSS (viewer.css)

Background is created entirely with CSS pseudo-elements:

- .book-viewer::before: The desk surface. Dark mode: multiple radial gradients (purple, blue accents) over a linear gradient (dark to darker). Light mode: radial gradient (warm beige tones) over linear gradient (light beige to tan).
- .book-viewer::after: Vignette effect. box-shadow:inset 0 0 120px rgba(0,0,0,0.3) dark / 0.08 light.
- .flipbook-container::before: Book shadow beneath spread. radial-gradient ellipse, 40px height, positioned below the book.

## 11.5 Paper Texture

- .flipbook .page::before: SVG filter
- Uses inline data:image/svg+xml with feTurbulence (fractalNoise, baseFrequency 0.9, 4 octaves)
- Dark mode: opacity 0.04, mix-blend-mode: overlay
- Light mode: opacity 0.5, mix-blend-mode: multiply
- Background size: 128px × 128px, repeated

## 11.6 Shadows

- Landing: --shadow-sm/md/lg/glow CSS variables
- Library: Book box-shadows with 3px offset right for 3D depth, hover shadow via ::before box-shadow (20px 60px black)
- Viewer: flipbook drop-shadow (4px 20px black 30%), .stp-cover box-shadow (0 0 40px black 40%), vignette inset shadow, book shadow beneath (radial gradient)

## 11.7 Typography

- Font: Inter (variable weight 300-800) loaded from Google Fonts
- Size: root 16px, hero title clamp(3rem, 10vw, 5.5rem), book label 0.65rem, page input 0.85rem
- Weights: 400 body, 500 medium, 600 semibold, 700 bold, 800 extra-bold (hero title)

## 11.8 Book 3D Effects

Spine thickness: .book-spine-cover::after — a 6px wide gradient strip on the right edge simulating the paper block. On the spine cover itself, box-shadow with 3px X-offset adds shadow depth on the right side.

## 11.9 Viewer Topbar/Zoom Controls

Both use fixed positioning, backdrop-filter blur (16px), semi-transparent backgrounds, .hidden class for slide-out animations (topbar: translateY -100%, zoom: translateY 100%). topbar z-index 50, zoom controls z-index 50.

## 11.10 Page Cells (viewer.css)

- .flipbook .page: flex center, overflow hidden, background #1a1a20
- .page::before: paper texture overlay (z-index 2)
- .page img: object-fit contain, width 100%, height 100%, z-index 1
- .flipbook::after: center binding crease (z-index 5, pointer-events none)

---

# 12. Data Structures

## 12.1 books/books.json

```json
[
    {
        "title": "Reverie Yearbook Farewell",
        "file": "reverie yearbook farwell.pdf",
        "cover": ""
    }
]
```

- title: string — display name (max ~20 chars before truncation on shelf)
- file: string — relative path from books/ directory
- cover: string — legacy field, currently unused

## 12.2 In-Memory State (library.js)

- `books`: Book[] — full catalog array
- `filteredBooks`: Book[] — currently filtered/sorted subset
- `pdfCovers`: Map<string, string> — filename → JPEG data URL cache

## 12.3 In-Memory State (viewer.js)

- `state`: Object with all runtime state (see Section 10.3)
- `state.renderedPages`: Map<number, string> — page number (1-indexed) → JPEG data URL
- `dom`: Object — cached DOM element references

## 12.4 localStorage Structure

Single key "flipbook_progress" storing JSON:

```json
{
    "reverie yearbook farwell.pdf": 5,
    "another-book.pdf": 12,
    "_bookmarks": {
        "reverie yearbook farwell.pdf": 8
    }
}
```

- Book filenames as keys → current page number
- "_bookmarks" sub-object → book file → bookmarked page number
- "flipbook_darkmode" separate key → "true" or "false" string
- All wrapped in try/catch for storage-unavailable scenarios (private browsing, quota exceeded)

## 12.5 Page Number Convention

- All internal state: 1-indexed (currentPage = 1 means first page)
- StPageFlip: 0-indexed (e.data returns 0 for first page)
- Conversion: state.currentPage = index + 1; turnToPage(target - 1);

## 12.6 Zoom

- state.zoom: float, default 1.0, range [0.5, 2.5], step 0.25
- Applied as CSS transform: scale(Z) on .flipbook-container
- transform-origin: center center

---

# 13. External Libraries

## 13.1 Mozilla PDF.js 3.11.174

**Why**: Renders PDF documents to canvas elements in the browser. Required for extracting page images to display in the flipbook and for generating cover thumbnails.

**CDN URLs**:
- Library page: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
- Viewer page: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js
- Worker: https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js

**Initialization**: In both library.html and viewer.html, after the PDF.js script tag, an inline <script> sets:
```javascript
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
```
The worker runs in a separate thread and handles the heavy PDF parsing/rendering.

**Files using PDF.js**: library.js, viewer.js

**Functions depending on PDF.js**:
- library.js: renderPDFCover() — uses pdfjsLib.getDocument, pdf.getPage, page.render
- viewer.js: loadPDF() — uses pdfjsLib.getDocument with onProgress callback
- viewer.js: renderPage() — uses pdfDoc.getPage, page.getViewport, page.render

## 13.2 StPageFlip (page-flip) 2.0.7

**Why**: Provides realistic page-flip animation with hardware-accelerated CSS transforms, touch/mouse/swipe support, and two-page spread mode. Essential for the flipbook reading experience.

**CDN URL**: https://cdn.jsdelivr.net/npm/page-flip@2.0.7/dist/js/page-flip.browser.min.js

**Initialization**: Loaded via <script> tag in viewer.html. The library exposes window.StPageFlip.

**Files using StPageFlip**: viewer.js

**Functions depending on StPageFlip**:
- setupFlipbook(): Creates PageFlip instance with configuration, loads pages via loadFromHTML(), registers flip event handler
- nextPage(): pageFlip.flipNext()
- prevPage(): pageFlip.flipPrev()
- goToPage(): pageFlip.turnToPage(index)
- applyZoom(): pageFlip.updateSize()

## 13.3 Google Fonts (Inter)

**Why**: Clean, modern, highly legible sans-serif font for all UI text. Free, fast CDN delivery.

**Load URLs**: https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800&display=swap (landing/library) / wght@300;400;500;600;700 (viewer, fewer weights).

**Files using Inter**: All three CSS files reference --font: "Inter", -apple-system, ...

## 13.4 Inline SVGs

**Why**: Zero external icon dependencies. All icons (book, search, navigation arrows, zoom controls, etc.) are inline SVG elements in the HTML.

**Files using SVGs**: All three HTML files contain inline SVGs.

---

# 14. Error Handling

## 14.1 Missing PDF File (Library)

- renderPDFCover() try/catch returns null → cover remains as SVG placeholder
- Books without valid PDFs still appear on the shelf with gradient placeholder covers

## 14.2 Missing PDF File (Viewer)

- pdfjsLib.getDocument throws → caught by init() try/catch → showError() displays error overlay
- Error message: "Failed to load book." (generic, caught exception message may be more specific)
- User can click "Back to Library" or "Retry"

## 14.3 Invalid books.json

- library.js: fetch fails or JSON parse fails → caught in loadBooks() → error state displayed with message "Could not load books.json. Make sure the file exists." or HTTP error
- viewer.js: loadBookMetadata() catches silently → book title remains "Book Title" placeholder, viewer still loads PDF (metadata is non-critical)

## 14.4 Broken CDN (PDF.js or StPageFlip)

- If PDF.js fails to load: pdfjsLib is undefined → ReferenceError → init() try/catch → showError("Failed to load book.")
- If StPageFlip fails to load: StPageFlip is undefined → ReferenceError in setupFlipbook → init() try/catch → showError

## 14.5 Network Failure

- PDF fetch fails → pdfjsLib.getDocument rejects → init() try/catch → showError
- books.json fetch fails → same handling as invalid books.json

## 14.6 Page Rendering Failure

- Individual renderPage() calls catch the error and console.warn with the page number → returns null (page stays blank but flipbook continues working)

## 14.7 Unsupported Browser

- No explicit browser detection. Minimum requirements: ES2020 (async/await, Map, Arrow functions, etc.), Fullscreen API, localStorage. Older browsers may fail silently.
- The clipboard API (navigator.clipboard) requires HTTPS or localhost — falls back to showing "Failed to copy link" toast.

## 14.8 localStorage Unavailable

- All localStorage access is wrapped in try/catch. If storage is unavailable (private browsing in some browsers, quota exceeded), progress saving/bookmarks silently fail without breaking the reader.

## 14.9 Missing URL Parameter (Viewer)

- If viewer.html is accessed without ?book= parameter: showError("No book specified. Please select a book from the library.") — prevents rendering blank flipbook


---

# 15. Performance

## 15.1 Lazy Rendering (Viewer)

The most impactful optimization. Instead of rendering every PDF page before showing the flipbook:
- First 4 pages are rendered synchronously (blocking the loader)
- StPageFlip is initialized after these 4 pages — the book appears within ~1-2 seconds for a typical PDF
- Remaining pages render in the background (batches of 3, no-await, with 15ms event loop yields)
- Newly rendered pages fade in via CSS opacity transition

This means the user can start flipping immediately. For a 100-page PDF, the perceived load time is ~2 seconds instead of ~20+ seconds.

## 15.2 Batching

Both library and viewer use request batching:
- Viewer page rendering: 2 pages per batch for initial render, 3 per batch for background
- 10-15ms setTimeout yields between batches to keep the event loop responsive
- Library PDF cover rendering: sequential (one at a time) to avoid overwhelming the PDF.js worker with concurrent requests

## 15.3 Memory Management

- Canvas elements are cleaned up immediately after export (width = height = 0) — this signals the browser to release GPU/CPU memory
- Rendered pages are stored as JPEG data URLs (not canvas elements) — strings are memory-efficient
- JPEG quality 88% for viewer pages, 85% for covers — good visual quality at ~50-200KB per page
- pdfCovers Map grows unboundedly with book count in the library (but typically small, < 100 entries)
- renderedPages Map grows unboundedly with page count — never cleared (could be O(n) memory issue for very large PDFs with hundreds of pages)

## 15.4 Canvas Resolution

- renderScale: 1.5 — renders PDF pages at 1.5x the nominal resolution. This ensures crisp rendering on Retina/HiDPI displays where the canvas is displayed at a smaller CSS size via object-fit:contain. The extra resolution is downsampled by the browser.
- Cover scale: 0.5 — covers are rendered at half resolution (thumbnails don't need full detail)

## 15.5 CSS Performance

- Page flip animations use hardware-accelerated CSS transforms in StPageFlip
- Zoom uses CSS transform: scale (composited layer, no repaint)
- Backdrop-filter: blur uses GPU when available
- Transitions use opacity and transform only (paint/composite, no layout)

## 15.6 DOM Minimization

- Library renders books once and replaces entire innerHTML on filter/sort/resize — not incremental. Acceptable for small collections (< 100 books), would be slow for large collections.
- Viewer creates all page DOM elements upfront (createPageElements) — avoids DOM insertion during rendering
- Page <img> elements are reused — src is updated, not replaced

## 15.7 Image Loading

- Library book covers use loading="lazy" attribute — browser defers off-screen cover loading
- Placeholder SVG covers are inline data URLs (instant, no network request)
- PDF renders become JPEG data URLs (inline, cached)

## 15.8 Debouncing

- Viewer resize: 250ms debounce
- Library resize: 300ms debounce (calls full re-render)

---

# 16. GitHub Pages Compatibility

## 16.1 Static-Only Architecture

The entire project is static files: HTML, CSS, JS, JSON, PDF. No server-side language, no database, no API. This means:
- Deployable to any static file server (GitHub Pages, Netlify, Vercel, S3, etc.)
- No backend configuration (no Node.js, PHP, Python, etc.)
- No build step (raw files served as-is)

## 16.2 Path Handling

- All paths are relative (not absolute): "books/books.json", "library.html", "viewer.html?book=..."
- This means the project works from any subdirectory path (e.g., https://user.github.io/repo/ as well as https://example.com/)
- No need for <base> tag or path prefix configuration

## 16.3 Deployment

1. git init, git add, git commit
2. Push to GitHub repository
3. In repository Settings → Pages → set source to "main" branch, root folder
4. Site is live at https://<user>.github.io/<repo>/ within minutes

## 16.4 No Server Requirements

- PDF.js worker is loaded from CDN (not from a local file — PDF.js worker cannot be a local file due to blob: URL restrictions in some browsers, but CDN src works)
- All library assets are CDN-hosted (PDF.js, StPageFlip, Google Fonts) — no need to vendor them
- localStorage persists per-domain, works on GitHub Pages

---

# 17. Security

## 17.1 XSS

- Book titles from books.json are rendered into the DOM via textContent (safe) and innerHTML in template literals (potentially unsafe). However, books.json is a static file committed by the project owner, not user-submitted content. No user input is reflected in book data.
- Search input: user text is used only for Array.filter() matching (logic comparison), never inserted into the DOM as HTML. Safe.
- URL parameter (book filename): Used in fetch() URLs and as href navigation target via encodeURIComponent. The book param is compared against books.json entries. If a non-existent book is specified, loadPDF() will fail gracefully (fetch 404 → error shown).

## 17.2 File Handling

- PDF files are loaded via fetch() and processed entirely in-browser by PDF.js. No PDF data is sent to external servers.
- Download button creates a temporary <a> element linking to the PDF file — standard browser download behavior.
- PDF filenames with spaces are preserved exactly and encoded via encodeURIComponent in URLs.

## 17.3 Input Validation

- Page input (viewer): validated to 1 ≤ value ≤ totalPages before calling goToPage. Invalid values reset to current page.
- Search input: converted to lowercase, trimmed. No HTML injection risk.
- Sort select: uses predefined option values only.

## 17.4 URL Parameters

- Only the "book" parameter is read from the URL. Used for fetch() to load the PDF and for finding metadata in books.json.
- If the parameter contains path traversal (e.g., "../../etc/passwd"), the fetch would fail (404) or return a non-PDF file which PDF.js would reject. GitHub Pages serves only intended files anyway.

## 17.5 localStorage

- Only stores page numbers (integers) and preference booleans. No sensitive data.
- JSON.parse/stringify used safely with try/catch.
- Key names are fixed: "flipbook_progress", "flipbook_darkmode".

---

# 18. Extending the Project

## 18.1 Adding New Books

1. Copy PDF file into books/ directory
2. Edit books/books.json — add a new object with "title" and "file" fields
3. Deploy (git push for GitHub Pages)

No code changes needed. The library page reads books.json dynamically and renders all entries. The viewer reads the book parameter and loads the matching PDF.

## 18.2 Adding New Animations

Library page:
- Add/modify CSS @keyframes in library.css
- Add a new class with animation property
- Toggle the class in library.js renderBooks() or openBook()

Viewer page:
- CSS transitions/animations in viewer.css
- Or use Web Animations API in viewer.js (like loadProgress fade-in or the opening animation)

## 18.3 Adding Toolbar Buttons

1. Add button HTML in viewer.html (inside #viewer-topbar-center or #viewer-topbar-right or #zoom-controls)
2. Add SVG icon (inline)
3. Add CSS styles in viewer.css (use .ctrl-btn class)
4. Add button ID to cacheDOM() in viewer.js
5. Implement handler function
6. Add event listener in setupControls()

## 18.4 Adding Themes

- Add new CSS class on body (e.g., body.sepia-mode)
- Define variable overrides in viewer.css under that class selector
- Add toggle function in viewer.js
- Add button in viewer.html
- Persist preference in localStorage

## 18.5 Adding Languages

- The project currently has no i18n system. Strings are hardcoded in HTML and JS.
- To add: extract all user-facing strings into a translation object, select based on a lang query or localStorage setting, apply to DOM elements on page load.

## 18.6 Adding Features Without Breaking

- viewer.js: add to CONFIG for new constants, add to state for new runtime values, add handlers as independent functions, register in setupControls/setupKeyboard
- library.js: keep all functions as closures sharing the same scope variables — add new functions in the same pattern
- CSS: avoid modifying existing class properties — add new classes and compose


---

# 19. Complete File Dependency Graph

```
┌──────────────────────────────────────────────────────────────────────────────┐
│                              index.html                                     │
│  ┌──────────────┐  ┌──────────────┐                                         │
│  │ style.css     │  │ script.js    │                                         │
│  │ (landing CSS) │  │ (hero fade)  │                                         │
│  └──────────────┘  └──────────────┘                                         │
│                         │                                                    │
│  <a href="library.html">                                                     │
└──────────────────┬───────────────────────────────────────────────────────────┘
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             library.html                                    │
│  ┌──────────────┐  ┌──────────────────────────────────────┐                 │
│  │ library.css   │  │ library.js                            │                 │
│  │ (shelf CSS)   │  │                                       │                 │
│  └──────────────┘  │  dependencies:                          │                 │
│                    │  └─ PDF.js CDN (pdfjsLib)               │                 │
│                    │                                       │                 │
│                    │  internal functions:                    │                 │
│                    │  ├─ generateCoverPlaceholder()          │                 │
│                    │  ├─ renderPDFCover() ← PDF.js           │                 │
│                    │  ├─ getBookWidth()                      │                 │
│                    │  ├─ renderBooks()                       │                 │
│                    │  ├─ loadPDFCovers()                     │                 │
│                    │  ├─ openBook() ← Web Animations API     │                 │
│                    │  ├─ applyFilters()                      │                 │
│                    │  └─ loadBooks() ← fetch()               │                 │
│                    │                                       │                 │
│                    │  data fetches:                          │                 │
│                    │  ├─ books/books.json ──────────┐        │                 │
│                    │  └─ books/*.pdf (HEAD + cover)  │        │                 │
│                    └──────────────────┬──────────────┘        │                 │
│                                       │                       │                 │
│  navigates with ?book= param                               │                 │
└──────────────────┬───────────────────────────────────────────┘                 │
                   │
                   ▼
┌──────────────────────────────────────────────────────────────────────────────┐
│                             viewer.html                                     │
│  ┌──────────────┐  ┌──────────────────────────────────────┐                 │
│  │ viewer.css    │  │ viewer.js                             │                 │
│  │ (desk CSS)    │  │                                       │                 │
│  └──────────────┘  │  dependencies:                          │                 │
│                    │  ├─ PDF.js CDN (pdfjsLib)               │                 │
│                    │  └─ StPageFlip CDN (StPageFlip)         │                 │
│                    │                                       │                 │
│                    │  CONFIG: renderScale, flippingTime...   │                 │
│                    │  state: pdfDoc, pageFlip, current...    │                 │
│                    │                                       │                 │
│                    │  functions:                             │                 │
│                    │  ├─ init()                              │                 │
│                    │  ├─ loadBookMetadata()  ← fetch()       │                 │
│                    │  ├─ loadPDF()           ← PDF.js        │                 │
│                    │  ├─ createPageElements()                │                 │
│                    │  ├─ renderPageRange()                   │                 │
│                    │  ├─ renderRemainingPages()              │                 │
│                    │  ├─ renderPage()       ← PDF.js         │                 │
│                    │  ├─ getPageDimensions()                 │                 │
│                    │  ├─ setupFlipbook()    ← StPageFlip     │                 │
│                    │  ├─ applyZoom()        ← StPageFlip     │                 │
│                    │  ├─ zoomIn/Out/Reset/FitWidth/FitPage   │                 │
│                    │  ├─ updateUI()                          │                 │
│                    │  ├─ goToPage()         ← StPageFlip     │                 │
│                    │  ├─ next/prev/first/last Page()         │                 │
│                    │  ├─ save/load Progress() ← localStorage │                 │
│                    │  ├─ get/toggle Bookmark() ← localStorage│                 │
│                    │  ├─ toggleFullscreen()                  │                 │
│                    │  ├─ toggleDarkMode() / loadTheme()      │                 │
│                    │  ├─ downloadPDF()                       │                 │
│                    │  ├─ shareLink()                         │                 │
│                    │  ├─ showToast()                         │                 │
│                    │  ├─ setupControls()                     │                 │
│                    │  ├─ setupKeyboard()                     │                 │
│                    │  ├─ setupAutoHideUI()                   │                 │
│                    │  └─ setupResizeHandler()                │                 │
│                    │                                       │                 │
│                    │  data: books/books.json, books/*.pdf    │                 │
│                    └───────────────────────────────────────┘                 │
└──────────────────────────────────────────────────────────────────────────────┘
                     │
                     │ <a href="library.html"> (back arrow)
                     └──────────────────────────────────────┘
```

Dependency legend:
- ──<link>──→ = CSS file dependency via <link> tag
- ──<script>→ = JS file dependency via <script> tag
- ──fetch──→ = HTTP request to data file
- ──→ = navigation via URL
- ← PDF.js / ← StPageFlip = function calls external library API

---

# 20. Rebuild Guide

If the entire project were deleted, rebuild in this order:

## Phase 1: Core Structure (5 min)

1. Create project root directory
2. Create empty directories: books/, covers/, assets/
3. Create books/books.json with at least one book entry
4. Place at least one PDF in books/

## Phase 2: Landing Page (10 min)

5. Create index.html with hero section, badge, title, subtitle, CTA button, footer
6. Create style.css with CSS reset, :root variables (dark theme), hero layout, hero button styling, footer
7. Create script.js with DOMContentLoaded handler for fade-in entrance

## Phase 3: Library Page (20 min)

8. Create library.html with topbar (logo, search, sort), library header, state containers (loading, empty, error), books-grid, footer
9. Create library.css with reset, :root, topbar, search/sort styling, state styling, bookshelf layout, shelf board wood texture, book spine 3D effects, hover/lift/gloss, entrance animations, responsive
10. Create library.js with PDF.js worker config, fetch books.json, renderBooks HTML builder, placeholder SVG cover generator, PDF.js cover renderer with caching, search/sort filter, openBook click handler with Web Animations API

## Phase 4: Viewer Page (30 min)

11. Create viewer.html with error overlay, loading overlay, topbar with nav + action buttons, progress bar, book-viewer > flipbook-container > flipbook, zoom controls with all buttons, toast element
12. Create viewer.css with reset, :root, html/body fixed fullscreen, desk background ::before/::after, light mode overrides, error/loading overlays, topbar styling with .hidden, control buttons, page indicator, progress bar, flipbook container/zoom transition, page cells with paper texture, center binding crease, book shadow, StPageFlip shadows, zoom controls bar, toast animations, responsive
13. Create viewer.js with CONFIG, state, cacheDOM, init flow, PDF.js loading with progress, page element creation, batch rendering (first 4 sync, rest async), StPageFlip setup with preserved pages on re-init, zoom controls, navigation, localStorage progress/bookmarks, fullscreen, dark mode, download, share, toast, keyboard shortcuts, auto-hide UI, resize handler

## Phase 5: Polish (10 min)

14. Add entrance animations to library (stagger.js logic)
15. Add fade-in transitions for page rendering and cover loading
16. Test all responsive breakpoints
17. Create README.md with usage instructions
18. Deploy to GitHub Pages

---

# 21. Developer Notes

## 21.1 Assumptions Made During Implementation

- PDF files are valid and properly formatted
- Page count is known at load time (PDF.js returns numPages synchronously after getDocument resolves)
- The first page of each PDF contains meaningful cover content
- Viewport dimensions are available at module load time for initial isMobile calculation
- Browser supports: async/await, Map, Promise.all, requestAnimationFrame, DOMContentLoaded, Fullscreen API, localStorage, CSS custom properties, backdrop-filter, Web Animations API (Element.animate)
- PDF.js worker CDN URL is always accessible
- The books/ directory is at the same level as the HTML files (relative path)

## 21.2 Known Limitations

- **No pan/scroll after zoom**: When zoomed in beyond 1.0, pages overflow the container and cannot be panned. StPageFlip doesn't support panning within zoomed pages.
- **Memory growth for large PDFs**: renderedPages Map stores every page as a JPEG data URL string. A 200-page PDF at ~100KB/page = ~20MB in memory. Never cleared during the session.
- **Full innerHTML replacement on search**: Library page destroys and recreates all book DOM elements on every search keystroke or sort change. Acceptable for < 50 books but would be slow for 500+.
- **No keyboard trap in fullscreen**: When in fullscreen mode and the topbar is auto-hidden, pressing Arrow keys to flip pages works, but there's no visible focus indicator for accessibility.
- **Single PDF only**: The books.json contains only one book entry for the demo. Adding more books requires manual editing of JSON + file placement.
- **No loading states for download/share**: Download creates a temporary <a> and clicks it — no progress indicator. Share uses Web Share API or clipboard with simple toast feedback.
- **Resize re-initializes StPageFlip**: On every window resize, StPageFlip is destroyed and recreated. The .resizing class hides the book briefly during this process. Frequent resizing (e.g., mobile orientation change) causes multiple re-initializations.

## 21.3 Future Improvements

- **Virtual page rendering**: Only render pages in/near the current spread, discard distant pages from the renderedPages Map (with re-rendering on return).
- **Canvas-based zoom with pan**: Replace CSS transform scale with canvas-based zoom + drag-to-pan for zoomed-in reading.
- **Incremental DOM updates on search**: Instead of innerHTML replacement, show/hide existing book elements for faster search/sort.
- **Accessibility**: Add ARIA labels, keyboard trap management in fullscreen, focus management for page jumps.
- **Offline support**: Add a service worker to cache PDFs and app shell for offline reading.
- **Multi-language support**: i18n system for UI strings.
- **Reading statistics**: Track time spent, pages read, completion percentages.
- **PDF text layer**: Overlay selectable text on rendered pages for copy/paste and search within the book.
- **Thumbnail navigation**: A sidebar showing page thumbnails for quick jumping.
- **Book info panel**: Show metadata (page count, file size, last read date) in the library.

## 21.4 Technical Debt

- **CONFIG.coversPath**: Defined in viewer.js but never used (legacy from when covers were separate image files). Should be removed.
- **Rendering progress tracking**: renderPageRange updates the progress bar during initial render, but renderRemainingPages does not (loading overlay is hidden at that point). The progress bar shows page position rather than render progress.
- **Book file size**: HEAD-fetched in library.js and stored on book objects but never displayed in the UI.
- **No CSS minification**: All CSS files include extensive comments and are served raw. Acceptable for GitHub Pages (HTTP/2, compression).
- **No image caching across page navigations**: When navigating from viewer back to library, rendered covers are lost (pdfCovers Map is in-memory, cleared on page unload). Covers re-render on return.

## 21.5 Potential Bugs

- **createPageElements on resize**: If setupFlipbook() is called after destroy, savedPages captures .page elements. But createPageElements() is NOT called during resize — the original .page elements (with their rendered img.src) are re-used. This is correct AND efficient, but if the total page count changed (impossible for a loaded PDF), new pages wouldn't exist.
- **goToPage during background rendering**: If loadProgress() fires goToPage to a page that hasn't rendered yet (page 20 in a PDF where only pages 1-4 are rendered), StPageFlip turns to an empty/transparent page. The render callback will fill the img when it finishes — the page appears mid-session. This is a minor visual glitch but not a crash.
- **Multiple setupFlipbook calls**: If resize fires rapidly, the 250ms debounce prevents multiple concurrent calls. However, fullscreenchange adds a separate 300ms setTimeout that could overlap with a resize — causing two setupFlipbook calls in quick succession.
- **Memory for large PDFs**: A PDF with 500+ pages could consume > 100MB of data URLs in the renderedPages Map. No current safeguard or culling strategy.

## 21.6 Trade-offs

- **JPEG over PNG**: JPEG data URLs are 5-10x smaller than PNG for document pages (mostly text with few colors). PNG loses to JPEG on file size while being lossless. For document viewing, JPEG at 80-88% quality is visually lossless and significantly more memory-efficient.
- **Inline SVG over CSS gradients for placeholders**: Inline SVG allows placing text (initials) on the gradient, providing a more identifiable placeholder than a plain CSS gradient. Trade-off: slightly larger inline content.
- **cloneNode + animate() over CSS @keyframes for opening**: JS animation provides precise control over the target position (center of viewport) which isn't possible with CSS keyframes alone (CSS doesn't know viewport center). Trade-off: slightly more JS code, but the effect is significantly better.
- **Full innerHTML rebuild over incremental DOM updates on search**: Simpler code, fewer edge cases. Acceptable for expected book counts (< 100). Would need optimization for large libraries.
- **Each page its own CSS**: Duplication of reset and variable definitions (~50 lines each), but eliminates cross-file CSS coupling and allows independent page loading.

