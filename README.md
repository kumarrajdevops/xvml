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

XVML supports reactive pages via `@if`, `@each`, `@bind`, `@var`, and `@data`.
A lightweight JS runtime (~40 lines) is embedded only when dynamic commands are used.

```
@spec 1
@page "Counter" light

@data
{ "count": 0, "name": "Alex" }
@@end

@card "Hello"
  @var name
  @bind name "Your name" text
@end

@card "Visibility"
  @if count
    @alert "count is non-zero" info
  @end
  @if !count
    @alert "count is zero" warning
  @end
@end

@card "List from state"
  @each tag in tags
    @badge tag neutral
  @end
@end
```

| Command | What it does |
|---|---|
| `@data` | Raw JSON block (`@@end`) — sets initial reactive state |
| `@if <var>` | Show block when `state.var` is truthy |
| `@if !<var>` | Show block when `state.var` is falsy |
| `@each item in collection` | Loop template for each item in `state.collection` |
| `@bind <var> "label"` | Two-way input — syncs to state on every keystroke |
| `@var <key>` | Render `state.key` inline, auto-updates |

Control state from the browser console: `xvml.set('count', 5)` · `xvml.state`

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
