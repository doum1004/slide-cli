import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

// Resolve the package root relative to THIS file at runtime.
// import.meta.url always points to the actual file on disk — whether running
// via `bun src/index.ts`, `bun link`, or a global bun/npm install.
//
// Source layout:  <root>/src/utils/paths.ts  → dirname = src/utils/ → up 2 = root
// Built layout:   <root>/dist/index.js       → dirname = dist/       → up 1 = root
//   (bun build bundles everything into a single dist/index.js)
const __fileDir = dirname(fileURLToPath(import.meta.url));
const isBundled = __fileDir.endsWith("dist") || __fileDir.endsWith("dist/");
export const PKG_ROOT = isBundled
  ? join(__fileDir, "..")         // dist/ → project root
  : join(__fileDir, "..", "..");  // src/utils/ → project root

// ── User config dir (global user-installed templates) ──────────────────────
export const CONFIG_DIR = join(homedir(), ".slide-cli");
export const USER_TEMPLATES_DIR = join(CONFIG_DIR, "templates");

// ── Built-in templates shipped with the package ────────────────────────────
// build.js copies templates/ into dist/templates/, and dist/ is the only
// directory published to npm. When running from source (unbundled), fall back
// to the repo-level templates/ directory.
export const BUILTIN_TEMPLATES_DIR = isBundled
  ? join(__fileDir, "templates")   // dist/templates/
  : join(PKG_ROOT, "templates");   // <root>/templates/

// ── Node modules & fonts (used by fonts.ts) ────────────────────────────────
export const NODE_MODULES_DIR = join(PKG_ROOT, "node_modules");
export const FONTS_DIR = join(PKG_ROOT, "fonts");

export function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(USER_TEMPLATES_DIR))
    mkdirSync(USER_TEMPLATES_DIR, { recursive: true });
}

export function resolveTemplateDirs(): string[] {
  return [USER_TEMPLATES_DIR, BUILTIN_TEMPLATES_DIR].filter(existsSync);
}