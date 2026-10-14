import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

// Auth-only check with installed plugins; does not replace the project config.
const authEslintConfig = [{
  files: ["**/*.ts", "**/*.tsx"],
  languageOptions: {
    parser: require("@typescript-eslint/parser"),
    parserOptions: { ecmaVersion: "latest", sourceType: "module", ecmaFeatures: { jsx: true } },
  },
  plugins: {
    "@typescript-eslint": require("@typescript-eslint/eslint-plugin"),
  },
  rules: {
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_" }],
  },
}];

export default authEslintConfig;
