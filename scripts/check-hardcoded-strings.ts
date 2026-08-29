/**
 * Flags user-visible text rendered directly instead of through t().
 *
 * The app ships English and French. A literal inside <Text> renders the same
 * in both, which is how "Needs/Wants/Savings still English in Edit
 * Transaction" and the untranslated onboarding tour both reached users. The
 * frozen-t() check catches strings that are translated but stuck; this one
 * catches strings that were never translated at all.
 *
 * Only <Text> children are inspected — that is where user-visible copy lives.
 * Symbols, digits, separators and single characters are allowed, since they
 * read identically in every locale.
 *
 * Run: node scripts/check-hardcoded-strings.ts  (or via `npm run check`)
 */
import * as ts from 'typescript';
import { collectSourceFiles, report, type Violation } from './lib/scan.ts';

/**
 * Expo template scaffolding that predates the app's i18n layer. Two of these
 * three are unreachable leftovers; +not-found.tsx is reachable but only via a
 * bad deep link. Allowlisted so the check can hard-fail on new violations in
 * product code today, rather than warning about known ones forever. Tracked as
 * a follow-up in vault/Issues/open-issues.md — delete entries as they are
 * translated or the files removed.
 */
const ALLOWLIST = new Set([
  'app/+not-found.tsx',
  'app/modal.tsx',
  'components/EditScreenInfo.tsx',
]);

/** Locale-independent glyphs: punctuation, digits, currency, arrows, ellipses. */
const LOCALE_NEUTRAL = /^[\s\d\p{P}\p{S}]*$/u;

function isTextElement(name: ts.JsxTagNameExpression): boolean {
  return ts.isIdentifier(name) && (name.text === 'Text' || name.text.endsWith('Text'));
}

/** A child is fine if it routes through t(), even inside a template or ternary. */
function referencesTranslator(node: ts.Node): boolean {
  let found = false;
  const visit = (n: ts.Node): void => {
    if (found) return;
    if (ts.isCallExpression(n) && ts.isIdentifier(n.expression) && n.expression.text === 't') {
      found = true;
      return;
    }
    ts.forEachChild(n, visit);
  };
  visit(node);
  return found;
}

function checkFile(file: ts.SourceFile): Violation[] {
  const found: Violation[] = [];

  const inspectChildren = (
    tagName: ts.JsxTagNameExpression,
    children: ts.NodeArray<ts.JsxChild>,
  ): void => {
    if (!isTextElement(tagName)) return;

    for (const child of children) {
      let literal: string | null = null;

      if (ts.isJsxText(child)) {
        literal = child.text.trim();
      } else if (
        ts.isJsxExpression(child) &&
        child.expression &&
        ts.isStringLiteral(child.expression)
      ) {
        literal = child.expression.text.trim();
      }

      if (!literal) continue;
      if (literal.length < 2) continue;
      if (LOCALE_NEUTRAL.test(literal)) continue;
      if (referencesTranslator(child)) continue;

      const { line } = file.getLineAndCharacterOfPosition(child.getStart(file));
      const preview = literal.length > 40 ? `${literal.slice(0, 40)}…` : literal;
      found.push({
        file: file.fileName,
        line: line + 1,
        message: `hardcoded UI string "${preview}" — route it through t() with a key in constants/i18n.`,
      });
    }
  };

  const visit = (node: ts.Node): void => {
    if (ts.isJsxElement(node)) {
      inspectChildren(node.openingElement.tagName, node.children);
    }
    ts.forEachChild(node, visit);
  };

  visit(file);
  return found;
}

const violations = collectSourceFiles()
  .filter((file) => !ALLOWLIST.has(file.fileName))
  .flatMap(checkFile);
report('hardcoded UI strings', violations, {
  hint: 'Add the key to constants/i18n/en.ts and fr.ts, then render t(key).',
});
