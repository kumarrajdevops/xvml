# xvml

A standalone CLI tool that renders `.xvml` files into deterministic self-contained HTML. XVML is a format between Markdown and HTML — plain text like Markdown, renders as live UI like HTML.

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
xvml init                          # scaffold CLAUDE.md + .xvmlrc
xvml render <file.xvml>             # render one file → docs/<name>.html
xvml render <file.xvml> --watch     # re-render on every save
xvml build                         # render all .xvml files in project
xvml check <file|dir>              # spec compliance check, exits 1 on error
xvml ask "<task>" [--out <name>]   # ask Claude to generate + render a page
xvml ask "<task>" --print          # preview generated XVML without saving
xvml ask "<task>" --model <id>     # use a specific Claude model
```

## AI Integration (xvml ask)

`xvml ask` sends the task description to Claude with `XVML_SPEC.md` as system context. Claude returns valid XVML which is parsed, saved to `examples/<slug>.xvml`, then rendered to `docs/<slug>.html`.

Requires `ANTHROPIC_API_KEY` in the environment:
```bash
export ANTHROPIC_API_KEY=sk-ant-...
xvml ask "NOC dashboard with alerts and incident table" --out noc-dashboard
```

## Project Structure

```
src/
  parser.ts     — tokenizer: .xvml source → AST
  templates.ts  — one HTML template function per @command
  renderer.ts   — AST → deterministic self-contained HTML
  styles.ts     — inlined CSS (light/dark/responsive)
  cli.ts        — commander CLI (render/build/check/ask/init)
  agent.ts      — Claude API integration for xvml ask
bin/
  xvml.ts        — CLI entry point (shebang)
examples/       — .xvml source files
docs/           — rendered .html output (committed to repo)
XVML_SPEC.md     — formal specification for all @commands
```

## Key Syntax Notes

- `@codeblock` must be closed with `@@end` (not `@end`) when code inside contains `@end` lines
- `@alert` variant keyword comes BEFORE the message string: `@alert warn "message"`
- `@stat` value (big number) is first string, label is second: `@stat "99%" "Uptime"`
- `@field` type keyword comes before label: `@field email "Email address"`
- `@select` options can be pipe-delimited in a single string: `@select "Team" "A | B | C"`
