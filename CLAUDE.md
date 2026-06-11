# xvml

A standalone CLI tool that renders `.xvml` files into deterministic self-contained HTML. XVML is a format between Markdown and HTML — plain text like Markdown, renders as live UI like HTML. Supports both static and reactive/dynamic pages.

## Rules

- All UI pages must be written as `.xvml` files, never raw `.html`
- After creating any `.xvml` file, always run: `xvml render <file>`
- Output rendered files go to `/docs` folder
- TypeScript only, strict mode, no `any` types
- No external CDN in rendered HTML output
- Rendered HTML must be fully self-contained (CSS + JS inline)
- Deterministic rendering — same `.xvml` input always produces identical HTML output
- Temperature `0` on all Claude API calls

## CLI Commands

```bash
xvml init                              # scaffold CLAUDE.md + .xvmlrc
xvml render <file.xvml>               # render one file → docs/<name>.html
xvml render <file.xvml> --watch       # re-render on every save
xvml build                            # render all .xvml files in project
xvml check <file|dir|glob>            # spec compliance check, exits 1 on error
xvml ask "<task>" [--out <name>]      # ask Claude to generate + render a page
xvml ask "<task>" --print             # preview generated XVML without saving
xvml ask "<task>" --model <id>        # use a specific Claude model
```

## AI Integration (xvml ask)

`xvml ask` sends the task description to Claude with `XVML_SPEC.md` as system context. Claude returns valid XVML which is parsed, saved to `examples/<slug>.xvml`, then rendered to `docs/<slug>.html`.

Requires `ANTHROPIC_API_KEY` in the environment:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
xvml ask "Incident dashboard with alerts and incident table" --out incident-dashboard
```

## Dynamic Commands

When using `@if`, `@each`, `@bind`, `@var`, or `@data` — a small reactive JS runtime is embedded in the output automatically.

```
@data
{ "name": "Alex", "items": ["a", "b"], "user": { "active": true } }
@@end

@if loggedIn
  @text "Welcome back"
  @button "Sign out" on:click=loggedIn=false
@else
  @button "Sign in" primary on:click=loggedIn=true
@end

@each item in items
  @badge item neutral
@end

@bind name "Your name" text
@var name
@var user.active
```

- State keys support dot paths everywhere: `@if user.active`, `@var user.role`
- `@button` actions: `on:click=key=value`, `on:click=toggle:key`, `on:click=fn:windowFn`
- Control state from browser console: `xvml.set('key', value)` · `xvml.get('key')` · `xvml.state`

## Project Structure

```
src/
  parser.ts     — tokenizer: .xvml source → AST (XvmlNode)
  templates.ts  — one HTML template function per @command
  renderer.ts   — AST → deterministic self-contained HTML
  browser.ts    — browser-safe renderSource (no fs/path deps, used by playground)
  styles.ts     — inlined CSS (light/dark/responsive)
  runtime.ts    — reactive JS runtime string (~40 lines, embedded when dynamic commands used)
  cli.ts        — commander CLI (render/build/check/ask/init)
  agent.ts      — Claude API integration for xvml ask
bin/
  xvml.ts        — CLI entry point (shebang)
examples/       — .xvml source files
docs/           — rendered .html output (committed to repo)
packages/
  playground/   — Vite web app: split-pane editor + live preview (xvml-lang.dev)
XVML_SPEC.md    — formal specification for all @commands
TODO.md         — v1.0.0 roadmap with checklist
```

## Key Syntax Notes

- Every command starts with `@`, blocks close with `@end`
- `@codeblock` and `@data` close with `@@end` (raw mode — `@end` can appear inside)
- `@alert` variant keyword comes BEFORE the message: `@alert warning "message"`
- `@stat` value is first string, label is second: `@stat "99%" "Uptime"`
- `@field` type keyword comes before label: `@field email "Email address"`
- `@select` options are pipe-delimited: `@select "Team" "A | B | C"`
- `@if !<var>` negates the condition (show when falsy)
- `@if ... @else ... @end` — two branches, exactly one visible
- `@each item in collection` — `in` keyword separates item name from collection name
