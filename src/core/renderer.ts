import Handlebars from "handlebars";
import { writeFileSync, mkdirSync, existsSync, readFileSync } from "fs";
import { join, resolve, extname, isAbsolute } from "path";
import type { Template, SlideData, RenderResult } from "../types.js";
import { buildFontCSS } from "../utils/fonts.js";

// Pre-build font CSS once per process — embedding as data URIs ensures
// Puppeteer renders them correctly regardless of working directory or OS.
let _fontCSSCache: string | null = null;
function getFontCSS(): string {
  if (_fontCSSCache === null) {
    _fontCSSCache = buildFontCSS({
      fraunces: true,
      dmMono: true,
      bebasNeue: true,
      outfit: true,
      playfairDisplay: true,
      lato: true,
      cjk: true,
    });
  }
  return _fontCSSCache;
}

// Register useful Handlebars helpers
Handlebars.registerHelper("eq", (a, b) => a === b);
Handlebars.registerHelper("add", (a, b) => Number(a) + Number(b));
Handlebars.registerHelper("or", (a, b) => a || b);
Handlebars.registerHelper("default", (val, fallback) => val || fallback);
Handlebars.registerHelper("upper", (s) => String(s).toUpperCase());
Handlebars.registerHelper("lower", (s) => String(s).toLowerCase());

// ── Image resolution ─────────────────────────────────────────────────────────
const MIME: Record<string, string> = {
  ".jpg": "image/jpeg", ".jpeg": "image/jpeg",
  ".png": "image/png",  ".webp": "image/webp",
  ".gif": "image/gif",  ".svg": "image/svg+xml",
};

export interface ImageFailure {
  slideIndex: number;  // 1-based
  slotId: string;
  value: string;       // original value from the data JSON
  reason: string;      // human-readable explanation
}

/**
 * Try to resolve an image value to a base64 data URI.
 * Returns { uri } on success or { error } on failure — never throws.
 */
async function tryResolveImage(
  value: string,
  dataDir: string
): Promise<{ uri: string } | { error: string }> {
  if (!value) return { uri: value };
  if (value.startsWith("data:")) return { uri: value };

  if (value.startsWith("http://") || value.startsWith("https://")) {
    try {
      const res = await fetch(value);
      if (!res.ok) return { error: `HTTP ${res.status} from server` };
      const buf = await res.arrayBuffer();
      const ct = res.headers.get("content-type") ?? "image/jpeg";
      const b64 = Buffer.from(buf).toString("base64");
      return { uri: `data:${ct};base64,${b64}` };
    } catch (err: any) {
      return { error: err.message ?? "Network error" };
    }
  }

  const absPath = isAbsolute(value) ? value : resolve(dataDir, value);
  if (!existsSync(absPath)) {
    return { error: `File not found: ${absPath}` };
  }
  const ext = extname(absPath).toLowerCase();
  const mime = MIME[ext] ?? "image/jpeg";
  const b64 = readFileSync(absPath).toString("base64");
  return { uri: `data:${mime};base64,${b64}` };
}

export async function renderSlides(
  template: Template,
  slides: SlideData[],
  outDir: string,
  dataDir: string,
  format: "png" | "jpg" = "jpg",
  generateImages = true,
  force = false
): Promise<{ results: RenderResult[]; failures: ImageFailure[] }> {
  mkdirSync(outDir, { recursive: true });

  const imageSlotIds = new Set(
    template.manifest.slots
      .filter((s) => s.type === "image" || s.type === "url")
      .map((s) => s.id)
  );

  const compiledTemplate = Handlebars.compile(template.html);
  const results: RenderResult[] = [];
  const failures: ImageFailure[] = [];

  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const resolvedSlots: Record<string, unknown> = {};
    let slideHasFailed = false;

    for (const [key, val] of Object.entries(slide)) {
      if (imageSlotIds.has(key) && typeof val === "string" && val) {
        const outcome = await tryResolveImage(val, dataDir);
        if ("error" in outcome) {
          failures.push({
            slideIndex: i + 1,
            slotId: key,
            value: val,
            reason: outcome.error,
          });
          slideHasFailed = true;
          // --force: clear the slot so {{#if image}} collapses the image section
          // no --force: skip rendering this slide entirely
          resolvedSlots[key] = force ? "" : val;
        } else {
          resolvedSlots[key] = outcome.uri;
        }
      } else {
        resolvedSlots[key] = val;
      }
    }

    // Without --force, skip writing HTML and recording a result for this slide
    if (slideHasFailed && !force) continue;

    const context = {
      ...resolvedSlots,
      slideIndex: i + 1,
      totalSlides: slides.length,
      title: (slide.title as string) ?? `Slide ${i + 1}`,
    };

    const html = compiledTemplate(context);
    const slideHtmlPath = join(outDir, `slide-${i + 1}.html`);
    const slideImagePath = join(outDir, `slide-${i + 1}.${format}`);

    writeFileSync(slideHtmlPath, wrapHtml(html, template.manifest.width, template.manifest.height));

    results.push({
      slideIndex: i + 1,
      htmlPath: slideHtmlPath,
      imagePath: slideImagePath,
    });
  }

  if (generateImages) {
    await screenshotSlides(results, template.manifest.width, template.manifest.height, format);
  }

  return { results, failures };
}

function wrapHtml(content: string, width: number, height: number): string {
  const fontCSS = getFontCSS();
  const fontBlock = `<style>\n/* ── Embedded fonts (portable, no network required) ── */\n${fontCSS}\n</style>`;

  if (content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html")) {
    // Full document: strip @import Google Fonts lines (network-dependent)
    // and inject embedded fonts right after <head> or before first <style>
    const cleaned = content.replace(/@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^'"]*['"]\);?\s*/g, "");
    return cleaned.replace(/(<head[^>]*>)/, `$1\n${fontBlock}`);
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${width}, initial-scale=1.0">
${fontBlock}
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
</style>
</head>
<body>${content}</body>
</html>`;
}

async function screenshotSlides(
  results: RenderResult[],
  width: number,
  height: number,
  format: "png" | "jpg"
): Promise<void> {
  const puppeteer = await import("puppeteer");

  const chromePaths = [
    "/opt/google/chrome/chrome",
    "/usr/bin/google-chrome",
    "/usr/bin/chromium",
    "/usr/bin/chromium-browser",
    process.env.CHROME_PATH,
  ].filter(Boolean) as string[];

  let executablePath: string | undefined;
  for (const p of chromePaths) {
    if (existsSync(p)) { executablePath = p; break; }
  }

  const browser = await puppeteer.default.launch({
    executablePath,
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage", "--disable-gpu", "--font-render-hinting=none"],
  });

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    for (const result of results) {
      const fileUrl = `file://${resolve(result.htmlPath)}`;
      await page.goto(fileUrl, { waitUntil: "networkidle0", timeout: 15000 });
      await page.evaluate(() => document.fonts.ready);
      await page.evaluate(() => new Promise<void>((resolve) => {
        requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
      }));
      await new Promise((r) => setTimeout(r, 150));

      const isJpeg = format === "jpg";

      // Puppeteer uses the file extension to infer type, but .jpg is not
      // recognised — only .jpeg is. We screenshot to a .jpeg temp path then
      // rename to the user-visible .jpg path to avoid any ambiguity.
      const screenshotPath = isJpeg
        ? result.imagePath.replace(/\.jpg$/, ".jpeg")
        : result.imagePath;

      await page.screenshot({
        path: screenshotPath as `${string}.png` | `${string}.jpeg`,
        type: isJpeg ? "jpeg" : "png",
        quality: isJpeg ? 95 : undefined,
        clip: { x: 0, y: 0, width, height },
      });

      // Rename .jpeg → .jpg so the output matches what the user asked for
      if (isJpeg && screenshotPath !== result.imagePath) {
        const { renameSync } = await import("fs");
        renameSync(screenshotPath, result.imagePath);
      }
    }
  } finally {
    await browser.close();
  }
}