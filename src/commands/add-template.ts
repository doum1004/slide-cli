import { existsSync, mkdirSync, cpSync, readdirSync } from "fs";
import { resolve, join, basename } from "path";
import chalk from "chalk";
import ora from "ora";
import { validateTemplateDir } from "../core/template.js";
import { ensureConfigDir, USER_TEMPLATES_DIR, BUILTIN_TEMPLATES_DIR } from "../utils/paths.js";

export async function addTemplateCommand(
  templatePath: string,
  opts: { global: boolean; force: boolean }
) {
  const spinner = ora({ color: "cyan" });
  const src = resolve(templatePath);

  // ── 1. Check source exists ─────────────────────────────────────────
  if (!existsSync(src)) {
    console.error(chalk.red(`✖ Path not found: ${src}`));
    process.exit(1);
  }

  // ── 2. Validate the template ───────────────────────────────────────
  spinner.start("Validating template…");
  let template;
  try {
    template = validateTemplateDir(src);
    const sampleNote = template.sample ? " + sample.json" : " (no sample.json)";
    spinner.succeed(
      `Template ${chalk.cyan(template.manifest.name)} validated (${template.manifest.slots.length} slots${sampleNote})`
    );
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }

  // ── 3. Decide destination ──────────────────────────────────────────
  ensureConfigDir();
  const destBase = opts.global ? USER_TEMPLATES_DIR : BUILTIN_TEMPLATES_DIR;
  const destDir = join(destBase, template.manifest.id);

  if (existsSync(destDir) && !opts.force) {
    console.error(
      chalk.yellow(
        `✖ Template "${template.manifest.id}" already exists at:\n  ${destDir}\n\nUse --force to overwrite.`
      )
    );
    process.exit(1);
  }

  // ── 4. Copy ────────────────────────────────────────────────────────
  spinner.start(`Installing to ${chalk.dim(destDir)}…`);
  try {
    mkdirSync(destDir, { recursive: true });
    cpSync(src, destDir, { recursive: true });
    spinner.succeed(`Template installed → ${chalk.cyan(destDir)}`);
  } catch (err: any) {
    spinner.fail(`Copy failed: ${err.message}`);
    process.exit(1);
  }

  // ── 5. Summary ─────────────────────────────────────────────────────
  const m = template.manifest;
  console.log(`
  ${chalk.bold("Template added")}

  ${chalk.dim("id")}          ${chalk.cyan(m.id)}
  ${chalk.dim("name")}        ${m.name}
  ${chalk.dim("version")}     ${m.version}
  ${chalk.dim("aspect")}      ${m.aspectRatio}  (${m.width}×${m.height}px)
  ${chalk.dim("slots")}       ${m.slots.map((s) => (s.required ? chalk.yellow(s.id) : chalk.dim(s.id))).join(", ")}

  Use it with:  ${chalk.cyan(`slide create --template ${m.id} --data data.json`)}
`);
}
