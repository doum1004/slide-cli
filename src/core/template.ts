import { z } from "zod";
import { existsSync, readdirSync, readFileSync } from "fs";
import { join } from "path";
import type { Template, TemplateManifest } from "../types.js";
import { resolveTemplateDirs } from "../utils/paths.js";

const SlotSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["text", "image", "color", "number", "url"]),
  label: z.string().min(1),
  required: z.boolean(),
  default: z.union([z.string(), z.number()]).optional(),
  description: z.string().optional(),
});

const ManifestSchema = z.object({
  name: z.string().min(1),
  id: z.string().regex(/^[a-z0-9-]+$/, "id must be kebab-case"),
  version: z.string().regex(/^\d+\.\d+\.\d+$/, "version must be semver"),
  description: z.string().min(1),
  author: z.string().optional(),
  aspectRatio: z.string().default("9:16"),
  width: z.number().int().positive().default(1080),
  height: z.number().int().positive().default(1920),
  slots: z.array(SlotSchema).min(1),
  tags: z.array(z.string()).optional(),
});

export class TemplateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TemplateError";
  }
}

export function validateManifest(raw: unknown): TemplateManifest {
  const result = ManifestSchema.safeParse(raw);
  if (!result.success) {
    const issues = result.error.issues
      .map((i) => `  • ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new TemplateError(`Invalid template manifest:\n${issues}`);
  }
  return result.data as TemplateManifest;
}

export function validateTemplateDir(dir: string): Template {
  if (!existsSync(dir)) {
    throw new TemplateError(`Template directory not found: ${dir}`);
  }

  const manifestPath = join(dir, "template.json");
  const htmlPath = join(dir, "template.html");

  if (!existsSync(manifestPath)) {
    throw new TemplateError(`Missing template.json in: ${dir}`);
  }
  if (!existsSync(htmlPath)) {
    throw new TemplateError(`Missing template.html in: ${dir}`);
  }

  let raw: unknown;
  try {
    raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
  } catch {
    throw new TemplateError(`template.json is not valid JSON in: ${dir}`);
  }

  const manifest = validateManifest(raw);
  const html = readFileSync(htmlPath, "utf-8");

  // Verify all slots referenced in HTML actually exist in manifest
  // Skip block helpers: {{#if}}, {{/if}}, {{else}}, {{#each}}, etc.
  const slotIds = new Set(manifest.slots.map((s) => s.id));
  const BUILTIN = new Set(["title", "slideIndex", "totalSlides", "else", "this"]);
  const referenced = [...html.matchAll(/\{\{([a-zA-Z0-9_.]+)\}\}/g)]
    .map((m) => m[1].split(".")[0])
    .filter((id) => !id.startsWith("#") && !id.startsWith("/") && !BUILTIN.has(id));
  const unknown = referenced.filter((id) => !slotIds.has(id));
  if (unknown.length > 0) {
    throw new TemplateError(
      `template.html references unknown slots: ${[...new Set(unknown)].join(", ")}\nDefined slots: ${[...slotIds].join(", ")}`
    );
  }

  // Load sample.json if present (optional)
  const samplePath = join(dir, "sample.json");
  let sample: Record<string, unknown> | null = null;
  if (existsSync(samplePath)) {
    try {
      sample = JSON.parse(readFileSync(samplePath, "utf-8"));
    } catch {
      // sample.json is optional — ignore parse errors
    }
  }

  return { manifest, html, dir, sample };
}

export function loadTemplate(nameOrId: string): Template {
  const dirs = resolveTemplateDirs();

  for (const baseDir of dirs) {
    if (!existsSync(baseDir)) continue;
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const candidateDir = join(baseDir, entry.name);
      const manifestPath = join(candidateDir, "template.json");
      if (!existsSync(manifestPath)) continue;
      try {
        const raw = JSON.parse(readFileSync(manifestPath, "utf-8"));
        if (raw.id === nameOrId || raw.name === nameOrId || entry.name === nameOrId) {
          return validateTemplateDir(candidateDir);
        }
      } catch {
        // skip invalid
      }
    }
  }

  throw new TemplateError(
    `Template "${nameOrId}" not found. Run \`slide list\` to see available templates.`
  );
}

export function listAllTemplates(): Template[] {
  const dirs = resolveTemplateDirs();
  const templates: Template[] = [];
  const seen = new Set<string>();

  for (const baseDir of dirs) {
    if (!existsSync(baseDir)) continue;
    const entries = readdirSync(baseDir, { withFileTypes: true });
    for (const entry of entries) {
      if (!entry.isDirectory()) continue;
      const dir = join(baseDir, entry.name);
      try {
        const t = validateTemplateDir(dir);
        if (!seen.has(t.manifest.id)) {
          seen.add(t.manifest.id);
          templates.push(t);
        }
      } catch {
        // skip broken templates silently in list
      }
    }
  }

  return templates;
}
