/**
 * Fails the build on `t()` calls evaluated at module load.
 *
 * lib/i18n.ts resolves strings against a module-level `activeLocale` variable
 * rather than a reactive store field. A `t()` call at module scope therefore
 * runs exactly once, when the module is first imported, and freezes whatever
 * locale happened to be active at that moment — the label then never updates
 * on a language switch, even though the rest of the screen does.
 *
 * This has shipped six times: SettingsModal, OnboardingOverlay, KeywordsModal,
 * ExpenseInput, EditTransactionModal and RecurringModal. Every fix took the
 * same shape — keep a module-scope map of StringKey values, and call t() on it
 * inside the render.
 *
 * The check is deliberately narrow: a `t(...)` call whose nearest enclosing
 * function is null. That is the exact defect and nothing else, so it should
 * stay free of false positives.
 *
 * Run: node scripts/check-frozen-i18n.ts  (or via `npm run check`)
 */
import * as ts from 'typescript';
import { collectSourceFiles, report, type Violation } from './lib/scan.ts';

function isFrozenCall(node: ts.Node): boolean {
  if (!ts.isCallExpression(node)) return false;
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 't') return false;

  // Walk up looking for anything that defers execution past module load.
  for (let parent = node.parent; parent; parent = parent.parent) {
    if (
      ts.isFunctionDeclaration(parent) ||
      ts.isFunctionExpression(parent) ||
      ts.isArrowFunction(parent) ||
      ts.isMethodDeclaration(parent) ||
      ts.isGetAccessorDeclaration(parent) ||
      ts.isSetAccessorDeclaration(parent) ||
      ts.isConstructorDeclaration(parent) ||
      ts.isClassDeclaration(parent)
    ) {
      return false;
    }
  }
  return true;
}

function checkFile(file: ts.SourceFile): Violation[] {
  const found: Violation[] = [];

  const visit = (node: ts.Node): void => {
    if (isFrozenCall(node)) {
      const { line } = file.getLineAndCharacterOfPosition(node.getStart(file));
      found.push({
        file: file.fileName,
        line: line + 1,
        message: `t() called at module scope — it will freeze to the locale active at import time. Store the StringKey and call t() during render instead.`,
      });
    }
    ts.forEachChild(node, visit);
  };

  visit(file);
  return found;
}

const violations = collectSourceFiles().flatMap(checkFile);
report('frozen t() calls', violations, {
  hint: 'See vault/Issues/open-issues.md — "Category/settings labels frozen to whichever locale was active on first load".',
});
