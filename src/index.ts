// Programmatic API — use this when importing @xvml/cli as a library rather than a CLI tool.
export { renderSource, renderFile, outputPath } from './renderer.js';
export { parse, ParseError } from './parser.js';
export type { XvmlNode, ParsedDocument, Arg, StringArg, KeywordArg, NumberArg, KeyValueArg, ThemeBlock } from './parser.js';
export { askClaude, slugify } from './agent.js';
export type { AskOptions } from './agent.js';
