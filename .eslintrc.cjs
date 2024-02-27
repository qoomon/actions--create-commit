/* eslint-env node */
module.exports = {
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:node/recommended',
    'google',
  ],
  parser: '@typescript-eslint/parser',
  plugins: [
    '@typescript-eslint',
  ],
  root: true,
  ignorePatterns: ['dist/**'],
  rules: {
    'semi': ['error', 'never'],
    'max-len': ['error', {'code': 120}],
    'valid-jsdoc': ['error', {requireParamType: false, requireReturnType: false}],
    'node/no-missing-import': ['error', {'tryExtensions': ['.js', '.json', '.ts']}],
  },
}
