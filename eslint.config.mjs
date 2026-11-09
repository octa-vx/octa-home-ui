import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default tseslint.config(
  {
    ignores: ['**/dist/**', '**/node_modules/**', '.cache/**', 'test-results/**', 'playwright-report/**'],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['tools/**/*.mjs'],
    languageOptions: {
      globals: {
        console: 'readonly',
        process: 'readonly',
        fetch: 'readonly',
        WebSocket: 'readonly',
        URL: 'readonly',
        URLSearchParams: 'readonly',
        // Used inside browser callbacks of the smoke test.
        localStorage: 'readonly',
        customElements: 'readonly',
        document: 'readonly',
      },
    },
  },
);
