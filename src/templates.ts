import type { Arg, KeyValueArg, XvmlNode } from './parser.js';

export interface RenderState {
  readonly idCounter: { n: number };
  readonly noScripts: boolean;
  readonly rtl: boolean;
}

export function createRenderState(flags: ReadonlySet<string>): RenderState {
  return {
    idCounter: { n: 0 },
    noScripts: flags.has('no-scripts'),
    rtl: flags.has('rtl'),
  };
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function esc(s: string): string {
  return s
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function cls(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

function nextId(state: RenderState, prefix: string): string {
  return `xvml-${prefix}-${state.idCounter.n++}`;
}

// First string arg
function firstStr(args: readonly Arg[], fallback = ''): string {
  return args.find(a => a.type === 'string')?.value ?? fallback;
}

// Nth string arg (0-indexed among strings only)
function nthStr(args: readonly Arg[], n: number, fallback = ''): string {
  let seen = 0;
  for (const a of args) {
    if (a.type === 'string') {
      if (seen === n) return a.value;
      seen++;
    }
  }
  return fallback;
}

function hasKw(args: readonly Arg[], ...kws: string[]): boolean {
  return args.some(a => a.type === 'keyword' && kws.includes(a.value));
}

function findKw(args: readonly Arg[], options: readonly string[]): string | undefined {
  return args.find((a): a is Extract<Arg, { type: 'keyword' }> =>
    a.type === 'keyword' && options.includes(a.value)
  )?.value;
}

function findKV(args: readonly Arg[], key: string): string | undefined {
  return args.find((a): a is KeyValueArg => a.type === 'keyvalue' && a.key === key)?.value;
}

// ── Render tree ───────────────────────────────────────────────────────────────

// @layout on a line consumes all subsequent siblings in that block.
export function renderChildren(nodes: readonly XvmlNode[], state: RenderState): string {
  let html = '';
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.command === 'layout') {
      const mode = node.args[0]?.type === 'keyword' ? node.args[0].value : 'stack';
      const inner = nodes.slice(i + 1).map(n => renderNode(n, state)).join('');
      html += `<div class="xvml-layout${mode !== 'stack' ? ` xvml-layout--${mode}` : ''}">${inner}</div>`;
      break;
    }
    html += renderNode(node, state);
    i++;
  }
  return html;
}

export function renderNode(node: XvmlNode, state: RenderState): string {
  switch (node.command) {
    case 'card':       return renderCard(node, state);
    case 'section':    return renderSection(node, state);
    case 'cols':       return renderCols(node, state);
    case 'stat-row':   return renderStatRow(node, state);
    case 'stats':      return renderStats(node, state);
    case 'nav':        return renderNav(node);
    case 'avatar':     return renderAvatar(node);
    case 'title':      return renderTitle(node);
    case 'subtitle':   return renderSubtitle(node);
    case 'text':       return renderText(node);
    case 'divider':    return renderDivider(node);
    case 'badge':      return renderBadge(node);
    case 'field':      return renderField(node, state);
    case 'button':     return renderButton(node);
    case 'checkbox':   return renderCheckbox(node, state);
    case 'select':     return renderSelect(node, state);
    case 'link':       return renderLink(node);
    case 'table':      return renderTable(node);
    case 'stat':       return renderStat(node);
    case 'progress':   return renderProgress(node);
    case 'list':       return renderList(node);
    case 'codeblock':  return renderCodeblock(node);
    case 'constraint': return renderConstraint(node);
    case 'alert':      return renderAlert(node);
    case 'if':         return renderIf(node, state);
    case 'each':       return renderEach(node, state);
    case 'bind':       return renderBind(node, state);
    case 'var':        return renderVar(node);
    case 'data':
    case 'import':
    case 'layout':
    case 'row':
    case 'item':
      return '';
    default:
      return '';
  }
}

// ── Layout ────────────────────────────────────────────────────────────────────

function renderCard(node: XvmlNode, state: RenderState): string {
  const label = node.args.find(a => a.type === 'string')?.value ?? '';
  const mod = findKw(node.args, ['flat', 'outlined', 'compact']);
  const labelHtml = label ? `<h2 class="xvml-card__label">${esc(label)}</h2>` : '';
  const body = renderChildren(node.children, state);
  return `<section class="${cls('xvml-card', mod && `xvml-card--${mod}`)}">${labelHtml}<div class="xvml-card__body">${body}</div></section>`;
}

function renderSection(node: XvmlNode, state: RenderState): string {
  const label = firstStr(node.args);
  const mod = findKw(node.args, ['divided', 'collapsible']);
  const body = renderChildren(node.children, state);
  return (
    `<div class="${cls('xvml-section', mod && `xvml-section--${mod}`)}">` +
    `<h3 class="xvml-section__label">${esc(label)}</h3>` +
    `<div class="xvml-section__body">${body}</div>` +
    `</div>`
  );
}

function renderCols(node: XvmlNode, state: RenderState): string {
  const count = node.args.find(a => a.type === 'number')?.value ?? 2;
  const wrapped = node.children
    .map(c => `<div class="xvml-col">${renderNode(c, state)}</div>`)
    .join('');
  return `<div class="xvml-cols xvml-cols--${count}">${wrapped}</div>`;
}

function renderStatRow(node: XvmlNode, state: RenderState): string {
  return `<div class="xvml-stat-row">${node.children.map(c => renderNode(c, state)).join('')}</div>`;
}

function renderStats(node: XvmlNode, state: RenderState): string {
  return `<div class="xvml-stats">${node.children.map(c => renderNode(c, state)).join('')}</div>`;
}

// ── Navigation / Presentation ─────────────────────────────────────────────────

function renderNav(node: XvmlNode): string {
  // Args: keyword items separated by "|" keyword, e.g. Home | Projects | Settings
  const items = node.args
    .filter((a): a is Extract<Arg, { type: 'keyword' }> => a.type === 'keyword' && a.value !== '|')
    .map(a => a.value);
  const links = items
    .map(item => `<li><a class="xvml-nav__link" href="#">${esc(item)}</a></li>`)
    .join('');
  return `<nav class="xvml-nav"><ul class="xvml-nav__links">${links}</ul></nav>`;
}

function renderAvatar(node: XvmlNode): string {
  const initials = firstStr(node.args);
  return `<div class="xvml-avatar">${esc(initials)}</div>`;
}

// ── Content ───────────────────────────────────────────────────────────────────

function renderTitle(node: XvmlNode): string {
  const text = firstStr(node.args);
  const size = findKw(node.args, ['xl', 'lg', 'md', 'sm']) ?? 'lg';
  return `<h1 class="xvml-title xvml-title--${size}">${esc(text)}</h1>`;
}

function renderSubtitle(node: XvmlNode): string {
  const text = firstStr(node.args);
  const muted = hasKw(node.args, 'muted');
  return `<p class="${cls('xvml-subtitle', muted && 'xvml-subtitle--muted')}">${esc(text)}</p>`;
}

function renderText(node: XvmlNode): string {
  const content = firstStr(node.args);
  const mod = findKw(node.args, ['sm', 'muted', 'bold', 'mono', 'error', 'success']);
  return `<p class="${cls('xvml-text', mod && `xvml-text--${mod}`)}">${esc(content)}</p>`;
}

function renderDivider(node: XvmlNode): string {
  const text = node.args.find(a => a.type === 'string')?.value;
  if (text) {
    return (
      `<div class="xvml-divider xvml-divider--text">` +
      `<span class="xvml-divider__line"></span>` +
      `<span class="xvml-divider__text">${esc(text)}</span>` +
      `<span class="xvml-divider__line"></span>` +
      `</div>`
    );
  }
  const mod = findKw(node.args, ['dashed', 'thick', 'spacious']);
  return `<hr class="${cls('xvml-divider', mod && `xvml-divider--${mod}`)}" />`;
}

function renderBadge(node: XvmlNode): string {
  const label = firstStr(node.args);
  const variant = findKw(node.args, ['neutral', 'success', 'warning', 'error', 'info']) ?? 'neutral';
  return `<span class="xvml-badge xvml-badge--${variant}">${esc(label)}</span>`;
}

// ── Form ──────────────────────────────────────────────────────────────────────

// Syntax: @field <type-kw> "Label" [required] [secret] [value="..."] [placeholder="..."]
// OR legacy: @field "Label" <type-kw> [modifiers...]
const HTML_INPUT_TYPES = new Set([
  'email', 'password', 'number', 'tel', 'url', 'date', 'textarea', 'search', 'time', 'text',
]);

function renderField(node: XvmlNode, state: RenderState): string {
  const label = firstStr(node.args);

  // Find type keyword (first keyword that isn't a modifier)
  const MODIFIERS = new Set(['required', 'secret', 'disabled', 'placeholder', 'value']);
  const typeKw = node.args.find(
    (a): a is Extract<Arg, { type: 'keyword' }> =>
      a.type === 'keyword' && !MODIFIERS.has(a.value),
  );
  const rawType = typeKw?.value ?? 'text';
  const htmlType = HTML_INPUT_TYPES.has(rawType) ? rawType : 'text';

  const isSecret = hasKw(node.args, 'secret') || htmlType === 'password';
  const required = hasKw(node.args, 'required');
  const disabled = hasKw(node.args, 'disabled');

  // Named values from key=value args (e.g. value="Kumar S" placeholder="Enter email")
  const defaultValue = findKV(node.args, 'value') ?? '';
  const placeholder = findKV(node.args, 'placeholder') ?? '';

  const actualType = isSecret ? 'password' : htmlType;
  const id = nextId(state, 'field');
  const reqAttr = required ? ' required' : '';
  const disAttr = disabled ? ' disabled' : '';
  const phAttr = placeholder ? ` placeholder="${esc(placeholder)}"` : '';
  const valAttr = defaultValue ? ` value="${esc(defaultValue)}"` : '';

  const input = actualType === 'textarea'
    ? `<textarea id="${id}" class="xvml-field__textarea"${reqAttr}${disAttr}${phAttr}>${esc(defaultValue)}</textarea>`
    : `<input id="${id}" class="xvml-field__input" type="${actualType}"${reqAttr}${disAttr}${phAttr}${valAttr} />`;

  return `<div class="xvml-field"><label class="xvml-field__label" for="${id}">${esc(label)}</label>${input}</div>`;
}

function renderButton(node: XvmlNode): string {
  const label = firstStr(node.args);
  const variant = findKw(node.args, ['default', 'primary', 'secondary', 'danger', 'ghost', 'link']) ?? 'default';
  const size = findKw(node.args, ['sm', 'md', 'lg']) ?? 'md';
  const full = hasKw(node.args, 'full');
  const disabled = hasKw(node.args, 'disabled');
  return (
    `<button class="${cls('xvml-button', `xvml-button--${variant}`, size !== 'md' && `xvml-button--${size}`, full && 'xvml-button--full')}" ` +
    `type="button"${disabled ? ' disabled' : ''}>${esc(label)}</button>`
  );
}

function renderCheckbox(node: XvmlNode, state: RenderState): string {
  const label = firstStr(node.args);
  const checked = hasKw(node.args, 'checked');
  const disabled = hasKw(node.args, 'disabled');
  const id = nextId(state, 'checkbox');
  return (
    `<label class="xvml-checkbox" for="${id}">` +
    `<input id="${id}" class="xvml-checkbox__input" type="checkbox"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''} />` +
    `<span class="xvml-checkbox__label">${esc(label)}</span>` +
    `</label>`
  );
}

function renderSelect(node: XvmlNode, state: RenderState): string {
  const label = nthStr(node.args, 0);
  const required = hasKw(node.args, 'required');
  const id = nextId(state, 'select');

  // Options come from second string arg (pipe-delimited) OR additional string args
  const allStrings = node.args.filter(a => a.type === 'string').map(a => a.value);
  const [, ...rest] = allStrings;
  const options: string[] = rest.length === 1 && rest[0].includes('|')
    ? rest[0].split('|').map(s => s.trim()).filter(Boolean)
    : rest;

  const optionsHtml = options
    .map(o => `<option value="${esc(o.toLowerCase().replace(/\s+/g, '-'))}">${esc(o)}</option>`)
    .join('');

  return (
    `<div class="xvml-select">` +
    `<label class="xvml-select__label" for="${id}">${esc(label)}</label>` +
    `<select id="${id}" class="xvml-select__input"${required ? ' required' : ''}>${optionsHtml}</select>` +
    `</div>`
  );
}

function renderLink(node: XvmlNode): string {
  const label = nthStr(node.args, 0);
  const href = nthStr(node.args, 1, '#');
  const blank = hasKw(node.args, 'blank');
  return `<a class="xvml-link" href="${esc(href)}"${blank ? ' target="_blank" rel="noreferrer"' : ''}>${esc(label)}</a>`;
}

// ── Data ──────────────────────────────────────────────────────────────────────

function renderTable(node: XvmlNode): string {
  const mod = findKw(node.args, ['striped', 'compact', 'bordered']);
  const rows = node.children.filter(c => c.command === 'row');
  if (rows.length === 0) {
    return `<div class="xvml-table-wrapper"><table class="xvml-table"></table></div>`;
  }
  const [header, ...body] = rows;
  const thead = `<thead><tr>${(header?.args ?? []).map(a => `<th>${esc(String(a.value))}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${body.map(r => `<tr>${r.args.map(a => `<td>${esc(String(a.value))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="xvml-table-wrapper"><table class="${cls('xvml-table', mod && `xvml-table--${mod}`)}">${thead}${tbody}</table></div>`;
}

// Syntax: @stat "Value" "Label" [trend-kw]
// Value is displayed large; Label is the descriptor below it.
function renderStat(node: XvmlNode): string {
  const value = nthStr(node.args, 0);
  const label = nthStr(node.args, 1);
  const trend = findKw(node.args, ['up', 'down', 'neutral']);
  const trendIcon: Record<string, string> = { up: '↑', down: '↓', neutral: '→' };
  const trendHtml = trend
    ? `<span class="xvml-stat__trend xvml-stat__trend--${trend}">${trendIcon[trend]}</span>`
    : '';
  return (
    `<div class="xvml-stat">` +
    `<span class="xvml-stat__value">${esc(value)}${trendHtml}</span>` +
    `<span class="xvml-stat__label">${esc(label)}</span>` +
    `</div>`
  );
}

function renderProgress(node: XvmlNode): string {
  const label = firstStr(node.args);
  const nums = node.args.filter((a): a is Extract<Arg, { type: 'number' }> => a.type === 'number');
  const value = nums[0]?.value ?? 0;
  const max = nums[1]?.value ?? 100;
  const variant = findKw(node.args, ['default', 'success', 'warning', 'error']);
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const fillClass = cls('xvml-progress__fill', variant && variant !== 'default' && `xvml-progress__fill--${variant}`);
  return (
    `<div class="xvml-progress">` +
    `<div class="xvml-progress__header">` +
    `<span class="xvml-progress__label">${esc(label)}</span>` +
    `<span class="xvml-progress__value">${pct}%</span>` +
    `</div>` +
    `<div class="xvml-progress__track"><div class="${fillClass}" style="width:${pct}%"></div></div>` +
    `</div>`
  );
}

function renderList(node: XvmlNode): string {
  const mod = findKw(node.args, ['ordered', 'unordered', 'check']) ?? 'unordered';
  const tag = mod === 'ordered' ? 'ol' : 'ul';
  const items = node.children
    .filter(c => c.command === 'item')
    .map(c => `<li class="xvml-list__item">${esc(firstStr(c.args))}</li>`)
    .join('');
  return `<${tag} class="xvml-list xvml-list--${mod}">${items}</${tag}>`;
}

// ── Code ──────────────────────────────────────────────────────────────────────

function renderCodeblock(node: XvmlNode): string {
  const lang = findKw(node.args, [
    'ts', 'js', 'json', 'bash', 'html', 'css', 'xvml', 'sh',
    'py', 'go', 'rust', 'yaml', 'toml', 'sql', 'md', 'text',
  ]) ?? 'text';
  const filename = node.args.find(a => a.type === 'string')?.value ?? '';
  const code = node.rawLines.join('\n');
  const header = lang !== 'text' || filename
    ? `<div class="xvml-codeblock__header">` +
      `<span class="xvml-codeblock__lang">${esc(lang)}</span>` +
      (filename ? `<span class="xvml-codeblock__filename">${esc(filename)}</span>` : '') +
      `</div>`
    : '';
  return (
    `<div class="xvml-codeblock">${header}` +
    `<pre class="xvml-codeblock__pre">` +
    `<code class="xvml-codeblock__code language-${esc(lang)}">${esc(code)}</code>` +
    `</pre></div>`
  );
}

function renderConstraint(node: XvmlNode): string {
  const name = nthStr(node.args, 0);
  const desc = nthStr(node.args, 1);
  const severity = findKw(node.args, ['must', 'should', 'may']) ?? 'must';
  return (
    `<div class="xvml-constraint xvml-constraint--${severity}">` +
    `<span class="xvml-constraint__severity">${severity.toUpperCase()}</span>` +
    `<span class="xvml-constraint__name">${esc(name)}</span>` +
    `<p class="xvml-constraint__desc">${esc(desc)}</p>` +
    `</div>`
  );
}

// Syntax: @alert <variant-kw> "Message"
// Variant keyword comes BEFORE the message string.
const ALERT_VARIANT_MAP: Record<string, string> = {
  info: 'info', success: 'success', ok: 'success',
  warn: 'warning', warning: 'warning',
  error: 'error', err: 'error', danger: 'error',
};
const ALERT_ICONS: Record<string, string> = {
  info: 'ℹ', success: '✓', warning: '⚠', error: '✕',
};

function renderAlert(node: XvmlNode): string {
  const rawVariant = node.args.find(
    a => a.type === 'keyword' && a.value in ALERT_VARIANT_MAP
  )?.value ?? 'info';
  const variant = ALERT_VARIANT_MAP[rawVariant] ?? 'info';
  const message = firstStr(node.args);
  const icon = ALERT_ICONS[variant] ?? 'ℹ';
  return (
    `<div class="xvml-alert xvml-alert--${variant}" role="alert">` +
    `<span class="xvml-alert__icon">${icon}</span>` +
    `<span class="xvml-alert__message">${esc(message)}</span>` +
    `</div>`
  );
}

// ── Dynamic commands ──────────────────────────────────────────────────────────

function renderIf(node: XvmlNode, state: RenderState): string {
  const expr = node.args[0]?.type === 'keyword' ? node.args[0].value : '';
  if (!expr) return '';
  const children = renderChildren(node.children, state);
  // Hidden by default; JS runtime shows/hides based on state
  return `<div data-xi="${esc(expr)}" style="display:none">${children}</div>`;
}

function renderEach(node: XvmlNode, state: RenderState): string {
  // @each <item> in <collection>
  const kws = node.args.filter(a => a.type === 'keyword').map(a => a.value);
  const inIdx = kws.indexOf('in');
  const itemName = inIdx > 0 ? kws[inIdx - 1] : (kws[0] ?? 'item');
  const collection = inIdx >= 0 && kws[inIdx + 1] ? kws[inIdx + 1] : kws[kws.length - 1] ?? '';
  const children = renderChildren(node.children, state);
  return (
    `<div data-xe="${esc(collection)}" data-xei="${esc(itemName)}">` +
    `<template>${children}</template>` +
    `<div data-xec></div>` +
    `</div>`
  );
}

function renderBind(node: XvmlNode, state: RenderState): string {
  // @bind <var> "label" [type]
  const varName = node.args[0]?.type === 'keyword' ? node.args[0].value : '';
  const label = firstStr(node.args);
  const inputType = String(node.args.find(a => a.type === 'keyword' && a.value !== varName)?.value ?? 'text');
  const id = nextId(state, 'bind');
  return (
    `<div class="xvml-field">` +
    `<label class="xvml-field__label" for="${id}">${esc(label || varName)}</label>` +
    `<input class="xvml-field__input" id="${id}" type="${esc(inputType)}" ` +
    `data-xb="${esc(varName)}" oninput="xvml.set('${esc(varName)}',this.value)" value="" />` +
    `</div>`
  );
}

function renderVar(node: XvmlNode): string {
  const key = node.args[0]?.type === 'keyword' ? node.args[0].value
    : firstStr(node.args);
  if (!key) return '';
  return `<span data-xv="${esc(key)}"></span>`;
}
