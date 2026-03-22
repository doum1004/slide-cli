import { join } from "path";
import { homedir } from "os";
import { mkdirSync, existsSync } from "fs";

export const CONFIG_DIR = join(homedir(), ".slide-cli");
export const USER_TEMPLATES_DIR = join(CONFIG_DIR, "templates");

// Built-in templates ship alongside the CLI source
export const BUILTIN_TEMPLATES_DIR = join(
  import.meta.dir,
  "..",
  "..",
  "templates"
);

export function ensureConfigDir() {
  if (!existsSync(CONFIG_DIR)) mkdirSync(CONFIG_DIR, { recursive: true });
  if (!existsSync(USER_TEMPLATES_DIR))
    mkdirSync(USER_TEMPLATES_DIR, { recursive: true });
}

export function resolveTemplateDirs(): string[] {
  return [USER_TEMPLATES_DIR, BUILTIN_TEMPLATES_DIR].filter(existsSync);
}
