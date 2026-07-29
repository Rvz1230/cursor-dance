import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const nodeFiles = [
  "eslint.config.js",
  "electron.vite.config.mjs",
  "playwright.config.js",
  "playwright.desktop.config.js",
  "vite.config.js",
  "scripts/**/*.mjs",
  "smoke/**/*.js",
];

const ipcLiteralSelectors = ["Literal", "TemplateLiteral"].map((type) => ({
  selector: `CallExpression[arguments.0.type='${type}'][callee.object.name=/^(ipcMain|ipcRenderer)$/][callee.property.name=/^(handle|invoke|on|send)$/]`,
  message: "Electron IPC channels must use constants from src/shared/ipc-channels.ts.",
}));

export default [
  {
    ignores: [
      "coverage/**",
      "dist/**",
      "extension/**",
      "landing/**",
      "node_modules/**",
      "out/**",
      "test-results/**",
      ".vite/**",
    ],
  },
  {
    ...js.configs.recommended,
    files: nodeFiles,
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-console": "off",
      "no-unused-vars": ["error", { argsIgnorePattern: "^_", caughtErrorsIgnorePattern: "^_" }],
    },
  },
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parser: tseslint.parser,
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    plugins: {
      "@typescript-eslint": tseslint.plugin,
    },
    rules: {
      "no-constant-binary-expression": "error",
      "no-debugger": "error",
      "no-unreachable": "error",
      "no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-floating-promises": ["error", { ignoreIIFE: false, ignoreVoid: true }],
      "@typescript-eslint/no-misused-promises": ["error", { checksVoidReturn: { attributes: false } }],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          caughtErrorsIgnorePattern: "^_",
          destructuredArrayIgnorePattern: "^_",
          varsIgnorePattern: "^_",
        },
      ],
    },
  },
  {
    files: ["src/**/*.tsx"],
    plugins: {
      "react-hooks": reactHooks,
    },
    rules: {
      "react-hooks/exhaustive-deps": "warn",
      "react-hooks/rules-of-hooks": "error",
    },
  },
  {
    files: ["src/desktop/**/*.ts", "src/desktop/**/*.tsx"],
    rules: {
      "@typescript-eslint/no-explicit-any": "error",
    },
  },
  {
    files: ["src/desktop/main/**/*.ts", "src/desktop/preload/**/*.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...ipcLiteralSelectors],
    },
  },
];
