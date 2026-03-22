import { writeFileSync } from "fs";
import { join, basename } from "path";
import type { RenderResult } from "../types.js";

export function generatePresenter(
  results: RenderResult[],
  outDir: string,
  title: string,
  format: "png" | "jpg",
  hasImages: boolean
): string {
  const total = results.length;
  const slideFiles = results.map((r) =>
    hasImages ? basename(r.imagePath) : basename(r.htmlPath)
  );

  const html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${escHtml(title)}</title>
<style>
  @import url('https://fonts.googleapis.com/css2?family=DM+Mono:wght@400;500&family=Fraunces:ital,opsz,wght@0,9..144,300;0,9..144,600;1,9..144,300&display=swap');

  :root {
    --bg: #0a0a0a;
    --surface: #111111;
    --border: #1f1f1f;
    --accent: #e8d5b0;
    --accent2: #7c6f5e;
    --text: #d4cfc8;
    --muted: #5a5550;
    --radius: 12px;
  }

  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }

  body {
    background: var(--bg);
    color: var(--text);
    font-family: 'DM Mono', monospace;
    height: 100dvh;
    display: grid;
    grid-template-rows: auto 1fr auto;
    overflow: hidden;
    user-select: none;
  }

  /* ── Header ── */
  header {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: 16px 24px;
    border-bottom: 1px solid var(--border);
    backdrop-filter: blur(8px);
    z-index: 10;
  }

  .title {
    font-family: 'Fraunces', serif;
    font-size: 15px;
    font-weight: 300;
    color: var(--accent);
    letter-spacing: 0.02em;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
    max-width: 40vw;
  }

  .counter {
    font-size: 11px;
    color: var(--muted);
    letter-spacing: 0.12em;
  }

  /* ── Main stage ── */
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
    aspect-ratio: ${getAspectRatio(results)};
    transition: opacity 0.2s ease;
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
  }

  .slide-frame img {
    width: 100%;
    height: 100%;
    object-fit: cover;
    display: block;
  }

  .slide-frame iframe {
    width: 100%;
    height: 100%;
    border: none;
    pointer-events: none;
  }

  /* ── Nav buttons ── */
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

  /* ── Progress bar ── */
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

  /* ── Footer controls ── */
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
  .dot.active {
    background: var(--accent);
    transform: scale(1.4);
  }
  .dot:hover:not(.active) { background: var(--accent2); }

  .ctrl-btn {
    background: var(--surface);
    border: 1px solid var(--border);
    color: var(--text);
    font-family: 'DM Mono', monospace;
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
    font-family: 'DM Mono', monospace;
    font-size: 10px;
    padding: 6px 8px;
    border-radius: 6px;
    cursor: pointer;
    appearance: none;
    outline: none;
  }
  .speed-select:focus { border-color: var(--accent2); }

  /* ── Keyboard hint ── */
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
  }
  .kbd-hint.show { opacity: 1; }

  /* ── Fullscreen mode ── */
  body.fullscreen header,
  body.fullscreen footer { display: none; }
  body.fullscreen main { padding: 0; }
  body.fullscreen .nav-btn { opacity: 0; transition: opacity 0.3s ease; }
  body.fullscreen:hover .nav-btn { opacity: 1; }
  body.fullscreen .slide-container { max-height: 100dvh; }

  @media (max-width: 600px) {
    main { padding: 12px 60px; }
    .nav-btn { width: 36px; height: 36px; }
    .nav-prev { left: 8px; }
    .nav-next { right: 8px; }
  }
</style>
</head>
<body>

<header>
  <div class="title">${escHtml(title)}</div>
  <div class="counter"><span id="cur">1</span> / ${total}</div>
</header>

<main>
  <button class="nav-btn nav-prev" id="btnPrev" onclick="go(-1)" title="Previous (←)">
    <svg viewBox="0 0 24 24"><polyline points="15 18 9 12 15 6"/></svg>
  </button>

  <div class="slide-container" id="slideContainer">
    <div class="slide-frame" id="slideFrame">
      ${hasImages
        ? `<img id="slideImg" src="${slideFiles[0]}" alt="Slide 1" draggable="false">`
        : `<iframe id="slideIframe" src="${slideFiles[0]}" sandbox="allow-scripts allow-same-origin"></iframe>`}
    </div>
    <div class="progress-track"><div class="progress-fill" id="progressFill" style="width: ${(1/total*100).toFixed(1)}%"></div></div>
  </div>

  <button class="nav-btn nav-next" id="btnNext" onclick="go(1)" title="Next (→)">
    <svg viewBox="0 0 24 24"><polyline points="9 18 15 12 9 6"/></svg>
  </button>
</main>

<footer>
  <button class="ctrl-btn" onclick="toggleFullscreen()" title="F">⛶ FULL</button>
  <div class="dot-track" id="dotTrack">
    ${slideFiles.map((_, i) => `<button class="dot${i === 0 ? ' active' : ''}" onclick="goTo(${i})" title="Slide ${i+1}"></button>`).join('')}
  </div>
  <select class="speed-select" id="speedSelect" title="Autoplay speed">
    <option value="2000">2s</option>
    <option value="3000" selected>3s</option>
    <option value="5000">5s</option>
    <option value="8000">8s</option>
  </select>
  <button class="ctrl-btn" id="btnPlay" onclick="togglePlay()">▶ PLAY</button>
</footer>

<div class="kbd-hint" id="kbdHint">← → to navigate · space to play · f for fullscreen · esc to exit</div>

<script>
  const SLIDES = ${JSON.stringify(slideFiles)};
  const USE_IMG = ${hasImages};
  let current = 0;
  let playing = false;
  let timer = null;

  const elCur = document.getElementById('cur');
  const elFill = document.getElementById('progressFill');
  const elDots = document.querySelectorAll('.dot');
  const elPrev = document.getElementById('btnPrev');
  const elNext = document.getElementById('btnNext');
  const elPlay = document.getElementById('btnPlay');
  const elImg = document.getElementById('slideImg');
  const elIframe = document.getElementById('slideIframe');
  const elContainer = document.getElementById('slideContainer');
  const elHint = document.getElementById('kbdHint');

  function updateUI() {
    elCur.textContent = current + 1;
    elFill.style.width = ((current + 1) / SLIDES.length * 100).toFixed(1) + '%';
    elPrev.disabled = current === 0;
    elNext.disabled = current === SLIDES.length - 1;
    elDots.forEach((d, i) => d.classList.toggle('active', i === current));
  }

  function loadSlide(idx) {
    elContainer.classList.add('fading');
    setTimeout(() => {
      if (USE_IMG) {
        elImg.src = SLIDES[idx];
        elImg.alt = 'Slide ' + (idx + 1);
      } else {
        elIframe.src = SLIDES[idx];
      }
      elContainer.classList.remove('fading');
    }, 180);
    current = idx;
    updateUI();
  }

  function go(dir) {
    const next = current + dir;
    if (next < 0 || next >= SLIDES.length) {
      if (playing && next >= SLIDES.length) stopPlay();
      return;
    }
    loadSlide(next);
  }

  function goTo(idx) { loadSlide(idx); }

  function togglePlay() {
    playing ? stopPlay() : startPlay();
  }

  function startPlay() {
    playing = true;
    elPlay.textContent = '⏸ PAUSE';
    elPlay.classList.add('active');
    const speed = parseInt(document.getElementById('speedSelect').value);
    timer = setInterval(() => go(1), speed);
  }

  function stopPlay() {
    playing = false;
    elPlay.textContent = '▶ PLAY';
    elPlay.classList.remove('active');
    clearInterval(timer);
  }

  function toggleFullscreen() {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.();
      document.body.classList.add('fullscreen');
    } else {
      document.exitFullscreen?.();
      document.body.classList.remove('fullscreen');
    }
  }

  // Keyboard navigation
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
      case ' ':
        e.preventDefault();
        togglePlay();
        break;
      case 'f': case 'F':
        toggleFullscreen();
        break;
      case 'Escape':
        if (document.fullscreenElement) {
          document.exitFullscreen?.();
          document.body.classList.remove('fullscreen');
        }
        break;
      case 'Home': goTo(0); break;
      case 'End':  goTo(SLIDES.length - 1); break;
    }
  });

  // Touch/swipe
  let touchX = 0;
  document.addEventListener('touchstart', (e) => { touchX = e.touches[0].clientX; }, { passive: true });
  document.addEventListener('touchend', (e) => {
    const dx = e.changedTouches[0].clientX - touchX;
    if (Math.abs(dx) > 50) go(dx < 0 ? 1 : -1);
  }, { passive: true });

  // Initial state
  updateUI();
  // Show hint briefly on load
  setTimeout(() => { elHint.classList.add('show'); setTimeout(() => elHint.classList.remove('show'), 2500); }, 800);
</script>
</body>
</html>`;

  const outPath = join(outDir, "index.html");
  writeFileSync(outPath, html);
  return outPath;
}

function getAspectRatio(results: RenderResult[]): string {
  // Default to 9/16 for portrait cards
  return "9 / 16";
}

function escHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
