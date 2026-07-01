// Flat ESLint config (ESLint 9 + typescript-eslint). Pragmatic, not pedantic:
// it fails CI on genuine problems (unused bindings, unreachable code, bad
// regex) without drowning in style. `any` and lazy require() are used
// deliberately at SDK boundaries, so those rules are relaxed.
const js = require("@eslint/js");
const tseslint = require("typescript-eslint");
const globals = require("globals");

module.exports = tseslint.config(
  {
    ignores: [
      "dist/**",
      "node_modules/**",
      "public/**",
      "data/**",
      "coverage/**",
      "eval/generate-results-image.js",
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ["**/*.ts"],
    languageOptions: {
      globals: { ...globals.node },
    },
    rules: {
      // TypeScript's own checker handles undefined identifiers far better.
      "no-undef": "off",
      // The codebase intentionally uses `any` at a few SDK/callback boundaries.
      "@typescript-eslint/no-explicit-any": "off",
      // Lazy/optional deps are loaded with require() on purpose (Langfuse/OTel).
      "@typescript-eslint/no-require-imports": "off",
      // Catch genuinely-dead bindings; allow intentional _-prefixed throwaways.
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-control-regex": "off",
    },
  },
);
