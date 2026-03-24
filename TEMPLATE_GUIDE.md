# Template Authoring Guide

This guide contains everything needed to create a slide-cli template from scratch —
whether you are a human developer or an LLM agent generating one on demand.

---

## What a template is

A template is a **folder** containing exactly three files:

```
my-template/
├── template.json   ← manifest: id, slots, dimensions
├── template.html   ← Handlebars HTML: the visual design
└── sample.json     ← working example + slot documentation
```

Install it with:

```bash
slide add-template ./my-template/
slide create --template my-template --data data.json --out ./output
```

---

## 1. template.json — the manifest

Defines the template identity and every data slot the HTML can use.

```json
{
  "name": "My Template",
  "id": "my-template",
  "version": "1.0.0",
  "description": "One sentence describing the visual style and use case.",
  "author": "your-name",
  "aspectRatio": "9:16",
  "width": 1080,
  "height": 1920,
  "slots": [
    {
      "id": "headline",
      "type": "text",
      "label": "Headline",
      "required": true,
      "description": "Main heading text. 1–6 words work best at large font sizes."
    },
    {
      "id": "body",
      "type": "text",
      "label": "Body text",
      "required": false,
      "default": "",
      "description": "Supporting paragraph. 1–3 sentences."
    },
    {
      "id": "bg",
      "type": "color",
      "label": "Background color",
      "required": false,
      "default": "#0f0e0c",
      "description": "Slide background. Any valid CSS hex color."
    }
  ]
}
```

### Slot types

| type | What it holds | Example value |
|---|---|---|
| `text` | Any string | `"Less is more"` |
| `color` | CSS hex color | `"#ff6b35"` |
| `number` | Integer or float | `42` |
| `url` | A URL string | `"https://example.com"` |
| `image` | Local file path or https:// URL | `"./photo.jpg"` or `"https://…"` |

> **How image slots work:** The renderer automatically converts any `image` slot value to a base64 data URI before injecting it into the HTML. This means Puppeteer can render the image without any network access, and relative paths (e.g. `"./assets/photo.jpg"`) are resolved relative to the directory of the source data JSON file. Template authors just use `{{slotId}}` as a normal `src` attribute — no special handling needed.
>
> ```html
> <!-- This just works — the renderer handles the conversion -->
> <img src="{{image}}" alt="">
> ```
>
> Accepted values in the data JSON:
> - Local path relative to the data JSON: `"./photo.jpg"`, `"assets/hero.png"`
> - Absolute local path: `"/Users/me/photos/hero.jpg"`
> - Remote URL: `"https://images.unsplash.com/photo-xxx?w=1080"`
> - Already a data URI: passed through unchanged

### Rules
- `id` must be kebab-case (`my-slot`, not `mySlot` or `my_slot`)
- `version` must be semver (`1.0.0`)
- `id` at the top level must be kebab-case and unique across all installed templates
- Every slot referenced with `{{slotId}}` in `template.html` must be declared here
- Required slots with no default will cause `slide create` to error if missing from data

### Standard dimensions

| Ratio | width | height | Use case |
|---|---|---|---|
| 9:16 | 1080 | 1920 | Instagram Stories, TikTok, Reels |
| 1:1 | 1080 | 1080 | Instagram feed, Twitter/X |
| 16:9 | 1920 | 1080 | YouTube thumbnails, presentations, Google Slides export |

Set `aspectRatio`, `width`, and `height` in `template.json` to match. The renderer crops the Puppeteer viewport to exactly these dimensions — the HTML must declare the same pixel size in CSS.

---

## 2. template.html — the visual design

A **full HTML document** rendered by Puppeteer at exactly `width × height` pixels.
Slot values are injected via [Handlebars](https://handlebarsjs.com/) before rendering.

### Minimum valid template.html

```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body {
    width: 1080px;
    height: 1920px;
    overflow: hidden;
    background: {{bg}};
    font-family: Georgia, serif;
  }
  body {
    display: flex;
    flex-direction: column;
    justify-content: center;
    padding: 96px;
  }
  h1 { font-size: 120px; color: #f0ece4; line-height: 1.1; }
  p  { font-size: 40px; color: #7a756e; margin-top: 48px; }
</style>
</head>
<body>
  <h1>{{headline}}</h1>
  {{#if body}}<p>{{body}}</p>{{/if}}
  <footer style="position:absolute;bottom:60px;right:80px;font-size:28px;color:#333">
    {{slideIndex}} / {{totalSlides}}
  </footer>
</body>
</html>
```

### Handlebars syntax reference

```handlebars
{{slotId}}                     Output a slot value (HTML-escaped)
{{{slotId}}}                   Output raw HTML (unescaped) — use with care

{{#if slotId}}…{{/if}}         Render block only if slot is truthy (non-empty)
{{#if slotId}}…{{else}}…{{/if}}  With fallback

{{#unless slotId}}…{{/unless}} Render block if slot is falsy

{{upper slotId}}               Uppercase the value
{{lower slotId}}               Lowercase the value
{{default slotId "fallback"}}  Use fallback if slot is empty
{{add slotId 1}}               Add a number to the slot value
```

### Always-available variables (no need to declare in slots)

| Variable | Value |
|---|---|
| `{{slideIndex}}` | 1-based index of the current slide (1, 2, 3…) |
| `{{totalSlides}}` | Total number of slides in the deck |
| `{{title}}` | Top-level `"title"` from the data JSON |

### Critical HTML constraints

1. **Fixed pixel dimensions** — `html` and `body` must be exactly `width × height` pixels
   from the manifest. Do not use `%`, `vw`, `vh`, or `auto` for the root size.
   Match your manifest values precisely:
   ```css
   /* 9:16 Stories/Reels */
   html, body { width: 1080px; height: 1920px; overflow: hidden; }

   /* 16:9 Presentations/YouTube */
   html, body { width: 1920px; height: 1080px; overflow: hidden; }

   /* 1:1 Feed/Square */
   html, body { width: 1080px; height: 1080px; overflow: hidden; }
   ```

2. **No external network requests in production** — Google Fonts and CDN links
   will fail in headless Puppeteer unless the machine has internet access.
   Always provide system font fallbacks:
   ```css
   font-family: 'Bebas Neue', Impact, 'Arial Narrow', sans-serif;
   font-family: 'Playfair Display', Georgia, 'Times New Roman', serif;
   font-family: 'DM Mono', 'Courier New', monospace;
   ```

3. **Use bold weights for legibility** — at the 1080px→mobile scale factor (~2.8×),
   light and thin font weights lose legibility faster than colour does. Apply these minimums:
   - Display titles (`font-size ≥ 140px`): `font-weight: 700–900`
   - Subtitles and subheadings (`font-size 50–100px`): `font-weight: 700`
   - Body text (`font-size 42–50px`): `font-weight: 400` minimum
   - Labels and eyebrows (`font-size 30–40px`): `font-weight: 700`
   - Footers and counters (`font-size 28–32px`): `font-weight: 400`, never lighter

4. **No `<script>` side effects that block rendering** — Puppeteer waits for
   `networkidle0` then `document.fonts.ready`. Avoid long JS loops or timers
   that prevent the page from settling.

5. **Colors must be hardcoded or from slots** — CSS variables like `var(--accent)`
   will not be set unless you define them yourself in `<style>`.

6. **Slot values in CSS** — you CAN use slot values directly inside `<style>` blocks:
   ```css
   body { background: {{bg}}; }
   h1   { color: {{accent}}; }
   ```
   This is the recommended way to apply per-slide color themes.

---

## 3. sample.json — documentation + working example

`sample.json` serves two purposes simultaneously:
- **Working example** — the `slides` array is valid input for `slide create`
- **Agent documentation** — `_slots` explains every slot in plain language

```json
{
  "_template": "my-template",
  "_description": "One paragraph describing when and why to use this template.",
  "_slots": {
    "headline": "REQUIRED — main heading. 1–6 words. Displayed at ~120px so short phrases work best.",
    "body":     "optional — supporting paragraph. 1–3 sentences. Shown below the heading.",
    "bg":       "optional — hex background color. Dark backgrounds (#0f0e0c) feel editorial; light (#fafaf8) feel clean. Default: #0f0e0c"
  },
  "title": "My Deck Title",
  "slides": [
    {
      "layout": "my-template",
      "headline": "Less is more",
      "body": "Remove everything that does not serve the message.",
      "bg": "#0f0e0c"
    },
    {
      "layout": "my-template",
      "headline": "Ship fast",
      "body": "A good product today beats a perfect product never.",
      "bg": "#0a1628"
    }
  ]
}
```

### Rules for sample.json
- `_*` keys are stripped before any output is shown to users — use them freely for notes
- `_slots` should have an entry for **every** slot, starting with `"REQUIRED — "` or `"optional — "`
- The `slides` array must be valid input — it must pass `slide create` without errors
- Include 2–4 slides showing variety: different `bg` colors, different content lengths, optional slots both present and absent
- The `layout` field in each slide object is informational only — `slide create` ignores it

---

## Design guidelines

### Choosing your aspect ratio

| Format | Ratio | Canvas | Primary display context |
|---|---|---|---|
| Stories, Reels, TikTok | 9:16 | 1080×1920 | Mobile, full-screen, held vertically |
| Presentations, YouTube | 16:9 | 1920×1080 | Desktop/TV, projected, landscape |
| Feed, Square posts | 1:1 | 1080×1080 | Mixed — mobile and desktop feeds |

The aspect ratio shapes every design decision: how much vertical space you have, how text wraps, and whether a two-column layout makes sense. Choose before writing any CSS.

---

## Design guidelines for 9:16 cards (1080×1920px)

### Typography scale

These slides render at 1080×1920px but display on a mobile screen at roughly 375–430px wide. The browser scales the image down by ~2.8×. A font that is 36px at render time appears as ~13px on screen — barely readable. Design for the final display size, not the render size.

| Role | Min render size | Approx on mobile | Notes |
|---|---|---|---|
| Display / hero title | 140px | ~50px | 1–3 words |
| Large heading | 100px | ~36px | 4–8 words |
| Subheading / subtitle | 50px | ~18px | 1–2 lines |
| Body text | 42px | ~15px | 3–5 lines max |
| Label / eyebrow | 32px | ~11px | Uppercase + letter-spacing |
| Footer / counter | 28px | ~10px | Absolute minimum — keep short |

**Never go below 28px render size** for any text a user needs to read.

### Layout zones (for 1080×1920)

```
┌─────────────────────────────┐  ← y=0
│                             │
│  TOP MARGIN: 80–120px       │  Branding, eyebrow label, logo
│                             │
├─────────────────────────────┤  ← y≈140
│                             │
│                             │
│  CONTENT ZONE               │  Main heading, visual, quote
│  (flex-grow: 1)             │
│                             │
│                             │
├─────────────────────────────┤  ← y≈1780
│                             │
│  BOTTOM MARGIN: 60–100px    │  Slide counter, CTA, footer
│                             │
└─────────────────────────────┘  ← y=1920
```

**Horizontal padding:** 80–120px left/right. Cards are viewed on mobile — tight edges feel cramped.

**Layout direction:** `flex-direction: column`. 9:16 is a tall, narrow canvas — vertical stacking is natural. Two-column layouts can work for specific use cases (image beside text) but require careful width management.

---

## Design guidelines for 16:9 cards (1920×1080px)

### Typography scale

16:9 cards are typically viewed at full screen on a desktop (1920px native) or projected. Scale factors vary widely — a 1920px canvas on a 1280px laptop screen is ~0.67×; projected on a wall it may be 1× or larger. Design for comfortable legibility at native size: text that reads well at 1920px will scale gracefully.

| Role | Recommended render size | Notes |
|---|---|---|
| Display / hero title | 120–160px | 1–4 words |
| Large heading | 80–110px | 4–8 words |
| Subheading / subtitle | 32–48px | 1–3 lines |
| Body text | 28–36px | 4–8 lines max |
| Label / eyebrow | 22–28px | Uppercase + letter-spacing |
| Footer / counter | 20–24px | Minimum — keep very short |

**Minimum:** 20px render size. Below that, text becomes illegible when projected or on a laptop.

### Layout zones (for 1920×1080)

```
┌──────────────────────────────────────────────┐  ← y=0
│  TOP BAR: 40–60px  · branding / counter      │
├──────────┬───────────────────────────────────┤  ← y≈80
│          │                                   │
│  LEFT    │  RIGHT COLUMN                     │
│  COLUMN  │  (image, subtitle, attribution)   │
│  (title, │                                   │
│  heading,│                                   │
│  quote)  │                                   │
│          │                                   │
├──────────┴───────────────────────────────────┤  ← y≈1020
│  BOTTOM BAR: 40–60px · CTA / footer / rule   │
└──────────────────────────────────────────────┘  ← y=1080
```

**Layout direction:** `flex-direction: row` is often the right choice. A 16:9 canvas is wide and shallow — two-column layouts (title left, subtitle right; quote left, attribution right) use the space naturally and give each element room to breathe.

**Horizontal padding:** 80–96px left/right.
**Vertical padding:** 44–64px top/bottom.

### Two-column layout patterns

```css
/* Split: content left + image/aside right */
.main {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: 1;
  padding: 0 80px;
  gap: 80px;
}
.main-left  { flex: 1 1 0; }           /* grows to fill */
.main-right { flex: 0 0 540px; }       /* fixed right column */

/* Equal split */
.main-left  { flex: 1 1 0; }
.main-right { flex: 1 1 0; }

/* Image takes right half */
.text-col  { flex: 0 0 900px; }
.image-col { flex: 1 1 0; }
```

---

## Shared design principles (all aspect ratios)

### Mobile/display contrast rules

- **Primary text** (headings, quotes): near-white on dark (`#f0ece4` or brighter), near-black on light (`#1a1714` or darker). No opacity reduction.
- **Secondary text** (body, subtitle): minimum `opacity: 0.7` or equivalent solid colour.
- **Tertiary text** (labels, roles, counters): minimum `opacity: 0.35`.
- **Ghost text** (decorative numbers/watermarks): `opacity: 0.03–0.08`.
- **Font weight matters as much as colour**: use `font-weight: 400` minimum for body text, `700` for labels and eyebrows at small sizes.

### Opacity pitfalls

```css
/* ✗ Risky — opacity affects background too if element has one */
.secondary { color: #ffffff; opacity: 0.45; }

/* ✓ Better — only the text colour is affected */
.secondary { color: rgba(255,255,255,0.6); }

/* ✓ Best for dark-on-light — use a concrete muted colour */
.secondary { color: #6b6560; }
```

### Consistent background and text colors across a deck

**The core rule:** Every slide in a deck should share the same `bg` (background) and `ink` (primary text) color. Only the `accent` color should change between slides to create variety.

This creates visual cohesion — the deck feels like one unified piece rather than a patchwork of unrelated cards. The accent color (used for rules, labels, highlights, and secondary elements) provides enough per-slide personality without breaking the rhythm.

**How to implement this:**

1. **Define `bg` and `ink` as slots with strong defaults** — pick one background/text pairing and commit to it:
   ```json
   { "id": "bg",  "type": "color", "default": "#0f0e0c", "description": "Background. Keep consistent across all slides." },
   { "id": "ink", "type": "color", "default": "#f0ece4", "description": "Primary text. Keep consistent across all slides." },
   { "id": "accent", "type": "color", "default": "#e8b86d", "description": "Accent color — varies per slide for visual interest." }
   ```

2. **In sample.json, keep `bg` and `ink` the same on every slide:**
   ```json
   { "heading": "Slide 1", "bg": "#0f0e0c", "ink": "#f0ece4", "accent": "#c8b89a" },
   { "heading": "Slide 2", "bg": "#0f0e0c", "ink": "#f0ece4", "accent": "#8eb8a0" },
   { "heading": "Slide 3", "bg": "#0f0e0c", "ink": "#f0ece4", "accent": "#a8b8d0" }
   ```

3. **In `_slots` documentation, make the intent explicit:**
   ```json
   "_slots": {
     "bg":     "optional — background hex color. Use the SAME value on every slide in a deck. Default: #0f0e0c",
     "ink":    "optional — primary text hex color. Use the SAME value on every slide in a deck. Default: #f0ece4",
     "accent": "optional — accent hex color. VARY this per slide for visual interest. Default: #e8b86d"
   }
   ```

4. **Apply in CSS — `bg` and `ink` for the canvas, `accent` only for highlights:**
   ```css
   html, body { background: {{bg}}; color: {{ink}}; }
   .label     { color: {{accent}}; }
   .rule      { background: {{accent}}; }
   .caption   { color: {{accent}}; opacity: 0.8; }
   /* Headings, body text, and counters all inherit {{ink}} */
   ```

**Why this matters:**
- Changing background color between slides creates a jarring "slideshow of screenshots" effect
- Consistent `bg` + `ink` lets the viewer focus on the content, not the shifting palette
- The accent color alone provides enough variation — it touches small elements (rules, labels, captions) that signal "new slide" without disrupting the overall feel
- When users *do* want a different background (e.g. a title slide vs. content slides), they can still override `bg` — the slots allow it, but the defaults and documentation guide them toward consistency

**Recommended pairings:**

| Style | `bg` | `ink` | Accent examples |
|---|---|---|---|
| Dark editorial | `#0f0e0c` | `#f0ece4` | `#c8b89a`, `#7eb8d4`, `#d47e7e` |
| Warm dark | `#1a1410` | `#f5f0e8` | `#e8b86d`, `#a8d4a0`, `#d4a8c8` |
| Cool dark | `#0a0e14` | `#e8ecf0` | `#6b9fd4`, `#d4b86b`, `#b86bd4` |
| Light clean | `#faf7f2` | `#1a1714` | `#c0392b`, `#2980b9`, `#27ae60` |
| Pure light | `#ffffff` | `#111111` | `#ff6b35`, `#6b35ff`, `#35ff6b` |

### Color palette strategies

**Dark editorial** (popular for thought-leadership content):
```css
background: #0f0e0c;  /* near-black warm */
color: #f0ece4;        /* warm white */
accent: #c8b89a;       /* aged gold */
muted: #3d3a36;        /* dark gray */
```

**Light clean** (popular for quotes, tips):
```css
background: #faf7f2;  /* warm off-white */
color: #1a1714;        /* near-black */
accent: #c0392b;       /* crimson */
muted: #8a857e;        /* warm gray */
```

**Gradient dark** (popular for bold impact):
```css
background: linear-gradient(160deg, #0d0221 0%, #1a0f2e 100%);
color: #ffffff;
accent: #ff6b35;  /* any vivid color */
```

### Decorative elements that work well

```css
/* Thin ruled line */
.rule { width: 60px; height: 2px; background: var(--accent); }

/* Corner brackets (no border-radius) */
.corner-tl { position: absolute; top: 80px; left: 80px;
  width: 50px; height: 50px;
  border-left: 2px solid currentColor;
  border-top: 2px solid currentColor; }

/* Noise texture overlay */
body::before {
  content: ''; position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.04'/%3E%3C/svg%3E");
  pointer-events: none; opacity: 0.35; }

/* Subtle grid overlay */
body::before {
  content: ''; position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 80px 80px; }

/* SVG quotation marks (font-independent) */
<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg" style="width:200px;opacity:0.12">
  <path d="M20 130 C20 90 45 55 80 30 L70 15 C25 42 0 82 0 130 C0 148 12 160 28 160
           C44 160 55 148 55 132 C55 116 44 104 28 104 C24 104 22 104 20 105 Z" fill="currentColor"/>
  <path d="M110 130 C110 90 135 55 170 30 L160 15 C115 42 90 82 90 130 C90 148 102 160 118 160
           C134 160 145 148 145 132 C145 116 134 104 118 104 C114 104 112 104 110 105 Z" fill="currentColor"/>
</svg>
```

### Balancing headings and titles with `text-wrap: pretty`

Apply `text-wrap: pretty` to any heading, title, or short text that may wrap across multiple lines. The browser distributes words across lines as evenly as possible — so a two-line title has roughly equal line lengths rather than a long first line with a dangling short word at the bottom.

```css
/* Apply to all display text that might wrap */
h1, h2, h3, .title, .quote-text, .card-title {
  text-wrap: pretty;
}
```

**When to use it:** Short text blocks — slide titles, card headings, pull-quotes, eyebrow labels. Not needed on long body paragraphs (browsers cap it at ~6 lines for performance, so it has no effect on prose anyway).

**`text-wrap: balance`** is the stronger alternative — it fully balances line lengths across all lines, not just the last one. Use `pretty` when you want clean, natural wrapping without orphans (the default for these templates), and `balance` when you specifically want every line to be the same visual weight.

**Browser support:** Chrome 114+, Firefox 121+, Safari 17.4+. All headless Chromium versions used by this CLI support it — no JS fallback needed.

**Do not use** `white-space: nowrap` combined with JS font-scaling to force single-line titles. That approach requires JavaScript, adds timing dependencies with Puppeteer, and prevents natural wrapping when a title genuinely needs two lines. `text-wrap: pretty` handles it correctly with one CSS property.

### Per-slide accent variation

Pass `accent` as a slot so each slide in a deck can have its own personality while sharing the same background and text color:

```json
{ "layout": "my-template", "heading": "Slide 1", "bg": "#0f0e0c", "ink": "#f0ece4", "accent": "#c8b89a" },
{ "layout": "my-template", "heading": "Slide 2", "bg": "#0f0e0c", "ink": "#f0ece4", "accent": "#8eb8a0" },
{ "layout": "my-template", "heading": "Slide 3", "bg": "#0f0e0c", "ink": "#f0ece4", "accent": "#a8b8d0" }
```

Note how `bg` and `ink` stay the same — only `accent` changes.

---

## Complete worked example

This is a fully working minimal 16:9 template. The same structure applies to any ratio — just change `aspectRatio`, `width`, `height`, and the matching CSS dimensions.

### template.json
```json
{
  "name": "Statement",
  "id": "statement",
  "version": "1.0.0",
  "description": "Single bold statement card with a colored rule and optional caption.",
  "aspectRatio": "16:9",
  "width": 1920,
  "height": 1080,
  "slots": [
    { "id": "statement", "type": "text",  "label": "Statement",    "required": true,  "description": "The main statement. 3–10 words." },
    { "id": "caption",   "type": "text",  "label": "Caption",      "required": false, "default": "", "description": "Small text below. Attribution, context, or source." },
    { "id": "label",     "type": "text",  "label": "Top label",    "required": false, "default": "", "description": "Uppercase eyebrow tag at the top." },
    { "id": "bg",        "type": "color", "label": "Background",   "required": false, "default": "#0f0e0c", "description": "Background color. Keep consistent across all slides in a deck." },
    { "id": "accent",    "type": "color", "label": "Accent color", "required": false, "default": "#e8b86d", "description": "Accent color for rule, label, caption. Vary per slide." },
    { "id": "ink",       "type": "color", "label": "Text color",   "required": false, "default": "#f0ece4", "description": "Primary text color. Keep consistent across all slides in a deck." }
  ]
}
```

### template.html
```html
<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<style>
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html, body { width: 1920px; height: 1080px; overflow: hidden; background: {{bg}}; }
  body {
    display: flex; flex-direction: column; justify-content: center;
    padding: 80px 120px;
    font-family: Georgia, 'Times New Roman', serif;
    color: {{ink}};
    position: relative;
  }
  .label {
    font-family: 'Courier New', monospace;
    font-size: 22px; font-weight: 400;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: {{accent}}; margin-bottom: 36px;
  }
  .rule { width: 64px; height: 3px; background: {{accent}}; margin-bottom: 48px; }
  .statement {
    font-size: 96px; font-weight: 400;
    line-height: 1.1; letter-spacing: -0.02em;
    max-width: 1400px;
    text-wrap: pretty;
  }
  .caption {
    margin-top: 48px;
    font-family: 'Courier New', monospace;
    font-size: 28px; font-weight: 400;
    line-height: 1.6; color: {{accent}};
    opacity: 0.8;
  }
  .counter {
    position: absolute; bottom: 52px; right: 96px;
    font-family: 'Courier New', monospace;
    font-size: 20px; opacity: 0.3; letter-spacing: 0.1em;
  }
</style>
</head>
<body>
  {{#if label}}<div class="label">{{label}}</div>{{/if}}
  <div class="rule"></div>
  <p class="statement">{{statement}}</p>
  {{#if caption}}<p class="caption">{{caption}}</p>{{/if}}
  <div class="counter">{{slideIndex}} / {{totalSlides}}</div>
</body>
</html>
```

### sample.json
```json
{
  "_template": "statement",
  "_description": "Single bold statement card. Best for impactful one-liners, principles, or rules. Keep bg and ink consistent across all slides; vary only accent for visual interest.",
  "_slots": {
    "statement": "REQUIRED — the main statement. 3–10 words works best at 96px font size.",
    "caption":   "optional — smaller text below: attribution, source, or elaboration.",
    "label":     "optional — short uppercase eyebrow tag above the rule (e.g. 'Rule 01').",
    "bg":        "optional — background hex color. Use the SAME value on every slide. Default: #0f0e0c",
    "accent":    "optional — accent hex color for rule, label, caption. VARY per slide. Default: #e8b86d",
    "ink":       "optional — primary text hex color. Use the SAME value on every slide. Default: #f0ece4"
  },
  "title": "Design Rules",
  "slides": [
    { "layout": "statement", "label": "Rule 01", "statement": "Constraints breed creativity.", "caption": "— limit your tools, not your thinking", "bg": "#0f0e0c", "accent": "#e8b86d", "ink": "#f0ece4" },
    { "layout": "statement", "label": "Rule 02", "statement": "Ship, then refine.", "caption": "— perfection is the enemy of done", "bg": "#0f0e0c", "accent": "#7eb8d4", "ink": "#f0ece4" },
    { "layout": "statement", "label": "Rule 03", "statement": "Clarity over cleverness.", "bg": "#0f0e0c", "accent": "#d47e7e", "ink": "#f0ece4" }
  ]
}
```

---

## Checklist before running `slide add-template`

- [ ] `template.json` has a unique kebab-case `id`
- [ ] `aspectRatio`, `width`, and `height` are set correctly for your format (9:16, 16:9, or 1:1)
- [ ] All slots used as `{{slotId}}` in the HTML are declared in `slots[]`
- [ ] `html` and `body` CSS dimensions exactly match `width × height` in the manifest, with `overflow: hidden`
- [ ] Font stacks include system fallbacks (no network-only fonts)
- [ ] `{{slideIndex}}` and `{{totalSlides}}` used for slide counter (optional but recommended)
- [ ] `sample.json` has `_slots` with a description for every slot
- [ ] `sample.json` `slides` array is valid and would pass `slide create`
- [ ] At least 2 slides in the sample showing different content and color combos
- [ ] `bg` and `ink` are the **same** on every slide in `sample.json` — only `accent` varies