# XVML — Roadmap to v1.0.0

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

- [ ] **6. VS Code extension** — syntax highlighting + live preview panel
  - [ ] TextMate grammar for `.xvml` syntax highlighting
  - [ ] Live preview panel (WebView) that re-renders on save
  - [ ] Publish to VS Code Marketplace

- [ ] **7. MCP adapter** — thin wrapper so XVML works as a native Claude CLI tool via MCP
  - [ ] Define MCP tool schema for `render`, `ask`, `check`
  - [ ] Wire up to existing CLI commands
  - [ ] Publish adapter config / instructions
