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

7. **Color slots must have inline defaults in CSS** — Slot values like `{{bg}}`, `{{ink}}`, and `{{accent}}` may be empty or null at render time (e.g. when a user omits them from their data JSON and no `default` is set in the manifest). If a color slot renders as an empty string, the CSS property becomes invalid and the browser discards it — resulting in no background, invisible text, or missing accent elements.

   **Always wrap color slot references in `{{#if}}…{{else}}…{{/if}}` with a hardcoded fallback:**

   ```css
   /* ✗ Dangerous — breaks if bg is empty */
   html, body { background: {{bg}}; }

   /* ✓ Safe — falls back to a concrete color */
   html, body { background: {{#if bg}}{{bg}}{{else}}#0f0e0c{{/if}}; }
   ```

   **Apply this to every occurrence** of a color slot in `<style>`, including inside pseudo-elements (`::after`, `::before`), gradients, and any other CSS property:

   ```css
   body { color: {{#if ink}}{{ink}}{{else}}#f0ece4{{/if}}; }

   .eyebrow { color: {{#if accent}}{{accent}}{{else}}#e8b86d{{/if}}; }
   .rule    { background: {{#if accent}}{{accent}}{{else}}#e8b86d{{/if}}; }

   /* Gradient fades must also be protected */
   .image-zone::after {
     background: linear-gradient(to bottom, transparent 0%,
       {{#if bg}}{{bg}}{{else}}#0f0e0c{{/if}} 100%);
   }

   /* Overlays too */
   .bg-image::after {
     background: {{#if bg}}{{bg}}{{else}}#0f0e0c{{/if}};
     opacity: 0.72;
   }
   ```

   **The fallback value should match the slot's `default` in `template.json`** so behavior is consistent whether the default comes from the manifest or the inline CSS. If the slot has `"default": "#0f0e0c"` in the manifest, use `#0f0e0c` as the `{{else}}` value.

   **This applies to all color-type slots**, not just `bg`. Common ones to protect:

   | Slot | Typical fallback | Used in |
   |---|---|---|
   | `bg` | `#0f0e0c` | `html, body` background, overlays, gradient fades |
   | `ink` | `#f0ece4` | `body` color, `.body`, `.footer-text`, `.counter` |
   | `accent` | `#e8b86d` | `.eyebrow`, `.rule`, `.divider`, `.label`, `.caption` |

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

### Image + text split layouts (for 9:16)

When a template features a prominent image alongside text, split the canvas into two vertical zones rather than using a full-bleed background with an overlay. This gives the image room to breathe and keeps text on a clean, solid-colored surface.

**Recommended split ratios:**

| Split | Image zone | Text zone | Best for |
|---|---|---|---|
| 55 / 45 | 1056px | 864px | Headshots, portraits, product photos with heading + body |
| 50 / 50 | 960px | 960px | Equal emphasis — scene photo with longer text |
| 40 / 60 | 768px | 1152px | Text-heavy — small image with detailed description |
| 65 / 35 | 1248px | 672px | Image-dominant — large visual with short caption only |

**Implementation pattern:**

```css
/* Image zone — fixed height, top of card */
.image-zone {
  position: relative;
  width: 100%;
  height: 1056px;        /* 55% of 1920 */
  overflow: hidden;
  flex-shrink: 0;
}
.image-zone img {
  width: 100%;
  height: 100%;
  object-fit: cover;     /* crops to fill — no distortion */
  display: block;
}

/* Text zone — fills remaining space */
.text-zone {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
  padding: 0 96px 140px 96px;
}
```

**Gradient fade between zones:** Use a gradient overlay at the bottom of the image zone to create a seamless transition into the background color. This eliminates the hard edge where photo meets solid color.

```css
.image-zone::after {
  content: '';
  position: absolute;
  bottom: 0;
  left: 0;
  right: 0;
  height: 280px;
  background: linear-gradient(to bottom, transparent 0%, {{bg}} 100%);
  pointer-events: none;
}
```

The gradient uses `{{bg}}` so it automatically matches whatever background color the slide uses — no hardcoded values needed.

**When to use split vs. full-bleed overlay:**

| Approach | Use when | Example |
|---|---|---|
| **Split layout** (image zone + text zone) | The image IS the content — a person, product, or scene the viewer should see clearly | Team intros, product cards, testimonials with portraits |
| **Full-bleed overlay** (image behind text with dark overlay) | The image is atmosphere — mood, texture, context | Insight cards, quote cards, title slides |

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

### Z-index stacking conventions

Templates with images, overlays, and layered content need a consistent z-index strategy. Use this standard stacking order so every template layers elements predictably:

| z-index | Layer | What goes here |
|---|---|---|
| 0 | **Image** | Background image, featured photo, `<img>` elements |
| 1 | **Image overlay** | Dark tint (`::after` on image container), gradient fades |
| 2–3 | **Content** | Text zones, headings, body, eyebrows, rules |
| 2–3 | **Footer** | Attribution, slide counter, bottom bar |
| 10 | **Texture** | Noise overlay, grain, grid — covers everything for unified feel |

**Why z-index 10 for noise?** Leaving a gap (3→10) means you can insert new layers later without renumbering. The noise texture should always be the topmost visual layer (with `pointer-events: none`) so it applies uniformly across image and text zones.

```css
.bg-image    { z-index: 0; }
.bg-overlay  { z-index: 1; }
.content     { position: relative; z-index: 2; }
.footer-bar  { position: absolute; z-index: 2; }
.noise       { position: absolute; inset: 0; z-index: 10; pointer-events: none; }
```

### Designing with image slots

Image slots introduce complexity that text-only templates don't have. Follow these principles:

**Always use `object-fit: cover`** on images inside fixed-size containers. This crops the image to fill the space without distortion. Never use `object-fit: contain` (leaves gaps) or `object-fit: fill` (stretches).

```css
.image-container img {
  width: 100%;
  height: 100%;
  object-fit: cover;
  display: block;
}
```

**Protect text legibility over images.** When text overlaps an image, you need one of:

1. **Solid overlay** — a semi-transparent layer of the `bg` color between image and text:
   ```css
   .bg-image::after {
     content: '';
     position: absolute;
     inset: 0;
     background: {{bg}};
     opacity: 0.72;     /* 0.65–0.80 depending on image brightness */
   }
   ```

2. **Gradient fade** — transitions from image to solid color. Best for split layouts:
   ```css
   .image-zone::after {
     content: '';
     position: absolute;
     bottom: 0; left: 0; right: 0;
     height: 280px;
     background: linear-gradient(to bottom, transparent 0%, {{bg}} 100%);
   }
   ```

3. **Text shadow** — last resort for text directly on images. Heavy and often looks dated:
   ```css
   /* Avoid unless no other option */
   .heading { text-shadow: 0 2px 40px rgba(0,0,0,0.8); }
   ```

**Use `{{bg}}` in overlays, not hardcoded black.** This ensures the overlay tint matches the deck's color identity. A `#0c0b09` overlay on a warm-dark deck feels cohesive; a `#000000` overlay feels generic.

**Make images optional when possible.** Templates should look complete with or without an image. Wrap image-dependent HTML and CSS in `{{#if image}}…{{/if}}`:

```html
{{#if image}}
<div class="bg-image">
  <img src="{{image}}" alt="">
</div>
{{/if}}
```

```css
{{#if image}}
.bg-image { position: absolute; inset: 0; z-index: 0; }
.bg-image img { width: 100%; height: 100%; object-fit: cover; display: block; }
.bg-image::after {
  content: ''; position: absolute; inset: 0;
  background: {{bg}}; opacity: 0.72;
}
{{/if}}
```

When the image is required (e.g. a portrait spotlight card), document this clearly in `_slots` and include guidance on what kinds of images work best.

### Decorative elements that work well

**CSS-only elements:**

```css
/* Thin ruled line */
.rule { width: 60px; height: 2px; background: {{accent}}; }

/* Top accent bar — thin colored stripe at the card edge */
.accent-bar {
  position: absolute;
  top: 0; left: 0; right: 0;
  height: 5px;
  background: {{accent}};
  z-index: 2;
}

/* Corner brackets (no border-radius) */
.corner-tl {
  position: absolute; top: 80px; left: 80px;
  width: 50px; height: 50px;
  border-left: 2px solid currentColor;
  border-top: 2px solid currentColor;
}

/* Noise texture overlay */
.noise {
  position: absolute; inset: 0;
  background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.85' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)' opacity='0.05'/%3E%3C/svg%3E");
  pointer-events: none;
  opacity: 0.25;
  z-index: 10;
}

/* Subtle grid overlay */
.grid-overlay {
  position: absolute; inset: 0;
  background-image:
    linear-gradient(rgba(255,255,255,0.03) 1px, transparent 1px),
    linear-gradient(90deg, rgba(255,255,255,0.03) 1px, transparent 1px);
  background-size: 80px 80px;
  pointer-events: none;
  z-index: 10;
}
```

**Inline SVG elements** (use directly in the HTML `<body>`, not inside `<style>`):

```html
<!-- SVG quotation marks (font-independent) -->
<svg viewBox="0 0 200 160" xmlns="http://www.w3.org/2000/svg"
     style="width:200px; opacity:0.12; position:absolute; top:100px; left:96px;">
  <path d="M20 130 C20 90 45 55 80 30 L70 15 C25 42 0 82 0 130 C0 148 12 160 28 160
           C44 160 55 148 55 132 C55 116 44 104 28 104 C24 104 22 104 20 105 Z"
        fill="currentColor"/>
  <path d="M110 130 C110 90 135 55 170 30 L160 15 C115 42 90 82 90 130 C90 148 102 160 118 160
           C134 160 145 148 145 132 C145 116 134 104 118 104 C114 104 112 104 110 105 Z"
        fill="currentColor"/>
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
  html, body {
    width: 1920px; height: 1080px; overflow: hidden;
    background: {{#if bg}}{{bg}}{{else}}#0f0e0c{{/if}};
  }
  body {
    display: flex; flex-direction: column; justify-content: center;
    padding: 80px 120px;
    font-family: Georgia, 'Times New Roman', serif;
    color: {{#if ink}}{{ink}}{{else}}#f0ece4{{/if}};
    position: relative;
  }
  .label {
    font-family: 'Courier New', monospace;
    font-size: 22px; font-weight: 400;
    letter-spacing: 0.2em; text-transform: uppercase;
    color: {{#if accent}}{{accent}}{{else}}#e8b86d{{/if}};
    margin-bottom: 36px;
  }
  .rule {
    width: 64px; height: 3px;
    background: {{#if accent}}{{accent}}{{else}}#e8b86d{{/if}};
    margin-bottom: 48px;
  }
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
    line-height: 1.6;
    color: {{#if accent}}{{accent}}{{else}}#e8b86d{{/if}};
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
- [ ] Every color slot in CSS uses `{{#if color}}{{color}}{{else}}#fallback{{/if}}` — never bare `{{color}}`
- [ ] Inline CSS fallback values match the slot's `default` in `template.json`
- [ ] `{{slideIndex}}` and `{{totalSlides}}` used for slide counter (optional but recommended)
- [ ] `sample.json` has `_slots` with a description for every slot
- [ ] `sample.json` `slides` array is valid and would pass `slide create`
- [ ] At least 2 slides in the sample showing different content and color combos
- [ ] `bg` and `ink` are the **same** on every slide in `sample.json` — only `accent` varies
- [ ] Images use `object-fit: cover` inside fixed-size containers
- [ ] Image overlays and gradient fades use `{{bg}}` (with inline default), not hardcoded black
- [ ] Z-index follows the convention: image (0) → overlay (1) → content (2–3) → noise (10)
