import { readFileSync, existsSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import chalk from "chalk";

// ── Resolve guide path for both Bun (unbundled) and Node (bundled) ─────
// import.meta.dir is Bun-only and undefined in Node.js.
// Bundled:   dist/index.js   → TEMPLATE_GUIDE.md is at dist/TEMPLATE_GUIDE.md
// Unbundled: src/commands/   → TEMPLATE_GUIDE.md is at ../../TEMPLATE_GUIDE.md
function resolveGuidePath(): string {
  // Strategy 1: process.argv[1] — reliable in bundled Node execution
  if (typeof process.argv[1] === "string" && process.argv[1].length > 0) {
    const { resolve } = require("path") as typeof import("path");
    const scriptDir = dirname(resolve(process.argv[1]));
    // Bundled: dist/TEMPLATE_GUIDE.md (build copies it there)
    const bundled = join(scriptDir, "TEMPLATE_GUIDE.md");
    if (existsSync(bundled)) return bundled;
    // Also check project root (one level up from dist/)
    const root = join(scriptDir, "..", "TEMPLATE_GUIDE.md");
    if (existsSync(root)) return root;
  }

  // Strategy 2: import.meta.url — works in unbundled ESM (bun src/index.ts)
  try {
    const metaUrl = import.meta.url;
    if (typeof metaUrl === "string" && metaUrl.startsWith("file:")) {
      const fileDir = dirname(fileURLToPath(metaUrl));
      // src/commands/guide.ts → ../../TEMPLATE_GUIDE.md
      const srcPath = join(fileDir, "..", "..", "TEMPLATE_GUIDE.md");
      if (existsSync(srcPath)) return srcPath;
    }
  } catch {
    // ignore
  }

  // Strategy 3: Bun-specific import.meta.dir (kept as last resort)
  try {
    const dir = (import.meta as any).dir;
    if (typeof dir === "string") {
      const bunPath = join(dir, "..", "..", "TEMPLATE_GUIDE.md");
      if (existsSync(bunPath)) return bunPath;
    }
  } catch {
    // ignore
  }

  return "";
}

const GUIDE_PATH = resolveGuidePath();

export function guideCommand() {
  // Human-readable mode — print the markdown guide
  if (existsSync(GUIDE_PATH)) {
    const md = readFileSync(GUIDE_PATH, "utf-8");
    // Light syntax highlighting for terminals
    const rendered = md
      .replace(/^(#{1,3} .+)$/gm, (_, h) => chalk.bold.cyan(h))
      .replace(/`([^`\n]+)`/g, (_, c) => chalk.yellow(c))
      .replace(/^\| .+/gm, (line) => chalk.dim(line))
      .replace(/^- \[ \]/gm, chalk.dim("  ☐"))
      .replace(/^- \[x\]/gm, chalk.green("  ☑"));
    console.log(rendered);
  } else {
    // Fallback: print JSON guide if markdown is missing
    console.log(chalk.yellow("(TEMPLATE_GUIDE.md not found — showing JSON guide)\n"));
  }

  console.log(
    `\n  ${chalk.dim("For machine-readable output (LLM agents):")}  ${chalk.cyan("slide guide --json")}\n`
  );
}