import { Command } from 'commander';
import chalk from 'chalk';
import fs from 'fs/promises';
import { watch as fsWatch } from 'fs';
import path from 'path';
import fse from 'fs-extra';
import { renderFile, outputPath } from './renderer.js';
import { parse, ParseError } from './parser.js';

const VMLRC_DEFAULT = JSON.stringify(
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
    } else if (entry.name.endsWith('.vml')) {
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

async function doCheck(file: string): Promise<boolean> {
  try {
    const source = await fs.readFile(file, 'utf-8');
    parse(source);
    console.log(`${chalk.green('✓')} ${file}`);
    return true;
  } catch (err) {
    if (err instanceof ParseError) {
      console.error(`${chalk.red('✕')} ${file}: ${chalk.red(err.message)}`);
    } else {
      const msg = err instanceof Error ? err.message : String(err);
      console.error(`${chalk.red('✕')} ${file}: ${msg}`);
    }
    return false;
  }
}

export function buildCli(): Command {
  const program = new Command();

  program
    .name('vml')
    .description('Renders .vml files into deterministic self-contained HTML')
    .version('1.0.0');

  // vml render <file> [--watch]
  program
    .command('render <file>')
    .description('Render a .vml file to docs/<file>.html')
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

  // vml check <file|glob...>
  program
    .command('check <patterns...>')
    .description('Check .vml files for spec compliance')
    .action(async (patterns: string[]) => {
      let passed = 0;
      let failed = 0;
      for (const pattern of patterns) {
        const stat = await fs.stat(pattern).catch(() => null);
        if (stat?.isDirectory()) {
          const files = await findVmlFiles(pattern);
          for (const f of files) {
            (await doCheck(f)) ? passed++ : failed++;
          }
        } else if (pattern.endsWith('.vml')) {
          (await doCheck(pattern)) ? passed++ : failed++;
        }
      }
      const total = passed + failed;
      if (total === 0) {
        console.log(chalk.yellow('No .vml files found.'));
        return;
      }
      console.log(
        `\n${chalk.bold(String(total))} file${total === 1 ? '' : 's'} checked — ` +
        `${chalk.green(String(passed))} passed, ${failed > 0 ? chalk.red(String(failed)) : chalk.dim('0')} failed`,
      );
      if (failed > 0) process.exit(1);
    });

  // vml build
  program
    .command('build')
    .description('Render all .vml files in the project to docs/')
    .action(async () => {
      const cwd = process.cwd();
      const files = await findVmlFiles(cwd);
      if (files.length === 0) {
        console.log(chalk.yellow('No .vml files found.'));
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

  // vml init
  program
    .command('init')
    .description('Create CLAUDE.md and .vmlrc in the current directory')
    .action(async () => {
      const cwd = process.cwd();

      const vmlrcPath = path.join(cwd, '.vmlrc');
      if (await fse.pathExists(vmlrcPath)) {
        console.log(chalk.yellow('.vmlrc already exists — skipping'));
      } else {
        await fs.writeFile(vmlrcPath, VMLRC_DEFAULT, 'utf-8');
        console.log(`${chalk.green('✓')} Created ${chalk.cyan('.vmlrc')}`);
      }

      const claudePath = path.join(cwd, 'CLAUDE.md');
      if (await fse.pathExists(claudePath)) {
        console.log(chalk.yellow('CLAUDE.md already exists — skipping'));
      } else {
        const content = [
          '# vml-agent',
          '',
          '- All UI pages must be written as `.vml` files, never raw `.html`',
          '- After creating any `.vml` file, always run: `vml render <file>`',
          '- Output rendered files go to `/docs` folder',
          '- TypeScript only, strict mode, no `any` types',
          '- No external CDN in rendered HTML output',
          '- Rendered HTML must be fully self-contained (CSS + JS inline)',
          '- Deterministic rendering — same `.vml` input always produces identical HTML',
          '- Temperature `0` on all Claude API calls',
        ].join('\n');
        await fs.writeFile(claudePath, content, 'utf-8');
        console.log(`${chalk.green('✓')} Created ${chalk.cyan('CLAUDE.md')}`);
      }
    });

  return program;
}

export function runCli(): void {
  buildCli().parse(process.argv);
}
