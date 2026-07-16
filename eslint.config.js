const browserGlobals = {
  console: "readonly",
  document: "readonly",
  Event: "readonly",
  HTMLElement: "readonly",
  HTMLInputElement: "readonly",
  KeyboardEvent: "readonly",
  setTimeout: "readonly",
  window: "readonly",
};

export default [
  {
    ignores: ["dist/**", "node_modules/**", "out/**"],
  },
  {
    files: ["electron/**/*.cjs", "forge.config.cjs"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "commonjs",
      globals: {
        __dirname: "readonly",
        console: "readonly",
        decodeURIComponent: "readonly",
        module: "readonly",
        process: "readonly",
        require: "readonly",
        Response: "readonly",
        URL: "readonly"
      }
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-undef": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "prefer-const": "error"
    }
  },
  {
    files: ["src/**/*.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: browserGlobals,
    },
    rules: {
      "constructor-super": "error",
      eqeqeq: ["error", "always"],
      "no-constant-binary-expression": "error",
      "no-duplicate-case": "error",
      "no-self-assign": "error",
      "no-undef": "error",
      "no-unreachable": "error",
      "no-unused-private-class-members": "error",
      "no-unused-vars": ["error", { "argsIgnorePattern": "^_" }],
      "prefer-const": "error"
    },
  },
  {
    files: ["tests/**/*.js", "*.config.js"],
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module"
    },
    rules: {
      eqeqeq: ["error", "always"],
      "no-undef": "error",
      "no-unused-vars": "error",
      "prefer-const": "error"
    }
  }
];
