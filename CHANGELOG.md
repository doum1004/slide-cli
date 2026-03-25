# Changelog

All notable changes to this project will be documented in this file.

The format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).
Versions follow [Semantic Versioning](https://semver.org/).

---

<!-- New entries are prepended automatically by the publish workflow -->

## v1.0.8 — 2026-03-25

### Changes

- feat: add support for publishing to GitHub Packages in workflow (3ec482a)
- 1.0.7 (784bb3b)
- chore: bump version to 1.0.6 and update publishConfig registry (8b3753d)
- docs: enhance template guide with color slot usage and fallback recommendations (161dcd1)

**Full diff:** [v1.0.6...v1.0.8](https://github.com/doum1004/slide-cli/compare/v1.0.6...v1.0.8)

---


## v1.0.6 — 2026-03-25

### Changes

- feat: update templates for spotlight and insight with new layouts and fallback colors (75439c5)

**Full diff:** [v1.0.5...v1.0.6](https://github.com/doum1004/slide-cli/compare/v1.0.5...v1.0.6)

---


## v1.0.5 — 2026-03-24

### Changes

- refactor: comment out performance logging in renderSlides and screenshotSlides functions (b833ec5)
- fix: update README examples to use correct sample data paths (0443c46)
- feat: adjust right column width in insight-wide template for improved layout (ca7a2d6)
- feat: add spotlight-wide template with detailed structure and customizable options (0b95664)
- feat: add insight-wide template with structured layout and customizable options (9db4fe5)
- feat: enhance template authoring guide with image and text layout strategies (b789a89)
- fix: update .gitignore to generalize downloaded fonts entry (7024b5b)
- feat: add spotlight card template and configuration for enhanced slide presentations (30baa83)
- feat: add guidelines for consistent background and text colors across slides (2b320b6)
- feat: add insight card template and JSON configuration for carousel decks (85550fc)
- Remove deprecated sample JSON files and templates for bold metric presentations (1d25d80)

**Full diff:** [v1.0.4...v1.0.5](https://github.com/doum1004/slide-cli/compare/v1.0.4...v1.0.5)

---


## v1.0.4 — 2026-03-23

### Changes

- feat: add sample data for bold metric layout showcasing airline baggage incident (f7cd522)
- feat: add hotkey overlay and shortcut button for improved navigation (dd4bf72)
- feat: enhance iframe loading management with loading state and timeout handling (a42eb42)
- refactor: remove font handling logic and associated utilities to simplify rendering process (6a3ab13)
- refactor: remove CJK font-face declarations from templates to streamline code (a1aba39)
- refactor: simplify guide command options by removing JSON output option (8f65b5c)
- feat: update minimal and minimal-wide templates with enhanced descriptions, improved layout, and CJK font support (fd8930c)
- feat: add bold-metric and bold-metric-wide templates with JSON and HTML files for enhanced presentation layouts (5b177cb)
- feat: implement embedded font stripping and optimize HTML rendering for slides (620e669)
- feat: enhance guide path resolution for Bun and Node environments (3019616)
- feat: add manifest.json output for programmatic consumers and update documentation (62111c6)
- feat: add Docker support with Dockerfile and Dockerfile.dev, include .dockerignore (dc5df5e)

**Full diff:** [v1.0.3...v1.0.4](https://github.com/doum1004/slide-cli/compare/v1.0.3...v1.0.4)

---


## v1.0.3 — 2026-03-23

### Changes

- fix: update BUILTIN_TEMPLATES_DIR logic to handle unbundled source fallback (2dbc6aa)

**Full diff:** [v1.0.2...v1.0.3](https://github.com/doum1004/slide-cli/compare/v1.0.2...v1.0.3)

---


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
