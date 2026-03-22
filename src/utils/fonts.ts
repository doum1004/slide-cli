import { existsSync, readFileSync } from "fs";
import { join, dirname } from "path";

const PKG_ROOT = join(dirname(import.meta.path), "..", "..", "node_modules");
const FONTS_DIR = join(dirname(import.meta.path), "..", "..", "fonts");

/**
 * Read a font file and return a base64 data URI.
 * Puppeteer renders from file:// pages — embedding fonts as data URIs
 * is the only way to guarantee they load regardless of working directory.
 */
function toDataUri(filePath: string, format: "woff2" | "truetype"): string {
  const data = readFileSync(filePath).toString("base64");
  const mime = format === "woff2" ? "font/woff2" : "font/truetype";
  return `data:${mime};base64,${data}`;
}

/**
 * Build a single @font-face rule.
 */
function fontFace(
  family: string,
  weight: number,
  style: "normal" | "italic",
  src: string
): string {
  return `@font-face {
  font-family: '${family}';
  font-weight: ${weight};
  font-style: ${style};
  font-display: block;
  src: ${src};
}`;
}

/**
 * Try to load a fontsource woff2 file, return data URI or null if not found.
 */
function fontsourceUri(pkg: string, subset: string, weight: number, style: string): string | null {
  const path = join(PKG_ROOT, "@fontsource", pkg, "files", `${pkg}-${subset}-${weight}-${style}.woff2`);
  if (!existsSync(path)) return null;
  return `url('${toDataUri(path, "woff2")}') format('woff2')`;
}

function fontsourceVariableUri(pkg: string, subset: string, style: string): string | null {
  // Variable fonts use a different filename pattern
  const path = join(PKG_ROOT, "@fontsource-variable", pkg, "files", `${pkg}-${subset}-wght-${style}.woff2`);
  if (!existsSync(path)) return null;
  return `url('${toDataUri(path, "woff2")}') format('woff2')`;
}

/**
 * Try to load a downloaded Noto CJK font, return data URI or null.
 * Falls back to local() hint so the system font is used if the file
 * wasn't downloaded (non-blocking graceful degradation).
 */
function notoCjkSrc(filename: string, localName: string): string {
  const path = join(FONTS_DIR, filename);
  if (existsSync(path)) {
    return `local('${localName}'), url('${toDataUri(path, "truetype")}') format('truetype')`;
  }
  // Font not downloaded — fall back to system only (still works if Noto is installed)
  return `local('${localName}')`;
}

// ─── Public font CSS builders ──────────────────────────────────────────────

export function frauncesCSS(): string {
  // Variable font covers all weights in one file
  const varSrc = fontsourceVariableUri("fraunces", "latin", "normal");
  const varItalicSrc = fontsourceVariableUri("fraunces", "latin", "italic");

  if (varSrc && varItalicSrc) {
    return [
      fontFace("Fraunces", 200, "normal", varSrc),
      fontFace("Fraunces", 400, "normal", varSrc),
      fontFace("Fraunces", 700, "normal", varSrc),
      fontFace("Fraunces", 200, "italic", varItalicSrc),
      fontFace("Fraunces", 400, "italic", varItalicSrc),
    ].join("\n");
  }

  // Fall back to individual weight files
  const faces: string[] = [];
  for (const [weight, style] of [[200, "normal"], [400, "normal"], [200, "italic"], [400, "italic"]] as const) {
    const src = fontsourceUri("fraunces", "latin", weight, style);
    if (src) faces.push(fontFace("Fraunces", weight, style, src));
  }
  return faces.join("\n");
}

export function dmMonoCSS(): string {
  const faces: string[] = [];
  for (const [weight, style] of [[300, "normal"], [400, "normal"], [500, "normal"]] as const) {
    const src = fontsourceUri("dm-mono", "latin", weight, style);
    if (src) faces.push(fontFace("DM Mono", weight, style, src));
  }
  return faces.join("\n");
}

export function bebasNeueCSS(): string {
  const src = fontsourceUri("bebas-neue", "latin", 400, "normal");
  if (!src) return "";
  return fontFace("Bebas Neue", 400, "normal", src);
}

export function outfitCSS(): string {
  // Variable font covers all weights
  const varSrc = fontsourceVariableUri("outfit", "latin", "normal");
  if (varSrc) {
    return [300, 400, 700, 900].map((w) =>
      fontFace("Outfit", w, "normal", varSrc)
    ).join("\n");
  }

  const faces: string[] = [];
  for (const weight of [300, 400, 700, 900] as const) {
    const src = fontsourceUri("outfit", "latin", weight, "normal");
    if (src) faces.push(fontFace("Outfit", weight, "normal", src));
  }
  return faces.join("\n");
}

export function playfairDisplayCSS(): string {
  const faces: string[] = [];
  for (const [weight, style] of [
    [400, "normal"], [700, "normal"],
    [400, "italic"], [700, "italic"],
  ] as const) {
    const src = fontsourceUri("playfair-display", "latin", weight, style);
    if (src) faces.push(fontFace("Playfair Display", weight, style, src));
  }
  return faces.join("\n");
}

export function latoCSS(): string {
  const faces: string[] = [];
  for (const [weight, style] of [[300, "normal"], [400, "normal"], [700, "normal"]] as const) {
    const src = fontsourceUri("lato", "latin", weight, style);
    if (src) faces.push(fontFace("Lato", weight, style, src));
  }
  return faces.join("\n");
}

export function notoCjkCSS(): string {
  return [
    fontFace("Noto Sans CJK", 700, "normal",
      notoCjkSrc("NotoSansCJK-Bold.ttc", "Noto Sans CJK JP")),
    fontFace("Noto Sans CJK", 900, "normal",
      notoCjkSrc("NotoSansCJK-Black.ttc", "Noto Sans CJK JP Black")),
    fontFace("Noto Serif CJK", 700, "normal",
      notoCjkSrc("NotoSerifCJK-Bold.ttc", "Noto Serif CJK JP Bold")),
  ].join("\n");
}

/**
 * Return the complete @font-face CSS block for a template.
 * Pass which font families the template uses.
 */
export function buildFontCSS(options: {
  fraunces?: boolean;
  dmMono?: boolean;
  bebasNeue?: boolean;
  outfit?: boolean;
  playfairDisplay?: boolean;
  lato?: boolean;
  cjk?: boolean;
}): string {
  const parts: string[] = [];
  if (options.fraunces)       parts.push(frauncesCSS());
  if (options.dmMono)         parts.push(dmMonoCSS());
  if (options.bebasNeue)      parts.push(bebasNeueCSS());
  if (options.outfit)         parts.push(outfitCSS());
  if (options.playfairDisplay) parts.push(playfairDisplayCSS());
  if (options.lato)           parts.push(latoCSS());
  if (options.cjk)            parts.push(notoCjkCSS());
  return parts.filter(Boolean).join("\n");
}
