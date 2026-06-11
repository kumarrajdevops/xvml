import type { Arg, KeyValueArg, VmlNode } from './parser.js';

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
  return `vml-${prefix}-${state.idCounter.n++}`;
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
export function renderChildren(nodes: readonly VmlNode[], state: RenderState): string {
  let html = '';
  let i = 0;
  while (i < nodes.length) {
    const node = nodes[i];
    if (node.command === 'layout') {
      const mode = node.args[0]?.type === 'keyword' ? node.args[0].value : 'stack';
      const inner = nodes.slice(i + 1).map(n => renderNode(n, state)).join('');
      html += `<div class="vml-layout${mode !== 'stack' ? ` vml-layout--${mode}` : ''}">${inner}</div>`;
      break;
    }
    html += renderNode(node, state);
    i++;
  }
  return html;
}

export function renderNode(node: VmlNode, state: RenderState): string {
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

function renderCard(node: VmlNode, state: RenderState): string {
  const label = node.args.find(a => a.type === 'string')?.value ?? '';
  const mod = findKw(node.args, ['flat', 'outlined', 'compact']);
  const labelHtml = label ? `<h2 class="vml-card__label">${esc(label)}</h2>` : '';
  const body = renderChildren(node.children, state);
  return `<section class="${cls('vml-card', mod && `vml-card--${mod}`)}">${labelHtml}<div class="vml-card__body">${body}</div></section>`;
}

function renderSection(node: VmlNode, state: RenderState): string {
  const label = firstStr(node.args);
  const mod = findKw(node.args, ['divided', 'collapsible']);
  const body = renderChildren(node.children, state);
  return (
    `<div class="${cls('vml-section', mod && `vml-section--${mod}`)}">` +
    `<h3 class="vml-section__label">${esc(label)}</h3>` +
    `<div class="vml-section__body">${body}</div>` +
    `</div>`
  );
}

function renderCols(node: VmlNode, state: RenderState): string {
  const count = node.args.find(a => a.type === 'number')?.value ?? 2;
  const wrapped = node.children
    .map(c => `<div class="vml-col">${renderNode(c, state)}</div>`)
    .join('');
  return `<div class="vml-cols vml-cols--${count}">${wrapped}</div>`;
}

function renderStatRow(node: VmlNode, state: RenderState): string {
  return `<div class="vml-stat-row">${node.children.map(c => renderNode(c, state)).join('')}</div>`;
}

function renderStats(node: VmlNode, state: RenderState): string {
  return `<div class="vml-stats">${node.children.map(c => renderNode(c, state)).join('')}</div>`;
}

// ── Navigation / Presentation ─────────────────────────────────────────────────

function renderNav(node: VmlNode): string {
  // Args: keyword items separated by "|" keyword, e.g. Home | Projects | Settings
  const items = node.args
    .filter((a): a is Extract<Arg, { type: 'keyword' }> => a.type === 'keyword' && a.value !== '|')
    .map(a => a.value);
  const links = items
    .map(item => `<li><a class="vml-nav__link" href="#">${esc(item)}</a></li>`)
    .join('');
  return `<nav class="vml-nav"><ul class="vml-nav__links">${links}</ul></nav>`;
}

function renderAvatar(node: VmlNode): string {
  const initials = firstStr(node.args);
  return `<div class="vml-avatar">${esc(initials)}</div>`;
}

// ── Content ───────────────────────────────────────────────────────────────────

function renderTitle(node: VmlNode): string {
  const text = firstStr(node.args);
  const size = findKw(node.args, ['xl', 'lg', 'md', 'sm']) ?? 'lg';
  return `<h1 class="vml-title vml-title--${size}">${esc(text)}</h1>`;
}

function renderSubtitle(node: VmlNode): string {
  const text = firstStr(node.args);
  const muted = hasKw(node.args, 'muted');
  return `<p class="${cls('vml-subtitle', muted && 'vml-subtitle--muted')}">${esc(text)}</p>`;
}

function renderText(node: VmlNode): string {
  const content = firstStr(node.args);
  const mod = findKw(node.args, ['sm', 'muted', 'bold', 'mono', 'error', 'success']);
  return `<p class="${cls('vml-text', mod && `vml-text--${mod}`)}">${esc(content)}</p>`;
}

function renderDivider(node: VmlNode): string {
  const text = node.args.find(a => a.type === 'string')?.value;
  if (text) {
    return (
      `<div class="vml-divider vml-divider--text">` +
      `<span class="vml-divider__line"></span>` +
      `<span class="vml-divider__text">${esc(text)}</span>` +
      `<span class="vml-divider__line"></span>` +
      `</div>`
    );
  }
  const mod = findKw(node.args, ['dashed', 'thick', 'spacious']);
  return `<hr class="${cls('vml-divider', mod && `vml-divider--${mod}`)}" />`;
}

function renderBadge(node: VmlNode): string {
  const label = firstStr(node.args);
  const variant = findKw(node.args, ['neutral', 'success', 'warning', 'error', 'info']) ?? 'neutral';
  return `<span class="vml-badge vml-badge--${variant}">${esc(label)}</span>`;
}

// ── Form ──────────────────────────────────────────────────────────────────────

// Syntax: @field <type-kw> "Label" [required] [secret] [value="..."] [placeholder="..."]
// OR legacy: @field "Label" <type-kw> [modifiers...]
const HTML_INPUT_TYPES = new Set([
  'email', 'password', 'number', 'tel', 'url', 'date', 'textarea', 'search', 'time', 'text',
]);

function renderField(node: VmlNode, state: RenderState): string {
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
    ? `<textarea id="${id}" class="vml-field__textarea"${reqAttr}${disAttr}${phAttr}>${esc(defaultValue)}</textarea>`
    : `<input id="${id}" class="vml-field__input" type="${actualType}"${reqAttr}${disAttr}${phAttr}${valAttr} />`;

  return `<div class="vml-field"><label class="vml-field__label" for="${id}">${esc(label)}</label>${input}</div>`;
}

function renderButton(node: VmlNode): string {
  const label = firstStr(node.args);
  const variant = findKw(node.args, ['default', 'primary', 'secondary', 'danger', 'ghost', 'link']) ?? 'default';
  const size = findKw(node.args, ['sm', 'md', 'lg']) ?? 'md';
  const full = hasKw(node.args, 'full');
  const disabled = hasKw(node.args, 'disabled');
  return (
    `<button class="${cls('vml-button', `vml-button--${variant}`, size !== 'md' && `vml-button--${size}`, full && 'vml-button--full')}" ` +
    `type="button"${disabled ? ' disabled' : ''}>${esc(label)}</button>`
  );
}

function renderCheckbox(node: VmlNode, state: RenderState): string {
  const label = firstStr(node.args);
  const checked = hasKw(node.args, 'checked');
  const disabled = hasKw(node.args, 'disabled');
  const id = nextId(state, 'checkbox');
  return (
    `<label class="vml-checkbox" for="${id}">` +
    `<input id="${id}" class="vml-checkbox__input" type="checkbox"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''} />` +
    `<span class="vml-checkbox__label">${esc(label)}</span>` +
    `</label>`
  );
}

function renderSelect(node: VmlNode, state: RenderState): string {
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
    `<div class="vml-select">` +
    `<label class="vml-select__label" for="${id}">${esc(label)}</label>` +
    `<select id="${id}" class="vml-select__input"${required ? ' required' : ''}>${optionsHtml}</select>` +
    `</div>`
  );
}

function renderLink(node: VmlNode): string {
  const label = nthStr(node.args, 0);
  const href = nthStr(node.args, 1, '#');
  const blank = hasKw(node.args, 'blank');
  return `<a class="vml-link" href="${esc(href)}"${blank ? ' target="_blank" rel="noreferrer"' : ''}>${esc(label)}</a>`;
}

// ── Data ──────────────────────────────────────────────────────────────────────

function renderTable(node: VmlNode): string {
  const mod = findKw(node.args, ['striped', 'compact', 'bordered']);
  const rows = node.children.filter(c => c.command === 'row');
  if (rows.length === 0) {
    return `<div class="vml-table-wrapper"><table class="vml-table"></table></div>`;
  }
  const [header, ...body] = rows;
  const thead = `<thead><tr>${(header?.args ?? []).map(a => `<th>${esc(String(a.value))}</th>`).join('')}</tr></thead>`;
  const tbody = `<tbody>${body.map(r => `<tr>${r.args.map(a => `<td>${esc(String(a.value))}</td>`).join('')}</tr>`).join('')}</tbody>`;
  return `<div class="vml-table-wrapper"><table class="${cls('vml-table', mod && `vml-table--${mod}`)}">${thead}${tbody}</table></div>`;
}

// Syntax: @stat "Value" "Label" [trend-kw]
// Value is displayed large; Label is the descriptor below it.
function renderStat(node: VmlNode): string {
  const value = nthStr(node.args, 0);
  const label = nthStr(node.args, 1);
  const trend = findKw(node.args, ['up', 'down', 'neutral']);
  const trendIcon: Record<string, string> = { up: '↑', down: '↓', neutral: '→' };
  const trendHtml = trend
    ? `<span class="vml-stat__trend vml-stat__trend--${trend}">${trendIcon[trend]}</span>`
    : '';
  return (
    `<div class="vml-stat">` +
    `<span class="vml-stat__value">${esc(value)}${trendHtml}</span>` +
    `<span class="vml-stat__label">${esc(label)}</span>` +
    `</div>`
  );
}

function renderProgress(node: VmlNode): string {
  const label = firstStr(node.args);
  const nums = node.args.filter((a): a is Extract<Arg, { type: 'number' }> => a.type === 'number');
  const value = nums[0]?.value ?? 0;
  const max = nums[1]?.value ?? 100;
  const variant = findKw(node.args, ['default', 'success', 'warning', 'error']);
  const pct = max > 0 ? Math.round((value / max) * 100) : 0;
  const fillClass = cls('vml-progress__fill', variant && variant !== 'default' && `vml-progress__fill--${variant}`);
  return (
    `<div class="vml-progress">` +
    `<div class="vml-progress__header">` +
    `<span class="vml-progress__label">${esc(label)}</span>` +
    `<span class="vml-progress__value">${pct}%</span>` +
    `</div>` +
    `<div class="vml-progress__track"><div class="${fillClass}" style="width:${pct}%"></div></div>` +
    `</div>`
  );
}

function renderList(node: VmlNode): string {
  const mod = findKw(node.args, ['ordered', 'unordered', 'check']) ?? 'unordered';
  const tag = mod === 'ordered' ? 'ol' : 'ul';
  const items = node.children
    .filter(c => c.command === 'item')
    .map(c => `<li class="vml-list__item">${esc(firstStr(c.args))}</li>`)
    .join('');
  return `<${tag} class="vml-list vml-list--${mod}">${items}</${tag}>`;
}

// ── Code ──────────────────────────────────────────────────────────────────────

function renderCodeblock(node: VmlNode): string {
  const lang = findKw(node.args, [
    'ts', 'js', 'json', 'bash', 'html', 'css', 'vml', 'sh',
    'py', 'go', 'rust', 'yaml', 'toml', 'sql', 'md', 'text',
  ]) ?? 'text';
  const filename = node.args.find(a => a.type === 'string')?.value ?? '';
  const code = node.rawLines.join('\n');
  const header = lang !== 'text' || filename
    ? `<div class="vml-codeblock__header">` +
      `<span class="vml-codeblock__lang">${esc(lang)}</span>` +
      (filename ? `<span class="vml-codeblock__filename">${esc(filename)}</span>` : '') +
      `</div>`
    : '';
  return (
    `<div class="vml-codeblock">${header}` +
    `<pre class="vml-codeblock__pre">` +
    `<code class="vml-codeblock__code language-${esc(lang)}">${esc(code)}</code>` +
    `</pre></div>`
  );
}

function renderConstraint(node: VmlNode): string {
  const name = nthStr(node.args, 0);
  const desc = nthStr(node.args, 1);
  const severity = findKw(node.args, ['must', 'should', 'may']) ?? 'must';
  return (
    `<div class="vml-constraint vml-constraint--${severity}">` +
    `<span class="vml-constraint__severity">${severity.toUpperCase()}</span>` +
    `<span class="vml-constraint__name">${esc(name)}</span>` +
    `<p class="vml-constraint__desc">${esc(desc)}</p>` +
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

function renderAlert(node: VmlNode): string {
  const rawVariant = node.args.find(
    a => a.type === 'keyword' && a.value in ALERT_VARIANT_MAP
  )?.value ?? 'info';
  const variant = ALERT_VARIANT_MAP[rawVariant] ?? 'info';
  const message = firstStr(node.args);
  const icon = ALERT_ICONS[variant] ?? 'ℹ';
  return (
    `<div class="vml-alert vml-alert--${variant}" role="alert">` +
    `<span class="vml-alert__icon">${icon}</span>` +
    `<span class="vml-alert__message">${esc(message)}</span>` +
    `</div>`
  );
}
