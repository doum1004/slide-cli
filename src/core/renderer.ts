import Handlebars from "handlebars";
import { writeFileSync, mkdirSync, existsSync, readFileSync, renameSync } from "fs";
import { join, resolve, extname, isAbsolute } from "path";
import type { Template, SlideData, RenderResult } from "../types.js";

// ── Handlebars helpers ───────────────────────────────────────────────────────
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
  slideIndex: number;
  slotId: string;
  value: string;
  reason: string;
}

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
  if (!existsSync(absPath)) return { error: `File not found: ${absPath}` };
  const ext = extname(absPath).toLowerCase();
  const mime = MIME[ext] ?? "image/jpeg";
  const b64 = readFileSync(absPath).toString("base64");
  return { uri: `data:${mime};base64,${b64}` };
}

// ── HTML helpers ─────────────────────────────────────────────────────────────

function extractBody(html: string): string {
  const match = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
  return match ? match[1] : html;
}

function extractBodyAttrs(html: string): string {
  const match = html.match(/<body([^>]*)>/i);
  return match ? match[1].trim() : "";
}

function extractHeadStyles(html: string): string {
  const headMatch = html.match(/<head[^>]*>([\s\S]*?)<\/head>/i);
  if (!headMatch) return "";
  const head = headMatch[1];
  const blocks: string[] = [];
  const re = /<style[^>]*>([\s\S]*?)<\/style>/gi;
  let m;
  while ((m = re.exec(head)) !== null) {
    const content = m[1].trim();
    if (content) {
      blocks.push(content);
    }
  }
  return blocks.join("\n");
}

function wrapHtml(content: string, width: number, height: number): string {
  if (content.trim().startsWith("<!DOCTYPE") || content.trim().startsWith("<html")) {
    return content.replace(
      /@import\s+url\(['"]https:\/\/fonts\.googleapis\.com[^'"]*['"]\);?\s*/g, ""
    );
  }

  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=${width}, initial-scale=1.0">
<style>
  * { margin: 0; padding: 0; box-sizing: border-box; }
  html, body { width: ${width}px; height: ${height}px; overflow: hidden; }
</style>
</head>
<body>${content}</body>
</html>`;
}

// ── Main entry point ─────────────────────────────────────────────────────────

export async function renderSlides(
  template: Template,
  slides: SlideData[],
  outDir: string,
  dataDir: string,
  format: "png" | "jpg" = "jpg",
  generateImages = true,
  allowMissingImages = false
): Promise<{ results: RenderResult[]; failures: ImageFailure[] }> {
  const totalStart = performance.now();
  mkdirSync(outDir, { recursive: true });

  const imageSlotIds = new Set(
    template.manifest.slots
      .filter((s) => s.type === "image" || s.type === "url")
      .map((s) => s.id)
  );

  const compiledTemplate = Handlebars.compile(template.html);
  const results: RenderResult[] = [];
  const failures: ImageFailure[] = [];

  const resolveStart = performance.now();
  for (let i = 0; i < slides.length; i++) {
    const slide = slides[i];
    const resolvedSlots: Record<string, unknown> = {};

    for (const [key, val] of Object.entries(slide)) {
      if (imageSlotIds.has(key) && typeof val === "string" && val) {
        const outcome = await tryResolveImage(val, dataDir);
        if ("error" in outcome) {
          failures.push({ slideIndex: i + 1, slotId: key, value: val, reason: outcome.error });
          resolvedSlots[key] = "";
        } else {
          resolvedSlots[key] = outcome.uri;
        }
      } else {
        resolvedSlots[key] = val;
      }
    }

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
    results.push({ slideIndex: i + 1, htmlPath: slideHtmlPath, imagePath: slideImagePath });
  }
  //console.log(`[perf] Resolve + write HTML: ${(performance.now() - resolveStart).toFixed(0)}ms`);

  if (generateImages) {
    await screenshotSlides(results, template.manifest.width, template.manifest.height, format);
  }

  //console.log(`[perf] Total renderSlides: ${(performance.now() - totalStart).toFixed(0)}ms`);
  return { results, failures };
}

// ── Screenshot ───────────────────────────────────────────────────────────────

async function screenshotSlides(
  results: RenderResult[],
  width: number,
  height: number,
  format: "png" | "jpg"
): Promise<void> {
  if (results.length === 0) return;

  const launchStart = performance.now();
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
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
      "--font-render-hinting=none",
    ],
  });
  //console.log(`[perf] Browser launch: ${(performance.now() - launchStart).toFixed(0)}ms`);

  try {
    const page = await browser.newPage();
    await page.setViewport({ width, height, deviceScaleFactor: 1 });

    // ── Shell page loaded once, slides swapped in via DOM ──────────
    const shellStart = performance.now();

    const isJpeg = format === "jpg";

    const shellHtml = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style id="slide-styles"></style>
<style>
  ${!isJpeg ? 'html, body { background: transparent !important; }' : ''}
</style>
</head>
<body></body>
</html>`;

    await page.setContent(shellHtml, { waitUntil: "load" });
    //console.log(`[perf] Shell page ready: ${(performance.now() - shellStart).toFixed(0)}ms`);

    // ── Render each slide by swapping body ──────────────────────────

    for (const result of results) {
      const slideStart = performance.now();

      const slideHtml = readFileSync(result.htmlPath, "utf-8");
      const bodyContent = extractBody(slideHtml);
      const bodyAttrs = extractBodyAttrs(slideHtml);
      const headStyles = extractHeadStyles(slideHtml);

      const t0 = performance.now();
      await page.evaluate(
        ({ styles, body, attrs }: { styles: string; body: string; attrs: string }) => {
          const styleEl = document.getElementById("slide-styles");
          if (styleEl) styleEl.textContent = styles;

          // Apply body attributes (class="has-bg-image" etc.)
          const temp = document.createElement("div");
          temp.innerHTML = `<div ${attrs}></div>`;
          const src = temp.firstElementChild;
          while (document.body.attributes.length > 0) {
            document.body.removeAttribute(document.body.attributes[0].name);
          }
          if (src) {
            for (const attr of Array.from(src.attributes)) {
              document.body.setAttribute(attr.name, attr.value);
            }
          }

          document.body.innerHTML = body;
        },
        { styles: headStyles, body: bodyContent, attrs: bodyAttrs }
      );
      //console.log(`[perf]   slide ${result.slideIndex} swap: ${(performance.now() - t0).toFixed(0)}ms`);

      // Wait for base64 images to decode
      await page.evaluate(() =>
        Promise.all(
          Array.from(document.images)
            .filter((img) => !img.complete)
            .map((img) => new Promise<void>((res) => {
              img.onload = () => res();
              img.onerror = () => res();
            }))
        )
      );

      // One rAF for layout
      await page.evaluate(() =>
        new Promise<void>((r) => requestAnimationFrame(() => r()))
      );

      const t2 = performance.now();
      const screenshotPath = isJpeg
        ? result.imagePath.replace(/\.jpg$/, ".jpeg")
        : result.imagePath;

      await page.screenshot({
        path: screenshotPath as `${string}.png` | `${string}.jpeg`,
        type: isJpeg ? "jpeg" : "png",
        quality: isJpeg ? 95 : undefined,
        clip: { x: 0, y: 0, width, height },
        omitBackground: !isJpeg,  // ← ADD THIS
      });
      //console.log(`[perf]   slide ${result.slideIndex} screenshot: ${(performance.now() - t2).toFixed(0)}ms`);

      if (isJpeg && screenshotPath !== result.imagePath) {
        renameSync(screenshotPath, result.imagePath);
      }

      //console.log(`[perf]   slide ${result.slideIndex} total: ${(performance.now() - slideStart).toFixed(0)}ms`);
    }
  } finally {
    await browser.close();
  }
}
