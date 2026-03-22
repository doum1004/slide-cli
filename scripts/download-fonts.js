#!/usr/bin/env node
/**
 * scripts/download-fonts.js
 *
 * Downloads Noto CJK fonts for unicode support (CJK, Korean, Japanese, French, etc.)
 * These fonts are too large for npm packages (~20MB each) so we fetch them directly
 * from the Noto project's GitHub releases.
 *
 * Fonts are stored in ./fonts/ and are gitignored.
 * Re-run manually with: node scripts/download-fonts.js
 */

import { createWriteStream, mkdirSync, existsSync, statSync } from "fs";
import { get as httpsGet } from "https";
import { get as httpGet } from "http";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const FONTS_DIR = join(__dirname, "..", "fonts");

const FONTS = [
  {
    name: "NotoSansCJK-Bold",
    filename: "NotoSansCJK-Bold.ttc",
    // Google Fonts CDN via GitHub Noto CJK releases
    url: "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTC/NotoSansCJK-Bold.ttc",
    minSize: 15_000_000, // ~20MB — if smaller, download failed
    description: "Noto Sans CJK Bold (Latin, French, CJK, Korean, Japanese)",
  },
  {
    name: "NotoSansCJK-Black",
    filename: "NotoSansCJK-Black.ttc",
    url: "https://github.com/notofonts/noto-cjk/raw/main/Sans/OTC/NotoSansCJK-Black.ttc",
    minSize: 15_000_000,
    description: "Noto Sans CJK Black (display titles, weight 900)",
  },
  {
    name: "NotoSerifCJK-Bold",
    filename: "NotoSerifCJK-Bold.ttc",
    url: "https://github.com/notofonts/noto-cjk/raw/main/Serif/OTC/NotoSerifCJK-Bold.ttc",
    minSize: 15_000_000,
    description: "Noto Serif CJK Bold (serif quotes, headings)",
  },
];

mkdirSync(FONTS_DIR, { recursive: true });

function download(url, destPath, description) {
  return new Promise((resolve, reject) => {
    // Skip if already present and large enough
    if (existsSync(destPath)) {
      const size = statSync(destPath).size;
      const font = FONTS.find((f) => destPath.endsWith(f.filename));
      if (font && size >= font.minSize) {
        console.log(`  ✓ ${description} (already downloaded)`);
        resolve();
        return;
      }
    }

    console.log(`  ↓ Downloading ${description}...`);
    const file = createWriteStream(destPath);
    const getter = url.startsWith("https") ? httpsGet : httpGet;

    const request = getter(url, { headers: { "User-Agent": "slide-cli/1.0" } }, (res) => {
      // Follow redirects (GitHub uses 302)
      if (res.statusCode === 301 || res.statusCode === 302 || res.statusCode === 307) {
        file.close();
        download(res.headers.location, destPath, description).then(resolve).catch(reject);
        return;
      }
      if (res.statusCode !== 200) {
        file.close();
        reject(new Error(`HTTP ${res.statusCode} for ${url}`));
        return;
      }
      res.pipe(file);
      file.on("finish", () => {
        file.close();
        const size = statSync(destPath).size;
        console.log(`  ✓ ${description} (${(size / 1_000_000).toFixed(1)}MB)`);
        resolve();
      });
    });

    request.on("error", (err) => {
      file.close();
      reject(err);
    });
  });
}

async function main() {
  console.log("\nslide-cli: Setting up unicode fonts (Noto CJK)...");
  console.log(`  Destination: ${FONTS_DIR}\n`);

  const failures = [];

  for (const font of FONTS) {
    const destPath = join(FONTS_DIR, font.filename);
    try {
      await download(font.url, destPath, font.description);
    } catch (err) {
      failures.push({ font, err });
      console.warn(`  ⚠ Could not download ${font.name}: ${err.message}`);
      console.warn(`    Slides with CJK/accented text will fall back to system fonts.`);
    }
  }

  if (failures.length === 0) {
    console.log("\n  ✓ All unicode fonts ready.\n");
  } else {
    console.log(`\n  ⚠ ${failures.length} font(s) could not be downloaded.`);
    console.log(`    Re-run: node scripts/download-fonts.js\n`);
  }
}

main().catch((err) => {
  console.error("Font setup failed:", err.message);
  // Non-zero exit would break bun install, so we warn and continue
  process.exit(0);
});
