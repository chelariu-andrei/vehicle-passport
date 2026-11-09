const { defineConfig } = require('eslint/config');
const expo = require('eslint-config-expo/flat');

const noBareText = {
  selector: 'JSXText[value=/\\S/]',
  message: 'User-visible strings come from src/shared/i18n/en.ts.',
};
const noFixedFontScale = {
  selector: "JSXAttribute[name.name='allowFontScaling'][value.expression.value=false]",
  message: 'Never disable font scaling.',
};

module.exports = defineConfig([
  expo,
  { ignores: ['dist/*', 'src/shared/api/generated/*'] },
  {
    files: ['src/shared/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/features/*'], message: 'shared must not import a feature.' }] },
      ],
    },
  },
  {
    files: ['src/features/**/*.{ts,tsx}', 'app/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        { patterns: [{ group: ['@/features/*/*'], message: 'Import a feature through its index.ts only.' }] },
      ],
      'no-restricted-syntax': ['error', noBareText, noFixedFontScale],
    },
  },
]);
