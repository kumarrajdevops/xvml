# XVML — Roadmap to v1.0.0

## Milestones

- [x] **1. GitHub Action** — auto-render on push of any `.xvml` file → commit HTML to `/docs`
  - [x] Trigger on `**.xvml` push
  - [x] Run `xvml build` via the published CLI
  - [x] Commit rendered HTML back to `/docs` (sha256-gated to avoid empty commits)
  - [x] Add to `.github/workflows/xvml-render.yml`

- [ ] **2. `xvml check`** — spec compliance command that verifies files against XVML spec constraints
  - [ ] Exit code 1 on any parse or spec error
  - [ ] Support glob patterns: `xvml check src/**/*.xvml`
  - [ ] Print line numbers with errors

- [ ] **3. Web playground** — paste `.xvml`, see live render, shareable links
  - [ ] Domain: xvml-lang.dev
  - [ ] Split-pane editor (source left, HTML preview right)
  - [ ] Shareable links (encode source in URL or short ID)
  - [ ] Deploy on Vercel / Cloudflare Pages

- [ ] **4. Blog post** — "I was tired of writing plan.md and login.html for the same page"
  - [ ] Publish on Dev.to
  - [ ] Cover the problem, the solution, and a live demo
  - [ ] Link to npm, GitHub, and playground

- [ ] **5. `@if`, `@each`, `@bind`** — dynamic layer for reactive pages
  - [ ] `@if <condition>` — conditional rendering
  - [ ] `@each <items>` — loop over data arrays
  - [ ] `@bind <field>` — two-way data binding
  - [ ] Update XVML_SPEC.md with new commands
  - [ ] Update parser + renderer + tests

- [ ] **6. VS Code extension** — syntax highlighting + live preview panel
  - [ ] TextMate grammar for `.xvml` syntax highlighting
  - [ ] Live preview panel (WebView) that re-renders on save
  - [ ] Publish to VS Code Marketplace

- [ ] **7. MCP adapter** — thin wrapper so XVML works as a native Claude CLI tool via MCP
  - [ ] Define MCP tool schema for `render`, `ask`, `check`
  - [ ] Wire up to existing CLI commands
  - [ ] Publish adapter config / instructions
