import { Anthropic } from '@anthropic-ai/sdk';
import fs from 'fs/promises';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Loaded once per process, cached here.
let cachedSpec: string | null = null;
async function loadSpec(): Promise<string> {
  if (cachedSpec) return cachedSpec;
  // ts-node:  src/agent.ts  → __dirname = .../src/   → ../XVML_SPEC.md = project root
  // compiled: dist/src/agent.js → __dirname = .../dist/src/ → ../../XVML_SPEC.md = dist/ (copied by build)
  const candidates = [
    path.resolve(__dirname, '../XVML_SPEC.md'),
    path.resolve(__dirname, '../../XVML_SPEC.md'),
  ];
  for (const p of candidates) {
    try {
      cachedSpec = await fs.readFile(p, 'utf-8');
      return cachedSpec;
    } catch { /* try next */ }
  }
  throw new Error(
    `XVML_SPEC.md not found. Searched:\n${candidates.join('\n')}\n` +
    'Run "npm run build" to copy XVML_SPEC.md into dist/.',
  );
}

const SYSTEM_PROMPT_PREFIX = `\
You are a XVML page generator. XVML (eXpressive Visual Markup Language) is a plain-text format that renders as live UI.

Below is the complete XVML specification — every command, its arguments, and the HTML it produces.
You must follow it exactly. Output only valid XVML. No markdown fences, no explanation, no prose.

Rules you must never break:
- Every command starts with @ on its own line
- String arguments use double quotes: "value"
- Modifier/keyword arguments are bare words: primary, muted, striped
- Block commands must be closed with @end (or @@end inside @codeblock)
- Do NOT use @if @each @bind @on:click @event @agent — they are reserved and cause parse errors
- Do NOT emit raw HTML — only XVML commands
- Always start the file with @page, optionally preceded by @spec and @meta
- Put content inside @card ... @end blocks
- Use @cols for side-by-side layouts, @layout inline for inline button rows
- Use @stats / @stat-row for metric grids
- Use @table for tabular data (first @row is the header)
- For @alert: variant keyword (info/warn/error/success) comes BEFORE the message string
- For @stat: value (big display number) is the first string, label is the second
- For @field: type keyword (email/password/text/number) comes before the label string
- For @codeblock: close with @@end (not @end) if the code inside contains @end lines

--- XVML_SPEC.md ---
`;

export interface AskOptions {
  model?: string;
  output?: string;
}

export async function askClaude(
  task: string,
  options: AskOptions = {},
): Promise<string> {
  const key = process.env['ANTHROPIC_API_KEY'];
  if (!key) {
    throw new Error(
      'ANTHROPIC_API_KEY is not set.\n' +
      'Export it before running: export ANTHROPIC_API_KEY=sk-ant-...',
    );
  }

  const spec = await loadSpec();
  const system = SYSTEM_PROMPT_PREFIX + spec;

  const client = new Anthropic({ apiKey: key });

  const response = await client.messages.create({
    model: options.model ?? 'claude-sonnet-4-6',
    max_tokens: 4096,
    temperature: 0,
    system,
    messages: [
      {
        role: 'user',
        content: `Generate a XVML page for the following task:\n\n${task}`,
      },
    ],
  });

  const block = response.content[0];
  if (block.type !== 'text') throw new Error('Unexpected non-text response from Claude');

  return block.text.trim();
}

// Derive a safe filename slug from the task description.
export function slugify(task: string): string {
  return task
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'page';
}
