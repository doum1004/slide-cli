import { readFileSync, existsSync, mkdirSync } from "fs";
import { join, resolve, dirname } from "path";
import chalk from "chalk";
import ora from "ora";
import { loadTemplate } from "../core/template.js";
import { renderSlides, type ImageFailure } from "../core/renderer.js";
import { generatePresenter } from "../core/presenter.js";
import type { PresentationData, CreateOptions } from "../types.js";

/**
 * Derive a safe directory name from a presentation title.
 * Lowercases, replaces spaces/special chars with hyphens, collapses runs, strips leading/trailing hyphens.
 * e.g. "My Great Deck!" > "my-great-deck"
 */
function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "presentation";
}

/**
 * Build an auto output path: output/<YYYY-MM-DD_HH-MM>-<slug>
 * e.g. output/2025-06-03_14-22-my-great-deck
 */
function buildAutoOutDir(title: string): string {
  const now = new Date();
  const date = now.toISOString().slice(0, 10);                          // 2025-06-03
  const time = now.toTimeString().slice(0, 5).replace(":", "-");        // 14-22
  return join("output", `${date}_${time}-${slugify(title)}`);
}

export async function createCommand(opts: CreateOptions) {
  const spinner = ora({ color: "yellow" });

  // ── 1. Load & validate data JSON ──────────────────────────────────
  const dataPath = resolve(opts.data);
  if (!existsSync(dataPath)) {
    console.error(chalk.red(`✖ Data file not found: ${dataPath}`));
    process.exit(1);
  }

  let data: PresentationData;
  try {
    data = JSON.parse(readFileSync(dataPath, "utf-8"));
  } catch {
    console.error(chalk.red("✖ Could not parse data JSON — check your file for syntax errors."));
    process.exit(1);
  }

  if (!Array.isArray(data.slides) || data.slides.length === 0) {
    console.error(chalk.red('✖ data JSON must have a "slides" array with at least one item.'));
    process.exit(1);
  }

  // ── 2. Load template ───────────────────────────────────────────────
  spinner.start(`Loading template ${chalk.cyan(opts.template)}…`);
  let template;
  try {
    template = loadTemplate(opts.template);
    spinner.succeed(`Template ${chalk.cyan(template.manifest.name)} loaded`);
  } catch (err: any) {
    spinner.fail(err.message);
    process.exit(1);
  }

  // ── 3. Validate required slots ─────────────────────────────────────
  const requiredSlots = template.manifest.slots.filter((s) => s.required);
  const errors: string[] = [];
  for (let i = 0; i < data.slides.length; i++) {
    const slide = data.slides[i];
    if (!slide) continue;
    for (const slot of requiredSlots) {
      if (slide[slot.id] === undefined || slide[slot.id] === null || slide[slot.id] === "") {
        errors.push(`Slide ${i + 1}: missing required slot "${slot.id}" (${slot.label})`);
      }
    }
  }
  
  if (errors.length > 0) {
    console.error(chalk.red("\n✖ Validation errors:"));
    errors.forEach((e) => console.error(chalk.red(`  • ${e}`)));
    process.exit(1);
  }

  // ── 4. Prepare output directory ────────────────────────────────────
  // --out is optional. When omitted, auto-generate: output/<date>_<time>-<title-slug>
  const rawOut = opts.out?.trim();
  const outDir = resolve(rawOut ? rawOut : buildAutoOutDir(data.title ?? "presentation"));

  if (!rawOut) {
    console.log(chalk.dim(`  No --out specified. Writing to auto-generated directory:`));
    console.log(`  ${chalk.cyan(outDir)}\n`);
  }

  mkdirSync(outDir, { recursive: true });

  const totalSlides = data.slides.length;
  console.log(chalk.dim(`  ${totalSlides} slide${totalSlides !== 1 ? "s" : ""} > ${outDir}\n`));

  // ── 5. Pre-flight image check (dry run — no screenshots yet) ───────
  // Run the render once without screenshots to surface image failures early.
  spinner.start("Checking image slots…");
  let precheck;
  try {
    precheck = await renderSlides(
      template, data.slides, outDir, dirname(dataPath),
      opts.format, false,   // generateImages = false
      opts.force
    );
  } catch (err: any) {
    spinner.fail(`Pre-flight failed: ${err.message}`);
    process.exit(1);
  }

  const { failures } = precheck;

  if (failures.length > 0 && !opts.force) {
    // ── Abort + show clear error report + prompt ───────────────────
    spinner.fail(`Found ${failures.length} image slot${failures.length !== 1 ? "s" : ""} that could not be resolved:\n`);

    for (const f of failures) {
      console.error(
        chalk.red(`  ✖ Slide ${f.slideIndex}`) +
        chalk.dim(` › slot "${f.slotId}"`)
      );
      console.error(chalk.dim(`    value:  `) + chalk.yellow(f.value));
      console.error(chalk.dim(`    reason: `) + chalk.red(f.reason));
      console.error();
    }

    console.error(chalk.bold("  What would you like to do?\n"));
    console.error(
      `  ${chalk.cyan("A)")} Fix the image paths/URLs in your data JSON and re-run.\n`
    );
    // Use the explicit --out the user provided (or omit the flag to auto-generate again)
    const outFlag = rawOut ? ` --out ${opts.out}` : "";
    console.error(
      `  ${chalk.cyan("B)")} Re-run with ${chalk.bold("--force")} to skip invalid images.\n` +
      chalk.dim(`     Affected slides will render without those images, using the\n`) +
      chalk.dim(`     template's text-only layout — which often looks cleaner anyway.\n`)
    );
    console.error(
      `  ${chalk.dim("Example:")}  ${chalk.cyan(`slide create --data ${opts.data} --template ${opts.template}${outFlag} --force`)}\n`
    );
    process.exit(1);
  }

  if (failures.length > 0 && opts.force) {
    // ── Continue with warning banner ───────────────────────────────
    spinner.warn(
      chalk.yellow(`${failures.length} image slot${failures.length !== 1 ? "s" : ""} skipped (--force):`)
    );
    for (const f of failures) {
      console.log(
        chalk.dim(`  slide ${f.slideIndex} › "${f.slotId}" — `) +
        chalk.yellow(f.reason) +
        chalk.dim(` (slot cleared, text-only layout used)`)
      );
    }
    console.log();
  } else {
    spinner.succeed("Image slots verified");
  }

  // ── 6. Render HTML + screenshots ──────────────────────────────────
  spinner.start(`Rendering ${totalSlides} slides…`);
  let results;
  try {
    const render = await renderSlides(
      template, data.slides, outDir, dirname(dataPath),
      opts.format, !opts.noImages,
      opts.force
    );
    results = render.results;
    if (!opts.noImages) {
      spinner.succeed(`Rendered ${totalSlides} slides + screenshots`);
    } else {
      spinner.succeed(`Rendered ${totalSlides} slide HTML files`);
    }
  } catch (err: any) {
    spinner.fail(`Render failed: ${err.message}`);
    process.exit(1);
  }

  // ── 7. Generate presentation viewer ───────────────────────────────
  spinner.start("Generating presentation viewer…");
  const presenterPath = generatePresenter(
    results, outDir, data.title ?? "Slide Presentation",
    opts.format, !opts.noImages,
    template.manifest.width, template.manifest.height
  );
  spinner.succeed("Presentation viewer ready");

  // ── 8. Write copy of source data ──────────────────────────────────
  const { writeFileSync } = await import("fs");
  writeFileSync(join(outDir, "data.json"), JSON.stringify(data, null, 2));

  // ── 9. Summary ────────────────────────────────────────────────────
  const skippedNote = failures.length > 0
    ? chalk.yellow(`\n  ${chalk.bold("⚠")}  ${failures.length} image slot${failures.length !== 1 ? "s" : ""} were skipped — those slides use text-only layout.\n`)
    : "";

  console.log(`
${chalk.green("✔")} Done! Output in ${chalk.cyan(outDir)}
${skippedNote}
  ${chalk.dim("Slides")}       ${results.map((r) => `slide-${r.slideIndex}.html`).join("  ")}
  ${opts.noImages ? "" : chalk.dim("Images") + "       " + results.map((r) => `slide-${r.slideIndex}.${opts.format}`).join("  ") + "\n  "}${chalk.dim("Viewer")}       ${chalk.underline("index.html")}
  ${chalk.dim("Data")}         data.json

  Open the viewer:  ${chalk.cyan(`open ${join(outDir, "index.html")}`)}
`);
}