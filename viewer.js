/* ============================================================
   FLIPBOOK VIEWER — Digital Library
   PDF.js rendering + StPageFlip integration
   All controls, zoom, fullscreen, keyboard, touch, bookmark, progress
   ============================================================ */

// ============================================================
// CONFIGURATION
// ============================================================
const CONFIG = {
  renderScale: 1.5,
  flippingTime: 450,
  defaultZoom: 1,
  minZoom: 0.5,
  maxZoom: 2.5,
  zoomStep: 0.25,
  localStorageKey: 'flipbook_progress',
  uiHideDelay: 2500,
  booksPath: 'books/',
  cacheWindow: 40,
};

// ============================================================
// STATE
// ============================================================
const state = {
  pdfDoc: null,
  pageFlip: null,
  currentPage: 1,
  totalPages: 0,
  paperPagesCount: 0,
  blankPageDataUrl: '',
  zoom: CONFIG.defaultZoom,
  renderedPages: new Map(),
  renderQueue: [],
  isRendering: false,
  isDarkMode: true,
  isFullscreen: false,
  isMobile: window.innerWidth < 768,
  isReady: false,
  isUIVisible: true,
  uiHideTimer: null,
  wasInteracting: false,
  bookData: null,
  bookFile: null,
  pageAspectRatio: 1.4,
};

// ============================================================
// DOM REFERENCES
// ============================================================
const $ = (id) => document.getElementById(id);
const dom = {};

function cacheDOM() {
  dom.topbar = $('viewer-topbar');
  dom.zoomControls = $('zoom-controls');
  dom.viewer = $('book-viewer');
  dom.flipbook = $('flipbook');
  dom.flipbookContainer = $('flipbook-container');
  dom.loader = $('loading-spinner');
  dom.loaderFill = $('loading-progress-fill');
  dom.errorPage = $('error-page');
  dom.errorText = $('error-message-text');
  dom.bookTitle = $('viewer-book-title');
  dom.currentPageEl = $('page-input');
  dom.totalPagesEl = $('total-pages');
  dom.progressFill = $('progress-fill');
  dom.progressText = $('progress-text');
  dom.firstBtn = $('first-button');
  dom.prevBtn = $('prev-button');
  dom.nextBtn = $('next-button');
  dom.lastBtn = $('last-button');
  dom.zoomIn = $('zoom-in');
  dom.zoomOut = $('zoom-out');
  dom.zoomLevel = $('zoom-level');
  dom.fitWidth = $('fit-width');
  dom.fitPage = $('fit-page');
  dom.fullscreenBtn = $('fullscreen-btn');
  dom.downloadBtn = $('download-btn');
  dom.shareBtn = $('share-btn');
  dom.darkModeBtn = $('dark-mode-btn');
  dom.bookmarkBtn = $('bookmark-btn');
  dom.toast = $('toast');
}

// ============================================================
// INITIALIZATION
// ============================================================

async function init() {
  cacheDOM();

  const params = new URLSearchParams(window.location.search);
  state.bookFile = params.get('book');

  if (!state.bookFile) {
    showError('No book specified. Please select a book from the library.');
    return;
  }

  try {
    await loadBookMetadata();
    await loadPDF();
    createPageElements();

    // Render cover first
    await renderPage(1);

    // Render first 4 spreads so the book appears quickly
    await renderPageRange(2, Math.min(5, state.totalPages));

    setupFlipbook();
    setupControls();
    setupKeyboard();
    setupAutoHideUI();
    setupResizeHandler();

    // Restore saved progress or start at cover spread
    loadProgress();

    hideLoader();

    // Continue rendering remaining spreads in the background
    renderRemainingPages();
  } catch (err) {
    showError(err.message || 'Failed to load book.');
  }
}

// ============================================================
// BOOK METADATA
// ============================================================

async function loadBookMetadata() {
  try {
    const res = await fetch('books/books.json');
    const books = await res.json();
    state.bookData = books.find(b => b.file === state.bookFile);
    if (state.bookData) {
      dom.bookTitle.textContent = state.bookData.title;
      document.title = `${state.bookData.title} — Digital Library`;
    }
  } catch {
    // Non-critical
  }
}

// ============================================================
// PDF LOADING
// ============================================================

async function loadPDF() {
  const loadingTask = pdfjsLib.getDocument(`${CONFIG.booksPath}${state.bookFile}`, {
    enableXfa: true,
  });

  loadingTask.onProgress = (progress) => {
    const pct = Math.min((progress.loaded / progress.total) * 100, 100);
    if (dom.loaderFill) dom.loaderFill.style.width = pct + '%';
  };

  state.pdfDoc = await loadingTask.promise;
  state.totalPages = state.pdfDoc.numPages;

  // Paper pages: desktop = blank + cover + 2 per spread, mobile = blank + cover + 1 per spread
  state.paperPagesCount = state.isMobile
    ? 1 + state.totalPages
    : 2 + (state.totalPages - 1) * 2;

  dom.totalPagesEl.textContent = state.totalPages;

  // Determine page aspect ratio from first page (portrait cover, same as each half-spread)
  const firstPage = await state.pdfDoc.getPage(1);
  const vp = firstPage.getViewport({ scale: 1 });
  state.pageAspectRatio = vp.height / vp.width;

  // Generate blank endpaper image (index 0)
  const bc = document.createElement('canvas');
  const bw = 100;
  const bh = Math.round(bw * state.pageAspectRatio);
  bc.width = bw;
  bc.height = bh;
  const bctx = bc.getContext('2d', { alpha: false });
  bctx.fillStyle = '#1a1a20';
  bctx.fillRect(0, 0, bw, bh);
  state.blankPageDataUrl = bc.toDataURL('image/jpeg', 0.88);
}

// ============================================================
// PAGE ELEMENTS
// ============================================================

function createPageElements() {
  dom.flipbook.innerHTML = '';
  for (let i = 0; i < state.paperPagesCount; i++) {
    const pageDiv = document.createElement('div');
    pageDiv.className = 'page';
    pageDiv.dataset.pageIndex = i;
    const img = document.createElement('img');
    img.id = `page-${i}`;
    img.className = 'page-img';
    img.alt = `Page ${i + 1}`;
    img.draggable = false;
    // Blank endpaper at index 0
    if (i === 0) {
      img.src = state.blankPageDataUrl;
    }
    pageDiv.appendChild(img);
    dom.flipbook.appendChild(pageDiv);
  }
}

// ============================================================
// PAGE RENDERING (PDF.js → Canvas → Image)
// ============================================================

async function renderPageRange(startPage, endPage) {
  const batchSize = 2;
  for (let i = startPage; i <= endPage; i += batchSize) {
    const batch = [];
    for (let j = i; j < i + batchSize && j <= endPage; j++) {
      batch.push(j);
    }
    await Promise.all(batch.map(pageNum => renderPage(pageNum)));
    const pct = Math.min(((i - 1 + batch.length) / state.totalPages) * 100, 100);
    if (dom.loaderFill) dom.loaderFill.style.width = pct + '%';
    await new Promise(r => setTimeout(r, 10));
  }
}

async function renderRemainingPages() {
  // Pages 2 through min(5, totalPages) were rendered in init. Start from 6.
  const startPage = 6;
  if (startPage > state.totalPages) return;
  const batchSize = 3;
  for (let i = startPage; i <= state.totalPages; i += batchSize) {
    const batch = [];
    for (let j = i; j < i + batchSize && j <= state.totalPages; j++) {
      batch.push(j);
    }
    await Promise.all(batch.map(pageNum => renderPage(pageNum)));
    await new Promise(r => setTimeout(r, 15));
  }
}

function cleanupPageCache(currentPage) {
  const keepBefore = currentPage - CONFIG.cacheWindow;
  const keepAfter = currentPage + CONFIG.cacheWindow;
  for (const key of state.renderedPages.keys()) {
    if (key < keepBefore || key > keepAfter) {
      state.renderedPages.delete(key);
    }
  }
}

async function renderPage(pageNum) {
  if (state.renderedPages.has(pageNum)) {
    return state.renderedPages.get(pageNum);
  }

  try {
    const page = await state.pdfDoc.getPage(pageNum);
    const viewport = page.getViewport({ scale: CONFIG.renderScale });

    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { alpha: false });
    canvas.width = viewport.width;
    canvas.height = viewport.height;

    await page.render({
      canvasContext: ctx,
      viewport: viewport,
      intent: 'print',
    }).promise;

    if (pageNum === 1) {
      // Cover — full portrait, goes to paper index 1 (right of blank endpaper)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      state.renderedPages.set(1, dataUrl);
      const img = $('page-1');
      if (img) {
        img.src = dataUrl;
        img.style.opacity = '0';
        requestAnimationFrame(() => {
          img.style.transition = 'opacity 0.3s ease';
          img.style.opacity = '1';
        });
      }
      canvas.width = 0;
      canvas.height = 0;
      return dataUrl;
    }

    if (state.isMobile) {
      // Mobile: full page as single image
      const dataUrl = canvas.toDataURL('image/jpeg', 0.88);
      state.renderedPages.set(pageNum, dataUrl);
      const img = $(`page-${pageNum}`);
      if (img) {
        img.src = dataUrl;
        img.style.opacity = '0';
        requestAnimationFrame(() => {
          img.style.transition = 'opacity 0.3s ease';
          img.style.opacity = '1';
        });
      }
      canvas.width = 0;
      canvas.height = 0;
      return dataUrl;
    }

    // Desktop pages 2+: split landscape spread into left and right halves
    const halfW = Math.floor(viewport.width / 2);
    const fullH = viewport.height;

    const lc = document.createElement('canvas');
    lc.width = halfW;
    lc.height = fullH;
    const lctx = lc.getContext('2d', { alpha: false });
    lctx.drawImage(canvas, 0, 0, halfW, fullH, 0, 0, halfW, fullH);
    const leftUrl = lc.toDataURL('image/jpeg', 0.88);

    const rc = document.createElement('canvas');
    rc.width = halfW;
    rc.height = fullH;
    const rctx = rc.getContext('2d', { alpha: false });
    rctx.drawImage(canvas, halfW, 0, halfW, fullH, 0, 0, halfW, fullH);
    const rightUrl = rc.toDataURL('image/jpeg', 0.88);

    state.renderedPages.set(pageNum, { left: leftUrl, right: rightUrl });

    const leftIdx = (pageNum - 1) * 2;
    const rightIdx = leftIdx + 1;

    const limg = $(`page-${leftIdx}`);
    if (limg) {
      limg.src = leftUrl;
      limg.style.opacity = '0';
      requestAnimationFrame(() => {
        limg.style.transition = 'opacity 0.3s ease';
        limg.style.opacity = '1';
      });
    }

    const rimg = $(`page-${rightIdx}`);
    if (rimg) {
      rimg.src = rightUrl;
      rimg.style.opacity = '0';
      requestAnimationFrame(() => {
        rimg.style.transition = 'opacity 0.3s ease';
        rimg.style.opacity = '1';
      });
    }

    canvas.width = 0;
    canvas.height = 0;
    lc.width = 0;
    lc.height = 0;
    rc.width = 0;
    rc.height = 0;

    return { left: leftUrl, right: rightUrl };
  } catch (err) {
    console.warn(`Failed to render page ${pageNum}:`, err);
    return null;
  }
}

// ============================================================
// StPageFlip SETUP
// ============================================================

function getPageDimensions() {
  const containerRect = dom.viewer.getBoundingClientRect();
  const w = containerRect.width;
  const h = containerRect.height;

  if (state.isMobile) {
    // Single page — portrait layout
    const pw = Math.min(w * 0.92, h / state.pageAspectRatio * 0.92);
    const ph = pw * state.pageAspectRatio;
    return {
      width: Math.round(pw),
      height: Math.round(ph),
      single: true,
    };
  } else {
    // Two-page spread — landscape layout
    const gap = 24;
    const spreadW = w - gap;
    let pw = Math.floor(spreadW / 2);
    let ph = Math.round(pw * state.pageAspectRatio);
    if (ph > h * 0.92) {
      ph = Math.round(h * 0.92);
      pw = Math.floor(ph / state.pageAspectRatio);
    }
    return {
      width: pw,
      height: ph,
      single: false,
    };
  }
}

function setupFlipbook() {
  // Save page elements before destroy so StPageFlip doesn't lose them
  let savedPages = [];
  if (state.pageFlip) {
    savedPages = Array.from(dom.flipbook.querySelectorAll('.page'));
    state.pageFlip.destroy();
    state.pageFlip = null;
    savedPages.forEach(p => dom.flipbook.appendChild(p));
  }

  const dims = getPageDimensions();
  const pages = savedPages.length > 0 ? savedPages : dom.flipbook.querySelectorAll('.page');

  // Paper page 0 = blank, 1 = cover, 2+3 = L+R of PDF 2, 4+5 = L+R of PDF 3, ...
  let startIdx = state.isMobile
    ? Math.max(0, Math.min(state.currentPage, state.paperPagesCount - 1))
    : Math.max(0, Math.min((state.currentPage - 1) * 2, state.paperPagesCount - 2));

  state.pageFlip = new St.PageFlip(dom.flipbook, {
    width: dims.width,
    height: dims.height,
    size: 'fixed',
    flippingTime: CONFIG.flippingTime,
    usePortrait: dims.single,
    startPage: startIdx,
    maxShadowOpacity: 0.55,
    showCover: false,
    mobileScrollSupport: true,
    swipeDistance: 25,
    clickEvent: false,
    drawShadow: true,
    forwardShadow: true,
    useMouseEvents: true,
    useTouchEvents: true,
  });

  state.pageFlip.loadFromHTML(pages);

  state.pageFlip.off('flip');
  state.pageFlip.on('flip', (e) => {
    const idx = e.data;
    if (state.isMobile) {
      state.currentPage = idx < 2 ? 1 : Math.min(idx, state.totalPages);
    } else {
      state.currentPage = Math.min(idx / 2 + 1, state.totalPages);
    }
    updateUI();
    saveProgress();
    cleanupPageCache(state.currentPage);
  });

  // Apply initial zoom
  applyZoom();

  state.isReady = true;
}

// ============================================================
// ZOOM
// ============================================================

function applyZoom() {
  const scale = state.zoom;
  dom.flipbookContainer.style.transform = `scale(${scale})`;
  dom.flipbookContainer.style.transformOrigin = 'center center';
  dom.zoomLevel.textContent = Math.round(scale * 100) + '%';

  const dims = getPageDimensions();
  dom.flipbook.style.width = dims.width + 'px';
  dom.flipbook.style.height = dims.height + 'px';

  // Update the flipbook's internal size if it's ready
  if (state.pageFlip) {
    state.pageFlip.update();
  }
}

function zoomIn() {
  state.zoom = Math.min(state.zoom + CONFIG.zoomStep, CONFIG.maxZoom);
  applyZoom();
}

function zoomOut() {
  state.zoom = Math.max(state.zoom - CONFIG.zoomStep, CONFIG.minZoom);
  applyZoom();
}

function zoomReset() {
  state.zoom = CONFIG.defaultZoom;
  applyZoom();
}

function zoomFitWidth() {
  if (!state.isReady) return;
  const containerRect = dom.viewer.getBoundingClientRect();
  const dims = getPageDimensions();
  if (state.isMobile) {
    // Single page: fit page width to container
    const targetWidth = containerRect.width * 0.92;
    state.zoom = targetWidth / dims.width;
  } else {
    // Two-page spread: the spread already fills width at zoom 1
    state.zoom = 1;
  }
  state.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, state.zoom));
  applyZoom();
}

function zoomFitPage() {
  if (!state.isReady) return;
  const containerRect = dom.viewer.getBoundingClientRect();
  if (state.isMobile) {
    const dims = getPageDimensions();
    const targetHeight = containerRect.height * 0.88;
    state.zoom = targetHeight / dims.height;
  } else {
    // Two-page: fit the page height to container
    const dims = getPageDimensions();
    const targetHeight = containerRect.height * 0.88;
    state.zoom = targetHeight / dims.height;
  }
  state.zoom = Math.max(CONFIG.minZoom, Math.min(CONFIG.maxZoom, state.zoom));
  applyZoom();
}

// ============================================================
// UI UPDATES
// ============================================================

function updateUI() {
  dom.currentPageEl.value = state.currentPage;
  dom.totalPagesEl.textContent = state.totalPages;

  // Progress
  const pct = ((state.currentPage - 1) / Math.max(state.totalPages - 1, 1)) * 100;
  dom.progressFill.style.width = Math.min(pct, 100) + '%';
  dom.progressText.textContent = Math.round(Math.min(pct, 100)) + '%';

  // Bookmark button state
  const bookmarked = getBookmarkedPage() === state.currentPage;
  dom.bookmarkBtn.style.color = bookmarked ? 'var(--accent)' : '';
}

// ============================================================
// NAVIGATION
// ============================================================

function goToPage(pageNum) {
  if (!state.pageFlip) return;
  const target = Math.max(1, Math.min(pageNum, state.totalPages));

  if (state.isMobile) {
    state.pageFlip.turnToPage(target);
  } else {
    // Desktop: target 1 → page 0 (blank+cover), target N → page (N-1)*2
    state.pageFlip.turnToPage(target === 1 ? 0 : (target - 1) * 2);
  }

  state.currentPage = target;
  updateUI();
}

function nextPage() {
  if (!state.pageFlip) return;
  if (state.currentPage < state.totalPages) {
    state.pageFlip.flipNext();
  }
}

function prevPage() {
  if (!state.pageFlip) return;
  if (state.currentPage > 1) {
    state.pageFlip.flipPrev();
  }
}

function firstPage() {
  goToPage(1);
}

function lastPage() {
  goToPage(state.totalPages);
}

// ============================================================
// PROGRESS (localStorage)
// ============================================================

function saveProgress() {
  if (!state.bookFile) return;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.localStorageKey) || '{}');
    data[state.bookFile] = state.currentPage;
    localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(data));
  } catch {
    // Storage unavailable
  }
}

function loadProgress() {
  if (!state.bookFile) return;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.localStorageKey) || '{}');
    const saved = data[state.bookFile];
    if (saved && saved > 1 && saved <= state.totalPages) {
      state.currentPage = saved;
      setTimeout(() => goToPage(saved), 100);
    }
  } catch {
    // Storage unavailable
  }
}

// ============================================================
// BOOKMARK
// ============================================================

function getBookmarkedPage() {
  if (!state.bookFile) return null;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.localStorageKey) || '{}');
    const bookmarks = data['_bookmarks'] || {};
    const saved = bookmarks[state.bookFile];
    if (saved && saved >= 1 && saved <= state.totalPages) return saved;
    return null;
  } catch {
    return null;
  }
}

function toggleBookmark() {
  if (!state.bookFile) return;
  try {
    const data = JSON.parse(localStorage.getItem(CONFIG.localStorageKey) || '{}');
    if (!data['_bookmarks']) data['_bookmarks'] = {};

    const current = data['_bookmarks'][state.bookFile];
    if (current === state.currentPage) {
      delete data['_bookmarks'][state.bookFile];
      showToast('Bookmark removed');
    } else {
      data['_bookmarks'][state.bookFile] = state.currentPage;
      showToast(`Bookmarked page ${state.currentPage}`);
    }

    localStorage.setItem(CONFIG.localStorageKey, JSON.stringify(data));
    updateUI();
  } catch {
    // Storage unavailable
  }
}

// ============================================================
// FULLSCREEN
// ============================================================

function toggleFullscreen() {
  if (!document.fullscreenElement) {
    document.documentElement.requestFullscreen().catch(() => {});
  } else {
    document.exitFullscreen().catch(() => {});
  }
}

document.addEventListener('fullscreenchange', () => {
  state.isFullscreen = !!document.fullscreenElement;
  setTimeout(() => {
    if (state.pageFlip) {
      setupFlipbook();
    }
  }, 300);
});

// ============================================================
// DARK / LIGHT MODE
// ============================================================

function toggleDarkMode() {
  state.isDarkMode = !state.isDarkMode;
  document.body.classList.toggle('light-mode', !state.isDarkMode);
  localStorage.setItem('flipbook_darkmode', state.isDarkMode);
}

function loadTheme() {
  const saved = localStorage.getItem('flipbook_darkmode');
  if (saved !== null) {
    state.isDarkMode = saved === 'true';
    document.body.classList.toggle('light-mode', !state.isDarkMode);
  }
}

// ============================================================
// DOWNLOAD
// ============================================================

function downloadPDF() {
  if (!state.bookFile) return;
  const a = document.createElement('a');
  a.href = `${CONFIG.booksPath}${state.bookFile}`;
  a.download = state.bookFile;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

// ============================================================
// SHARE
// ============================================================

async function shareLink() {
  const url = window.location.href;
  if (navigator.share) {
    try {
      await navigator.share({
        title: state.bookData?.title || 'Digital Library Book',
        url: url,
      });
    } catch {
      // User cancelled
    }
  } else {
    try {
      await navigator.clipboard.writeText(url);
      showToast('Link copied to clipboard');
    } catch {
      showToast('Failed to copy link');
    }
  }
}

// ============================================================
// TOAST
// ============================================================

let toastTimer = null;

function showToast(message) {
  if (!dom.toast) return;
  clearTimeout(toastTimer);
  dom.toast.textContent = message;
  dom.toast.style.display = 'block';
  dom.toast.style.animation = 'none';
  void dom.toast.offsetHeight;
  dom.toast.style.animation = '';
  toastTimer = setTimeout(() => {
    dom.toast.style.display = 'none';
  }, 2500);
}

// ============================================================
// CONTROLS SETUP
// ============================================================

function setupControls() {
  dom.firstBtn.addEventListener('click', firstPage);
  dom.prevBtn.addEventListener('click', prevPage);
  dom.nextBtn.addEventListener('click', nextPage);
  dom.lastBtn.addEventListener('click', lastPage);

  dom.currentPageEl.addEventListener('change', () => {
    const val = parseInt(dom.currentPageEl.value, 10);
    if (val >= 1 && val <= state.totalPages) {
      goToPage(val);
    } else {
      dom.currentPageEl.value = state.currentPage;
    }
  });

  dom.zoomIn.addEventListener('click', zoomIn);
  dom.zoomOut.addEventListener('click', zoomOut);
  dom.fitWidth.addEventListener('click', zoomFitWidth);
  dom.fitPage.addEventListener('click', zoomFitPage);

  dom.fullscreenBtn.addEventListener('click', toggleFullscreen);
  dom.downloadBtn.addEventListener('click', downloadPDF);
  dom.shareBtn.addEventListener('click', shareLink);
  dom.darkModeBtn.addEventListener('click', toggleDarkMode);
  dom.bookmarkBtn.addEventListener('click', toggleBookmark);
}

// ============================================================
// KEYBOARD SHORTCUTS
// ============================================================

function setupKeyboard() {
  document.addEventListener('keydown', (e) => {
    // Ignore if user is typing in an input
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
      if (e.key === 'Enter' && e.target === dom.currentPageEl) {
        const val = parseInt(dom.currentPageEl.value, 10);
        if (val >= 1 && val <= state.totalPages) goToPage(val);
      }
      return;
    }

    switch (e.key) {
      case 'ArrowRight':
      case ' ':
        e.preventDefault();
        nextPage();
        break;
      case 'ArrowLeft':
        e.preventDefault();
        prevPage();
        break;
      case 'Home':
        e.preventDefault();
        firstPage();
        break;
      case 'End':
        e.preventDefault();
        lastPage();
        break;
      case 'f':
      case 'F':
        e.preventDefault();
        toggleFullscreen();
        break;
      case '=':
      case '+':
        e.preventDefault();
        zoomIn();
        break;
      case '-':
        e.preventDefault();
        zoomOut();
        break;
      case '0':
        e.preventDefault();
        zoomReset();
        break;
      case 'b':
      case 'B':
        e.preventDefault();
        toggleBookmark();
        break;
      case 'd':
      case 'D':
        e.preventDefault();
        toggleDarkMode();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen().catch(() => {});
        }
        break;
    }
  });
}

// ============================================================
// AUTO-HIDE UI
// ============================================================

function setupAutoHideUI() {
  let interactionTimer = null;

  function showUI() {
    dom.topbar.classList.remove('hidden');
    dom.zoomControls.classList.remove('hidden');
    state.isUIVisible = true;
    clearTimeout(interactionTimer);
  }

  function scheduleHide() {
    clearTimeout(interactionTimer);
    interactionTimer = setTimeout(() => {
      if (state.isReady && state.isUIVisible && !state.wasInteracting) {
        dom.topbar.classList.add('hidden');
        dom.zoomControls.classList.add('hidden');
        state.isUIVisible = false;
      }
    }, CONFIG.uiHideDelay);
  }

  document.addEventListener('mousemove', () => {
    if (!state.isUIVisible) {
      showUI();
    }
    scheduleHide();
  });

  document.addEventListener('touchstart', () => {
    showUI();
    scheduleHide();
  });

  document.addEventListener('scroll', () => {
    if (!state.isUIVisible) {
      showUI();
    }
    scheduleHide();
  });

  // Keep UI visible when hovering over controls
  [dom.topbar, dom.zoomControls].forEach(el => {
    el.addEventListener('mouseenter', () => {
      state.wasInteracting = true;
      clearTimeout(interactionTimer);
    });
    el.addEventListener('mouseleave', () => {
      state.wasInteracting = false;
      scheduleHide();
    });
  });

  // Show UI initially
  showUI();
  scheduleHide();
}

// ============================================================
// RESIZE HANDLER
// ============================================================

let resizeTimeout = null;

function setupResizeHandler() {
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimeout);
    resizeTimeout = setTimeout(() => {
      const wasMobile = state.isMobile;
      state.isMobile = window.innerWidth < 768;

      if (state.isReady) {
        dom.flipbookContainer.classList.add('resizing');
        requestAnimationFrame(() => {
          if (wasMobile !== state.isMobile) {
            state.paperPagesCount = state.isMobile
              ? 1 + state.totalPages
              : 2 + (state.totalPages - 1) * 2;
            createPageElements();
          }
          setupFlipbook();
          dom.flipbookContainer.classList.remove('resizing');
          if (state.currentPage > state.totalPages) {
            state.currentPage = state.totalPages;
          }
          goToPage(state.currentPage);
        });
      }
    }, 250);
  });
}

// ============================================================
// ERROR & LOADING
// ============================================================

function showError(message) {
  if (dom.errorPage) {
    dom.errorPage.style.display = 'flex';
    dom.errorText.textContent = message;
  }
  hideLoader();
}

function hideLoader() {
  if (dom.loader) {
    dom.loader.classList.add('hidden');
    setTimeout(() => {
      dom.loader.style.display = 'none';
    }, 500);
  }
}

// ============================================================
// START
// ============================================================

loadTheme();
document.addEventListener('DOMContentLoaded', init);
