import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

const GUIDE_PATH = join(import.meta.dir, "..", "..", "TEMPLATE_GUIDE.md");

// Structured JSON summary — everything an LLM needs without parsing markdown
const AGENT_GUIDE = {
  overview: "A slide-cli template is a folder with 3 files: template.json (manifest), template.html (Handlebars HTML), sample.json (docs + example). Install with: slide add-template <path>",

  files: {
    "template.json": {
      purpose: "Declares the template identity and every data slot the HTML uses.",
      required_fields: ["name", "id", "version", "description", "aspectRatio", "width", "height", "slots"],
      slot_fields: ["id (kebab-case)", "type (text|color|number|url|image)", "label", "required (bool)", "default (optional)", "description (optional)"],
      example: {
        name: "My Template", id: "my-template", version: "1.0.0",
        description: "One sentence describing style and use case.",
        aspectRatio: "9:16", width: 1080, height: 1920,
        slots: [
          { id: "headline", type: "text",  label: "Headline",   required: true,  description: "Main heading. 1–6 words." },
          { id: "body",     type: "text",  label: "Body text",  required: false, default: "", description: "Supporting paragraph." },
          { id: "bg",       type: "color", label: "Background", required: false, default: "#0f0e0c", description: "CSS hex color." }
        ]
      }
    },

    "template.html": {
      purpose: "Full HTML document rendered by Puppeteer. Slot values injected via Handlebars.",
      critical_rules: [
        "html and body must be EXACTLY width×height pixels (e.g. 1080px × 1920px). Never use %, vw, vh for root size.",
        "Add overflow: hidden to html and body.",
        "Always include system font fallbacks — Google Fonts may not load in headless Chrome.",
        "Slot values can be used inside <style> blocks: body { background: {{bg}}; }",
        "Do NOT use CSS variables like var(--x) unless you define them yourself in <style>."
      ],
      always_available_variables: {
        "{{slideIndex}}": "1-based index of current slide (1, 2, 3...)",
        "{{totalSlides}}": "Total slide count in the deck",
        "{{title}}": "Top-level title from the data JSON"
      },
      handlebars_syntax: {
        "{{slotId}}": "Output slot value (HTML-escaped)",
        "{{{slotId}}}": "Output raw HTML (unescaped)",
        "{{#if slotId}}...{{/if}}": "Conditional block — renders if slot is truthy",
        "{{#if slotId}}...{{else}}...{{/if}}": "Conditional with fallback",
        "{{#unless slotId}}...{{/unless}}": "Renders if slot is falsy",
        "{{upper slotId}}": "Uppercase the value",
        "{{lower slotId}}": "Lowercase the value",
        "{{default slotId 'fallback'}}": "Use fallback if slot is empty",
        "{{add slotId 1}}": "Add a number to the slot value"
      },
      font_stack_examples: {
        sans_display_latin_only: "'Bebas Neue', Impact, 'Arial Narrow', sans-serif",
        sans_display_unicode: "'Bebas Neue', 'Noto Sans CJK', Impact, 'Arial Narrow', sans-serif  /* CJK + French fallback */",
        sans_body_unicode: "'Outfit', 'Noto Sans CJK', 'Helvetica Neue', Arial, sans-serif",
        serif_latin_only: "'Playfair Display', Georgia, 'Times New Roman', serif",
        serif_unicode: "'Playfair Display', 'Noto Serif CJK', Georgia, 'Times New Roman', serif  /* CJK + accented Latin */",
        mono: "'DM Mono', 'Noto Sans CJK', 'Courier New', monospace"
      },
      unicode_font_faces: {
        note: "Add these @font-face declarations at the top of your template <style> block to enable CJK and extended Latin (French, Spanish, etc.) rendering. The local() hint works on any system with Noto installed. The url() path works in slide-cli's Puppeteer renderer on Linux.",
        noto_sans_black: "@font-face { font-family: 'Noto Sans CJK'; font-weight: 900; src: local('Noto Sans CJK JP Black'), url('file:///usr/share/fonts/opentype/noto/NotoSansCJK-Black.ttc') format('truetype'); }",
        noto_sans_bold: "@font-face { font-family: 'Noto Sans CJK'; font-weight: 700; src: local('Noto Sans CJK JP'), url('file:///usr/share/fonts/opentype/noto/NotoSansCJK-Bold.ttc') format('truetype'); }",
        noto_serif_bold: "@font-face { font-family: 'Noto Serif CJK'; font-weight: 700; src: local('Noto Serif CJK JP Bold'), url('file:///usr/share/fonts/opentype/noto/NotoSerifCJK-Bold.ttc') format('truetype'); }",
        coverage: "Latin, French (àâæçéèêëîïôœùûü), Spanish (ñ), CJK Simplified, CJK Traditional, Japanese (Hiragana/Katakana/Kanji), Korean (Hangul), Arabic (partial)"
      },
      bold_weight_rules: {
        note: "Bold weights are critical for legibility at mobile scale (1080px renders at ~375px on screen). Use these minimums per font size range:",
        display_titles_140px_plus: "font-weight: 700–900 — thick strokes at large sizes create visual impact",
        subtitles_50_100px: "font-weight: 700 — medium sizes need bold to hold up at mobile scale",
        body_42_50px: "font-weight: 400 minimum — never use 300 (Light) for body text",
        labels_30_40px: "font-weight: 700 — small uppercase labels disappear at lighter weights",
        footers_28_32px: "font-weight: 400 — never lighter than regular at the smallest sizes"
      },
      minimum_template: `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1080px; height: 1920px; overflow: hidden; background: {{bg}}; }
  body { display: flex; flex-direction: column; justify-content: center; padding: 96px;
         font-family: Georgia, serif; color: {{ink}}; position: relative; }
  h1   { font-size: 120px; line-height: 1.1; }
  p    { font-size: 40px; margin-top: 48px; opacity: 0.7; }
  .counter { position: absolute; bottom: 60px; right: 80px; font-size: 26px; opacity: 0.3; }
</style>
</head>
<body>
  <h1>{{headline}}</h1>
  {{#if body}}<p>{{body}}</p>{{/if}}
  <div class="counter">{{slideIndex}} / {{totalSlides}}</div>
</body>
</html>`
    },

    "sample.json": {
      purpose: "Two things at once: (1) working input for slide create, (2) slot documentation for agents and users.",
      meta_keys: {
        "_template": "The template id this sample belongs to.",
        "_description": "Paragraph describing when/why to use this template.",
        "_slots": "Object mapping every slot id to a plain-language description. Start required slots with 'REQUIRED — ', optional with 'optional — '."
      },
      rules: [
        "_* keys are stripped before printing — write freely in them.",
        "The slides array must be valid — it must pass slide create without errors.",
        "Include 2–4 slides showing variety: different bg colors, optional slots both set and absent.",
        "layout field in each slide is informational only — slide create ignores it."
      ],
      example: {
        _template: "my-template",
        _description: "A clean statement card. Best for bold one-liners or principles.",
        _slots: {
          headline: "REQUIRED — main heading. 1–6 words. Displayed at ~120px font size.",
          body: "optional — supporting text. 1–3 sentences.",
          bg: "optional — hex background. Default #0f0e0c. Dark = editorial; light (#fafaf8) = clean."
        },
        title: "My Deck",
        slides: [
          { layout: "my-template", headline: "Less is more", body: "Remove everything that does not serve the message.", bg: "#0f0e0c" },
          { layout: "my-template", headline: "Ship fast", bg: "#0a1220" }
        ]
      }
    }
  },

  typography_scale: {
    note: "All sizes are render sizes at 1080×1920px canvas. At mobile display (~375px wide), divide by ~2.8 to get on-screen size. Design for the final display size.",
    display_hero:    "140px min render (~50px mobile) — 1–3 words max",
    large_heading:   "100px min render (~36px mobile) — 4–8 words",
    subheading:      "50px min render (~18px mobile) — 1–2 lines",
    body:            "42px min render (~15px mobile) — 3–5 lines max",
    caption_label:   "32px min render (~11px mobile) — uppercase with letter-spacing, use font-weight:700",
    footnote_counter:"28px min render (~10px mobile) — absolute minimum, keep text short",
    hard_floor:      "Never use text below 28px render size. At 1080→375px scale, that renders at ~10px which is the absolute legibility floor."
  },

  mobile_readability: {
    summary: "9:16 cards are viewed on mobile screens at ~375px wide. The 1080px render is scaled down ~2.8×. Every readability decision must account for this scale.",
    contrast_rules: {
      primary_text:   "Near-white on dark (#f0ece4+), near-black on light (#1a1714 or darker). No opacity reduction on primary text.",
      secondary_text: "Minimum opacity:0.7 or rgba equivalent. rgba(255,255,255,0.55) is the floor on dark backgrounds.",
      tertiary_text:  "Minimum opacity:0.35 for labels, roles, counters. Below 0.35 becomes decoration, not information.",
      ghost_text:     "opacity:0.03–0.08 is fine for purely decorative watermarks — they carry no information."
    },
    font_weight_rules: {
      body_min:    "font-weight:400 minimum for body text. Light/thin weights lose legibility faster at small sizes.",
      labels_min:  "font-weight:700 for small uppercase labels (eyebrows, topics) — thin weight at 32px is too faint.",
      headings:    "font-weight:200–400 is fine for large headings (100px+) because size compensates for weight."
    },
    opacity_pitfall: "opacity on a text element affects its entire box. Prefer rgba() on color directly: color:rgba(255,255,255,0.6) instead of color:#fff; opacity:0.6.",
    avoid: [
      "Text below 28px render size",
      "Body text in colours below ~3.5:1 contrast on the background — #7a756e on #0f0e0c is ~3:1, use #a09890 or brighter",
      "font-weight:300 or lighter for text smaller than 50px render size",
      "opacity below 0.35 for any text that carries information"
    ]
  },

  layout_zones: {
    note: "Recommended zones for 1080×1920px",
    top_margin: "80–120px — branding, eyebrow label, logo",
    content_zone: "flex-grow: 1 — main heading, visual, quote",
    bottom_margin: "60–100px — slide counter, CTA, footer",
    horizontal_padding: "80–120px left and right"
  },

  color_palettes: {
    dark_editorial: { bg: "#0f0e0c", ink: "#f0ece4", accent: "#c8b89a", muted: "#3d3a36" },
    light_clean:    { bg: "#faf7f2", ink: "#1a1714", accent: "#c0392b", muted: "#8a857e" },
    gradient_dark:  { bg: "linear-gradient(160deg, #0d0221 0%, #1a0f2e 100%)", ink: "#ffffff", accent: "#ff6b35" }
  },

  common_decorations: {
    thin_rule: `.rule { width: 60px; height: 2px; background: {{accent}}; }`,
    corner_bracket: `.corner-tl { position: absolute; top: 80px; left: 80px; width: 50px; height: 50px; border-left: 2px solid currentColor; border-top: 2px solid currentColor; }`,
    noise_texture: `body::before { content: ''; position: absolute; inset: 0; background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E"); pointer-events: none; opacity: 0.35; }`,
    grid_overlay: `body::before { content: ''; position: absolute; inset: 0; background-image: linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px); background-size: 80px 80px; pointer-events: none; }`,
    svg_quotemark: `<svg viewBox="0 0 200 160" style="width:200px;opacity:0.12"><path d="M20 130 C20 90 45 55 80 30 L70 15 C25 42 0 82 0 130 C0 148 12 160 28 160 C44 160 55 148 55 132 C55 116 44 104 28 104Z" fill="currentColor"/><path d="M110 130 C110 90 135 55 170 30 L160 15 C115 42 90 82 90 130 C90 148 102 160 118 160 C134 160 145 148 145 132 C145 116 134 104 118 104Z" fill="currentColor"/></svg>`
  },

  heading_and_title_wrapping: {
    summary: "Use text-wrap:pretty on headings, titles, and short text blocks. It distributes text across lines as evenly as possible, so multi-line titles look intentional rather than ragged.",
    css_pattern: "h1, h2, h3, .title, .quote-text, .card-title { text-wrap: pretty; }",
    when_to_use: "Short text that may wrap: slide titles, card headings, pull-quotes, labels. Not needed on long body paragraphs (browsers limit it to ~6 lines for performance).",
    also_available: "text-wrap:balance — fully balances line lengths. Stronger than pretty. Use balance when you want visually even lines across all lines, not just orphan prevention.",
    browser_support: "Excellent in modern browsers: Chrome 114+, Firefox 121+, Safari 17.4+. All headless Puppeteer versions used by this CLI support it.",
    do_not_use: "white-space:nowrap with JS font-scaling to force single-line titles. That was the old approach — text-wrap:pretty is simpler, more correct, and needs no JavaScript."
  },

  checklist: [
    "template.json has a unique kebab-case id",
    "All {{slotId}} in the HTML are declared in slots[]",
    "html and body are fixed at width×height px with overflow: hidden",
    "Font stacks include Noto CJK fallback for unicode (CJK, French, accented Latin)",
    "Font weights: 900 for display titles, 700 for subtitles/labels/eyebrows, 400+ for body",
    "{{slideIndex}} / {{totalSlides}} counter is shown somewhere",
    "Headings and titles use text-wrap:pretty, subtitles use text-wrap:balance",
    "No text below 28px render size (floors at ~10px on mobile)",
    "Secondary text opacity ≥ 0.35; body text opacity ≥ 0.7",
    "sample.json _slots has an entry for every slot",
    "sample.json slides array passes slide create without errors",
    "sample.json has 2+ slides showing different content and color combos"
  ],

  workflow: [
    "1. Run: slide list --verbose   (to see existing templates for inspiration)",
    "2. Create a folder: mkdir my-template",
    "3. Write template.json with manifest + slots",
    "4. Write template.html using Handlebars syntax referencing those slots",
    "5. Write sample.json with _slots documentation and 2-4 working slide examples",
    "6. Run: slide add-template ./my-template/   (validates all three files)",
    "7. Test: slide create --template my-template --data my-template/sample.json --out ./test-out"
  ]
};

export function guideCommand(opts: { json: boolean }) {
  if (opts.json) {
    // Machine-readable mode — pure JSON, no decoration
    console.log(JSON.stringify(AGENT_GUIDE, null, 2));
    return;
  }

  // Human-readable mode — print the markdown guide
  if (existsSync(GUIDE_PATH)) {
    const md = readFileSync(GUIDE_PATH, "utf-8");
    // Light syntax highlighting for terminals
    const rendered = md
      .replace(/^(#{1,3} .+)$/gm, (_, h) => chalk.bold.cyan(h))
      .replace(/`([^`\n]+)`/g, (_, c) => chalk.yellow(c))
      .replace(/^\| .+/gm, (line) => chalk.dim(line))
      .replace(/^- \[ \]/gm, chalk.dim("  ☐"))
      .replace(/^- \[x\]/gm, chalk.green("  ☑"));
    console.log(rendered);
  } else {
    // Fallback: print JSON guide if markdown is missing
    console.log(chalk.yellow("(TEMPLATE_GUIDE.md not found — showing JSON guide)\n"));
    console.log(JSON.stringify(AGENT_GUIDE, null, 2));
  }

  console.log(
    `\n  ${chalk.dim("For machine-readable output (LLM agents):")}  ${chalk.cyan("slide guide --json")}\n`
  );
}
