// Applies core `no-restricted-imports` only to modules that start with a
// 'use client' directive. ESLint's flat config cannot select files by their
// content, and a client module can live anywhere under src/, so the check
// is done here: the options are passed through unchanged to the core rule.
import { builtinRules } from 'eslint/use-at-your-own-risk';

const coreRule = builtinRules.get('no-restricted-imports');

function hasUseClientDirective(program) {
  for (const statement of program.body) {
    if (statement.type !== 'ExpressionStatement' || typeof statement.directive !== 'string') {
      return false;
    }
    if (statement.directive === 'use client') {
      return true;
    }
  }
  return false;
}

const clientRestrictedImports = {
  meta: {
    ...coreRule.meta,
    docs: {
      description: "Disallow specified imports in modules marked 'use client'",
    },
  },
  create(context) {
    if (!hasUseClientDirective(context.sourceCode.ast)) {
      return {};
    }
    return coreRule.create(context);
  },
};

export default clientRestrictedImports;
