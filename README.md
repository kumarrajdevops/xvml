# @vml/cli

**VML** (Visual Markup Language) — write plain text, render live UI.

VML sits between Markdown and HTML: as readable as Markdown, as structured as HTML.
The CLI compiles `.vml` files into fully self-contained, deterministic HTML — all CSS inlined,
no CDN links, no external fonts.

---

## Install

```bash
npm install -g @vml/cli
```

## Quick start

```bash
vml init              # scaffold CLAUDE.md + .vmlrc in the current project
vml render login.vml  # compile one file → docs/login.html
vml build             # compile every .vml file in the project
```

## All commands

| Command | Description |
|---|---|
| `vml init` | Create `CLAUDE.md` and `.vmlrc` |
| `vml render <file.vml>` | Render one file to `docs/<name>.html` |
| `vml render <file.vml> --watch` | Re-render on every save |
| `vml build` | Render all `.vml` files in the project |
| `vml check <file\|dir>` | Spec compliance check, exits 1 on errors |

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

`vml render login.vml` produces `docs/login.html` — a single, self-contained file with all
styles inlined. Same input always produces byte-identical output.

---

## Why VML?

| | Markdown | HTML | **VML** |
|---|---|---|---|
| Human-readable source | ✓ | ✗ | **✓** |
| Renders interactive UI | ✗ | ✓ | **✓** |
| No build toolchain | ✓ | ✓ | **✓** |
| Self-contained output | — | ✗ | **✓** |
| Deterministic | ✓ | — | **✓** |

---

## Spec

See [`VML_SPEC.md`](./VML_SPEC.md) for the full language reference — every `@command`,
its arguments, and the HTML it renders to.
