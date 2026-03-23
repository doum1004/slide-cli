import { writeFileSync, readFileSync } from "fs";
import { join, basename } from "path";
import type { RenderResult } from "../types.js";

/**
 * Strip all embedded fonts from slide HTML:
 * - @font-face blocks (base64 data URIs, url() refs, any source)
 * - Google Fonts @import statements
 * - Google Fonts / gstatic <link> tags
 * - <link rel="preconnect"> to Google Fonts domains
 *
 * Injects system font stacks so text still renders properly.
 */
function stripEmbeddedFonts(htmlContent: string): string {
  let result = htmlContent
    // Remove entire @font-face blocks (handles base64, url(), multi-line)
    .replace(/@font-face\s*\{[^}]*\}/gi, "")
    // Remove @import url('...fonts.googleapis.com...')
    .replace(
      /@import\s+url\([^)]*fonts\.googleapis\.com[^)]*\)\s*;?/gi,
      ""
    )
    // Remove <link ...fonts.googleapis.com...>
    .replace(/<link[^>]*fonts\.googleapis\.com[^>]*\/?>/gi, "")
    // Remove <link ...fonts.gstatic.com...>
    .replace(/<link[^>]*fonts\.gstatic\.com[^>]*\/?>/gi, "")
    // Remove preconnect links to google fonts domains
    .replace(
      /<link[^>]*preconnect[^>]*fonts\.(googleapis|gstatic)\.com[^>]*\/?>/gi,
      ""
    );

  // Inject system font fallbacks before </head>
  const fontOverride = `<style data-system-fonts>
:root {
  --sys-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
  --sys-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif;
  --sys-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
}
body, html, div, span, p, a, li, td, th, label, input, button, textarea, select {
  font-family: var(--sys-sans) !important;
}
h1, h2, h3, h4, h5, h6 {
  font-family: var(--sys-serif) !important;
}
code, pre, kbd, samp, .mono, [class*="mono"] {
  font-family: var(--sys-mono) !important;
}
</style>`;

  result = result.replace(/<\/head>/i, fontOverride + "\n</head>");

  return result;
}

export function generatePresenter(
  results: RenderResult[],
  outDir: string,
  title: string,
  format: "png" | "jpg",
  hasImages: boolean,
  width: number,
  height: number
): string {
  const total = results.length;
  const imageFiles = results.map((r) => basename(r.imagePath));
  const htmlFiles = results.map((r) => basename(r.htmlPath));

  // ── Strip embedded fonts from every slide HTML for fast loading ──
  for (const result of results) {
    try {
      const content = readFileSync(result.htmlPath, "utf-8");
      // Skip if already processed
      if (content.includes("data-system-fonts")) continue;
      const fast = stripEmbeddedFonts(content);
      if (fast !== content) {
        writeFileSync(result.htmlPath, fast);
      }
    } catch (_) {
      // skip if file can't be read
    }
  }

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>
  :root {
    --bg: #0a0a0a;
    --surface: #111111;
    --border: #1f1f1f;
    --accent: #e8d5b0;
    --accent2: #7c6f5e;
    --text: #d4cfc8;
    --muted: #5a5550;
    --radius: 12px;
    --font-mono: ui-monospace, "Cascadia Code", "Source Code Pro", Menlo, Consolas, "DejaVu Sans Mono", monospace;
    --font-serif: "Iowan Old Style", "Palatino Linotype", Palatino, Georgia, "Noto Serif", serif;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: var(--font-mono);
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    user-select: none;
  }

  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    z-index: 10;
    gap: 12px;
  }

  .title {
    font-family: var(--font-serif);
    font-size: 15px;
    font-weight: 300;
    color: var(--accent);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    flex: 1;
    min-width: 0;
  }

  .header-right {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-shrink: 0;
  }

  .counter {
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.12em;
  }

  .mode-toggle {
    display: flex;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 6px;
    overflow: hidden;
  }

  .mode-btn {
    background: none;
    border: none;
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 9px;
    letter-spacing: 0.1em;
    padding: 5px 10px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .mode-btn:hover { color: var(--text); }
  .mode-btn.active { background: var(--accent); color: #0a0a0a; }
  .mode-btn:disabled { opacity: 0.25; cursor: not-allowed; }

  main {
    display: flex;
    align-items: center;
    justify-content: center;
    position: relative;
    overflow: hidden;
    padding: 24px 80px;
  }

  .slide-container {
    position: relative;
    height: 100%;
    max-height: calc(100dvh - 140px);
    aspect-ratio: ${width} / ${height};
    transition: opacity 0.15s ease;
  }

  .slide-container.fading { opacity: 0; }

  .slide-frame {
    width: 100%;
    height: 100%;
    border-radius: var(--radius);
    overflow: hidden;
    box-shadow:
      0 0 0 1px var(--border),
      0 32px 80px rgba(0,0,0,0.6),
      0 8px 24px rgba(0,0,0,0.4);
    background: #000;
    position: relative;
  }

  .slide-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .slide-frame iframe {
    position: absolute;
    top: 0;
    left: 0;
    width: ${width}px;
    height: ${height}px;
    border: none;
    pointer-events: none;
    transform-origin: top left;
  }

  .render-badge {
    display: none;
    position: absolute;
    bottom: 8px;
    right: 8px;
    background: rgba(0,0,0,0.7);
    color: var(--muted);
    font-size: 9px;
    letter-spacing: 0.08em;
    padding: 3px 7px;
    border-radius: 4px;
    pointer-events: none;
  }
  .needs-render .render-badge { display: block; }

  .nav-btn {
    position: absolute;
    top: 50%;
    transform: translateY(-50%);
    width: 44px;
    height: 44px;
    border-radius: 50%;
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    cursor: pointer;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: all 0.15s ease;
    z-index: 5;
  }
  .nav-btn:hover { background: var(--border); border-color: var(--accent2); }
  .nav-btn:active { transform: translateY(-50%) scale(0.95); }
  .nav-btn:disabled { opacity: 0.2; cursor: default; }
  .nav-btn svg { width: 18px; height: 18px; fill: none; stroke: currentColor; stroke-width: 2; stroke-linecap: round; stroke-linejoin: round; }
  .nav-prev { left: 16px; }
  .nav-next { right: 16px; }

  .progress-track {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    height: 2px;
    background: var(--border);
  }
  .progress-fill {
    height: 100%;
    background: var(--accent);
    transition: width 0.3s ease;
  }

  footer {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 16px;
    padding: 14px 24px;
    border-top: 1px solid var(--border);
  }

  .dot-track {
    display: flex;
    gap: 6px;
    align-items: center;
    flex-wrap: wrap;
    justify-content: center;
    max-width: 60vw;
  }

  .dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: var(--muted);
    cursor: pointer;
    transition: all 0.2s ease;
    border: none;
    padding: 0;
  }
  .dot.active { background: var(--accent); transform: scale(1.4); }
  .dot:hover:not(.active) { background: var(--accent2); }

  .ctrl-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: var(--font-mono);
    font-size: 10px;
    letter-spacing: 0.1em;
    padding: 6px 14px;
    border-radius: 6px;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
  }
  .ctrl-btn:hover { border-color: var(--accent2); color: var(--accent); }
  .ctrl-btn.active { background: var(--accent); color: #0a0a0a; border-color: var(--accent); }

  .speed-select {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--muted);
    font-family: var(--font-mono);
    font-size: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    appearance: none;
    outline: none;
  }
  .speed-select:focus { border-color: var(--accent2); }

  .kbd-hint {
    position: fixed;
    bottom: 72px;
    left: 50%;
    transform: translateX(-50%);
    font-size: 10px;
    color: var(--muted);
    letter-spacing: 0.1em;
    opacity: 0;
    pointer-events: none;
    transition: opacity 0.3s ease;
    white-space: nowrap;
  }
  .kbd-hint.show { opacity: 1; }

  body.fullscreen header,
  body.fullscreen footer { display: none; }
  body.fullscreen main { padding: 0; }
  body.fullscreen .nav-btn { opacity: 0; transition: opacity 0.3s ease; }
  body.fullscreen:hover .nav-btn { opacity: 1; }
  body.fullscreen .slide-container { max-height: 100dvh; }

  .slide-frame.loading::after {
    content: '';
    position: absolute;
    top: 50%;
    left: 50%;
    width: 24px;
    height: 24px;
    margin: -12px 0 0 -12px;
    border: 2px solid var(--border);
    border-top-color: var(--accent);
    border-radius: 50%;
    animation: spin 0.6s linear infinite;
    z-index: 2;
  }
  @keyframes spin { to { transform: rotate(360deg); } }

  @media (max-width: 600px) {
    main { padding: 12px 60px; }
    .nav-btn { width: 36px; height: 36px; }
    .nav-prev { left: 8px; }
    .nav-next { right: 8px; }
    .header-right { gap: 6px; }
    .mode-btn { padding: 5px 7px; }
  }
</style>
</head>
<body>

<header>
  <div class="title">${escHtml(title)}</div>
  <div class="header-right">
    <div class="mode-toggle" id="modeToggle" title="Switch between rendered images and live HTML">
      <button class="mode-btn${hasImages ? " active" : ""}" id="btnModeImg"
        onclick="setMode('img')" ${hasImages ? "" : "disabled title='No images — run without --no-images to generate them'"}>
        IMAGE
      </button>
      <button class="mode-btn${!hasImages ? " active" : ""}" id="btnModeHtml" onclick="setMode('html')">
        HTML
      </button>
    </div>
    <div class="counter"><span id="cur">1</span> / ${total}</div>
  </div>
</header>

<main>
  <button class="nav-btn nav-prev" id="btnPrev" onclick="go(-1)" title="Previous (<-)">
    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
  </button>

  <div class="slide-container" id="slideContainer">
    <div class="slide-frame" id="slideFrame">
      <img id="slideImg" src="" alt="Slide 1" draggable="false" style="display:none">
      <iframe id="slideIframe" src="" sandbox="allow-scripts allow-same-origin" style="display:none"></iframe>
      <div class="render-badge">no image</div>
    </div>
    <div class="progress-track">
      <div class="progress-fill" id="progressFill" style="width: ${(1 / total * 100).toFixed(1)}%"></div>
    </div>
  </div>

  <button class="nav-btn nav-next" id="btnNext" onclick="go(1)" title="Next (->)">
    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
  </button>
</main>

<footer>
  <button class="ctrl-btn" onclick="toggleFullscreen()" title="F">FULL</button>
  <div class="dot-track" id="dotTrack">
    ${htmlFiles.map((_, i) => `<button class="dot${i === 0 ? " active" : ""}" onclick="goTo(${i})" title="Slide ${i + 1}"></button>`).join("")}
  </div>
  <select class="speed-select" id="speedSelect" title="Autoplay speed">
    <option value="2000">2s</option>
    <option value="3000" selected>3s</option>
    <option value="5000">5s</option>
    <option value="8000">8s</option>
  </select>
  <button class="ctrl-btn" id="btnPlay" onclick="togglePlay()">PLAY</button>
</footer>

<div class="kbd-hint" id="kbdHint">\u2190 \u2192 navigate \u00b7 space play \u00b7 f fullscreen \u00b7 esc exit</div>

<script>
  const SLIDE_HTML   = ${JSON.stringify(htmlFiles)};
  const SLIDE_IMAGES = ${JSON.stringify(imageFiles)};
  const HAS_IMAGES   = ${hasImages};
  const SLIDE_WIDTH  = ${width};
  const SLIDE_HEIGHT = ${height};
  const TOTAL        = ${total};

  let current = 0;
  let mode = HAS_IMAGES ? 'img' : 'html';
  let playing = false;
  let timer = null;

  const $ = (id) => document.getElementById(id);
  const elCur       = $('cur');
  const elFill      = $('progressFill');
  const elDots      = document.querySelectorAll('.dot');
  const elPrev      = $('btnPrev');
  const elNext      = $('btnNext');
  const elPlay      = $('btnPlay');
  const elImg       = $('slideImg');
  const elContainer = $('slideContainer');
  const elFrame     = $('slideFrame');
  const elHint      = $('kbdHint');
  const elBtnImg    = $('btnModeImg');
  const elBtnHtml   = $('btnModeHtml');

  /* ── Image preload ── */
  const imgCache = new Map();

  function preloadImage(idx) {
    if (imgCache.has(idx) || !HAS_IMAGES) return;
    const img = new Image();
    img.src = SLIDE_IMAGES[idx];
    imgCache.set(idx, img);
  }

  function preloadNearby(idx) {
    preloadImage(idx);
    if (idx + 1 < TOTAL) preloadImage(idx + 1);
    if (idx - 1 >= 0) preloadImage(idx - 1);
  }

  /* ── Iframe LRU cache ── */
  const iframeCache = new Map();
  const IFRAME_CACHE_SIZE = 3;

  function getIframe(idx) {
    if (iframeCache.has(idx)) {
      const el = iframeCache.get(idx);
      iframeCache.delete(idx);
      iframeCache.set(idx, el);
      return el;
    }
    if (iframeCache.size >= IFRAME_CACHE_SIZE) {
      const oldest = iframeCache.keys().next().value;
      const oldEl = iframeCache.get(oldest);
      if (oldEl.parentNode) oldEl.remove();
      iframeCache.delete(oldest);
    }
    const iframe = document.createElement('iframe');
    iframe.sandbox = 'allow-scripts allow-same-origin';
    iframe.style.cssText = 'position:absolute;top:0;left:0;width:${width}px;height:${height}px;border:none;pointer-events:none;transform-origin:top left;';
    iframe.src = SLIDE_HTML[idx];
    iframeCache.set(idx, iframe);
    return iframe;
  }

  /* ── Mode ── */
  function setMode(m) {
    if (m === 'img' && elBtnImg.disabled) return;
    mode = m;
    elBtnImg.classList.toggle('active', m === 'img');
    elBtnHtml.classList.toggle('active', m === 'html');
    showSlide(current);
  }

  /* ── Show slide ── */
  function showSlide(idx) {
    iframeCache.forEach((el) => { el.style.display = 'none'; });

    if (mode === 'img') {
      elImg.style.display = '';
      const cached = imgCache.get(idx);
      elImg.src = (cached && cached.complete) ? cached.src : SLIDE_IMAGES[idx];
      elImg.alt = 'Slide ' + (idx + 1);
      elFrame.classList.remove('loading');
      preloadNearby(idx);
    } else {
      elImg.style.display = 'none';
      const iframe = getIframe(idx);
      if (!iframe.parentNode) elFrame.appendChild(iframe);
      iframe.style.display = '';
      elFrame.classList.add('loading');

      const onReady = () => { elFrame.classList.remove('loading'); };
      try {
        if (iframe.contentDocument && iframe.contentDocument.readyState === 'complete') {
          onReady();
        } else {
          iframe.addEventListener('load', onReady, { once: true });
        }
      } catch(e) {
        iframe.addEventListener('load', onReady, { once: true });
      }
      scaleIframe(iframe);
    }
  }

  function scaleIframe(iframe) {
    if (!iframe || !elFrame) return;
    const cw = elFrame.clientWidth;
    const ch = elFrame.clientHeight;
    if (cw === 0 || ch === 0) return;
    const scale = Math.min(cw / SLIDE_WIDTH, ch / SLIDE_HEIGHT);
    const ox = (cw - SLIDE_WIDTH * scale) / 2;
    const oy = (ch - SLIDE_HEIGHT * scale) / 2;
    iframe.style.transform = 'translate(' + ox + 'px,' + oy + 'px) scale(' + scale + ')';
  }

  new ResizeObserver(() => {
    if (mode === 'html') {
      const iframe = iframeCache.get(current);
      if (iframe) scaleIframe(iframe);
    }
  }).observe(elFrame);

  /* ── Nav ── */
  function updateUI() {
    elCur.textContent = current + 1;
    elFill.style.width = ((current + 1) / TOTAL * 100).toFixed(1) + '%';
    elPrev.disabled = current === 0;
    elNext.disabled = current === TOTAL - 1;
    elDots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function loadSlide(idx) {
    if (idx === current) return;
    elContainer.classList.add('fading');
    current = idx;
    updateUI();
    setTimeout(() => {
      showSlide(idx);
      elContainer.classList.remove('fading');
    }, 120);
  }

  function go(dir) {
    const next = current + dir;
    if (next < 0 || next >= TOTAL) {
      if (playing && next >= TOTAL) stopPlay();
      return;
    }
    loadSlide(next);
  }

  function goTo(idx) {
    if (idx >= 0 && idx < TOTAL) loadSlide(idx);
  }

  /* ── Autoplay ── */
  function togglePlay() { playing ? stopPlay() : startPlay(); }

  function startPlay() {
    playing = true;
    elPlay.textContent = 'PAUSE';
    elPlay.classList.add('active');
    timer = setInterval(() => go(1), parseInt($('speedSelect').value));
  }

  function stopPlay() {
    playing = false;
    elPlay.textContent = 'PLAY';
    elPlay.classList.remove('active');
    clearInterval(timer);
  }

  /* ── Fullscreen ── */
  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      document.body.classList.add('fullscreen');
    } else {
      document.exitFullscreen?.();
    }
  }
  document.addEventListener('fullscreenchange', () => {
    if (!document.fullscreenElement) document.body.classList.remove('fullscreen');
  });

  /* ── Keyboard ── */
  let hintTimer;
  function showHint() {
    elHint.classList.add('show');
    clearTimeout(hintTimer);
    hintTimer = setTimeout(() => elHint.classList.remove('show'), 2000);
  }

  document.addEventListener('keydown', (e) => {
    switch (e.key) {
      case 'ArrowLeft':  go(-1); showHint(); break;
      case 'ArrowRight': go(1);  showHint(); break;
      case ' ':          e.preventDefault(); togglePlay(); break;
      case 'f': case 'F': toggleFullscreen(); break;
      case 'Escape':     if (document.fullscreenElement) document.exitFullscreen?.(); break;
      case 'Home':       goTo(0); break;
      case 'End':        goTo(TOTAL - 1); break;
    }
  });

  /* ── Touch ── */
  let touchX = 0;
  document.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  /* ── Init ── */
  showSlide(0);
  updateUI();
  if (HAS_IMAGES && typeof requestIdleCallback === 'function') {
    requestIdleCallback(() => { for (let i = 0; i < TOTAL; i++) preloadImage(i); });
  }
  setTimeout(() => { elHint.classList.add('show'); setTimeout(() => elHint.classList.remove('show'), 2500); }, 800);
</script>

</body>
</html>`;

  const outPath = join(outDir, "index.html");
  writeFileSync(outPath, html);
  return outPath;
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
