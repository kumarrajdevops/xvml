<!--
HOW TO PUBLISH ON DEV.TO
─────────────────────────
1. Go to https://dev.to/new
2. Paste the full content of this file (including the frontmatter below)
3. Dev.to auto-populates title, tags, and published state from the frontmatter
4. Add a cover image (1000×420px recommended)
5. Update the playground URL (xvml-lang.dev) with your actual deployed URL
6. Hit "Publish"
-->

---
title: I was tired of writing plan.md and login.html for the same page
published: true
tags: webdev, opensource, cli, ai
cover_image: https://github.com/kumarrajdevops/xvml/raw/main/docs/cover.png
---

Every project I've worked on has the same two files:

**`plan.md`**
```
Login page
- Email field
- Password field (masked)
- Remember me checkbox
- Sign in button (primary)
- "or" divider
- Continue with Google button (secondary)
- Sign up link at the bottom
```

**`login.html`**
```html
<div class="card">
  <h2>Welcome back</h2>
  <label>Email address</label>
  <input type="email" ... />
  <label>Password</label>
  <input type="password" ... />
  <input type="checkbox" /> Remember me
  <button class="btn-primary">Sign in</button>
  ...
</div>
```

Two files. Same information. One human-readable, one machine-readable. Kept in sync manually. Diverged constantly.

I wanted one file that was both.

---

## Meet XVML

**XVML (eXpressive Visual Markup Language)** sits between Markdown and HTML.

As readable as Markdown. As structured as HTML. Compiles to fully self-contained, deterministic HTML — no build toolchain, no CDN links, no external fonts.

The same login page in XVML:

```
@page login
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

Run `xvml render login.xvml` → get `docs/login.html`. A single, self-contained HTML file with all CSS inlined, no dependencies, no CDN.

Same input always produces **byte-identical output** — safe to diff, safe to commit, safe to cache.

---

## The rules are simple

Every command starts with `@`. Blocks open and close with `@end`. That's it.

```
@page <title> [theme]          # document header
@card [label]                  # card container
  @title "text" [size]         # heading
  @subtitle "text" [muted]     # subheading
  @field <type> "label"        # form input
  @button "label" [variant]    # button
  @text "content" [style]      # paragraph
  @divider ["label"]           # separator
  @badge "text" [color]        # pill badge
  @alert "text" [type]         # alert box
  @table / @row / @stat        # data elements
  @progress <value> <max>      # progress bar
  @list / @item                # list
  @cols <n> / @section         # layout
@end
```

No attributes. No closing tags. No class names to remember.

---

## Install

```bash
npm install -g @xvml/cli
```

```bash
xvml render login.xvml      # compile one file → docs/login.html
xvml build                  # render all .xvml files in the project
xvml check "**/*.xvml"      # spec compliance check
xvml watch login.xvml       # re-render on every save
```

---

## The AI part

The part I use daily: describe a page in plain English, get a rendered HTML file.

```bash
export ANTHROPIC_API_KEY=sk-ant-...
xvml ask "incident dashboard with service health and recent alerts"
```

Claude generates the `.xvml` source, the CLI validates it, renders it to HTML, saves both files. Temperature `0` — same prompt always produces the same page.

```
@spec 1
@page "Incident Dashboard" light

@card
  @stat-row
    @stat "Active incidents" "3" negative
    @stat "Services healthy" "47/50" positive
    @stat "MTTR (30d)" "12m" neutral
  @end
@end

@card "Recent incidents"
  @alert "Payment service degraded — investigating" error
  @alert "CDN latency elevated in eu-west-1" warning
  @alert "Database failover completed successfully" success
@end
```

→ `docs/incident-dashboard.html` in under 5 seconds.

---

## GitHub Action

Push a `.xvml` file, get the rendered HTML committed back to `/docs` automatically:

```yaml
on:
  push:
    paths:
      - '**.xvml'
jobs:
  render:
    runs-on: ubuntu-latest
    permissions:
      contents: write
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '24'
      - run: npm install -g @xvml/cli
      - run: xvml build
      - name: Commit changed HTML
        run: |
          git config user.name "xvml-bot"
          git config user.email "xvml-bot@users.noreply.github.com"
          git add docs/
          git diff --cached --quiet || git commit -m "render: update docs" && git push
```

---

## Try it in the browser

[**XVML Playground →**](https://xvml-lang.dev) — paste `.xvml` source, see live render, share via URL.

No install needed.

---

## Links

- **npm:** [`@xvml/cli`](https://npmjs.com/package/@xvml/cli)
- **GitHub:** [kumarrajdevops/xvml](https://github.com/kumarrajdevops/xvml)
- **Spec:** [`XVML_SPEC.md`](https://github.com/kumarrajdevops/xvml/blob/main/XVML_SPEC.md) — every `@command` documented

If you've ever maintained a Markdown spec and an HTML file for the same page — this is for you.
