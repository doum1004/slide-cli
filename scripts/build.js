#!/usr/bin/env node
// Cross-platform build script (works on Windows, macOS, Linux)
// Run with: bun scripts/build.js   OR   node scripts/build.js

import { cpSync, mkdirSync, copyFileSync, rmSync, existsSync, readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dist = join(root, "dist");

// Clean dist
if (existsSync(dist)) {
  rmSync(dist, { recursive: true, force: true });
  console.log("🗑  Cleaned dist/");
}
mkdirSync(dist, { recursive: true });

// Bundle TypeScript entry point
console.log("⚙️  Bundling src/index.ts …");
execSync(
  "bun build ./src/index.ts --outdir ./dist --target node --format esm",
  { cwd: root, stdio: "inherit" }
);

const outFile = join(dist, "index.js");
const content = readFileSync(outFile, "utf-8");

// Strip any shebang bun may have written, inject the correct one
const stripped = content.replace(/^#!.*\n/, "");
writeFileSync(outFile, "#!/usr/bin/env node\n" + stripped);
console.log("🔧  Shebang set → #!/usr/bin/env node");

// Copy static assets
const copies = [
  ["templates", "dist/templates"],
  ["scripts",   "dist/scripts"],
];
for (const [src, dest] of copies) {
  cpSync(join(root, src), join(root, dest), { recursive: true });
  console.log(`📁  Copied ${src}/ → ${dest}/`);
}

// Strip preview/ folders from dist/templates — they're for the repo only, not the npm package
const distTemplates = join(dist, "templates");
for (const name of readdirSync(distTemplates)) {
  const previewDir = join(distTemplates, name, "preview");
  if (existsSync(previewDir)) {
    rmSync(previewDir, { recursive: true, force: true });
    console.log(`🗑  Stripped ${name}/preview/ from dist`);
  }
}

copyFileSync(join(root, "TEMPLATE_GUIDE.md"), join(root, "dist", "TEMPLATE_GUIDE.md"));
console.log("📄  Copied TEMPLATE_GUIDE.md → dist/");

console.log("\n✅  Build complete → dist/");
