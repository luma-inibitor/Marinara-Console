import js from "@eslint/js";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import i18next from "eslint-plugin-i18next";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";

// Babel, not typescript-eslint, parses the TypeScript here. typescript@7 — the
// native compiler — exports only `version` from the package root, so anything
// that does `import * as ts from "typescript"` and reaches for
// `ts.createSourceFile` gets undefined. typescript-eslint does exactly that.
// Babel strips the types syntactically instead, which is enough: the rules
// below are not type-aware.
//
// The compiler API does exist, under `typescript/unstable/*`: `ast` carries the
// scanner and the node factory, `sync` carries Program and Checker. A tool of
// our own can use it. Only the root-export assumption is unavailable.
//
// This also pins eslint to 9.x, because @babel/eslint-parser does not accept
// eslint 10 as a peer.
//
// Deliberately not extending any preset. tsc --strict and the bespoke checks in
// scripts/ already cover the ground a preset would, and a linter that reports
// things nobody acts on gets ignored.
export default [
  {
    files: ["src/**/*.ts", "src/**/*.tsx"],
    languageOptions: {
      parser: babelParser,
      parserOptions: {
        requireConfigFile: false,
        babelOptions: {
          babelrc: false,
          configFile: false,
          presets: [["@babel/preset-typescript", { isTSX: true, allExtensions: true }]],
        },
      },
    },
    plugins: { "react-hooks": reactHooks, import: importPlugin, i18next },
    settings: {
      // Resolution is the node resolver's, over TypeScript extensions.
      "import/resolver": { node: { extensions: [".ts", ".tsx", ".js", ".json"] } },
      "import/parsers": { "@babel/eslint-parser": [".ts", ".tsx"] },
    },
    rules: {
      // Copy that reaches the reader must come out of t().
      // `words` replaces the plugin's default excludes rather than extending them.
      "i18next/no-literal-string": [
        "error",
        {
          mode: "all",
          words: {
            exclude: [
              /^[^\p{L}]+$/u, // no letter anywhere: a number, a separator, a glyph
              /^[kst]$/, // unit suffixes glued to a number: k, seconds, tokens
              /^[A-Z_-]+$/, // a constant or an engine code
              /^_*[a-z][A-Za-z0-9]*$/, // an identifier
              /^[.#/]{0,1}-{0,2}[a-z0-9]+(?:[_./:-][a-z0-9]+)*\/?$/, // a route, a class, a data attribute
              /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/, // a catalog key passed as a prop
              /^\p{Emoji}+$/u,
            ],
          },
        },
      ],
      // Two of the word patterns above admit any bare lowercase word. One in
      // JSX text position is copy, and only this rule still sees it.
      "no-restricted-syntax": [
        "error",
        {
          selector: 'JSXText[value=/^\\s*[a-z][a-z0-9]*\\s*$/]:not([value=/^\\s*[kst]\\s*$/])',
          message: "bare lowercase JSX text must come from t()",
        },
      ],
      "react-hooks/exhaustive-deps": "error",
      "react-hooks/rules-of-hooks": "error",
      // No module may take part in an import cycle.
      "import/no-cycle": ["error", { ignoreExternal: true }],
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Only src/shell owns a request. A screen gets data from a hook (ARCHITECTURE.md §3).",
        },
      ],
    },
  },
  {
    // A fixture string reaches no reader.
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/test/**"],
    rules: { "i18next/no-literal-string": "off", "no-restricted-syntax": "off" },
  },
  {
    // The transport layer is where a fetch belongs.
    files: ["src/shell/**"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    // The binding half of the fetch rule above. layercheck.mjs passes this:
    // presentation reaching the transport client points downward.
    files: ["src/**/*.tsx", "src/**/components/**/*.ts", "src/**/screens/**/*.ts"],
    ignores: ["src/shell/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["**/shell/api"],
              // The binding, not the module: `ApiError` and `tokensOf` are fine.
              importNames: ["api", "default"],
              message: "Only src/shell owns a request. A screen gets data from a hook (ARCHITECTURE.md §3).",
            },
          ],
        },
      ],
    },
  },
  {
    // scripts/ takes the recommended preset, which src/ does not, because
    // nothing else checks it: tsconfig.json includes only src, so these 3,900
    // lines have no compiler over them at all. The preset earns its place here
    // for the same reason it would be redundant there.
    files: ["scripts/**/*.mjs"],
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: { ...globals.node },
    },
    plugins: { import: importPlugin },
    rules: {
      ...js.configs.recommended.rules,
      // copycheck masks catalog placeholders with a NUL sentinel and matches
      // it back out, so a control character in a regex is the design.
      "no-control-regex": "off",
      "import/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
  {
    // These five drive a real Chromium. The callback inside page.evaluate runs
    // in the page, so document and friends are defined there and nowhere else
    // in scripts/ -- listing the files keeps a stray `document` in a Node-only
    // script reportable.
    files: [
      "scripts/domsnap.mjs",
      "scripts/faceprobe.mjs",
      "scripts/shots.mjs",
      "scripts/verify.mjs",
      "scripts/lib/browser.mjs",
    ],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
