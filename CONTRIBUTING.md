# Contributing to xvml

## Setup

```bash
git clone https://github.com/kumarrajdevops/xvml
cd xvml
npm ci
cp .env.example .env   # add your ANTHROPIC_API_KEY
```

## Development workflow

```bash
# Type-check
npm run check

# Render a XVML file (uses ts-node, no build step needed)
npm run xvml -- render examples/login.xvml

# Render all examples
npm run xvml -- build

# Ask Claude to generate a page
npm run xvml -- ask "your task description"

# Run tests
npm test
```

## Build & verify compiled output

```bash
npm run build
node dist/bin/xvml.js render examples/login.xvml
node dist/bin/xvml.js ask "test page"
```

## Adding a new @command

1. Add command name to `KNOWN_COMMANDS` in `src/parser.ts`
2. If block command (has children), add to `BLOCK_COMMANDS`
3. Add a `render<Command>()` function in `src/templates.ts`
4. Add the case to `renderNode()` switch in `src/templates.ts`
5. Add CSS for new classes in `src/styles.ts`
6. Document in `XVML_SPEC.md`
7. Add an example usage to an `examples/*.xvml` file and re-render

## Rules

- TypeScript strict mode — no `any` types
- All rendered HTML must be self-contained (no CDN, no external fonts)
- Same `.xvml` input must always produce byte-identical HTML
- Temperature `0` on all Claude API calls
