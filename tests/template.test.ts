import { describe, it, expect } from "bun:test";
import { join } from "path";
import { validateManifest, validateTemplateDir, TemplateError } from "../src/core/template.js";

const FIXTURES = join(import.meta.dir, "fixtures");

// ─────────────────────────────────────────────────────────────────────────────
// validateManifest
// ─────────────────────────────────────────────────────────────────────────────

describe("validateManifest", () => {
  const base = {
    name: "My Template",
    id: "my-template",
    version: "1.0.0",
    description: "A test template.",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    slots: [
      { id: "title", type: "text", label: "Title", required: true },
    ],
  };

  it("accepts a valid 9:16 manifest", () => {
    const m = validateManifest(base);
    expect(m.id).toBe("my-template");
    expect(m.aspectRatio).toBe("9:16");
    expect(m.width).toBe(1080);
    expect(m.height).toBe(1920);
  });

  it("accepts a valid 16:9 manifest", () => {
    const m = validateManifest({ ...base, id: "wide", aspectRatio: "16:9", width: 1920, height: 1080 });
    expect(m.aspectRatio).toBe("16:9");
    expect(m.width).toBe(1920);
    expect(m.height).toBe(1080);
  });

  it("accepts a valid 1:1 manifest", () => {
    const m = validateManifest({ ...base, id: "square", aspectRatio: "1:1", width: 1080, height: 1080 });
    expect(m.aspectRatio).toBe("1:1");
  });

  it("defaults aspectRatio to 9:16 when omitted", () => {
    const { aspectRatio, ...without } = base;
    const m = validateManifest(without);
    expect(m.aspectRatio).toBe("9:16");
  });

  it("throws TemplateError when id is not kebab-case", () => {
    expect(() => validateManifest({ ...base, id: "MyTemplate" }))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when id contains underscores", () => {
    expect(() => validateManifest({ ...base, id: "my_template" }))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when version is not semver", () => {
    expect(() => validateManifest({ ...base, version: "v1.0" }))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when name is empty", () => {
    expect(() => validateManifest({ ...base, name: "" }))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when description is empty", () => {
    expect(() => validateManifest({ ...base, description: "" }))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when slots array is empty", () => {
    expect(() => validateManifest({ ...base, slots: [] }))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when a slot type is invalid", () => {
    expect(() =>
      validateManifest({
        ...base,
        slots: [{ id: "x", type: "video", label: "X", required: false }],
      })
    ).toThrow(TemplateError);
  });

  it("throws TemplateError when a slot id is missing", () => {
    expect(() =>
      validateManifest({
        ...base,
        slots: [{ id: "", type: "text", label: "X", required: true }],
      })
    ).toThrow(TemplateError);
  });

  it("preserves optional slot fields (default, description)", () => {
    const m = validateManifest({
      ...base,
      slots: [
        { id: "bg", type: "color", label: "Background", required: false, default: "#000", description: "Slide background." },
      ],
    });
    expect(m.slots[0]?.default).toBe("#000");
    expect(m.slots[0]?.description).toBe("Slide background.");
  });

  it("accepts optional author and tags fields", () => {
    const m = validateManifest({ ...base, author: "Alice", tags: ["bold", "dark"] });
    expect(m.author).toBe("Alice");
    expect(m.tags).toEqual(["bold", "dark"]);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// validateTemplateDir
// ─────────────────────────────────────────────────────────────────────────────

describe("validateTemplateDir", () => {
  it("loads a valid template directory", () => {
    const t = validateTemplateDir(join(FIXTURES, "valid-template"));
    expect(t.manifest.id).toBe("test-card");
    expect(t.manifest.name).toBe("Test Card");
    expect(t.manifest.slots).toHaveLength(4);
    expect(t.html).toContain("{{title}}");
  });

  it("returns the dir on the loaded template", () => {
    const t = validateTemplateDir(join(FIXTURES, "valid-template"));
    expect(t.dir).toBe(join(FIXTURES, "valid-template"));
  });

  it("throws TemplateError when directory does not exist", () => {
    expect(() => validateTemplateDir(join(FIXTURES, "nonexistent")))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when template.html is missing", () => {
    expect(() => validateTemplateDir(join(FIXTURES, "missing-html")))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when template.json is invalid JSON", () => {
    expect(() => validateTemplateDir(join(FIXTURES, "bad-json")))
      .toThrow(TemplateError);
  });

  it("throws TemplateError when template.html references undeclared slots", () => {
    expect(() => validateTemplateDir(join(FIXTURES, "unknown-slots")))
      .toThrow(TemplateError);
    try {
      validateTemplateDir(join(FIXTURES, "unknown-slots"));
    } catch (err) {
      expect((err as Error).message).toContain("ghost_slot");
    }
  });

  it("does not throw for built-in variables (slideIndex, totalSlides, title)", () => {
    // The valid-template uses {{slideIndex}} and {{totalSlides}} — these are
    // always-available and must NOT be treated as unknown slots.
    expect(() => validateTemplateDir(join(FIXTURES, "valid-template")))
      .not.toThrow();
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Built-in templates
// ─────────────────────────────────────────────────────────────────────────────

describe("built-in templates", () => {
  const BUILTIN = join(import.meta.dir, "..", "templates");

  for (const id of ["minimal", "bold-title", "quote-card", "minimal-wide", "bold-title-wide", "quote-card-wide"]) {
    it(`validates built-in template: ${id}`, () => {
      const t = validateTemplateDir(join(BUILTIN, id));
      expect(t.manifest.id).toBe(id);
      expect(t.manifest.slots.length).toBeGreaterThan(0);
      expect(t.html.length).toBeGreaterThan(0);
    });
  }

  it("minimal is 9:16", () => {
    const t = validateTemplateDir(join(BUILTIN, "minimal"));
    expect(t.manifest.aspectRatio).toBe("9:16");
    expect(t.manifest.width).toBe(1080);
    expect(t.manifest.height).toBe(1920);
  });

  it("minimal-wide is 16:9", () => {
    const t = validateTemplateDir(join(BUILTIN, "minimal-wide"));
    expect(t.manifest.aspectRatio).toBe("16:9");
    expect(t.manifest.width).toBe(1920);
    expect(t.manifest.height).toBe(1080);
  });

  it("bold-title-wide is 16:9", () => {
    const t = validateTemplateDir(join(BUILTIN, "bold-title-wide"));
    expect(t.manifest.aspectRatio).toBe("16:9");
    expect(t.manifest.width).toBe(1920);
    expect(t.manifest.height).toBe(1080);
  });

  it("quote-card-wide is 16:9", () => {
    const t = validateTemplateDir(join(BUILTIN, "quote-card-wide"));
    expect(t.manifest.aspectRatio).toBe("16:9");
    expect(t.manifest.width).toBe(1920);
    expect(t.manifest.height).toBe(1080);
  });

  it("each built-in template has a sample.json with a slides array", () => {
    for (const id of ["minimal", "bold-title", "quote-card", "minimal-wide", "bold-title-wide", "quote-card-wide"]) {
      const t = validateTemplateDir(join(BUILTIN, id));
      expect(t.sample).not.toBeNull();
      expect(Array.isArray((t.sample as any).slides)).toBe(true);
      expect((t.sample as any).slides.length).toBeGreaterThan(0);
    }
  });

  it("each built-in template has at least one required slot", () => {
    for (const id of ["minimal", "bold-title", "quote-card", "minimal-wide", "bold-title-wide", "quote-card-wide"]) {
      const t = validateTemplateDir(join(BUILTIN, id));
      const required = t.manifest.slots.filter(s => s.required);
      expect(required.length).toBeGreaterThan(0);
    }
  });
});
