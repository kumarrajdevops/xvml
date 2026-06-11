export { parse, ParseError } from './parser.js';
export type { XvmlNode, ParsedDocument } from './parser.js';
export { BASE_CSS } from './styles.js';
export { renderChildren, createRenderState } from './templates.js';

import { parse } from './parser.js';
import type { XvmlNode, ThemeBlock } from './parser.js';
import { renderChildren, createRenderState } from './templates.js';
import { BASE_CSS } from './styles.js';
import { XVML_RUNTIME } from './runtime.js';

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

  const DYNAMIC_CMDS = new Set(['if', 'each', 'bind', 'var', 'data']);
  function hasDynamic(nodes: XvmlNode[]): boolean {
    return nodes.some(n => DYNAMIC_CMDS.has(n.command) || hasDynamic(n.children));
  }
  const isDynamic = hasDynamic(doc.body) || Object.keys(doc.initialState).length > 0;
  const runtimeScript = isDynamic
    ? `<script>${XVML_RUNTIME}\nxvml.init(${JSON.stringify(doc.initialState)});</script>`
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
