# Digital Library — Interactive Flipbook Platform

A premium, production-ready digital flipbook library built with vanilla HTML, CSS, and JavaScript. Zero build tools, no backend, no frameworks — everything runs on GitHub Pages.

Features a realistic **bookshelf** layout with wooden shelves, auto-rendered PDF covers, and an immersive flipbook reader with paper texture, center binding, and reading desk background.

## ✨ Features

- **Realistic Bookshelf** — Books stand vertically on wooden shelves with 3D hover effects (lift, tilt, gloss)
- **Auto Cover Rendering** — First page of every PDF is automatically rendered as the book cover — no separate cover images needed
- **Interactive Flipbooks** — Realistic page-flip with page curl, shadow, and smooth 60 FPS animations
- **Open-Book Animation** — Clicking a book triggers a smooth zoom-in transition before entering the reader
- **PDF Support** — Uses Mozilla PDF.js to render any PDF as a flipbook
- **Responsive** — Two-page spread on desktop with center binding crease, single page with swipe on mobile
- **Paper Texture** — Subtle noise overlay on each page for a realistic paper feel
- **Reading Desk** — Elegant dark studio background with ambient book shadow
- **Controls** — Next/Previous, page jump, fullscreen, zoom in/out, fit width/page, download, share
- **Dark / Light Mode** — Toggle between dark studio and warm paper themes
- **Bookmarks** — Bookmark pages and resume from where you left off
- **Search & Sort** — Search your library and sort by title
- **Lazy Loading** — Pages render progressively for instant startup
- **Keyboard Shortcuts** — Full keyboard navigation support
- **Touch & Mouse** — Swipe, drag, click — works on every device
- **No Backend** — Everything is static files. No servers, no databases, no API keys

## 🚀 Deploy to GitHub Pages

1. **Push to GitHub**:
   ```bash
   git init
   git add .
   git commit -m "Initial commit"
   git remote add origin https://github.com/yourusername/digital-library.git
   git push -u origin main
   ```

2. **Enable GitHub Pages**:
   - Go to your repository on GitHub
   - Click **Settings** → **Pages**
   - Under "Branch", select `main` and set folder to `/ (root)`
   - Click **Save**

3. **Done!** Your library will be live at `https://yourusername.github.io/digital-library/` within a few minutes.

> **Note:** No build step, no configuration files, no GitHub Actions needed. Just push and it works.

## 📖 How to Add a Book

You only need to do two things:

### 1. Add the PDF

Copy your PDF file into the `books/` folder.

```
books/
├── reverie yearbook farwell.pdf
└── your-book.pdf              ← Add your file here
```

### 2. Add an entry to `books.json`

Edit `books/books.json` and add a new object:

```json
[
  {
    "title": "Your Book Title",
    "file": "your-book.pdf"
  }
]
```

| Field   | Required | Description |
|---------|----------|-------------|
| `title` | Yes      | The book title displayed on the shelf and in the viewer |
| `file`  | Yes      | The PDF filename in `books/` folder (must match exactly, including spaces) |
| `cover` | No       | **No longer used.** Cover is automatically rendered from the first page of the PDF |

> **Note:** The first page of your PDF should be a designed cover page. It will be automatically rendered by PDF.js as the book's cover on the shelf and as the first page inside the viewer.

### File names with spaces

If your PDF filename contains spaces (e.g. `reverie yearbook farwell.pdf`), write it exactly as-is in `books.json`. The library handles URL encoding automatically.

## 📁 Project Structure

```
/
├── index.html              # Landing page (clean hero with Open Library CTA)
├── library.html            # Bookshelf library page
├── viewer.html             # Flipbook reader with full controls
├── style.css               # Landing page styles
├── library.css             # Bookshelf, wooden shelf boards, book spines, hover effects
├── viewer.css              # Reading desk, paper texture, center binding, controls
├── script.js               # Landing page entrance animation
├── library.js              # Bookshelf rendering, PDF cover generation, search/sort
├── viewer.js               # PDF.js + StPageFlip integration, controls, keyboard, bookmarks
├── books/
│   └── books.json          # Book catalog (edit this to add books)
├── covers/                 # No longer needed — covers auto-rendered from PDF page 1
├── assets/                 # Static assets
└── README.md
```

## 🎨 Customization

### Colors & Theme

Edit the `:root` CSS variables in any `.css` file to change the color scheme:

```css
--accent: #7c3aed;          /* Primary accent color */
--accent-hover: #8b5cf6;    /* Hover state */
--bg-primary: #0c0a14;      /* Dark background */
--text-primary: #ffffff;     /* Text color */
```

### Bookshelf

The wooden shelf color is controlled by two variables in `library.css`:

```css
--shelf-wood-top: #3d2b1f;     /* Top edge of shelf */
--shelf-wood-bottom: #1f1410;  /* Bottom edge of shelf */
```

### Book Dimensions

Book width is calculated dynamically in `library.js` with slight random variation. Adjust `getBookWidth()` to change sizing.

### Viewer Background

The reading desk background is defined in `viewer.css` via `.book-viewer::before` and `.book-viewer::after` pseudo-elements. Edit the gradient values to change the desk appearance.

### Paper Texture

The paper noise texture is an inline SVG fractal filter in `viewer.css` at `.flipbook .page::before`. Adjust the `opacity` or `baseFrequency` values to change the texture strength.

### Font

The project uses [Inter](https://fonts.googleapis.com/css2?family=Inter) from Google Fonts. Change it in the `<link>` tag of each HTML file.

### Branding

- **Site title**: Edit the `<title>` tag in each HTML file
- **Landing page**: Edit `index.html` hero section
- **Footer text**: Edit the `<footer>` element in `index.html` and `library.html`

## ⌨️ Keyboard Shortcuts

| Key | Action |
|-----|--------|
| `←` | Previous page |
| `→` / `Space` | Next page |
| `Home` | First page |
| `End` | Last page |
| `+` / `=` | Zoom in |
| `-` | Zoom out |
| `0` | Reset zoom |
| `F` | Toggle fullscreen |
| `B` | Toggle bookmark |
| `D` | Toggle dark mode |
| `Esc` | Exit fullscreen |

## 📄 License

MIT — Free for personal and commercial use.

## 🙏 Credits

- [PDF.js](https://mozilla.github.io/pdf.js/) by Mozilla
- [StPageFlip](https://github.com/Nodlik/StPageFlip) by Nodlik
- [Inter](https://rsms.me/inter/) font by Rasmus Andersson
