import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import { watch as fsWatch } from 'fs';
import path from 'path';
import { createRequire } from 'module';
import fse from 'fs-extra';
import { glob } from 'glob';
import { renderFile, outputPath } from './renderer.js';
import { parse, ParseError } from './parser.js';
import { askClaude, slugify } from './agent.js';

const require = createRequire(import.meta.url);
// dist/src/cli.js → ../../package.json; src/cli.ts via ts-node → ../package.json
let version: string;
try {
  ({ version } = require('../../package.json') as { version: string });
} catch {
  ({ version } = require('../package.json') as { version: string });
}

const XVMLRC_DEFAULT = JSON.stringify(
  { outDir: 'docs', spec: 1 },
  null,
  2,
);

async function findVmlFiles(dir: string): Promise<string[]> {
  const SKIP = new Set(['node_modules', 'docs', 'dist', '.git']);
  const files: string[] = [];
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    if (SKIP.has(entry.name) || entry.name.startsWith('.')) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...await findVmlFiles(full));
    } else if (entry.name.endsWith('.xvml')) {
      files.push(full);
    }
  }
  return files;
}

async function doRender(file: string): Promise<void> {
  const out = outputPath(file);
  const html = await renderFile(file);
  await fse.outputFile(out, html, 'utf-8');
  console.log(`${chalk.green('✓')} ${chalk.dim(file)} → ${chalk.cyan(out)}`);
}

interface CheckResult {
  ok: boolean;
  warnings: string[];
}

async function doCheck(file: string): Promise<CheckResult> {
  const warnings: string[] = [];
  try {
    const source = await fs.readFile(file, 'utf-8');
    const doc = parse(source);

    // Spec-level checks
    if (doc.specVersion === 1 && !source.includes('@spec')) {
      warnings.push('missing @spec directive (defaulting to spec 1)');
    }
    if (!doc.page) {
      warnings.push('missing @page directive');
    }

    if (warnings.length > 0) {
      console.log(`${chalk.yellow('⚠')} ${file}`);
      for (const w of warnings) {
        console.log(`  ${chalk.yellow('warn')} ${w}`);
      }
    } else {
      console.log(`${chalk.green('✓')} ${file}`);
    }
    return { ok: true, warnings };
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`${chalk.red('✕')} ${file}`);
      console.error(`  ${chalk.red('error')} ${err.message}`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('✕')} ${file}`);
      console.error(`  ${chalk.red('error')} ${msg}`);
    }
    return { ok: false, warnings };
  }
}

export function buildCli(): Command {
  const program = new Command();

  program
    .name('xvml')
    .description('Renders .xvml files into deterministic self-contained HTML')
    .version(version);

  // xvml render <file> [--watch]
  program
    .command('render <file>')
    .description('Render a .xvml file to docs/<file>.html')
    .option('-w, --watch', 're-render on file change')
    .action(async (file: string, opts: { watch?: boolean }) => {
      try {
        await doRender(file);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${chalk.red('Error:')} ${msg}`);
        process.exit(1);
      }

      if (opts.watch) {
        console.log(chalk.dim(`Watching ${file} for changes…`));
        let debounce: ReturnType<typeof setTimeout> | null = null;
        fsWatch(file, { persistent: true }, () => {
          if (debounce) clearTimeout(debounce);
          debounce = setTimeout(async () => {
            try {
              await doRender(file);
            } catch (err) {
              const msg = err instanceof Error ? err.message : String(err);
              console.error(`${chalk.red('Error:')} ${msg}`);
            }
          }, 100);
        });
      }
    });

  // xvml check <file|glob...>
  program
    .command('check <patterns...>')
    .description('Check .xvml files for spec compliance')
    .action(async (patterns: string[]) => {
      let passed = 0;
      let warned = 0;
      let failed = 0;

      async function checkFile(f: string): Promise<void> {
        const result = await doCheck(f);
        if (!result.ok) failed++;
        else if (result.warnings.length > 0) { warned++; passed++; }
        else passed++;
      }

      for (const pattern of patterns) {
        const stat = await fs.stat(pattern).catch(() => null);
        if (stat?.isDirectory()) {
          const files = await findVmlFiles(pattern);
          for (const f of files) await checkFile(f);
        } else if (pattern.includes('*') || pattern.includes('{')) {
          // Glob pattern
          const matches = await glob(pattern);
          const files = matches.filter(f => f.endsWith('.xvml'));
          if (files.length === 0) {
            console.log(chalk.yellow(`No .xvml files matched: ${pattern}`));
          }
          for (const f of files) await checkFile(f);
        } else {
          await checkFile(pattern);
        }
      }

      const total = passed + failed;
      if (total === 0) {
        console.log(chalk.yellow('No .xvml files found.'));
        return;
      }

      const summary = [
        `\n${chalk.bold(String(total))} file${total === 1 ? '' : 's'} checked —`,
        `${chalk.green(String(passed))} passed`,
        warned > 0 ? `(${chalk.yellow(String(warned))} with warnings)` : '',
        `${failed > 0 ? chalk.red(String(failed)) : chalk.dim('0')} failed`,
      ].filter(Boolean).join(' ');

      console.log(summary);
      if (failed > 0) process.exit(1);
    });

  // xvml build
  program
    .command('build')
    .description('Render all .xvml files in the project to docs/')
    .action(async () => {
      const cwd = process.cwd();
      const files = await findVmlFiles(cwd);
      if (files.length === 0) {
        console.log(chalk.yellow('No .xvml files found.'));
        return;
      }
      let ok = 0;
      let fail = 0;
      for (const file of files) {
        try {
          await doRender(file);
          ok++;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          console.error(`${chalk.red('✕')} ${file}: ${msg}`);
          fail++;
        }
      }
      console.log(
        `\n${chalk.bold(String(files.length))} file${files.length === 1 ? '' : 's'} built — ` +
        `${chalk.green(String(ok))} ok${fail > 0 ? `, ${chalk.red(String(fail))} failed` : ''}`,
      );
      if (fail > 0) process.exit(1);
    });

  // xvml ask "task description" [--out filename] [--model model-id]
  program
    .command('ask <task>')
    .description('Ask Claude to generate a XVML page, then render it')
    .option('-o, --out <filename>', 'output filename without extension (default: slugified task)')
    .option('-m, --model <model>', 'Claude model ID', 'claude-sonnet-4-6')
    .option('--print', 'print generated XVML to stdout without saving or rendering')
    .action(async (task: string, opts: { out?: string; model: string; print?: boolean }) => {
      const spinner = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏'];
      let spinIdx = 0;
      const spinInterval = setInterval(() => {
        process.stdout.write(`\r${chalk.cyan(spinner[spinIdx++ % spinner.length])} Asking Claude…`);
      }, 80);

      let xvml: string;
      try {
        xvml = await askClaude(task, { model: opts.model });
      } catch (err: unknown) {
        clearInterval(spinInterval);
        process.stdout.write('\r');
        const msg =
          err instanceof Error
            ? err.message
            : typeof err === 'object' && err !== null && 'message' in err
              ? String((err as Record<string, unknown>)['message'])
              : String(err);
        console.error(`${chalk.red('Error:')} ${msg}`);
        process.exit(1);
      }
      clearInterval(spinInterval);
      process.stdout.write('\r');

      if (opts.print) {
        console.log(xvml);
        return;
      }

      // Validate before writing — fail fast with a clear parse error.
      try {
        parse(xvml);
      } catch (err) {
        const msg = err instanceof ParseError ? err.message : String(err);
        console.error(`${chalk.red('Parse error in generated XVML:')} ${msg}`);
        console.error(chalk.dim('Generated XVML:\n') + chalk.dim(xvml));
        process.exit(1);
      }

      const slug = opts.out ?? slugify(task);
      const xvmlPath = path.join('examples', `${slug}.xvml`);

      await fse.outputFile(xvmlPath, xvml, 'utf-8');
      console.log(`${chalk.green('✓')} ${chalk.dim('saved')} ${chalk.cyan(xvmlPath)}`);

      try {
        await doRender(xvmlPath);
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`${chalk.red('Render error:')} ${msg}`);
        process.exit(1);
      }
    });

  // xvml init
  program
    .command('init')
    .description('Create CLAUDE.md and .xvmlrc in the current directory')
    .action(async () => {
      const cwd = process.cwd();

      const xvmlrcPath = path.join(cwd, '.xvmlrc');
      if (await fse.pathExists(xvmlrcPath)) {
        console.log(chalk.yellow('.xvmlrc already exists — skipping'));
      } else {
        await fs.writeFile(xvmlrcPath, XVMLRC_DEFAULT, 'utf-8');
        console.log(`${chalk.green('✓')} Created ${chalk.cyan('.xvmlrc')}`);
      }

      const claudePath = path.join(cwd, 'CLAUDE.md');
      if (await fse.pathExists(claudePath)) {
        console.log(chalk.yellow('CLAUDE.md already exists — skipping'));
      } else {
        const content = [
          '# xvml',
          '',
          '- All UI pages must be written as `.xvml` files, never raw `.html`',
          '- After creating any `.xvml` file, always run: `xvml render <file>`',
          '- Output rendered files go to `/docs` folder',
          '- TypeScript only, strict mode, no `any` types',
          '- No external CDN in rendered HTML output',
          '- Rendered HTML must be fully self-contained (CSS + JS inline)',
          '- Deterministic rendering — same `.xvml` input always produces identical HTML',
          '- Temperature `0` on all Claude API calls',
        ].join('\n');
        await fs.writeFile(claudePath, content, 'utf-8');
        console.log(`${chalk.green('✓')} Created ${chalk.cyan('CLAUDE.md')}`);
      }
    });

  return program;
}

export function runCli(): void {
  buildCli().parseAsync(process.argv).catch((err: unknown) => {
    const msg =
      err instanceof Error
        ? err.message
        : typeof err === 'object' && err !== null && 'message' in err
          ? String((err as Record<string, unknown>)['message'])
          : String(err);
    console.error(`${chalk.red('Error:')} ${msg}`);
    process.exit(1);
  });
}
