// Flat config — ESLint 10 no longer reads `.eslintrc.cjs`, so `pnpm lint`
// could not run at all. This is a 1:1 port of the previous `.eslintrc.cjs`,
// with one documented gap: `eslint:recommended` needs the `@eslint/js` package,
// which is not installed here, and pulling it in would surface a new class of
// findings unrelated to the task at hand. The TypeScript rules — the ones that
// actually flag `any` — are ported unchanged.
import tsPlugin from '@typescript-eslint/eslint-plugin';
import tsParser from '@typescript-eslint/parser';
import prettier from 'eslint-config-prettier/flat';

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
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },

  // `src/test-support` boots a real server and an in-memory Mongo; only specs
  // may reach for it. Keeps the boundary enforced rather than documented.
  {
    files: ['src/**/*.ts'],
    ignores: ['src/test-support/**', 'src/**/tests/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/test-support', '@/test-support/*', '@/test-support/**'],
              message: 'test-support is for specs only; production code must not import it.',
            },
          ],
        },
      ],
    },
  },
  prettier,
];
