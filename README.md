# slide-cli

A Bun/TypeScript CLI to create beautiful 9:16 slide cards from JSON data + HTML templates.

```
slide create        --data data.json --template minimal --out ./output
slide list          [--verbose]
slide add-template  <path>  [--force]
```

---

## Installation

```bash
cd slide-cli
bun install
bun src/index.ts --help   # run directly
bun link                  # or link globally as `slide`
```

> **Requires:** Bun ≥ 1.0 · Chrome or Chromium for screenshot rendering.

---

## Commands

### `slide create`

```bash
slide create --data my-deck.json --template minimal --out ./output
```

| Flag | Default | Description |
|---|---|---|
| `-d, --data <file>` | *(required)* | Path to data JSON |
| `-t, --template <id>` | *(required)* | Template id or name |
| `-o, --out <dir>` | `./output` | Output directory |
| `-f, --format <png\|jpg>` | `jpg` | Screenshot format |
| `--no-images` | off | Skip screenshots (HTML only) |

**Output:**
```
output/
├── slide-1.html   slide-1.jpg
├── slide-2.html   slide-2.jpg
│   …
├── index.html     ← presentation viewer
└── data.json      ← copy of your input
```

### `slide list`
```bash
slide list
slide list --verbose    # full slot schema
```

### `slide add-template`
```bash
slide add-template ./my-template/
slide add-template ./my-template/ --force
```

---

## Data JSON format

```json
{
  "title": "My Presentation",
  "slides": [
    {
      "layout": "minimal",
      "heading": "Less is more",
      "body": "Simplicity is the ultimate sophistication.",
      "label": "Chapter 01",
      "accent": "#c8b89a",
      "bg": "#0f0e0c"
    }
  ]
}
```

---

## Built-in templates

| id | Required slots | Style |
|---|---|---|
| `minimal` | `heading` | Dark typographic, Fraunces serif |
| `bold-title` | `title` | Gradient editorial, Bebas Neue |
| `quote-card` | `quote` | Light serif pull-quote card |

---

## Creating a custom template

```
my-template/
├── template.json    ← manifest + slot definitions
└── template.html   ← Handlebars HTML (1080×1920px)
```

### template.json
```json
{
  "name": "My Template",
  "id": "my-template",
  "version": "1.0.0",
  "description": "Short description",
  "aspectRatio": "9:16",
  "width": 1080,
  "height": 1920,
  "slots": [
    { "id": "headline", "type": "text", "label": "Headline", "required": true },
    { "id": "bg",       "type": "color","label": "Background","required": false, "default": "#fff" }
  ]
}
```

**Slot types:** `text` · `color` · `image` · `number` · `url`

### template.html
```html
<!DOCTYPE html><html>
<head><style>
  html, body { width: 1080px; height: 1920px; background: {{bg}}; }
</style></head>
<body>
  <h1>{{headline}}</h1>
  {{#if subtitle}}<p>{{subtitle}}</p>{{/if}}
  <footer>{{slideIndex}} / {{totalSlides}}</footer>
</body></html>
```

**Always available:** `{{slideIndex}}` · `{{totalSlides}}` · `{{title}}`  
**Helpers:** `{{#if}}` · `{{upper val}}` · `{{lower val}}` · `{{default val "fallback"}}`

---

## Presentation viewer

The generated `index.html` has:
- ← → keys or buttons · Space = autoplay · F = fullscreen
- Home/End · touch/swipe support
- Speed selector · progress bar · dot nav

---

## Template storage

| Path | Purpose |
|---|---|
| `~/.slide-cli/templates/` | User templates (via `add-template`) |
| `<project>/templates/` | Built-in templates |

User templates take priority over built-ins on id collision.
