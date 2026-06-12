export { parse, ParseError } from './parser.js';
export type { XvmlNode, ParsedDocument } from './parser.js';
export { BASE_CSS } from './styles.js';
export { renderChildren, createRenderState } from './templates.js';

import { parse } from './parser.js';
import type { ThemeBlock } from './parser.js';
import { renderChildren, createRenderState, treeUsesDynamic } from './templates.js';
import { BASE_CSS } from './styles.js';
import { XVML_RUNTIME } from './runtime.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escScript(s: string): string {
  return s.replace(/<\//g, '<\\/');
}

function buildThemeStyles(themes: readonly ThemeBlock[]): string {
  if (themes.length === 0) return '';
  return themes.map(t => {
    const vars = Object.entries(t.vars).map(([k, v]) => `  --xvml-${k}:${v};`).join('\n');
    return `:root {\n${vars}\n}`;
  }).join('\n');
}

export interface RenderOptions {
  minify?: boolean;
  noScripts?: boolean;
  rtl?: boolean;
}

export function renderSource(source: string, options?: RenderOptions): string {
  const doc = parse(source);

  const flags = new Set(doc.rendererFlags);
  if (options?.noScripts) flags.add('no-scripts');
  if (options?.rtl) flags.add('rtl');

  const isDynamic =
    treeUsesDynamic(doc.body) ||
    Object.keys(doc.initialState).length > 0 ||
    doc.persistKey !== null ||
    doc.dataSrc !== null;
  const state = createRenderState(flags, isDynamic);
  const pageTitle = doc.page?.title ?? 'Page';
  const pageTheme = doc.page?.theme ?? '';
  const themeClass = pageTheme && pageTheme !== 'system' ? ` xvml-theme-${esc(pageTheme)}` : '';
  const dir = flags.has('rtl') ? ' dir="rtl"' : '';

  const metaTagsHtml = doc.metaTags
    .map(t => `<meta name="${esc(t.key)}" content="${esc(t.value)}" />`)
    .join('\n');

  const themeStyles = buildThemeStyles(doc.themes);
  const bodyHtml = renderChildren(doc.body, state);

  // Boot order matters: init seeds defaults, persist overlays saved state,
  // load overlays remote state last.
  const bootLines = [`window.xvml.init(${escScript(JSON.stringify(doc.initialState))});`];
  if (doc.persistKey) bootLines.push(`window.xvml.persist(${escScript(JSON.stringify(doc.persistKey))});`);
  if (doc.dataSrc) bootLines.push(`window.xvml.load(${escScript(JSON.stringify(doc.dataSrc))});`);
  const runtimeScript = isDynamic
    ? `<script>${XVML_RUNTIME}\n${bootLines.join('\n')}</script>`
    : '';

  return `<!DOCTYPE html>
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
}
