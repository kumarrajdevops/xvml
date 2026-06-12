import type { Arg, KeyValueArg, XvmlNode } from './parser.js';

export interface RenderState {
  readonly idCounter: { n: number };
  readonly noScripts: boolean;
  readonly rtl: boolean;
  // The @each blocks currently being rendered (innermost last)
  readonly eachStack: Array<{ item: string; collection: string }>;
  // True when the document uses dynamic commands — enables {path} interpolation
  readonly dynamic: boolean;
}

export function createRenderState(flags: ReadonlySet<string>, dynamic = false): RenderState {
  return {
    idCounter: { n: 0 },
    noScripts: flags.has('no-scripts'),
    rtl: flags.has('rtl'),
    eachStack: [],
    dynamic,
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

// Authors link source-to-source (@nav Home=readme.xvml); rendered pages must
// link output-to-output. Local *.xvml hrefs become *.html at render time;
// external URLs pass through untouched.
function hrefOut(href: string): string {
  if (/^https?:\/\//.test(href)) return href;
  return href.replace(/\.xvml$/, '.html');
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

// Inside @each, a bare keyword matching the loop item name (or item.path /
// item__index) becomes a live <span data-xv> placeholder filled per item.
function dynVarSpan(args: readonly Arg[], state: RenderState): string | undefined {
  for (let i = state.eachStack.length - 1; i >= 0; i--) {
    const item = state.eachStack[i].item;
    const kw = args.find((a): a is Extract<Arg, { type: 'keyword' }> =>
      a.type === 'keyword' &&
      (a.value === item || a.value === `${item}__index` || a.value.startsWith(`${item}.`))
    );
    if (kw) return `<span data-xv="${esc(kw.value)}"></span>`;
  }
  return undefined;
}

// In dynamic documents, {path} inside string args becomes a live placeholder:
// "Hello {name}" → Hello <span data-xv="name"></span>
function interp(text: string, state: RenderState): string {
  const escaped = esc(text);
  if (!state.dynamic) return escaped;
  return escaped.replace(/\{([\w.]+)\}/g, (_, p: string) => `<span data-xv="${p}"></span>`);
}

// Label content for text-bearing commands: literal string arg wins,
// otherwise a loop-item keyword renders as a dynamic placeholder.
function labelContent(args: readonly Arg[], state: RenderState): string {
  const str = firstStr(args);
  if (str) return interp(str, state);
  return dynVarSpan(args, state) ?? '';
}

// Map a loop-scoped path to a global state path with {item__index}
// placeholders that the runtime interpolates per item:
//   todo            → todos.{todo__index}
//   member (nested) → teams.{team__index}.members.{member__index}
// Paths that don't reference a loop item pass through unchanged.
function globalStatePath(p: string, state: RenderState, depth = state.eachStack.length): string {
  for (let i = depth - 1; i >= 0; i--) {
    const { item, collection } = state.eachStack[i];
    if (p === item || p.startsWith(`${item}.`)) {
      const suffix = p === item ? '' : p.slice(item.length);
      return `${globalStatePath(collection, state, i)}.{${item}__index}${suffix}`;
    }
  }
  return p;
}

// Collect bind:<attr>=<path> args into a data-xattr attribute string.
// Returns '' when there are no bind: args.
function attrBindStr(node: XvmlNode): string {
  const binds = node.args
    .filter((a): a is KeyValueArg => a.type === 'keyvalue' && a.key.startsWith('bind:'))
    .map(a => `${a.key.slice(5)}:${a.value}`);
  return binds.length > 0 ? ` data-xattr="${esc(binds.join(';'))}"` : '';
}

// bind:<attr>=<path> args become a data-xattr attribute the runtime applies.
// Injected right after the opening tag name of the rendered HTML.
function applyAttrBinds(html: string, node: XvmlNode): string {
  const attr = attrBindStr(node);
  if (!attr) return html;
  return html.replace(/^<([a-z0-9]+)/i, `<$1${attr}`);
}

// True when any node uses a dynamic command, an on:<event> action, or a
// bind:<attr> binding — the renderer embeds the JS runtime when this is true.
const DYNAMIC_COMMANDS = new Set(['if', 'each', 'bind', 'var', 'data']);

export function treeUsesDynamic(nodes: readonly XvmlNode[]): boolean {
  return nodes.some(n =>
    DYNAMIC_COMMANDS.has(n.command) ||
    n.args.some(a => a.type === 'keyvalue' && (a.key.startsWith('on:') || a.key.startsWith('bind:'))) ||
    treeUsesDynamic(n.children));
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
  const html = renderNodeInner(node, state);
  // @checkbox / @select / @bind render wrapper elements; they handle bind: attrs
  // internally (injected on the actual <input>/<select>, not the wrapper).
  if (node.command === 'checkbox' || node.command === 'select' || node.command === 'bind') {
    return html;
  }
  return applyAttrBinds(html, node);
}

function renderNodeInner(node: XvmlNode, state: RenderState): string {
  switch (node.command) {
    case 'card':       return renderCard(node, state);
    case 'section':    return renderSection(node, state);
    case 'cols':       return renderCols(node, state);
    case 'stat-row':   return renderStatRow(node, state);
    case 'stats':      return renderStats(node, state);
    case 'nav':        return renderNav(node);
    case 'avatar':     return renderAvatar(node);
    case 'title':      return renderTitle(node, state);
    case 'subtitle':   return renderSubtitle(node, state);
    case 'text':       return renderText(node, state);
    case 'divider':    return renderDivider(node);
    case 'badge':      return renderBadge(node, state);
    case 'field':      return renderField(node, state);
    case 'button':     return renderButton(node, state);
    case 'checkbox':   return renderCheckbox(node, state);
    case 'select':     return renderSelect(node, state);
    case 'link':       return renderLink(node);
    case 'table':      return renderTable(node);
    case 'stat':       return renderStat(node);
    case 'progress':   return renderProgress(node);
    case 'list':       return renderList(node, state);
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
  const onClickAttr = eventAttr(node, 'click');
  return `<section class="${cls('xvml-card', mod && `xvml-card--${mod}`)}"${onClickAttr}>${labelHtml}<div class="xvml-card__body">${body}</div></section>`;
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
  // Args: keyword items separated by "|", with optional key=value for URLs
  // e.g. @nav Home=readme.html | Projects | Settings=settings.html
  const links = node.args
    .filter(a => a.value !== '|')
    .map(a => {
      if (a.type === 'keyvalue') {
        return `<li><a class="xvml-nav__link" href="${esc(hrefOut(a.value))}">${esc(a.key)}</a></li>`;
      }
      const label = String(a.value);
      return `<li><a class="xvml-nav__link" href="#">${esc(label)}</a></li>`;
    })
    .join('');
  return `<nav class="xvml-nav"><ul class="xvml-nav__links">${links}</ul></nav>`;
}

function renderAvatar(node: XvmlNode): string {
  const initials = firstStr(node.args);
  return `<div class="xvml-avatar">${esc(initials)}</div>`;
}

// ── Content ───────────────────────────────────────────────────────────────────

function renderTitle(node: XvmlNode, state: RenderState): string {
  const size = findKw(node.args, ['xl', 'lg', 'md', 'sm']) ?? 'lg';
  return `<h1 class="xvml-title xvml-title--${size}">${labelContent(node.args, state)}</h1>`;
}

function renderSubtitle(node: XvmlNode, state: RenderState): string {
  const muted = hasKw(node.args, 'muted');
  return `<p class="${cls('xvml-subtitle', muted && 'xvml-subtitle--muted')}">${labelContent(node.args, state)}</p>`;
}

function renderText(node: XvmlNode, state: RenderState): string {
  const mod = findKw(node.args, ['sm', 'muted', 'bold', 'mono', 'error', 'success']);
  return `<p class="${cls('xvml-text', mod && `xvml-text--${mod}`)}">${labelContent(node.args, state)}</p>`;
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

function renderBadge(node: XvmlNode, state: RenderState): string {
  const variant = findKw(node.args, ['neutral', 'success', 'warning', 'error', 'info']) ?? 'neutral';
  const onClickAttr = eventAttr(node, 'click');
  return `<span class="xvml-badge xvml-badge--${variant}"${onClickAttr}>${labelContent(node.args, state)}</span>`;
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

function renderButton(node: XvmlNode, state: RenderState): string {
  const label = firstStr(node.args);
  const variant = findKw(node.args, ['default', 'primary', 'secondary', 'danger', 'ghost', 'link']) ?? 'default';
  const size = findKw(node.args, ['sm', 'md', 'lg']) ?? 'md';
  const full = hasKw(node.args, 'full');
  const disabled = hasKw(node.args, 'disabled');
  const onClickAttr = eventAttr(node, 'click');
  return (
    `<button class="${cls('xvml-button', `xvml-button--${variant}`, size !== 'md' && `xvml-button--${size}`, full && 'xvml-button--full')}" ` +
    `type="button"${disabled ? ' disabled' : ''}${onClickAttr}>${labelContent(node.args, state)}</button>`
  );
}

// JS string-literal-safe key
function jsKey(raw: string): string {
  return raw.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

// JS literal for an action value: true/false/null/numbers pass through,
// a lone {path} stays bare so the runtime interpolates it per loop item,
// everything else becomes a string literal.
function jsLiteral(raw: string): string {
  if (raw === 'true' || raw === 'false' || raw === 'null') return raw;
  if (raw !== '' && !isNaN(Number(raw))) return raw;
  if (/^\{[\w.]+\}$/.test(raw)) return raw;
  return `'${jsKey(raw)}'`;
}

// Action forms shared by on:click / on:change:
//   key=value        → xvml.set('key', value)   (true/false/number parsed, else string)
//   toggle:key       → xvml.set('key', !xvml.get('key'))
//   fn:name          → window.name()
//   push:key=value   → xvml.push('key', value)
//   remove:key:idx   → xvml.removeAt('key', idx)   (idx is usually {item__index})
function actionJs(action: string): string {
  if (action.startsWith('toggle:')) {
    const key = jsKey(action.slice(7));
    return `xvml.set('${key}',!xvml.get('${key}'))`;
  }
  if (action.startsWith('fn:')) {
    const fn = action.slice(3);
    if (!/^[\w$]+$/.test(fn)) return '';
    return `typeof window.${fn}==='function'&&window.${fn}()`;
  }
  if (action.startsWith('push:')) {
    const rest = action.slice(5);
    const eq = rest.indexOf('=');
    if (eq <= 0) return '';
    return `xvml.push('${jsKey(rest.slice(0, eq))}',${jsLiteral(rest.slice(eq + 1))})`;
  }
  if (action.startsWith('remove:')) {
    const rest = action.slice(7);
    const colon = rest.indexOf(':');
    if (colon <= 0) return '';
    return `xvml.removeAt('${jsKey(rest.slice(0, colon))}',${jsLiteral(rest.slice(colon + 1))})`;
  }
  if (action.includes('=')) {
    const eq = action.indexOf('=');
    return `xvml.set('${jsKey(action.slice(0, eq))}',${jsLiteral(action.slice(eq + 1))})`;
  }
  return '';
}

// Render an on<event>="..." attribute from an on:<event>=<action> arg.
function eventAttr(node: XvmlNode, event: 'click' | 'change'): string {
  const action = findKV(node.args, `on:${event}`);
  if (!action) return '';
  const js = actionJs(action);
  return js ? ` on${event}="${esc(js)}"` : '';
}

// on:change on @checkbox/@select: a bare key writes the control's own value
// into state; any other form uses the shared action grammar.
function changeAttr(node: XvmlNode, valueExpr: string): string {
  const action = findKV(node.args, 'on:change');
  if (!action) return '';
  if (/^[\w.]+$/.test(action)) {
    return ` onchange="${esc(`xvml.set('${jsKey(action)}',${valueExpr})`)}"`;
  }
  const js = actionJs(action);
  return js ? ` onchange="${esc(js)}"` : '';
}

function renderCheckbox(node: XvmlNode, state: RenderState): string {
  const label = firstStr(node.args);
  const checked = hasKw(node.args, 'checked');
  const disabled = hasKw(node.args, 'disabled');
  const id = nextId(state, 'checkbox');
  const onChangeAttr = changeAttr(node, 'this.checked');
  // When on:change writes to a bare state key, mirror it as data-xb so the
  // runtime can sync state → checkbox on external state changes (e.g. @persist).
  const changeAction = findKV(node.args, 'on:change');
  const xbAttr = changeAction && /^[\w.]+$/.test(changeAction) ? ` data-xb="${esc(changeAction)}"` : '';
  // bind: attrs target the <input>, not the outer <label> wrapper
  const bindAttr = attrBindStr(node);
  return (
    `<label class="xvml-checkbox" for="${id}">` +
    `<input id="${id}" class="xvml-checkbox__input" type="checkbox"${checked ? ' checked' : ''}${disabled ? ' disabled' : ''}${onChangeAttr}${xbAttr}${bindAttr} />` +
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

  const onChangeAttr = changeAttr(node, 'this.value');
  const bindAttr = attrBindStr(node);
  return (
    `<div class="xvml-select">` +
    `<label class="xvml-select__label" for="${id}">${esc(label)}</label>` +
    `<select id="${id}" class="xvml-select__input"${required ? ' required' : ''}${onChangeAttr}${bindAttr}>${optionsHtml}</select>` +
    `</div>`
  );
}

function renderLink(node: XvmlNode): string {
  const label = nthStr(node.args, 0);
  const href = hrefOut(nthStr(node.args, 1, '#'));
  const blank = hasKw(node.args, 'blank');
  const onClickAttr = eventAttr(node, 'click');
  return `<a class="xvml-link" href="${esc(href)}"${blank ? ' target="_blank" rel="noreferrer"' : ''}${onClickAttr}>${esc(label)}</a>`;
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

function renderList(node: XvmlNode, state: RenderState): string {
  const mod = findKw(node.args, ['ordered', 'unordered', 'check']) ?? 'unordered';
  const tag = mod === 'ordered' ? 'ol' : 'ul';
  const items = node.children
    .filter(c => c.command === 'item')
    .map(c => `<li class="xvml-list__item">${labelContent(c.args, state)}</li>`)
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
  // The parser stores the whole condition as one raw keyword arg:
  // a key, !key, or a comparison like: count > 0, role == "admin"
  const expr = node.args[0]?.type === 'keyword' ? node.args[0].value.trim() : '';
  if (!expr) return '';
  // @else splits the children into two branches; the else branch gets the negated expr
  const elseIdx = node.children.findIndex(c => c.command === 'else');
  const ifChildren = elseIdx === -1 ? node.children : node.children.slice(0, elseIdx);
  const elseChildren = elseIdx === -1 ? [] : node.children.slice(elseIdx + 1);
  // Hidden by default; JS runtime shows/hides based on state
  let html = `<div data-xi="${esc(expr)}" style="display:none">${renderChildren(ifChildren, state)}</div>`;
  if (elseChildren.length > 0) {
    const simple = /^!?[\w.]+$/.test(expr);
    const negated = simple
      ? (expr.startsWith('!') ? expr.slice(1) : `!${expr}`)
      : `!(${expr})`;
    html += `<div data-xi="${esc(negated)}" style="display:none">${renderChildren(elseChildren, state)}</div>`;
  }
  return html;
}

function renderEach(node: XvmlNode, state: RenderState): string {
  // @each <item> in <collection>
  const kws = node.args.filter(a => a.type === 'keyword').map(a => a.value);
  const inIdx = kws.indexOf('in');
  const itemName = inIdx > 0 ? kws[inIdx - 1] : (kws[0] ?? 'item');
  const collection = inIdx >= 0 && kws[inIdx + 1] ? kws[inIdx + 1] : kws[kws.length - 1] ?? '';
  state.eachStack.push({ item: itemName, collection });
  const children = renderChildren(node.children, state);
  state.eachStack.pop();
  return (
    `<div data-xe="${esc(collection)}" data-xei="${esc(itemName)}">` +
    `<template>${children}</template>` +
    `<div data-xec></div>` +
    `</div>`
  );
}

function renderBind(node: XvmlNode, state: RenderState): string {
  // @bind <var> "label" [type] — type: text|email|number|...|checkbox|select
  // select options come from a second string arg: @bind team "Team" select "A | B | C"
  // Inside @each, <var> may be the loop item (or item.path): the input reads
  // the scoped value and writes back to the item's index in the collection.
  const varName = node.args[0]?.type === 'keyword' ? node.args[0].value : '';
  const label = firstStr(node.args);
  const inputType = String(node.args.find(a => a.type === 'keyword' && a.value !== varName)?.value ?? 'text');
  const id = nextId(state, 'bind');
  const key = esc(varName);
  // write path: global, with {item__index} placeholders interpolated per item
  const setKey = jsKey(globalStatePath(varName, state));

  const bindAttr = attrBindStr(node);

  if (inputType === 'checkbox') {
    return (
      `<label class="xvml-checkbox" for="${id}">` +
      `<input id="${id}" class="xvml-checkbox__input" type="checkbox" ` +
      `data-xb="${key}" onchange="${esc(`xvml.set('${setKey}',this.checked)`)}"${bindAttr} />` +
      `<span class="xvml-checkbox__label">${esc(label || varName)}</span>` +
      `</label>`
    );
  }

  if (inputType === 'select') {
    const optionsStr = nthStr(node.args, 1);
    const options = optionsStr.split('|').map(s => s.trim()).filter(Boolean);
    const optionsHtml = options.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('');
    return (
      `<div class="xvml-select">` +
      `<label class="xvml-select__label" for="${id}">${esc(label || varName)}</label>` +
      `<select id="${id}" class="xvml-select__input" ` +
      `data-xb="${key}" onchange="${esc(`xvml.set('${setKey}',this.value)`)}"${bindAttr}>${optionsHtml}</select>` +
      `</div>`
    );
  }

  // number inputs coerce to Number so comparisons in @if work
  const setter = inputType === 'number'
    ? `xvml.set('${setKey}',this.value===''?0:Number(this.value))`
    : `xvml.set('${setKey}',this.value)`;
  return (
    `<div class="xvml-field">` +
    `<label class="xvml-field__label" for="${id}">${esc(label || varName)}</label>` +
    `<input class="xvml-field__input" id="${id}" type="${esc(inputType)}" ` +
    `data-xb="${key}" oninput="${esc(setter)}" value=""${bindAttr} />` +
    `</div>`
  );
}

function renderVar(node: XvmlNode): string {
  const key = node.args[0]?.type === 'keyword' ? node.args[0].value
    : firstStr(node.args);
  if (!key) return '';
  return `<span data-xv="${esc(key)}"></span>`;
}
