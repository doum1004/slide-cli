import { readFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";

const GUIDE_PATH = join(import.meta.dir, "..", "..", "TEMPLATE_GUIDE.md");

// Structured JSON summary — everything an LLM needs without parsing markdown
const AGENT_GUIDE = {
  overview: "A slide-cli template is a folder with 3 files: template.json (manifest), template.html (Handlebars HTML), sample.json (docs + example). Install with: slide add-template <path>. Supports 9:16 (Stories/Reels), 16:9 (presentations/YouTube), and 1:1 (feed) aspect ratios.",

  files: {
    "template.json": {
      purpose: "Declares the template identity and every data slot the HTML uses.",
      required_fields: ["name", "id", "version", "description", "aspectRatio", "width", "height", "slots"],
      slot_fields: ["id (kebab-case)", "type (text|color|number|url|image)", "label", "required (bool)", "default (optional)", "description (optional)"],
      example: {
        name: "My Template", id: "my-template", version: "1.0.0",
        description: "One sentence describing style and use case.",
        aspectRatio: "16:9", width: 1920, height: 1080,
        slots: [
          { id: "headline", type: "text",  label: "Headline",   required: true,  description: "Main heading. 1–6 words." },
          { id: "body",     type: "text",  label: "Body text",  required: false, default: "", description: "Supporting paragraph." },
          { id: "bg",       type: "color", label: "Background", required: false, default: "#0f0e0c", description: "CSS hex color." }
        ]
      },
      standard_dimensions: {
        "9:16":  { width: 1080, height: 1920, use_case: "Instagram Stories, TikTok, Reels — mobile full-screen portrait" },
        "16:9":  { width: 1920, height: 1080, use_case: "YouTube thumbnails, presentations, Google Slides — landscape" },
        "1:1":   { width: 1080, height: 1080, use_case: "Instagram feed, Twitter/X — square, mixed desktop/mobile" },
        note: "aspectRatio, width, and height in template.json must match the CSS dimensions in template.html exactly."
      }
    },

    "template.html": {
      purpose: "Full HTML document rendered by Puppeteer. Slot values injected via Handlebars.",
      critical_rules: [
        "html and body CSS dimensions must EXACTLY match the width×height in template.json. 9:16 → 1080px×1920px, 16:9 → 1920px×1080px, 1:1 → 1080px×1080px. Never use %, vw, vh for the root size.",
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
        note: "Bold weights are critical for legibility at small display sizes. Use these minimums per font size range:",
        display_titles_large: "font-weight: 700–900 — thick strokes at large sizes create visual impact",
        subtitles_medium: "font-weight: 700 — medium sizes need bold to hold up when scaled down",
        body_text: "font-weight: 400 minimum — never use 300 (Light) for body text",
        labels_small: "font-weight: 700 — small uppercase labels disappear at lighter weights",
        footers_smallest: "font-weight: 400 — never lighter than regular at the smallest sizes"
      },
      minimum_template: {
        "9:16": `<!DOCTYPE html>
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
</html>`,
        "16:9": `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; background: {{bg}}; }
  body { display: flex; flex-direction: column; justify-content: center; padding: 80px 120px;
         font-family: Georgia, serif; color: {{ink}}; position: relative; }
  h1   { font-size: 96px; line-height: 1.1; max-width: 1400px; text-wrap: pretty; }
  p    { font-size: 32px; margin-top: 40px; opacity: 0.7; max-width: 1100px; }
  .counter { position: absolute; bottom: 52px; right: 96px; font-size: 20px; opacity: 0.3; }
</style>
</head>
<body>
  <h1>{{headline}}</h1>
  {{#if body}}<p>{{body}}</p>{{/if}}
  <div class="counter">{{slideIndex}} / {{totalSlides}}</div>
</body>
</html>`
      }
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
    "9:16": {
      note: "Render canvas: 1080×1920px. Displayed on mobile at ~375px wide → scale factor ~2.8×. Design for the final display size.",
      display_hero:     "140px min render (~50px mobile) — 1–3 words max",
      large_heading:    "100px min render (~36px mobile) — 4–8 words",
      subheading:       "50px min render (~18px mobile) — 1–2 lines",
      body:             "42px min render (~15px mobile) — 3–5 lines max",
      caption_label:    "32px min render (~11px mobile) — uppercase with letter-spacing, font-weight:700",
      footnote_counter: "28px min render (~10px mobile) — absolute minimum, keep text short",
      hard_floor:       "Never use text below 28px render size."
    },
    "16:9": {
      note: "Render canvas: 1920×1080px. Viewed at desktop/projected scale — typically 1× to 0.67×. Design for comfortable legibility at native resolution.",
      display_hero:     "120–160px — 1–4 words max",
      large_heading:    "80–110px — 4–8 words; add max-width to prevent full-canvas stretch",
      subheading:       "32–48px — 1–3 lines",
      body:             "28–36px — 4–8 lines max",
      caption_label:    "22–28px — uppercase with letter-spacing, font-weight:700",
      footnote_counter: "20–24px — absolute minimum",
      hard_floor:       "Never use text below 20px render size.",
      layout_tip:       "16:9 is wide and shallow — use flex-direction:row for two-column layouts (title left + subtitle right). Add max-width on text columns to prevent lines from spanning the full 1920px width."
    },
    "1:1": {
      note: "Render canvas: 1080×1080px. Displayed on mobile feed at ~375px wide → scale factor ~2.9×. Similar to 9:16 but less vertical space.",
      display_hero:     "120–160px — 1–3 words max",
      large_heading:    "90–120px — 4–6 words",
      subheading:       "44–56px — 1–2 lines",
      body:             "38–46px — 2–4 lines max (less vertical room than 9:16)",
      caption_label:    "30–36px — uppercase with letter-spacing, font-weight:700",
      footnote_counter: "26–30px — absolute minimum",
      hard_floor:       "Never use text below 26px render size."
    }
  },

  readability: {
    summary: "Cards are viewed at different scales depending on aspect ratio. 9:16 and 1:1 are scaled down ~2.8–2.9× on mobile; 16:9 is typically viewed near native resolution on desktop or projected. Contrast rules are the same for all ratios.",
    contrast_rules: {
      primary_text:   "Near-white on dark (#f0ece4+), near-black on light (#1a1714 or darker). No opacity reduction on primary text.",
      secondary_text: "Minimum opacity:0.7 or rgba equivalent. rgba(255,255,255,0.55) is the floor on dark backgrounds.",
      tertiary_text:  "Minimum opacity:0.35 for labels, roles, counters. Below 0.35 becomes decoration, not information.",
      ghost_text:     "opacity:0.03–0.08 is fine for purely decorative watermarks — they carry no information."
    },
    font_weight_rules: {
      body_min:    "font-weight:400 minimum for body text. Light/thin weights lose legibility faster at small sizes.",
      labels_min:  "font-weight:700 for small uppercase labels (eyebrows, topics) — thin weight at small sizes is too faint.",
      headings:    "font-weight:200–400 is fine for large headings because size compensates for weight."
    },
    opacity_pitfall: "opacity on a text element affects its entire box. Prefer rgba() on color directly: color:rgba(255,255,255,0.6) instead of color:#fff; opacity:0.6.",
    avoid: [
      "Text below the hard floor for your ratio (28px for 9:16/1:1, 20px for 16:9)",
      "Body text in colours below ~3.5:1 contrast on the background",
      "font-weight:300 or lighter for text at small render sizes",
      "opacity below 0.35 for any text that carries information"
    ]
  },

  layout_zones: {
    "9:16": {
      note: "1080×1920px — tall portrait canvas. Use flex-direction:column.",
      top_margin: "80–120px — branding, eyebrow label, logo",
      content_zone: "flex-grow:1 — main heading, visual, quote",
      bottom_margin: "60–100px — slide counter, CTA, footer",
      horizontal_padding: "80–120px left and right",
      preferred_direction: "flex-direction: column — vertical stacking is natural for portrait"
    },
    "16:9": {
      note: "1920×1080px — wide landscape canvas. Use flex-direction:row for two-column layouts.",
      top_bar: "40–60px — branding dot, slide counter",
      content_zone: "flex:1 with flex-direction:row — title column left, subtitle/image column right",
      bottom_bar: "40–60px — CTA rule, footer text",
      horizontal_padding: "80–96px left and right",
      vertical_padding: "44–64px top and bottom",
      preferred_direction: "flex-direction: row — two-column layout uses the wide canvas naturally",
      two_column_tip: "Use flex:1 1 0 for the growing column and flex:0 0 Npx for the fixed column. Common split: 900px text + auto image, or 50/50 for equal columns."
    },
    "1:1": {
      note: "1080×1080px — square canvas. Moderate height — avoid cramming too much content.",
      top_margin: "72–100px",
      content_zone: "flex-grow:1",
      bottom_margin: "60–80px",
      horizontal_padding: "80–100px left and right",
      preferred_direction: "flex-direction: column — vertical stacking works; two columns possible for image+text"
    }
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
    "aspectRatio, width, and height are set for your target format (9:16 → 1080×1920, 16:9 → 1920×1080, 1:1 → 1080×1080)",
    "CSS html/body dimensions exactly match the manifest width×height, with overflow: hidden",
    "All {{slotId}} in the HTML are declared in slots[]",
    "Font stacks include Noto CJK fallback for unicode (CJK, French, accented Latin)",
    "Font weights: 900 for display titles, 700 for subtitles/labels/eyebrows, 400+ for body",
    "{{slideIndex}} / {{totalSlides}} counter is shown somewhere",
    "Headings and titles use text-wrap:pretty, subtitles use text-wrap:balance",
    "No text below the hard floor (28px for 9:16/1:1, 20px for 16:9)",
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
