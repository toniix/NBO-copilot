module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true,
  },
  parserOptions: {
    ecmaVersion: 'latest',
    sourceType: 'module',
    ecmaFeatures: { jsx: true },
  },
  plugins: ['react-hooks', 'react-refresh'],
  extends: ['eslint:recommended'],
  rules: {
    'no-unused-vars': 'off',
    'react-hooks/rules-of-hooks': 'error',
    'react-refresh/only-export-components': 'off',
  },
  ignorePatterns: ['dist', 'node_modules'],
}