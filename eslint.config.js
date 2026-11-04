// NFR-MNT-01: strict TypeScript, ESLint clean, no `any` without a justification comment.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import react from 'eslint-plugin-react';
import reactHooks from 'eslint-plugin-react-hooks';
import jsxA11y from 'eslint-plugin-jsx-a11y';
import globals from 'globals';
import prettier from 'eslint-config-prettier';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/dist-e2e/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      'apps/android/**',
      'docs/design/index.html',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/consistent-type-imports': 'error',
      eqeqeq: ['error', 'always'],
    },
  },
  {
    files: ['apps/web/src/**/*.tsx'],
    plugins: { react, 'react-hooks': reactHooks, 'jsx-a11y': jsxA11y },
    settings: { react: { version: '19' } },
    rules: {
      // Classic hook rules only: the app does not use the React Compiler, whose extra checks are in `recommended`.
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      ...jsxA11y.configs.recommended.rules,
      // NFR-I18N-01: user-facing text comes from i18n/en.json.
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: true,
          ignoreProps: true,
          allowedStrings: ['*', '0', '·', '/', '–', ':', ': ', ' ', '°C', '%', 'mm', 'Rs'],
        },
      ],
      'jsx-a11y/no-autofocus': 'off',
      // A scrollable <main> without links must be focusable (axe scrollable-region-focusable).
      'jsx-a11y/no-noninteractive-tabindex': ['error', { tags: ['main'] }],
    },
  },
  {
    files: ['apps/web/src/**/*.test.tsx', 'apps/web/src/test/**'],
    rules: { 'react/jsx-no-literals': 'off' },
  },
  {
    files: ['**/*.{js,mjs,cjs}'],
    languageOptions: { globals: { ...globals.node } },
  },
  prettier,
);
