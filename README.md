# @xvml/cli

**XVML** (eXpressive Visual Markup Language) — write plain text, render live UI.

XVML sits between Markdown and HTML: as readable as Markdown, as structured as HTML.
The CLI compiles `.xvml` files into fully self-contained, deterministic HTML — all CSS inlined,
no CDN links, no external fonts.

---

## Install

```bash
npm install -g @xvml/cli
```

## Quick start

```bash
xvml init                        # scaffold CLAUDE.md + .xvmlrc
xvml render login.xvml           # compile one file → docs/login.html
xvml build                       # compile every .xvml file in the project
xvml check "**/*.xvml"           # spec compliance check
```

## CLI commands

| Command | Description |
|---|---|
| `xvml init` | Create `CLAUDE.md` and `.xvmlrc` |
| `xvml render <file.xvml>` | Render one file to `docs/<name>.html` |
| `xvml render <file.xvml> --watch` | Re-render on every save |
| `xvml build` | Render all `.xvml` files in the project |
| `xvml check <file\|dir\|glob>` | Spec compliance check, exits 1 on errors |
| `xvml ask "<task>"` | Ask Claude to generate + render an XVML page |

## AI integration

```bash
export ANTHROPIC_API_KEY=sk-ant-...

xvml ask "Incident dashboard with alerts and service health"
xvml ask "user settings page" --out settings
xvml ask "billing page" --model claude-opus-4-8
xvml ask "simple card" --print   # preview without saving
```

Requires an [Anthropic API key](https://console.anthropic.com/settings/keys). Uses `temperature: 0` — same prompt always produces the same XVML.

---

## Static example

```
@spec 1
@page login light
@card "Welcome back"
  @subtitle "Sign in to your account"
  @field email "Email address"
  @field password "Password" secret
  @checkbox "Remember me"
  @button "Sign in" primary
  @divider "or"
  @button "Continue with Google" secondary
  @link "Don't have an account? Sign up"
@end
```

`xvml render login.xvml` → `docs/login.html` — single self-contained file, byte-identical every time.

---

## Dynamic pages

XVML supports reactive pages via `@if`, `@each`, `@bind`, `@var`, `@data`, `@persist`,
and `on:`/`bind:` attributes. A tiny JS runtime (~5 KB) is embedded only when dynamic
commands are used.

```
@spec 1
@page "Todos" light
@persist "my-todos"

@data
{ "count": 0, "name": "Alex", "todos": ["Ship it"], "user": { "active": true } }
@@end

@card "Conditions & actions"
  @text "Count: {count}" muted
  @if count > 0
    @badge "positive" success
  @else
    @badge "zero" neutral
  @end
  @button "Set to 10" primary on:click=count=10
  @button "Toggle active" ghost on:click=toggle:user.active
@end

@card "Editable list"
  @each todo in todos
    @bind todo "Todo" text
    @button "✕" sm ghost on:click=remove:todos:{todo__index}
  @end
  @button "Add" secondary on:click=push:todos=New
@end

@card "Two-way binding"
  @bind name "Your name" text
  @text "Hello {name}"
  @button "Members only" primary bind:disabled=!user.active
@end
```

| Feature | Syntax |
|---|---|
| Initial state | `@data` JSON block (`@@end`), or `@data src=/state.json` to fetch at load |
| Persistence | `@persist "key"` — state survives reloads via localStorage |
| Conditions | `@if key` · `@if !key` · `@if count > 0` · `@if role == "admin"` · `@else` |
| Loops | `@each item in items` — nestable, supports item-scoped collections (`team.members`) |
| Two-way inputs | `@bind name "Label" text` — also `number`, `checkbox`, `select "A \| B"` |
| Inline values | `@var key` · `{path}` interpolation in any string arg |
| Click actions | `on:click=key=value` · `toggle:key` · `push:key=value` · `remove:key:{item__index}` · `fn:windowFn` |
| Change actions | `on:change=key` on `@checkbox`/`@select` writes the control's own value |
| Attribute binding | `bind:disabled=!loggedIn`, `bind:class=modeClass` on any element |

State keys support dot paths everywhere (`user.active`). Control state from the browser
console: `xvml.set('key', value)` · `xvml.get('key')` · `xvml.push/removeAt` · `xvml.state`

---

## VS Code extension

Syntax highlighting + live preview for `.xvml` files — see [`packages/vscode-xvml/`](./packages/vscode-xvml/).

- Highlights all `@commands`, strings, `{path}` interpolation, `on:`/`bind:` attributes
- **Open Preview** button renders the file side-by-side, updating as you type
- Nav links (`@nav`, `@link`) navigate between `.xvml` files inside the preview panel
- Preview also refreshes when files change on disk (git, CLI, AI agents)

```bash
cd packages/vscode-xvml
npm install && npm run package
code --install-extension xvml-*.vsix --force
```

---

## Multi-page sites

Link pages **source-to-source** — write `.xvml` hrefs, get `.html` links in the output:

```
@nav Home=readme.xvml | Projects=dashboard.xvml | Settings=settings.xvml

@link "← Back to docs" "dashboard.xvml"
```

The renderer rewrites local `*.xvml` hrefs to `*.html` at render time
(`href="dashboard.html"` in the published page); external `https://` URLs pass through
untouched. In the VS Code preview the links navigate between source files directly —
so you iterate entirely on `.xvml` files and render once when everything looks right,
instead of re-rendering on every edit.

---

## Why XVML?

| | Markdown | HTML | **XVML** |
|---|---|---|---|
| Human-readable source | ✓ | ✗ | **✓** |
| Renders interactive UI | ✗ | ✓ | **✓** |
| No build toolchain | ✓ | ✓ | **✓** |
| Self-contained output | — | ✗ | **✓** |
| Deterministic | ✓ | — | **✓** |
| Reactive / dynamic | ✗ | ✓ | **✓** |

---

## Spec

See [`XVML_SPEC.md`](./XVML_SPEC.md) for the full language reference — every `@command`,
its arguments, and the HTML it renders to.

---

## Links

- **GitHub:** [github.com/kumarrajdevops/xvml](https://github.com/kumarrajdevops/xvml)
- **npm:** [@xvml/cli](https://npmjs.com/package/@xvml/cli)
- **Playground:** [xvml-lang.dev](https://xvml-lang.dev)
- **Issues:** [github.com/kumarrajdevops/xvml/issues](https://github.com/kumarrajdevops/xvml/issues)
