const js = require('@eslint/js');
const globals = require('globals');

module.exports = [
  js.configs.recommended,
  {
    files: ['**/*.js'],
    languageOptions: { ecmaVersion: 2022, sourceType: 'commonjs', globals: { ...globals.node } },
    rules: { 'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }] },
  },
  {
    files: ['public/js/**/*.js'],
    languageOptions: { sourceType: 'script', globals: { ...globals.browser, gsap: 'readonly', ScrollTrigger: 'readonly' } },
  },
  { ignores: ['node_modules/**'] },
];
