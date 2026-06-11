export class ParseError extends Error {
  constructor(message: string, public readonly line?: number) {
    super(line !== undefined ? `Line ${line}: ${message}` : message);
    this.name = 'ParseError';
  }
}

export interface StringArg {
  readonly type: 'string';
  readonly value: string;
}
export interface KeywordArg {
  readonly type: 'keyword';
  readonly value: string;
}
export interface NumberArg {
  readonly type: 'number';
  readonly value: number;
}
export interface KeyValueArg {
  readonly type: 'keyvalue';
  readonly key: string;
  readonly value: string;
}
export type Arg = StringArg | KeywordArg | NumberArg | KeyValueArg;

export interface XvmlNode {
  command: string;
  args: Arg[];
  children: XvmlNode[];
  rawLines: string[];
}

export interface ThemeBlock {
  name: string;
  vars: Record<string, string>;
}

export interface ParsedDocument {
  specVersion: number;
  filePath: string | null;
  metaTags: Array<{ key: string; value: string }>;
  rendererFlags: Set<string>;
  page: { title: string; theme: string } | null;
  themes: ThemeBlock[];
  body: XvmlNode[];
  initialState: Record<string, unknown>;
}

const BLOCK_COMMANDS = new Set([
  'card', 'section', 'cols', 'stat-row', 'stats', 'list', 'table', 'codeblock', 'theme',
  'if', 'each', 'data',
]);

const DOC_DIRECTIVE_COMMANDS = new Set([
  'spec', 'file', 'meta', 'renderer', 'page',
]);

const RESERVED_COMMANDS = new Set([
  'on:click', 'event', 'agent',
]);

const KNOWN_COMMANDS = new Set([
  // layout
  'page', 'card', 'end', 'section', 'layout', 'cols',
  // content
  'title', 'subtitle', 'text', 'divider', 'badge',
  // navigation / presentation
  'nav', 'avatar',
  // form
  'field', 'button', 'checkbox', 'select', 'link',
  // data
  'table', 'row', 'stat', 'stat-row', 'stats', 'progress', 'list', 'item',
  // code
  'codeblock', 'constraint', 'alert',
  // meta
  'spec', 'file', 'meta', 'import', 'theme', 'renderer',
  // dynamic
  'if', 'each', 'bind', 'var', 'data',
]);

// Theme names — keywords that identify themes, not page names
const THEME_KEYWORDS = new Set(['light', 'dark', 'system']);

function parseArgs(argStr: string, lineNum: number): Arg[] {
  const args: Arg[] = [];
  let i = 0;
  while (i < argStr.length) {
    const ch = argStr[i];
    if (ch === ' ' || ch === '\t') { i++; continue; }

    if (ch === '"') {
      // Quoted string
      let j = i + 1;
      while (j < argStr.length && argStr[j] !== '"') j++;
      if (j >= argStr.length) throw new ParseError('Unterminated string argument', lineNum);
      args.push({ type: 'string', value: argStr.slice(i + 1, j) });
      i = j + 1;
    } else {
      // Bare token — may be keyword, number, or key=value / key="value"
      let j = i;
      while (j < argStr.length && argStr[j] !== ' ' && argStr[j] !== '\t' && argStr[j] !== '=') j++;

      if (j < argStr.length && argStr[j] === '=') {
        // key=value or key="value"
        const key = argStr.slice(i, j);
        j++; // skip '='
        if (j < argStr.length && argStr[j] === '"') {
          // key="quoted value"
          let k = j + 1;
          while (k < argStr.length && argStr[k] !== '"') k++;
          if (k >= argStr.length) throw new ParseError(`Unterminated value for key "${key}"`, lineNum);
          args.push({ type: 'keyvalue', key, value: argStr.slice(j + 1, k) });
          i = k + 1;
        } else {
          // key=bare_value
          let k = j;
          while (k < argStr.length && argStr[k] !== ' ' && argStr[k] !== '\t') k++;
          args.push({ type: 'keyvalue', key, value: argStr.slice(j, k) });
          i = k;
        }
      } else {
        const token = argStr.slice(i, j);
        const num = Number(token);
        if (token !== '' && !isNaN(num)) {
          args.push({ type: 'number', value: num });
        } else {
          args.push({ type: 'keyword', value: token });
        }
        i = j;
      }
    }
  }
  return args;
}

function parseThemeVars(rawLines: string[], lineNum: number): Record<string, string> {
  const vars: Record<string, string> = {};
  for (const line of rawLines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    const a = parseArgs(trimmed, lineNum);
    const k = a[0];
    const v = a[1];
    if (k?.type === 'string' && v?.type === 'string') {
      vars[k.value] = v.value;
    }
  }
  return vars;
}

function handleDocDirective(doc: ParsedDocument, cmd: string, args: Arg[]): void {
  switch (cmd) {
    case 'spec': {
      const a = args[0];
      if (a?.type === 'number') doc.specVersion = a.value;
      break;
    }
    case 'file': {
      const a = args[0];
      if (a?.type === 'string') doc.filePath = a.value;
      break;
    }
    case 'meta': {
      const k = args[0];
      const v = args[1];
      if (k?.type === 'string' && v?.type === 'string') {
        doc.metaTags.push({ key: k.value, value: v.value });
      }
      break;
    }
    case 'renderer': {
      for (const a of args) {
        if (a.type === 'keyword') doc.rendererFlags.add(a.value);
      }
      break;
    }
    case 'page': {
      // First arg may be a quoted title OR a bare page-name keyword.
      // Any light/dark/system keyword is the theme; other keywords become the title.
      let title = 'Page';
      let theme = '';

      for (const a of args) {
        if (a.type === 'string') {
          title = a.value;
        } else if (a.type === 'keyword') {
          if (THEME_KEYWORDS.has(a.value)) {
            theme = a.value;
          } else {
            // bare page-name keyword → capitalize
            title = a.value.charAt(0).toUpperCase() + a.value.slice(1);
          }
        }
      }

      doc.page = { title, theme };
      break;
    }
  }
}

export function parse(source: string): ParsedDocument {
  const doc: ParsedDocument = {
    specVersion: 1,
    filePath: null,
    metaTags: [],
    rendererFlags: new Set(),
    page: null,
    themes: [],
    body: [],
    initialState: {},
  };

  const lines = source.split('\n');
  const stack: XvmlNode[] = [];
  let rawMode = false;
  let themeMode = false;
  let dataMode = false;

  for (let idx = 0; idx < lines.length; idx++) {
    const lineNum = idx + 1;
    const raw = lines[idx];
    const trimmed = raw.trim();

    if (trimmed === '') continue;
    if (trimmed.startsWith('@#')) continue;

    if (rawMode) {
      // @@end is the exclusive raw-mode sentinel so literal @end can appear inside codeblocks.
      if (trimmed === '@@end') {
        rawMode = false;
        stack.pop();
      } else {
        stack[stack.length - 1]?.rawLines.push(raw);
      }
      continue;
    }

    if (themeMode) {
      if (trimmed === '@end') {
        themeMode = false;
        const themeNode = stack.pop();
        if (themeNode) {
          const nameArg = themeNode.args[0];
          const name = nameArg?.type === 'string' ? nameArg.value : 'default';
          doc.themes.push({ name, vars: parseThemeVars(themeNode.rawLines, lineNum) });
        }
      } else if (!trimmed.startsWith('@')) {
        stack[stack.length - 1]?.rawLines.push(trimmed);
      }
      continue;
    }

    if (dataMode) {
      if (trimmed === '@@end') {
        dataMode = false;
        const dataNode = stack.pop();
        if (dataNode) {
          try {
            const json = dataNode.rawLines.join('\n');
            if (json.trim()) {
              const parsed = JSON.parse(json) as Record<string, unknown>;
              Object.assign(doc.initialState, parsed);
            }
          } catch {
            throw new ParseError('Invalid JSON in @data block', lineNum);
          }
        }
      } else {
        stack[stack.length - 1]?.rawLines.push(raw);
      }
      continue;
    }

    if (!trimmed.startsWith('@')) continue;

    const spaceIdx = trimmed.indexOf(' ');
    const cmdRaw = spaceIdx === -1 ? trimmed.slice(1) : trimmed.slice(1, spaceIdx);
    const argStr = spaceIdx === -1 ? '' : trimmed.slice(spaceIdx + 1).trim();
    const cmd = cmdRaw.toLowerCase();

    if (cmd === 'end') {
      if (stack.length === 0) throw new ParseError('@end without open block', lineNum);
      stack.pop();
      continue;
    }

    if (RESERVED_COMMANDS.has(cmd)) {
      throw new ParseError(`@${cmd} is reserved for future XVML versions`, lineNum);
    }

    if (!KNOWN_COMMANDS.has(cmd)) {
      throw new ParseError(`Unknown command: @${cmd}`, lineNum);
    }

    const args = parseArgs(argStr, lineNum);

    if (DOC_DIRECTIVE_COMMANDS.has(cmd)) {
      handleDocDirective(doc, cmd, args);
      continue;
    }

    const node: XvmlNode = { command: cmd, args, children: [], rawLines: [] };

    if (stack.length > 0) {
      stack[stack.length - 1].children.push(node);
    } else {
      doc.body.push(node);
    }

    if (BLOCK_COMMANDS.has(cmd)) {
      stack.push(node);
      if (cmd === 'codeblock') rawMode = true;
      if (cmd === 'data') dataMode = true;
      if (cmd === 'theme') themeMode = true;
    }
  }

  if (stack.length > 0) {
    throw new ParseError(`Unclosed block: @${stack[stack.length - 1].command}`);
  }

  return doc;
}
