// ESLint flat config (ESLint 10 dropped .eslintrc support).
//
// Besides the usual TypeScript rules, this file is where the module boundaries
// are enforced: a module is reached through its public `index.ts`, and the
// dependency direction is one-way.
//
//   hrm  -> iam, auth   (through the barrels only)
//   auth -> iam         (barrel + the ports it re-exports)
//   iam  -> nothing     (so it stays reusable by another product)
//   shared, infra -> no business-module internals
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';

/** Everything under a module except its public barrel. */
const inside = (m) => [`${m}/*`, `${m}/**`];
/** The module, barrel included. */
const whole = (m) => [m, `${m}/*`, `${m}/**`];

const boundary = (...patterns) => ({
  'no-restricted-imports': ['error', { patterns }],
});

export default [
  { ignores: ['dist/**', 'node_modules/**', 'coverage/**'] },
  {
    files: ['**/*.ts'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaVersion: 2022, sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': tsPlugin },
    rules: {
      ...tsPlugin.configs.recommended.rules,
      'no-undef': 'off', // TypeScript checks this and knows the ambient globals
      'no-unused-vars': 'off',
      // Pre-existing `any` usage predates this config (the old .eslintrc never
      // ran under ESLint 10). Kept visible as a warning, not a build blocker.
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // ---- module boundaries ----
  {
    files: ['src/modules/hrm/**/*.ts'],
    // Integration tests assert on persisted IAM/Auth state, so they are allowed
    // to read those collections directly.
    ignores: ['src/modules/hrm/tests/**'],
    rules: boundary({
      group: [...inside('@modules/iam'), ...inside('@modules/auth')],
      message: 'Reach IAM/Auth through their public API: import "@modules/iam" or "@modules/auth".',
    }),
  },
  {
    files: ['src/modules/auth/**/*.ts'],
    // Integration tests assert on persisted IAM state.
    ignores: ['src/modules/auth/tests/**'],
    rules: boundary(
      {
        group: whole('@modules/hrm'),
        message: 'Auth must not depend on HRM — it only answers "who is this user?".',
      },
      {
        group: ['@modules/iam/adapters/*', '@modules/iam/adapters/**'],
        message: 'Compose against IAM through "@modules/iam"; its adapters are private.',
      },
    ),
  },
  {
    files: ['src/modules/iam/**/*.ts'],
    rules: boundary({
      group: [...whole('@modules/hrm'), ...whole('@modules/auth')],
      message: 'IAM must depend on no other business module — that is what keeps it reusable.',
    }),
  },
  {
    files: ['src/shared/**/*.ts', 'src/infra/**/*.ts'],
    // The HTTP test harness boots the real app, so it needs the barrels.
    ignores: ['src/shared/testing/**'],
    rules: boundary({
      group: ['@modules/*/*', '@modules/*/**'],
      message: 'shared/ and infra/ may not depend on a business module internals.',
    }),
  },
];
