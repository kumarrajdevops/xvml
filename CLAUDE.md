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

When using `@if`, `@each`, `@bind`, `@var`, `@data`, `@persist`, or any `on:`/`bind:` attribute — a small reactive JS runtime is embedded in the output automatically.

```
@data
{ "name": "Alex", "count": 0, "items": ["a", "b"], "user": { "active": true } }
@@end
@data src=/state.json        # OR fetch state from a URL at load
@persist "my-app"            # save state to localStorage under this key

@if count > 0
  @text "You have items"     # conditions: key | !key | key OP literal
@else                        # ops: == != > < >= <=  (bad syntax = parse error)
  @text "Empty"
@end

@each item in items
  @badge item neutral
  @var item__index                                 # zero-based loop index
  @bind item "Edit" text                           # edits items.<index> in place
  @button "✕" on:click=remove:items:{item__index}  # per-item action
@end
@button "Add" on:click=push:items=new

@bind name "Your name" text        # also: number (coerces), checkbox, select "A | B"
@text "Hello {name}"               # {path} interpolation in any string arg
@var user.active
```

- State keys support dot paths everywhere: `@if user.active`, `@var user.role`
- Actions (`on:click` on @button/@link/@card/@badge, `on:change` on @checkbox/@select): `key=value`, `toggle:key`, `fn:windowFn`, `push:key=value`, `remove:key:index`; a bare key on `on:change` writes the control's own value
- Attribute binding on any element: `bind:disabled=busy`, `bind:class=modeClass` (boolean toggles presence; class appends)
- Nested `@each` works; inner collections may be item-scoped: `@each member in team.members`
- Control state from browser console: `xvml.set('key', value)` · `xvml.get('key')` · `xvml.push/removeAt` · `xvml.state`

## Project Structure

```
src/
  parser.ts     — tokenizer: .xvml source → AST (XvmlNode)
  templates.ts  — one HTML template function per @command
  renderer.ts   — AST → deterministic self-contained HTML
  browser.ts    — browser-safe renderSource (no fs/path deps, used by playground)
  styles.ts     — inlined CSS (light/dark/responsive)
  runtime.ts    — reactive JS runtime string (~5 KB, embedded when dynamic commands used)
  cli.ts        — commander CLI (render/build/check/ask/init)
  agent.ts      — Claude API integration for xvml ask
bin/
  xvml.ts        — CLI entry point (shebang)
examples/       — .xvml source files
docs/           — rendered .html output (committed to repo)
packages/
  playground/   — Vite web app: split-pane editor + live preview (xvml-lang.dev)
  vscode-xvml/  — VS Code extension: TextMate grammar + live preview WebView
                  (preview-html.ts is the pure/testable part; extension.ts wires vscode APIs;
                   bump version in its package.json before npm run package — same-version
                   vsix reinstalls are silently ignored by VS Code)
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
- `@nav` items are pipe-separated, with optional URLs: `@nav Home=readme.html | Projects | Settings=settings.html`
- `@link "Label" "url" [blank]` — `blank` opens in a new tab (`target="_blank"`)
- `@if !<var>` negates the condition (show when falsy)
- `@if ... @else ... @end` — two branches, exactly one visible
- `@each item in collection` — `in` keyword separates item name from collection name
- Action values can't contain spaces (`push:todos=New task` pushes only "New") — use single-word values
