import js from '@eslint/js';
import reactHooks from 'eslint-plugin-react-hooks';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/.wrangler/**',
      '**/node_modules/**',
      '**/playwright-report/**',
      '**/test-results/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: { globals: { ...globals.browser, ...globals.node } },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-empty': ['error', { allowEmptyCatch: true }],
    },
  },
  {
    files: ['apps/web/**/*.{ts,tsx}'],
    plugins: { 'react-hooks': reactHooks },
    rules: {
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'warn',
    },
  },
  // Design-system guards (DESIGN_SYSTEM.md › Guards): semantic colours, the type floor, no
  // transition-all.
  {
    files: ['apps/web/src/**/*.tsx'],
    ignores: ['apps/web/src/render/**'],
    rules: {
      'no-restricted-syntax': [
        'error',
        ...['Literal', 'TemplateElement'].flatMap((node) => {
          const value = node === 'Literal' ? 'value' : 'value.raw';
          return [
            {
              selector: `${node}[${value}=/\\btransition-all\\b/]`,
              message: 'Use a specific transition (transition-colors, transition-transform…).',
            },
            {
              selector: `${node}[${value}=/\\b(bg|text|border|ring|from|to|via|fill|stroke|accent|outline|decoration|divide|shadow)-(rose|amber|green|sky|red|emerald|yellow|blue|violet|purple|orange|pink|lime|teal|cyan|indigo|fuchsia|slate|gray|zinc|neutral|stone)-\\d/]`,
              message: 'Use a semantic colour role (fg, go, standby, fault, warn, info, accent…).',
            },
            {
              selector: `${node}[${value}=/\\b(bg|text|border|ring|outline|fill|stroke|divide)-(ink-\\d+|live)\\b/]`,
              message: 'The ink-* and live colours are gone: use fg, line, surface or fault roles.',
            },
            {
              selector: `${node}[${value}=/\\btext-\\[\\d+px\\]/]`,
              message: 'Use the type scale (label-caps, text-caption, text-ui…), 12 px minimum.',
            },
          ];
        }),
      ],
    },
  },
  // UI motion never runs on the stage, output windows or the operator's main thread.
  {
    files: [
      'apps/web/src/render/**/*.{ts,tsx}',
      'apps/web/src/routes/OutputWindow.tsx',
      'apps/web/src/routes/RemoteOutput.tsx',
      'apps/web/src/routes/operator/**/*.{ts,tsx}',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['motion', 'motion/*', 'framer-motion'],
              message: 'No motion library here: outputs and the operator stay CSS-only.',
            },
          ],
        },
      ],
    },
  },
);
