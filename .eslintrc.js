/*
 * Eslint config file
 * Documentation: https://eslint.org/docs/user-guide/configuring/
 * Install the Eslint extension before using this feature.
 */
module.exports = {
  env: {
    es6: true,
    browser: true,
    node: true,
  },
  ecmaFeatures: {
    modules: true,
    jsx: false // 小程序不使用JSX，显式关闭
  },
  parserOptions: {
    ecmaVersion: 2020, // 支持较新的ES特性
    sourceType: 'module',
  },
  globals: {
    wx: true,
    App: true,
    Page: true,
    getCurrentPages: true,
    getApp: true,
    Component: true,
    requirePlugin: true,
    requireMiniProgram: true,
    // 新增常见小程序全局变量
    Behavior: true,
    wxss: true
  },
  extends: 'eslint:recommended',
  rules: {
    // 基础语法规则
    'no-console': ['warn', { allow: ['warn', 'error'] }], // 允许warn和error级别console
    'no-debugger': 'error', // 禁止debugger
    'no-undef': 'error', // 禁止未声明变量
    'no-unused-vars': ['warn', { vars: 'all', args: 'after-used' }], // 警告未使用的变量
    'no-extra-semi': 'error', // 禁止多余的分号
    'semi': ['error', 'always'], // 强制使用分号
    'quotes': ['error', 'single'], // 强制使用单引号
    'indent': ['error', 2, { SwitchCase: 1 }], // 强制2空格缩进
    'eqeqeq': ['error', 'always'], // 强制使用===和!==
    'curly': ['error', 'all'], // 强制使用大括号包裹代码块
    'no-empty': ['error', { allowEmptyCatch: true }], // 禁止空代码块（允许空catch）
    'no-trailing-spaces': 'error', // 禁止行尾空格
    'eol-last': ['error', 'always'], // 文件末尾强制空行
    'space-before-function-paren': ['error', {
      anonymous: 'always',
      named: 'never',
      asyncArrow: 'always'
    }], // 函数括号前的空格规则
    'keyword-spacing': ['error', { before: true, after: true }], // 关键字前后空格
    'comma-spacing': ['error', { before: false, after: true }], // 逗号后空格
    'object-curly-spacing': ['error', 'always'], // 对象字面量花括号内空格
    'array-bracket-spacing': ['error', 'never'], // 数组方括号内无空格
  }
}