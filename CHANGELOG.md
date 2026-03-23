# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

<!-- New entries are prepended automatically by the publish workflow -->

## v1.0.2 — 2026-03-23

### Changes

- fix: add NODE_AUTH_TOKEN environment variable for npm publish step (821b7aa)
- fix: update version to 1.0.1 and adjust bin path in package.json (07f9fea)
- fix: update permissions for npm publish job and clarify Node setup step (ce6eb16)
- fix: add --provenance flag to npm publish command for improved package integrity (870e1e4)
- fix: update Node setup in publish workflow to specify version and registry URL (c893b3c)
- fix: rename force option to allowMissingImages for clarity and update related logic (3a76df5)
- fix: improve slide rendering logic to skip failed images and avoid unnecessary HTML generation (1c3b62b)
- fix: update start script to use node and set shebang for compatibility (0a80e2c)
- fix: update button labels for clarity and consistency in presenter HTML (bd7a4d4)
- feat: add option to skip image generation in renderSlides function and update Chrome paths for screenshotting (1b9b1fa)
- fix: update navigation button titles and hints for consistency in presenter HTML (a0627f8)
- refactor: streamline path resolution for package root and fonts directory (bdbee93)
- feat: enhance generatePresenter function with improved HTML and image handling, add mode toggle and responsive design features (97a0787)
- feat: extend generatePresenter function to accept width and height parameters for aspect ratio calculation (72fd4e5)
- feat: add Ko-fi funding support and update README with donation badge (3fc9d58)
- feat: add LICENSE and CHANGELOG files, update README with CI and license badges, and enhance package.json metadata (13df5b5)
- update secret name (16e7f58)
- fix: update Handlebars helper for default value handling and correct JSON formatting in bold-title template (8e54d9d)
- feat: add CI and publish workflows, enhance testing setup, and implement template validation (135e3c2)
- feat: update build process and fix binary path in package.json (5425ec5)
- feat: add new templates and enhance existing ones (58d2581)
- feat: add sample JSON files for bold-title and minimal templates, update README and .gitignore (c5cac57)
- feat: enhance create command with auto-generated output directory and slugify function (bdfb1aa)
- docs: update README with additional getting started instructions (1c9368e)
- feat: add new bold-title and minimal templates with corresponding HTML, JSON, and sample data (2d5d509)


---


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
