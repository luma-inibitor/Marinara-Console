import babelParser from "@babel/eslint-parser";
import i18next from "eslint-plugin-i18next";
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
    plugins: { "react-hooks": reactHooks, import: importPlugin, i18next },
    settings: {
      // Resolution is the node resolver's, over TypeScript extensions.
      "import/resolver": { node: { extensions: [".ts", ".tsx", ".js", ".json"] } },
      "import/parsers": { "@babel/eslint-parser": [".ts", ".tsx"] },
    },
    rules: {
      // Copy that reaches the reader as JSX text must come out of t().
      // `words` replaces the plugin's default excludes rather than extending them.
      "i18next/no-literal-string": [
        "error",
        {
          mode: "jsx-text-only",
          words: {
            exclude: [
              /^[^\p{L}]+$/u, // no letter anywhere: a number, a separator, a glyph
              /^[kst]$/, // unit suffixes glued to a number: k, seconds, tokens
            ],
          },
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
    // The transport layer is where a fetch belongs.
    files: ["src/shell/**"],
    rules: { "no-restricted-globals": "off" },
  },
  {
    // The other half of the same rule, one level down: not the global, but the
    // binding that wraps it. The direction rule in scripts/layercheck.mjs cannot
    // express this — presentation reaching the transport client points DOWNWARD,
    // so it passes that check while still being the defect §1 names, a screen
    // bypassing the data layer instead of calling a hook.
    //
    // Presentation is the same set layercheck draws, so one file cannot be
    // presentation to one check and something else to the other: a file that
    // returns markup is presentation wherever it sits, and `components/` and
    // `screens/` are that layer's own directories whatever the extension.
    files: ["src/**/*.tsx", "src/**/components/**/*.ts", "src/**/screens/**/*.ts"],
    // src/shell is the transport, `.tsx` and all — the app frame it wraps owns
    // requests legitimately.
    ignores: ["src/shell/**"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              // No path alias in this project, so the reach is always relative.
              group: ["**/shell/api"],
              // `api()` is a request, so importing it into a component is the
              // same defect as calling `fetch` there. The rest of that module is
              // not: `ApiError` is a shape an error boundary has to name, and
              // `tokensOf` is a pure estimate. Naming the binding rather than
              // the module is what keeps this from firing on all of them.
              importNames: ["api", "default"],
              message: "Only src/shell owns a request. A screen gets data from a hook (ARCHITECTURE.md §3).",
            },
          ],
        },
      ],
    },
  },
];
