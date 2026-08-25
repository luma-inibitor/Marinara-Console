import babelParser from "@babel/eslint-parser";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";

// Babel, not typescript-eslint, parses the TypeScript here. The project
// compiles with typescript@7 — the native compiler — whose npm package exposes
// no JS Compiler API at all (`ts.createSourceFile` is undefined), so any parser
// built on it would need a second, older TypeScript installed alongside. Babel
// strips the types syntactically and needs no compiler, which is enough: the
// rules below are not type-aware.
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
    plugins: { "react-hooks": reactHooks, import: importPlugin },
    settings: {
      // Resolution is the node resolver's, over TypeScript extensions.
      "import/resolver": { node: { extensions: [".ts", ".tsx", ".js", ".json"] } },
      "import/parsers": { "@babel/eslint-parser": [".ts", ".tsx"] },
    },
    rules: {
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
    // The transport layer is where a fetch belongs.
    files: ["src/shell/**"],
    rules: { "no-restricted-globals": "off" },
  },
];
