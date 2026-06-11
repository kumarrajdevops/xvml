export { parse, ParseError } from './parser.js';
export type { XvmlNode, ParsedDocument } from './parser.js';
export { BASE_CSS } from './styles.js';
export { renderChildren, createRenderState } from './templates.js';

import { parse } from './parser.js';
import type { ThemeBlock } from './parser.js';
import { renderChildren, createRenderState } from './templates.js';
import { BASE_CSS } from './styles.js';

function esc(s: string): string {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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

  const state = createRenderState(flags);
  const pageTitle = doc.page?.title ?? 'Page';
  const pageTheme = doc.page?.theme ?? '';
  const themeClass = pageTheme && pageTheme !== 'system' ? ` xvml-theme-${esc(pageTheme)}` : '';
  const dir = flags.has('rtl') ? ' dir="rtl"' : '';

  const metaTagsHtml = doc.metaTags
    .map(t => `<meta name="${esc(t.key)}" content="${esc(t.value)}" />`)
    .join('\n');

  const themeStyles = buildThemeStyles(doc.themes);
  const bodyHtml = renderChildren(doc.body, state);

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
</body>
</html>`;
}
