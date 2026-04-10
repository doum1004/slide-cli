import { existsSync, mkdirSync, rmSync, writeFileSync } from "fs";
import { join, basename } from "path";
import chalk from "chalk";
import ora from "ora";
import { loadTemplate, listAllTemplates } from "../core/template.js";
import { renderSlides } from "../core/renderer.js";
import { generatePresenter } from "../core/presenter.js";
import type { Template, PresentationData } from "../types.js";

export interface PreviewOptions {
  templateId?: string;
  all: boolean;
  format: "png" | "jpg";
  noImages: boolean;
}

async function generatePreviewForTemplate(
  template: Template,
  format: "png" | "jpg",
  noImages: boolean,
): Promise<boolean> {
  const spinner = ora({ color: "yellow" });
  const { manifest, sample, dir } = template;

  if (!sample || !Array.isArray((sample as PresentationData).slides)) {
    console.log(chalk.dim(`  ⏭  ${manifest.id} — no sample.json with slides, skipping`));
    return false;
  }

  const data = sample as PresentationData;
  const previewDir = join(dir, "preview");

  // Clean existing preview
  if (existsSync(previewDir)) {
    rmSync(previewDir, { recursive: true, force: true });
  }
  mkdirSync(previewDir, { recursive: true });

  // Render slides
  spinner.start(`Rendering ${manifest.id}…`);
  let results;
  try {
    const render = await renderSlides(
      template, data.slides, previewDir, dir,
      format, !noImages, true, // allowMissingImages
    );
    results = render.results;
  } catch (err: any) {
    spinner.fail(`${manifest.id}: ${err.message}`);
    return false;
  }

  // Generate presenter viewer
  generatePresenter(
    results, previewDir, data.title ?? manifest.name,
    format, !noImages,
    manifest.width, manifest.height,
  );

  // Write data.json + manifest.json
  writeFileSync(join(previewDir, "data.json"), JSON.stringify(data, null, 2));
  writeFileSync(
    join(previewDir, "manifest.json"),
    JSON.stringify({
      title:       data.title ?? manifest.name,
      template:    manifest.id,
      format,
      totalSlides: results.length,
      skipped:     0,
      slides:      results.map((r) => ({
        slideIndex: r.slideIndex,
        htmlPath:   basename(r.htmlPath),
        imagePath:  noImages ? null : basename(r.imagePath),
      })),
    }, null, 2),
  );

  spinner.succeed(`${manifest.id} → ${previewDir}`);
  return true;
}

export async function previewCommand(opts: PreviewOptions) {
  if (!opts.all && !opts.templateId) {
    console.error(chalk.red("✖ Provide a template id, or use --all to regenerate all previews."));
    process.exit(1);
  }

  if (opts.templateId && !opts.all) {
    // Single template
    let template: Template;
    try {
      template = loadTemplate(opts.templateId);
    } catch (err: any) {
      console.error(chalk.red(`✖ ${err.message}`));
      process.exit(1);
    }
    const ok = await generatePreviewForTemplate(template, opts.format, opts.noImages);
    if (!ok) process.exit(1);
    return;
  }

  // All templates
  const templates = listAllTemplates();
  console.log(chalk.bold(`\nGenerating previews for ${templates.length} templates…\n`));

  let succeeded = 0;
  let skipped = 0;
  for (const t of templates) {
    const ok = await generatePreviewForTemplate(t, opts.format, opts.noImages);
    if (ok) succeeded++;
    else skipped++;
  }

  console.log(`\n${chalk.green("✔")} ${succeeded} preview${succeeded !== 1 ? "s" : ""} generated` +
    (skipped > 0 ? chalk.dim(`, ${skipped} skipped`) : ""));
}
