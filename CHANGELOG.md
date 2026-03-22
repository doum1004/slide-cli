# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

<!-- New entries are prepended automatically by the publish workflow -->

## v1.0.0 — 2026-03-22

Initial release.

### Templates

- `minimal` — dark typographic card with Fraunces serif (9:16)
- `bold-title` — high-contrast gradient editorial card with Bebas Neue (9:16)
- `quote-card` — elegant pull-quote card with attribution (9:16)
- `minimal-wide` — typographic two-column layout (16:9)
- `bold-title-wide` — gradient editorial card, title left / subtitle right (16:9)
- `quote-card-wide` — pull-quote card, quote left / attribution right (16:9)

### Features

- `slide create` — render slides from a JSON data file + HTML template
- `slide list` — list all available templates with slot schemas
- `slide add-template` — install a custom template directory
- `slide guide` — full template authoring guide (`--json` for LLM-agent output)
- Handlebars templating with `{{#if}}`, `upper`, `lower`, `default`, `add`, `eq` helpers
- Image slots auto-resolved to base64 data URIs (local paths and https:// URLs)
- `--force` flag to skip unresolvable images and render text-only layouts
- Presentation viewer (`index.html`) with keyboard nav, autoplay, and touch support
- Cross-platform build script (`scripts/build.js`) — works on Windows, macOS, Linux

---
