/**
 * Shared plumbing for the scripts/check-*.ts guards: locate the app's own
 * source files, and report violations in a consistent, clickable format.
 */
import * as fs from 'fs';
import * as path from 'path';
import * as ts from 'typescript';

export interface Violation {
  file: string;
  line: number;
  message: string;
}

/** Directories that hold shipped app code. Tests and tooling are excluded. */
const SOURCE_DIRS = ['app', 'components', 'constants', 'db', 'lib', 'store', 'theme'];

const EXCLUDED_SEGMENTS = ['__tests__', '__mocks__', 'node_modules', '.claude'];

// npm scripts always run from the package root, and CI does the same.
export function projectRoot(): string {
  return process.cwd();
}

function walk(dir: string, out: string[]): void {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (EXCLUDED_SEGMENTS.includes(entry.name)) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
    } else if (/\.tsx?$/.test(entry.name) && !/\.d\.ts$/.test(entry.name)) {
      out.push(full);
    }
  }
}

export function sourcePaths(): string[] {
  const root = projectRoot();
  const files: string[] = [];
  for (const dir of SOURCE_DIRS) {
    const full = path.join(root, dir);
    if (fs.existsSync(full)) walk(full, files);
  }
  return files.sort();
}

export function collectSourceFiles(): ts.SourceFile[] {
  const root = projectRoot();
  return sourcePaths().map((file) =>
    ts.createSourceFile(
      path.relative(root, file).replace(/\\/g, '/'),
      fs.readFileSync(file, 'utf8'),
      ts.ScriptTarget.Latest,
      /* setParentNodes */ true,
      file.endsWith('.tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    ),
  );
}

/**
 * Prints results and sets the exit code. `warnOnly` reports without failing,
 * for checks still being tuned against existing code.
 */
export function report(
  label: string,
  violations: Violation[],
  opts: { hint?: string; warnOnly?: boolean } = {},
): void {
  if (violations.length === 0) {
    console.log(`✓ ${label}: clean`);
    return;
  }

  const verb = opts.warnOnly ? 'warning' : 'error';
  console.log(`${opts.warnOnly ? '!' : '✗'} ${label}: ${violations.length} ${verb}(s)`);
  for (const v of violations) {
    console.log(`  ${v.file}:${v.line}  ${v.message}`);
  }
  if (opts.hint) console.log(`  ${opts.hint}`);

  if (!opts.warnOnly) process.exitCode = 1;
}
