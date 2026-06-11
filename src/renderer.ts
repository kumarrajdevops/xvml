import fs from 'fs/promises';
import path from 'path';
import { parse, ParseError } from './parser.js';
import type { VmlNode, ThemeBlock } from './parser.js';
import { renderChildren, createRenderState } from './templates.js';
import { BASE_CSS } from './styles.js';

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
        .map(([k, v]) => `  --vml-${k}:${v};`)
        .join('\n');
      return `:root {\n${vars}\n}`;
    })
    .join('\n');
}

async function resolveImports(
  nodes: VmlNode[],
  basePath: string,
  chain: Set<string>,
): Promise<VmlNode[]> {
  const result: VmlNode[] = [];
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
  const state = createRenderState(flags);

  const pageTitle = doc.page?.title ?? 'Page';
  // theme: '' means no explicit class → respects prefers-color-scheme via CSS
  const pageTheme = doc.page?.theme ?? '';
  const themeClass = pageTheme && pageTheme !== 'system' ? ` vml-theme-${esc(pageTheme)}` : '';
  const dir = flags.has('rtl') ? ' dir="rtl"' : '';

  const metaTagsHtml = doc.metaTags
    .map(t => `<meta name="${esc(t.key)}" content="${esc(t.value)}" />`)
    .join('\n');

  const themeStyles = buildThemeStyles(doc.themes);
  const bodyHtml = renderChildren(body, state);

  const html = `<!DOCTYPE html>
<html lang="en"${dir}>
<head>
<meta charset="UTF-8" />
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<title>${esc(pageTitle)}</title>
${metaTagsHtml}
<style>${BASE_CSS}${themeStyles}</style>
</head>
<body class="vml-page${themeClass}">
${bodyHtml}
</body>
</html>`;

  return flags.has('minify') ? minifyHtml(html) : html;
}

export async function renderFile(
  vmlPath: string,
  options?: RenderOptions,
): Promise<string> {
  const source = await fs.readFile(vmlPath, 'utf-8');
  return renderSource(source, path.resolve(vmlPath), options);
}

// Output is always docs/<basename>.html — no subdirectory nesting.
export function outputPath(inputPath: string): string {
  const name = path.basename(inputPath, '.vml');
  return path.join('docs', `${name}.html`);
}
