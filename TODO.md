# XVML — Roadmap to v1.0.0

## Status (2026-06-13)

Shipped and live:
- **npm**: `@xvml/cli` v0.1.6 — includes the `.xvml` → `.html` href rewrite, so the
  GitHub Action now renders correct links (this was the cause of the push conflicts)
- **VS Code extension**: v0.1.7 built + installed locally (`packages/vscode-xvml/`) —
  syntax highlighting, live preview, in-preview nav, disk-change refresh
- **Analysis report**: `docs/format-analysis.html` — XVML vs HTML vs Markdown benchmarked
  against real HN / GitHub pages, incl. token utilization (login: 120 tokens XVML vs
  832 HTML vs 14,321 real page)
- 139 tests passing; all docs (README, CLAUDE.md, spec, readme.xvml) in sync

## Next session — pending tasks

- [ ] **Milestone 7: MCP adapter** (last engineering milestone — see below)
- [ ] Publish VS Code extension to Marketplace (`cd packages/vscode-xvml && npm run publish` — steps in its README)
- [ ] Deploy playground on Vercel (`vercel` in `packages/playground/`)
- [ ] Register xvml-lang.dev domain + point DNS
- [ ] Publish blog post on Dev.to (content ready in `docs/blog-devto.md`)

Reminder: bump `version` in `packages/vscode-xvml/package.json` before every
`npm run package` — same-version `.vsix` installs are silently ignored by VS Code.

## Milestones

- [x] **1. GitHub Action** — auto-render on push of any `.xvml` file → commit HTML to `/docs`
  - [x] Trigger on `**.xvml` push
  - [x] Run `xvml build` via the published CLI
  - [x] Commit rendered HTML back to `/docs` (sha256-gated to avoid empty commits)
  - [x] Add to `.github/workflows/xvml-render.yml`

- [x] **2. `xvml check`** — spec compliance command that verifies files against XVML spec constraints
  - [x] Exit code 1 on any parse or spec error
  - [x] Support glob patterns: `xvml check src/**/*.xvml`
  - [x] Print line numbers with errors

- [x] **3. Web playground** — paste `.xvml`, see live render, shareable links
  - [ ] Domain: xvml-lang.dev (register separately)
  - [x] Split-pane editor (source left, HTML preview right)
  - [x] Shareable links (LZ-string URL compression, no backend)
  - [x] 5 built-in examples (login, dashboard, profile, settings, minimal)
  - [x] Open in new tab button
  - [ ] Deploy on Vercel (run `vercel` in `packages/playground/`)

- [x] **4. Blog post** — "I was tired of writing plan.md and login.html for the same page"
  - [x] Written — see `docs/blog-devto.md`
  - [ ] Publish on Dev.to (paste content from docs/blog-devto.md)
  - [x] Covers the problem, solution, live demo, GitHub Action, AI integration
  - [x] Links to npm, GitHub, playground, spec

- [x] **5. `@if`, `@each`, `@bind`** — dynamic layer for reactive pages
  - [x] `@if <var>` / `@if !<var>` — conditional block, shown/hidden by JS state
  - [x] `@each <item> in <collection>` — loop template over state array
  - [x] `@bind <var> "label" [type]` — two-way bound input field
  - [x] `@var <key>` — render current state value inline
  - [x] `@data` — raw JSON block defining initial state
  - [x] Embedded reactive JS runtime (~40 lines) injected only when dynamic commands used
  - [x] Parser + renderer + browser.ts + 7 new tests (63 total passing)

- [x] **5b. Dynamic layer hardening (v0.1.5)**
  - [x] `@if` comparison expressions (`count > 0`, `role == "admin"`); malformed conditions are parse errors, never silent fallback
  - [x] Nested `@each` with item-scoped collections (`@each member in team.members`)
  - [x] `@bind` checkbox / select / number (Number-coerced) types
  - [x] `on:click` on `@link`, `@card`, `@badge`; `on:change` on `@checkbox`, `@select`
  - [x] Per-item loop actions: `item__index`, `push:key=value`, `remove:key:index`, typed `{path}` interpolation in handlers
  - [x] Item-scoped `@bind` — edit array elements in place from inside `@each`
  - [x] Attribute binding: `bind:<attr>=<path>` on any element (incl. `bind:class`, `bind:disabled`)
  - [x] String interpolation: `@text "Hello {name}"`
  - [x] `@persist <key>` (localStorage) and `@data src=<url>` (remote JSON fetch)
  - [x] 38 new tests (124 total passing)

- [x] **6. VS Code extension** — syntax highlighting + live preview panel
  - [x] TextMate grammar for `.xvml` syntax highlighting
  - [x] Live preview panel (WebView) that re-renders on save (debounced 400 ms)
  - [ ] Publish to VS Code Marketplace (run `npm run publish` in `packages/vscode-xvml/`)

- [ ] **7. MCP adapter** — thin wrapper so XVML works as a native Claude CLI tool via MCP
  - [ ] Define MCP tool schema for `render`, `ask`, `check`
  - [ ] Wire up to existing CLI commands
  - [ ] Publish adapter config / instructions
