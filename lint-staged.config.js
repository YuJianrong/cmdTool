module.exports = {
  '*.{json,md,less,yaml,yml}': ['prettier --write'],
  '*.{ts,tsx}': ['eslint --fix --max-warnings 0'],
};
