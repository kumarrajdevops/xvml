import fs from 'fs/promises';
import path from 'path';
import { parse, ParseError } from './parser.js';
import type { XvmlNode, ThemeBlock } from './parser.js';
import { renderChildren, createRenderState, treeUsesDynamic } from './templates.js';
import { BASE_CSS } from './styles.js';
import { XVML_RUNTIME } from './runtime.js';

export interface RenderOptions {
  minify?: boolean;
  noScripts?: boolean;
  rtl?: boolean;
}

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// Prevent </script> in JSON-serialised state from breaking the inline script block.
function escScript(s: string): string {
  return s.replace(/<\//g, '<\\/');
}

function minifyHtml(html: string): string {
  return html
    .replace(/>\s+</g, '><')
    .replace(/[ \t]{2,}/g, ' ')
    .trim();
}

function buildThemeStyles(themes: readonly ThemeBlock[]): string {
  if (themes.length === 0) return '';
  return themes
    .map(t => {
      const vars = Object.entries(t.vars)
        .map(([k, v]) => `  --xvml-${k}:${v};`)
        .join('\n');
      return `:root {\n${vars}\n}`;
    })
    .join('\n');
}

async function resolveImports(
  nodes: XvmlNode[],
  basePath: string,
  chain: Set<string>,
): Promise<XvmlNode[]> {
  const result: XvmlNode[] = [];
  for (const node of nodes) {
    if (node.command === 'import') {
      const pathArg = node.args[0];
      if (pathArg?.type !== 'string') continue;
      const importPath = path.resolve(path.dirname(basePath), pathArg.value);
      if (chain.has(importPath)) {
        throw new ParseError(`Circular import detected: ${importPath}`);
      }
      const source = await fs.readFile(importPath, 'utf-8');
      const importedDoc = parse(source);
      const resolved = await resolveImports(
        importedDoc.body,
        importPath,
        new Set([...chain, importPath]),
      );
      result.push(...resolved);
    } else {
      const resolvedChildren = await resolveImports(node.children, basePath, chain);
      result.push({ ...node, children: resolvedChildren });
    }
  }
  return result;
}

export async function renderSource(
  source: string,
  sourcePath: string,
  options?: RenderOptions,
): Promise<string> {
  const doc = parse(source);

  const flags = new Set(doc.rendererFlags);
  if (options?.minify) flags.add('minify');
  if (options?.noScripts) flags.add('no-scripts');
  if (options?.rtl) flags.add('rtl');

  const body = await resolveImports(doc.body, sourcePath, new Set([path.resolve(sourcePath)]));
  const isDynamic =
    treeUsesDynamic(body) ||
    Object.keys(doc.initialState).length > 0 ||
    doc.persistKey !== null ||
    doc.dataSrc !== null;
  const state = createRenderState(flags, isDynamic);

  const pageTitle = doc.page?.title ?? 'Page';
  // theme: '' means no explicit class → respects prefers-color-scheme via CSS
  const pageTheme = doc.page?.theme ?? '';
  const themeClass = pageTheme && pageTheme !== 'system' ? ` xvml-theme-${esc(pageTheme)}` : '';
  const dir = flags.has('rtl') ? ' dir="rtl"' : '';

  const metaTagsHtml = doc.metaTags
    .map(t => `<meta name="${esc(t.key)}" content="${esc(t.value)}" />`)
    .join('\n');

  const themeStyles = buildThemeStyles(doc.themes);
  const bodyHtml = renderChildren(body, state);

  // Boot order matters: init seeds defaults, persist overlays saved state,
  // load overlays remote state last.
  const bootLines = [`window.xvml.init(${escScript(JSON.stringify(doc.initialState))});`];
  if (doc.persistKey) bootLines.push(`window.xvml.persist(${escScript(JSON.stringify(doc.persistKey))});`);
  if (doc.dataSrc) bootLines.push(`window.xvml.load(${escScript(JSON.stringify(doc.dataSrc))});`);
  const runtimeScript = isDynamic
    ? `<script>${XVML_RUNTIME}\n${bootLines.join('\n')}</script>`
    : '';

  const html = `<!DOCTYPE html>
<html lang="en"${dir}>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(pageTitle)}</title>
${metaTagsHtml}
<style>${BASE_CSS}${themeStyles}</style>
</head>
<body class="xvml-page${themeClass}">
${bodyHtml}
${runtimeScript}
</body>
</html>`;

  return flags.has('minify') ? minifyHtml(html) : html;
}

export async function renderFile(
  xvmlPath: string,
  options?: RenderOptions,
): Promise<string> {
  const source = await fs.readFile(xvmlPath, 'utf-8');
  return renderSource(source, path.resolve(xvmlPath), options);
}

// Output is always docs/<basename>.html — no subdirectory nesting.
export function outputPath(inputPath: string): string {
  const name = path.basename(inputPath, '.xvml');
  return path.join('docs', `${name}.html`);
}
