import { describe, it, expect } from "bun:test";

// ─────────────────────────────────────────────────────────────────────────────
// slugify — extracted for unit testing
// These tests mirror the function in src/commands/create.ts.
// If you refactor slugify into a utility module, import it directly instead.
// ─────────────────────────────────────────────────────────────────────────────

function slugify(title: string): string {
  return title
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60) || "presentation";
}

describe("slugify", () => {
  it("lowercases and hyphenates spaces", () => {
    expect(slugify("My Great Deck")).toBe("my-great-deck");
  });

  it("strips leading and trailing hyphens", () => {
    expect(slugify("  Hello World  ")).toBe("hello-world");
  });

  it("collapses consecutive special chars into one hyphen", () => {
    expect(slugify("Hello!!!World")).toBe("hello-world");
    expect(slugify("A  B  C")).toBe("a-b-c");
  });

  it("strips non-alphanumeric characters", () => {
    expect(slugify("My Great Deck!")).toBe("my-great-deck");
    expect(slugify("Q3 Revenue: $1M")).toBe("q3-revenue-1m");
  });

  it("returns 'presentation' for an empty or all-special string", () => {
    expect(slugify("")).toBe("presentation");
    expect(slugify("!!!")).toBe("presentation");
    expect(slugify("   ")).toBe("presentation");
  });

  it("truncates to 60 characters", () => {
    const long = "a".repeat(80);
    expect(slugify(long).length).toBeLessThanOrEqual(60);
  });

  it("handles unicode by stripping non-ASCII", () => {
    // Non-ASCII letters become hyphens, then get collapsed/stripped
    const result = slugify("Café Paris");
    expect(result).toMatch(/^[a-z0-9-]+$/);
    expect(result.length).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Data JSON validation rules (mirroring what createCommand checks)
// ─────────────────────────────────────────────────────────────────────────────

describe("data JSON shape rules", () => {
  function validateData(data: unknown): { ok: boolean; error?: string } {
    if (typeof data !== "object" || data === null) return { ok: false, error: "Not an object" };
    const d = data as Record<string, unknown>;
    if (!Array.isArray(d["slides"])) return { ok: false, error: "Missing slides array" };
    if ((d["slides"] as unknown[]).length === 0) return { ok: false, error: "slides array is empty" };
    return { ok: true };
  }

  it("accepts a valid data object", () => {
    expect(validateData({ title: "My Deck", slides: [{ layout: "minimal", heading: "Hi" }] }).ok).toBe(true);
  });

  it("rejects data with no slides array", () => {
    const r = validateData({ title: "Bad" });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("slides");
  });

  it("rejects data with an empty slides array", () => {
    const r = validateData({ slides: [] });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("empty");
  });

  it("rejects null and non-objects", () => {
    expect(validateData(null).ok).toBe(false);
    expect(validateData("string").ok).toBe(false);
    expect(validateData(42).ok).toBe(false);
  });

  it("accepts slides without a title at the top level", () => {
    expect(validateData({ slides: [{ heading: "Slide" }] }).ok).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────────────────────────
// Required slot validation (mirroring createCommand's slot check)
// ─────────────────────────────────────────────────────────────────────────────

describe("required slot validation", () => {
  interface SlotDef { id: string; required: boolean }

  function validateRequiredSlots(
    slides: Record<string, unknown>[],
    slots: SlotDef[]
  ): string[] {
    const required = slots.filter(s => s.required);
    const errors: string[] = [];
    for (let i = 0; i < slides.length; i++) {
      const slide = slides[i]!;
      for (const slot of required) {
        if (slide[slot.id] === undefined || slide[slot.id] === null || slide[slot.id] === "") {
          errors.push(`Slide ${i + 1}: missing required slot "${slot.id}"`);
        }
      }
    }
    return errors;
  }

  const slots: SlotDef[] = [
    { id: "heading", required: true },
    { id: "body",    required: false },
  ];

  it("returns no errors when all required slots are present", () => {
    const errors = validateRequiredSlots([{ heading: "Hello" }, { heading: "World" }], slots);
    expect(errors).toHaveLength(0);
  });

  it("returns an error for each slide missing a required slot", () => {
    const errors = validateRequiredSlots([{ body: "No heading here" }], slots);
    expect(errors).toHaveLength(1);
    expect(errors[0]).toContain("heading");
    expect(errors[0]).toContain("Slide 1");
  });

  it("returns errors for multiple failing slides", () => {
    const errors = validateRequiredSlots([{}, {}, { heading: "OK" }], slots);
    expect(errors).toHaveLength(2);
  });

  it("treats empty string as missing for required slots", () => {
    const errors = validateRequiredSlots([{ heading: "" }], slots);
    expect(errors).toHaveLength(1);
  });

  it("does not error on optional slots that are missing", () => {
    const errors = validateRequiredSlots([{ heading: "Hi" }], slots);
    expect(errors).toHaveLength(0);
  });
});
