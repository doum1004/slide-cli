import { describe, it, expect, beforeAll, afterAll } from "bun:test";
import { join } from "path";
import { mkdirSync, rmSync, existsSync, readFileSync } from "fs";
import { tmpdir } from "os";
import Handlebars from "handlebars";
import { validateTemplateDir } from "../src/core/template.js";
import { renderSlides } from "../src/core/renderer.js";

// ─────────────────────────────────────────────────────────────────────────────
// Handlebars helpers (registered by renderer at import time)
// ─────────────────────────────────────────────────────────────────────────────

describe("Handlebars helpers", () => {
  it("upper helper uppercases a string", () => {
    const fn = Handlebars.compile("{{upper val}}");
    expect(fn({ val: "hello world" })).toBe("HELLO WORLD");
  });

  it("lower helper lowercases a string", () => {
    const fn = Handlebars.compile("{{lower val}}");
    expect(fn({ val: "HELLO WORLD" })).toBe("hello world");
  });

  it("default helper returns value when truthy", () => {
    const fn = Handlebars.compile('{{default val "fallback"}}');
    expect(fn({ val: "actual" })).toBe("actual");
  });

  it("default helper returns fallback when value is falsy", () => {
    const fn = Handlebars.compile('{{default val "fallback"}}');
    expect(fn({ val: "" })).toBe("fallback");
    expect(fn({})).toBe("fallback");
  });

  it("add helper adds two numbers", () => {
    const fn = Handlebars.compile("{{add a b}}");
    expect(fn({ a: 3, b: 4 })).toBe("7");
  });

  it("eq helper returns true for equal values", () => {
    const fn = Handlebars.compile('{{#if (eq a b)}}yes{{else}}no{{/if}}');
    expect(fn({ a: "foo", b: "foo" })).toBe("yes");
    expect(fn({ a: "foo", b: "bar" })).toBe("no");
  });

  it("#if renders block when slot is truthy", () => {
    const fn = Handlebars.compile("{{#if title}}<h1>{{title}}</h1>{{/if}}");
    expect(fn({ title: "Hello" })).toBe("<h1>Hello</h1>");
    expect(fn({ title: "" })).toBe("");
    expect(fn({})).toBe("");
  });

  it("#unless renders block when slot is falsy", () => {
    const fn = Handlebars.compile("{{#unless title}}no title{{/unless}}");
    expect(fn({})).toBe("no title");
    expect(fn({ title: "Hi" })).toBe("");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderSlides — HTML output (no screenshots)
// ─────────────────────────────────────────────────────────────────────────────

describe("renderSlides (HTML only, no screenshots)", () => {
  const FIXTURES = join(import.meta.dir, "fixtures");
  let outDir: string;

  beforeAll(() => {
    outDir = join(tmpdir(), `slide-cli-test-${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  });

  it("renders one slide HTML file per slide", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [
      { layout: "test-card", title: "Slide One", bg: "#111" },
      { layout: "test-card", title: "Slide Two", subtitle: "A subtitle", bg: "#222" },
    ];
    const { results, failures } = await renderSlides(
      template, slides, outDir, outDir, "jpg", false
    );
    expect(results).toHaveLength(2);
    expect(failures).toHaveLength(0);
    expect(existsSync(join(outDir, "slide-1.html"))).toBe(true);
    expect(existsSync(join(outDir, "slide-2.html"))).toBe(true);
  });

  it("injects slideIndex and totalSlides correctly", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [
      { title: "A" },
      { title: "B" },
      { title: "C" },
    ];
    await renderSlides(template, slides, outDir, outDir, "jpg", false);
    const html1 = readFileSync(join(outDir, "slide-1.html"), "utf-8");
    const html3 = readFileSync(join(outDir, "slide-3.html"), "utf-8");
    expect(html1).toContain("1 / 3");
    expect(html3).toContain("3 / 3");
  });

  it("renders title slot into the HTML output", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [{ title: "My Unique Title XYZ" }];
    await renderSlides(template, slides, outDir, outDir, "jpg", false);
    const html = readFileSync(join(outDir, "slide-1.html"), "utf-8");
    expect(html).toContain("My Unique Title XYZ");
  });

  it("omits optional subtitle when not provided", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [{ title: "No Subtitle Here" }];
    await renderSlides(template, slides, outDir, outDir, "jpg", false);
    const html = readFileSync(join(outDir, "slide-1.html"), "utf-8");
    // The <p> subtitle block should not appear
    expect(html).not.toMatch(/<p[^>]*>\s*<\/p>/);
  });

  it("renders subtitle when provided", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [{ title: "Title", subtitle: "This Is The Subtitle" }];
    await renderSlides(template, slides, outDir, outDir, "jpg", false);
    const html = readFileSync(join(outDir, "slide-1.html"), "utf-8");
    expect(html).toContain("This Is The Subtitle");
  });

  it("returns a failure (not a throw) for an unresolvable image path", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    // Absolute path guaranteed not to exist (unique per test run)
    const missingImg = join(outDir, `missing-${Date.now()}.jpg`);
    const slides = [{ title: "With Image", image: missingImg }];
    const { failures } = await renderSlides(
      template, slides, outDir, outDir, "jpg", false, false
    );
    expect(failures).toHaveLength(1);
    expect(failures[0]?.slotId).toBe("image");
    expect(failures[0]?.slideIndex).toBe(1);
  });

  it("clears the image slot and renders without it when allowMissingImages=true", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    // Absolute path guaranteed not to exist (unique per test run)
    const missingImg = join(outDir, `missing-${Date.now()}.jpg`);
    const slides = [{ title: "Force Test", image: missingImg }];
    const { results, failures } = await renderSlides(
      template, slides, outDir, outDir, "jpg", false, true
    );
    // Still renders a result
    expect(results).toHaveLength(1);
    // Failure is still recorded so caller can warn
    expect(failures).toHaveLength(1);
    // HTML should not contain a broken img src
    const html = readFileSync(join(outDir, "slide-1.html"), "utf-8");
    expect(html).not.toContain(missingImg);
  });

  it("does not create image files when generateImages=false", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [{ title: "No Screenshots" }];
    await renderSlides(template, slides, outDir, outDir, "jpg", false);
    expect(existsSync(join(outDir, "slide-1.jpg"))).toBe(false);
  });

  it("handles an empty string image slot gracefully", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [{ title: "Empty Image", image: "" }];
    const { failures } = await renderSlides(
      template, slides, outDir, outDir, "jpg", false
    );
    expect(failures).toHaveLength(0);
  });

  it("handles already-base64 data URI image slots without re-fetching", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const dataUri = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==";
    const slides = [{ title: "Data URI", image: dataUri }];
    const { failures } = await renderSlides(
      template, slides, outDir, outDir, "jpg", false
    );
    expect(failures).toHaveLength(0);
    const html = readFileSync(join(outDir, "slide-1.html"), "utf-8");
    expect(html).toContain("data:image/png;base64,");
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// renderSlides — result shape
// ─────────────────────────────────────────────────────────────────────────────

describe("renderSlides result shape", () => {
  const FIXTURES = join(import.meta.dir, "fixtures");
  let outDir: string;

  beforeAll(() => {
    outDir = join(tmpdir(), `slide-cli-test-shape-${Date.now()}`);
    mkdirSync(outDir, { recursive: true });
  });

  afterAll(() => {
    if (existsSync(outDir)) rmSync(outDir, { recursive: true, force: true });
  });

  it("result slideIndex is 1-based", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const slides = [{ title: "A" }, { title: "B" }];
    const { results } = await renderSlides(template, slides, outDir, outDir, "jpg", false);
    expect(results[0]?.slideIndex).toBe(1);
    expect(results[1]?.slideIndex).toBe(2);
  });

  it("result htmlPath points to a real file", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const { results } = await renderSlides(
      template, [{ title: "X" }], outDir, outDir, "jpg", false
    );
    expect(existsSync(results[0]!.htmlPath)).toBe(true);
  });

  it("result imagePath uses the requested format extension", async () => {
    const template = validateTemplateDir(join(FIXTURES, "valid-template"));
    const { results: jpg } = await renderSlides(
      template, [{ title: "X" }], outDir, outDir, "jpg", false
    );
    const { results: png } = await renderSlides(
      template, [{ title: "X" }], outDir, outDir, "png", false
    );
    expect(jpg[0]?.imagePath).toEndWith(".jpg");
    expect(png[0]?.imagePath).toEndWith(".png");
  });
});