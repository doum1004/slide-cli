import chalk from "chalk";
import { listAllTemplates } from "../core/template.js";
import { USER_TEMPLATES_DIR, BUILTIN_TEMPLATES_DIR } from "../utils/paths.js";

export function listCommand(opts: { verbose: boolean; sample: string | null }) {
  const templates = listAllTemplates();

  if (templates.length === 0) {
    console.log(chalk.yellow("\n  No templates found.\n"));
    console.log(`  Add one with: ${chalk.cyan("slide add-template <path-to-template-dir>")}\n`);
    return;
  }

  // ── --sample <id>: print just that template's sample JSON ──────────
  if (opts.sample) {
    const target = templates.find(
      (t) => t.manifest.id === opts.sample || t.manifest.name === opts.sample
    );
    if (!target) {
      console.error(chalk.red(`\n  Template "${opts.sample}" not found. Run \`slide list\` to see available templates.\n`));
      process.exit(1);
    }
    if (!target.sample) {
      console.error(chalk.yellow(`\n  Template "${target.manifest.id}" has no sample.json.\n`));
      process.exit(1);
    }
    const clean = stripMeta(target.sample);
    console.log();
    console.log(chalk.dim(`  # sample data for template: `) + chalk.cyan(target.manifest.id));
    console.log(chalk.dim(`  # ${target.manifest.description}`));
    console.log();
    console.log(JSON.stringify(clean, null, 2));
    console.log();
    return;
  }

  // ── Normal list ────────────────────────────────────────────────────
  console.log(`\n  ${chalk.bold("Available templates")}  ${chalk.dim(`(${templates.length} total)`)}\n`);

  for (const t of templates) {
    const m = t.manifest;
    const isBuiltin = t.dir.startsWith(BUILTIN_TEMPLATES_DIR);
    const source = isBuiltin ? chalk.dim("[built-in]") : chalk.dim("[user]    ");
    const hasSample = t.sample ? chalk.green("✔ sample.json") : chalk.dim("  no sample.json");

    console.log(`  ${source} ${chalk.cyan(m.id.padEnd(22))} ${chalk.white(m.name)}  ${hasSample}`);
    console.log(`           ${" ".padEnd(22)} ${chalk.dim(m.description)}`);

    if (opts.verbose) {
      console.log(`           ${" ".padEnd(22)} ${chalk.dim(`${m.aspectRatio}  ${m.width}×${m.height}px  v${m.version}`)}`);
      console.log(`\n           ${" ".padEnd(22)} ${chalk.bold("Slots:")}`);
      for (const slot of m.slots) {
        const req = slot.required ? chalk.red("* required") : chalk.dim("  optional");
        console.log(`           ${" ".padEnd(22)}   ${req}  ${chalk.yellow(slot.id.padEnd(18))} ${chalk.dim(slot.type.padEnd(8))} ${slot.label}`);
        if (slot.description) {
          console.log(`           ${" ".padEnd(22)}     ${" ".padEnd(28)} ${chalk.dim(slot.description)}`);
        }
        if (slot.default !== undefined) {
          console.log(`           ${" ".padEnd(22)}     ${" ".padEnd(28)} ${chalk.dim(`default: ${JSON.stringify(slot.default)}`)}`);
        }
      }

      if (t.sample) {
        const meta = t.sample as Record<string, unknown>;
        const slotGuide = meta["_slots"] as Record<string, string> | undefined;
        if (slotGuide) {
          console.log();
          console.log(`           ${" ".padEnd(22)} ${chalk.bold("Slot guide (from sample.json):")}`);
          for (const [key, desc] of Object.entries(slotGuide)) {
            const isReq = String(desc).startsWith("REQUIRED");
            const tag = isReq ? chalk.red("*") : chalk.dim("?");
            console.log(`           ${" ".padEnd(22)}   ${tag} ${chalk.yellow(key.padEnd(12))} ${chalk.dim(desc)}`);
          }
        }
        console.log();
        console.log(`           ${" ".padEnd(22)} ${chalk.dim("Get full sample JSON:")}  ${chalk.cyan(`slide list --sample ${m.id}`)}`);
      }
      console.log();
    } else {
      const slotNames = m.slots.map((s) => s.required ? chalk.yellow(s.id) : chalk.dim(s.id));
      console.log(`           ${" ".padEnd(22)} ${chalk.dim("slots: ")}${slotNames.join(chalk.dim(", "))}`);
      if (t.sample) {
        console.log(`           ${" ".padEnd(22)} ${chalk.dim("sample:")}  ${chalk.cyan(`slide list --sample ${m.id}`)}`);
      }
      console.log();
    }
  }

  console.log(
    `  ${chalk.dim("Tips:")}\n` +
    `    ${chalk.cyan("slide list --verbose")}            ${chalk.dim("full slot schema + sample guide")}\n` +
    `    ${chalk.cyan("slide list --sample <id>")}        ${chalk.dim("print ready-to-use sample JSON for agents/users")}\n`
  );
  console.log(`  ${chalk.dim("User template dir:")} ${USER_TEMPLATES_DIR}`);
  console.log(`  ${chalk.dim("Built-in dir:     ")} ${BUILTIN_TEMPLATES_DIR}\n`);
}

function stripMeta(sample: Record<string, unknown>): Record<string, unknown> {
  return Object.fromEntries(Object.entries(sample).filter(([k]) => !k.startsWith("_")));
}
