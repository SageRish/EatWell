module.exports = {
  root: true,
  env: {
    browser: true,
    es2021: true
  },
  parser: '@typescript-eslint/parser',
  parserOptions: {
    ecmaFeatures: {
      jsx: true
    },
    ecmaVersion: 'latest',
    sourceType: 'module'
  },
  plugins: ['react', '@typescript-eslint'],
  extends: ['eslint:recommended', 'plugin:react/recommended', 'plugin:@typescript-eslint/recommended', 'prettier'],
  settings: {
    react: {
      version: 'detect'
    }
  },
  rules: {
    // allow `any` in this repo to avoid churn while tests and types stabilize
    '@typescript-eslint/no-explicit-any': 'off',
    // avoid failing CI for unused vars in test/dev code — warn instead
    '@typescript-eslint/no-unused-vars': ['warn', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    // prefer-const and similar are useful but should not fail CI right now
    'prefer-const': 'warn',
    // relax some rules that conflict with current code patterns
    'no-useless-escape': 'off',
    'no-empty': ['warn', { allowEmptyCatch: true }],
    'no-unused-expressions': 'off',
    '@typescript-eslint/no-unused-expressions': 'off'
  }
}
