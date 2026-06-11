# vml-agent

A standalone CLI tool that renders `.vml` files into deterministic self-contained HTML. VML is a format between Markdown and HTML — plain text like Markdown, renders as live UI like HTML.

## Rules

- All UI pages must be written as `.vml` files, never raw `.html`
- After creating any `.vml` file, always run: `vml render <file>`
- Output rendered files go to `/docs` folder
- TypeScript only, strict mode, no `any` types
- No external CDN in rendered HTML output
- Rendered HTML must be fully self-contained (CSS + JS inline)
- Deterministic rendering — same `.vml` input always produces identical HTML output
- Temperature `0` on all Claude API calls
