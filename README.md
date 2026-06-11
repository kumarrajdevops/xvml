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
xvml init              # scaffold CLAUDE.md + .xvmlrc in the current project
xvml render login.xvml  # compile one file → docs/login.html
xvml build             # compile every .xvml file in the project
```

## All commands

| Command | Description |
|---|---|
| `xvml init` | Create `CLAUDE.md` and `.xvmlrc` |
| `xvml render <file.xvml>` | Render one file to `docs/<name>.html` |
| `xvml render <file.xvml> --watch` | Re-render on every save |
| `xvml build` | Render all `.xvml` files in the project |
| `xvml check <file\|dir>` | Spec compliance check, exits 1 on errors |
| `xvml ask "<task>"` | Ask Claude to generate + render a XVML page |

## AI integration

```bash
export ANTHROPIC_API_KEY=sk-ant-...

xvml ask "NOC dashboard with alerts and service health"
xvml ask "user settings page" --out settings
xvml ask "billing page" --model claude-opus-4-8
xvml ask "simple card" --print   # preview without saving
```

Requires an [Anthropic API key](https://console.anthropic.com/settings/keys). Uses `temperature: 0` — same prompt always produces the same XVML.

---

## Example

```
@page login
@card
  @title "Welcome back"
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

`xvml render login.xvml` produces `docs/login.html` — a single, self-contained file with all
styles inlined. Same input always produces byte-identical output.

---

## Why XVML?

| | Markdown | HTML | **XVML** |
|---|---|---|---|
| Human-readable source | ✓ | ✗ | **✓** |
| Renders interactive UI | ✗ | ✓ | **✓** |
| No build toolchain | ✓ | ✓ | **✓** |
| Self-contained output | — | ✗ | **✓** |
| Deterministic | ✓ | — | **✓** |

---

## Spec

See [`XVML_SPEC.md`](./XVML_SPEC.md) for the full language reference — every `@command`,
its arguments, and the HTML it renders to.
