#!/usr/bin/env bun
import { Command } from "commander";
import chalk from "chalk";
import { createCommand } from "./commands/create.js";
import { listCommand } from "./commands/list.js";
import { addTemplateCommand } from "./commands/add-template.js";
import { guideCommand } from "./commands/guide.js";
import { ensureConfigDir } from "./utils/paths.js";

ensureConfigDir();

const program = new Command();

program
  .name("slide")
  .description(
    chalk.bold("slide-cli") + chalk.dim(" — create beautiful slide cards (9:16, 16:9, 1:1) from JSON data")
  )
  .version("1.0.0");

// ── create ─────────────────────────────────────────────────────────────
program
  .command("create")
  .description("Create slides from a data JSON file and a template")
  .requiredOption("-d, --data <file>", "Path to data JSON file")
  .requiredOption("-t, --template <id>", "Template id or name to use")
  .option("-o, --out <dir>", "Output directory (default: output/<date>_<time>-<title>)")
  .option("-f, --format <png|jpg>", "Image format for screenshots", "jpg")
  .option("--no-images", "Skip Puppeteer screenshot step (HTML only)")
  .option("--force", "Skip unresolvable image slots and render without them", false)
  .action(async (opts) => {
    await createCommand({
      data: opts.data,
      template: opts.template,
      out: opts.out,
      format: opts.format as "png" | "jpg",
      noImages: !opts.images,
      force: opts.force,
    });
  });

// ── list ────────────────────────────────────────────────────────────────
program
  .command("list")
  .description("List all available templates")
  .option("-v, --verbose", "Show full slot schema and sample guide for each template", false)
  .option("-s, --sample <id>", "Print the ready-to-use sample JSON for a template (great for agents)")
  .action((opts) => {
    listCommand({ verbose: opts.verbose, sample: opts.sample ?? null });
  });

// ── add-template ────────────────────────────────────────────────────────
program
  .command("add-template <path>")
  .description("Add a new template (validates before installing)")
  .option("-g, --global", "Install to ~/.slide-cli/templates (default)", true)
  .option("--force", "Overwrite if template id already exists", false)
  .action(async (templatePath, opts) => {
    await addTemplateCommand(templatePath, { global: opts.global, force: opts.force });
  });

// ── guide ────────────────────────────────────────────────────────────────
program
  .command("guide")
  .description("Show the full template authoring guide (--json for LLM-agent-friendly output)")
  .option("-j, --json", "Output structured JSON instead of markdown (ideal for LLM agents)", false)
  .action((opts) => {
    guideCommand({ json: opts.json });
  });

program.parse(process.argv);