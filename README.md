# Quick Timestamp

Insert the current date and time into your notes with one click, customizable formats, AI conversation stamps, and optional daily-note awareness.

**Problem solved:** Manually typing timestamps breaks flow. Existing plugins either offer only a single format or focus on lists/frontmatter. Quick Timestamp gives you multiple named formats, clean styling, AI-specific stamps, and a daily-note mode so logging stays frictionless.

## Features

- **Multiple named formats** — Define as many formats as you want. Set a default for the ribbon and main command; use the chooser for any other.
- **Prefix, suffix, and markdown styling** — Optionally wrap timestamps in bold or code, and prepend/append text (e.g. `- ` or `**`).
- **AI conversation stamps** — Dedicated commands and a chooser for prefixes like “Grok:”, “Claude:”, “ChatGPT:”, etc. Each prefix can optionally override the format and separator.
- **Daily-note aware insertion** — Opens or creates today’s daily note (requires the core Daily Notes plugin) and inserts under an optional heading.
- Ribbon icon + commands:
  - Insert timestamp (default)
  - Insert timestamp (choose format)
  - Insert timestamp in daily note
  - Insert AI conversation stamp (chooser)
  - Insert AI stamp (default prefix)
  - Support the developer
- Works on desktop and mobile
- Lightweight — no network requests

## Supported format tokens

The formatter uses Moment.js when available (most Obsidian installs include it) and falls back to simple tokens:

| Token  | Meaning              | Example          |
|--------|----------------------|------------------|
| YYYY   | 4-digit year         | 2026             |
| MM     | Month                | 10               |
| DD     | Day                  | 28               |
| HH     | Hour (24h)           | 15               |
| mm     | Minute               | 37               |
| ss     | Second               | 12               |
| locale | System locale string | 10/28/2026, 3:37:12 PM |

Moment.js formats (e.g. `MMMM Do, YYYY`, `h:mm A`) also work.

## Installation

### From Obsidian Community Plugins (once published)

1. Settings → Community plugins → Browse
2. Search for “Quick Timestamp”
3. Install and enable

### Manual installation

1. Download the latest release from GitHub.
2. Copy `main.js`, `manifest.json`, and `styles.css` into your vault under `.obsidian/plugins/quick-timestamp/`.
3. Reload Obsidian and enable the plugin in Community plugins settings.

### Development

This plugin was bootstrapped from the official [obsidian-sample-plugin](https://github.com/obsidianmd/obsidian-sample-plugin).

```bash
npm install
npm run dev
```

Enable the plugin in a development vault and use the Command Palette “Reload app without saving” for rapid iteration.

## Usage

1. Click the clock icon in the ribbon to insert the default timestamp.
2. Use the Command Palette for format choice, daily-note insertion, or AI stamps.
3. Open plugin settings to:
   - Manage named formats and choose a default
   - Set prefix, suffix, and bold/code wrapping
   - Configure daily-note behavior
   - Customize AI prefixes (with optional per-prefix format and separator)
   - Click the Support button

## Support

This plugin is free in the official Obsidian Community directory.

If it helps your workflow, you can support ongoing development:

- GitHub Sponsors: https://github.com/sponsors/bzucker4
- Or use the “Support the developer” command / settings button (opens the funding URL from `manifest.json`)

All current features remain free.

## License

0BSD — see the [LICENSE](LICENSE) file. You are free to use, modify, and redistribute the free version.

## Author

Brian Zucker ([@atlas_relics](https://github.com/atlas_relics))

Built following the official Obsidian plugin toolkit so it can be published to the community directory and used by real people.
