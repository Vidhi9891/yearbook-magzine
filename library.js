/* ============================================================
   LIBRARY PAGE — Digital Library
   Bookshelf layout, PDF cover rendering, search & sort
   ============================================================ */

document.addEventListener('DOMContentLoaded', async () => {
  const grid = document.getElementById('books-grid');
  const loadingState = document.getElementById('loading-state');
  const emptyState = document.getElementById('empty-state');
  const errorState = document.getElementById('error-state');
  const errorMessage = document.getElementById('error-message');
  const countEl = document.getElementById('library-count');
  const searchInput = document.getElementById('search-input');
  const sortSelect = document.getElementById('sort-select');

  let books = [];
  let filteredBooks = [];
  let pdfCovers = new Map();

  // Predefined gradient palettes for placeholder covers
  const PALETTES = [
    ['#667eea', '#764ba2'], ['#f093fb', '#f5576c'],
    ['#4facfe', '#00f2fe'], ['#43e97b', '#38f9d7'],
    ['#fa709a', '#fee140'], ['#a18cd1', '#fbc2eb'],
    ['#fccb90', '#d57eeb'], ['#e0c3fc', '#8ec5fc'],
    ['#84fab0', '#8fd3f4'], ['#a1c4fd', '#c2e9fb'],
    ['#d4fc79', '#96e6a1'], ['#f6d365', '#fda085'],
    ['#96fbc4', '#f9f586'], ['#fbab7e', '#f7ce68'],
  ];

  /**
   * Generate placeholder SVG gradient cover
   */
  function generateCoverPlaceholder(title) {
    const hash = title.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
    const palette = PALETTES[hash % PALETTES.length];
    const initials = title.split(/\s+/).filter(w => w.length > 0)
      .map(w => w[0]).join('').substring(0, 2).toUpperCase();
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="200" height="280" viewBox="0 0 200 280">
      <defs><linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="${palette[0]}"/>
        <stop offset="100%" stop-color="${palette[1]}"/>
      </linearGradient></defs>
      <rect width="200" height="280" fill="url(#bg)"/>
      <text x="100" y="140" text-anchor="middle" dominant-baseline="central"
            font-family="Inter,sans-serif" font-size="48" font-weight="700"
            fill="rgba(255,255,255,0.2)" letter-spacing="2">${initials}</text>
    </svg>`;
    return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg)));
  }

  /**
   * Render first PDF page as a cover data URL via PDF.js
   */
  async function renderPDFCover(book) {
    if (pdfCovers.has(book.file)) return pdfCovers.get(book.file);
    try {
      const task = pdfjsLib.getDocument(`books/${book.file}`);
      const pdf = await task.promise;
      const page = await pdf.getPage(1);
      const vp = page.getViewport({ scale: 0.5 });
      const canvas = document.createElement('canvas');
      canvas.width = vp.width;
      canvas.height = vp.height;
      const ctx = canvas.getContext('2d', { alpha: false });
      ctx.fillStyle = '#fff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      await page.render({ canvasContext: ctx, viewport: vp }).promise;
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      canvas.width = 0;
      canvas.height = 0;
      pdfCovers.set(book.file, dataUrl);
      return dataUrl;
    } catch {
      return null;
    }
  }

  /**
   * Determine book width — slight variation for realism
   */
  function getBookWidth(title, index) {
    const base = 90;
    const variation = (title.charCodeAt(0) % 5 - 2) * 6;
    return base + variation;
  }

  /**
   * Render the bookshelf into the grid
   */
  function renderBooks(booksArray) {
    if (!booksArray.length) {
      grid.innerHTML = '';
      emptyState.style.display = 'flex';
      return;
    }
    emptyState.style.display = 'none';

    const ww = window.innerWidth;
    let booksPerRow = 8;
    if (ww < 480) booksPerRow = 4;
    else if (ww < 768) booksPerRow = 5;
    else if (ww < 1024) booksPerRow = 6;
    else if (ww < 1400) booksPerRow = 7;

    let html = '';
    for (let i = 0; i < booksArray.length; i += booksPerRow) {
      const rowBooks = booksArray.slice(i, i + booksPerRow);
      html += '<div class="shelf-row">';
      html += '<div class="shelf-books">';

      rowBooks.forEach((book, j) => {
        const width = getBookWidth(book.title, i + j);
        const cachedCover = pdfCovers.get(book.file);
        const coverSrc = cachedCover || generateCoverPlaceholder(book.title);
        const titleShort = book.title.length > 20
          ? book.title.substring(0, 18) + '...' : book.title;
        html += `
          <div class="book-spine" data-file="${book.file}" data-index="${i + j}"
               style="--book-width:${width}px">
            <div class="book-spine-cover">
              <img src="${coverSrc}" alt="${book.title}"
                   class="book-cover-img" data-file="${book.file}"
                   loading="lazy" draggable="false">
              <div class="book-spine-gloss"></div>
            </div>
            <div class="book-spine-label">${titleShort}</div>
          </div>`;
      });

      html += '</div>';
      html += '<div class="shelf-board"></div>';
      html += '</div>';
    }

    // Close remaining gaps with invisible spacers if row incomplete
    grid.innerHTML = html;

    // Trigger entrance animations
    requestAnimationFrame(() => {
      const spines = grid.querySelectorAll('.book-spine');
      spines.forEach((el, idx) => {
        setTimeout(() => el.classList.add('visible'), idx * 40);
      });
      const boards = grid.querySelectorAll('.shelf-board');
      boards.forEach((el, idx) => {
        setTimeout(() => el.classList.add('visible'), 200 + idx * 80);
      });
    });

    // Bind click → open-book animation
    grid.querySelectorAll('.book-spine').forEach((el) => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        openBook(el);
      });
    });

    // Start rendering PDF covers in background
    loadPDFCovers(booksArray);
  }

  /**
   * Load and replace placeholders with rendered PDF covers
   */
  async function loadPDFCovers(booksArray) {
    for (const book of booksArray) {
      if (pdfCovers.has(book.file)) continue;
      const dataUrl = await renderPDFCover(book);
      if (!dataUrl) continue;
      const imgs = grid.querySelectorAll(`.book-cover-img[data-file="${book.file}"]`);
      imgs.forEach((img) => {
        img.style.opacity = '0';
        img.src = dataUrl;
        requestAnimationFrame(() => {
          img.style.transition = 'opacity 0.5s ease';
          img.style.opacity = '1';
        });
      });
    }
  }

  /**
   * Open-book animation then navigate to viewer
   */
  function openBook(el) {
    if (el.classList.contains('opening')) return;
    el.classList.add('opening');

    const file = el.dataset.file;
    const rect = el.getBoundingClientRect();

    // Clone the book at its current position
    const clone = el.cloneNode(true);
    clone.style.cssText = `
      position: fixed;
      top: ${rect.top}px;
      left: ${rect.left}px;
      width: ${rect.width}px;
      height: ${rect.height}px;
      margin: 0;
      z-index: 9999;
      pointer-events: none;
      opacity: 1;
    `;
    document.body.appendChild(clone);

    // Backdrop overlay
    const overlay = document.createElement('div');
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0,0,0,0);
      z-index: 9998;
      transition: background 0.5s ease;
      pointer-events: none;
    `;
    document.body.appendChild(overlay);

    requestAnimationFrame(() => {
      overlay.style.background = 'rgba(0,0,0,0.7)';

      // Calculate center target
      const cx = window.innerWidth / 2;
      const cy = window.innerHeight / 2;
      const dx = cx - rect.left - rect.width / 2;
      const dy = cy - rect.top - rect.height / 2;
      const scaleX = window.innerWidth * 0.75 / rect.width;
      const scaleY = window.innerHeight * 0.85 / rect.height;
      const scale = Math.min(scaleX, scaleY);

      clone.animate([
        { transform: 'translate(0, 0) scale(1) rotateY(0deg)', filter: 'brightness(1)', offset: 0 },
        { transform: `translate(${dx * 0.3}px, ${dy * 0.3}px) scale(1.15) rotateY(-5deg)`, filter: 'brightness(1.2)', offset: 0.3 },
        { transform: `translate(${dx * 0.7}px, ${dy * 0.7}px) scale(1.7) rotateY(-3deg)`, filter: 'brightness(1.4)', offset: 0.6 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale}) rotateY(0deg)`, filter: 'brightness(1.6)', offset: 0.85 },
        { transform: `translate(${dx}px, ${dy}px) scale(${scale * 1.08}) rotateY(0deg)`, filter: 'brightness(1.8)', offset: 1 },
      ], {
        duration: 800,
        easing: 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        fill: 'forwards',
      }).onfinish = () => {
        setTimeout(() => {
          window.location.href = `viewer.html?book=${encodeURIComponent(file)}`;
        }, 150);
      };
    });
  }

  /**
   * Apply search and sort filters
   */
  function applyFilters() {
    const query = searchInput.value.toLowerCase().trim();
    const sort = sortSelect.value;

    filteredBooks = books.filter(b =>
      b.title.toLowerCase().includes(query)
    );

    switch (sort) {
      case 'title':
        filteredBooks.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'newest':
        filteredBooks.sort((a, b) => (b.added || 0) - (a.added || 0));
        break;
      case 'oldest':
        filteredBooks.sort((a, b) => (a.added || 0) - (b.added || 0));
        break;
    }

    renderBooks(filteredBooks);
    countEl.textContent = `${filteredBooks.length} of ${books.length} books`;
  }

  /**
   * Load books from books.json
   */
  async function loadBooks() {
    try {
      const res = await fetch('books/books.json');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      books = await res.json();

      loadingState.style.display = 'none';
      applyFilters();
    } catch (err) {
      loadingState.style.display = 'none';
      errorState.style.display = 'flex';
      errorMessage.textContent = err.message || 'Could not load books.json.';
    }
  }

  // Event listeners
  searchInput.addEventListener('input', applyFilters);
  sortSelect.addEventListener('change', applyFilters);

  // Handle window resize for books-per-row
  let resizeTimer;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(applyFilters, 300);
  });

  await loadBooks();
});
