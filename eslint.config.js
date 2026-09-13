import js from "@eslint/js";
import globals from "globals";
import babelParser from "@babel/eslint-parser";
import i18next from "eslint-plugin-i18next";
import importPlugin from "eslint-plugin-import";
import reactHooks from "eslint-plugin-react-hooks";
import i18nDefaults from "eslint-plugin-i18next/lib/options/defaults.js";
import betterTailwindcss from "eslint-plugin-better-tailwindcss";
import { getDefaultSelectors } from "eslint-plugin-better-tailwindcss/api/defaults";

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

// ── the copy rules eslint-plugin-i18next cannot express ───────────────────
// Gotcha: its attribute list is fixed at five, so `jsx-attributes` cannot reach
// the other four aria attributes. Its `words.exclude` matches a string and not
// a position, so a bare word passes in a copy position as well as in a key.
const COPY_SELECTORS = [
  {
    selector: "JSXText[value=/^\\s*[a-z][A-Za-z0-9]*\\s*$/]:not([value=/^\\s*[kst]\\s*$/])",
    message: "a bare word in JSX text must come from t()",
  },
  {
    selector:
      "JSXAttribute[name.name=/^aria-(description|placeholder|valuetext|roledescription)$/] > Literal[value=/[a-zA-Z]/]",
    message: "aria text must come from t()",
  },
  {
    selector:
      "JSXAttribute[name.name=/^(aria-label|title|placeholder|alt|label|body|heading|hint|caption|tip|summary|empty|note)$/] > Literal[value=/^_*[a-z][A-Za-z0-9]*$/]",
    message: "a one-word copy attribute must come from t()",
  },
];

// It also skips everything inside an ALL-CAPS declarator, which is where the
// two files below keep their enum-to-label tables.
const COPY_TABLE_SELECTOR = {
  selector: "VariableDeclarator[id.name=/^[A-Z][A-Z_0-9]*$/] Literal[value=/[a-zA-Z] [a-zA-Z]/]",
  message: "a label in a copy table must come from t()",
};

// Two utilities on one property resolve by their order in the generated sheet, not in the string.
const CLASS_SELECTORS = [
  {
    selector: 'JSXAttribute[name.name="className"] > JSXExpressionContainer > TemplateLiteral',
    message: "Compose classes with cn() from src/ui/cn.ts",
  },
  {
    selector: "CallExpression[callee.name=/^(cn|cva)$/] > TemplateLiteral",
    message: "Compose classes with cn() from src/ui/cn.ts",
  },
  {
    selector: 'JSXAttribute[name.name="className"] > JSXExpressionContainer > BinaryExpression[operator="+"]',
    message: "Compose classes with cn()",
  },
  {
    selector:
      'JSXAttribute[name.name="className"] > JSXExpressionContainer CallExpression[callee.property.name="join"]',
    message: "Compose classes with cn()",
  },
  {
    selector: 'CallExpression[callee.property.name="join"][arguments.0.value=" "]',
    message: "A space-joined string in a component is a class list. Use cn()",
  },
  {
    selector: 'BinaryExpression[operator="+"] > Literal[value=/^ |  $/]',
    message: "A space-joined string in a component is a class list. Use cn()",
  },
  {
    selector: 'CallExpression[callee.name=/^(cn|cva)$/] > BinaryExpression[operator="+"]',
    message: "A space-joined string in a component is a class list. Use cn()",
  },
  {
    selector: 'CallExpression[callee.name=/^(cn|cva)$/] CallExpression[callee.property.name="join"]',
    message: "A space-joined string in a component is a class list. Use cn()",
  },
];

const BUTTON_SELECTOR = {
  selector: 'JSXOpeningElement[name.name="button"]',
  message: "Use <Button> from src/ui/Button.tsx",
};

// The classes the e2e suite and the legacy stylesheets reach by name.
const HOOK_CLASSES = ["hit", "sheet", "peek-scrim", "chip", "tag", "ar"];

// A button that is not a Button, each for its own shape.
const BUTTON_OK = [
  "src/ui/Chip.tsx", // a pressable tag
  "src/ui/ListGroup.tsx", // the group header's disclosure
  "src/ui/ListItem.tsx", // the row's primary target
  "src/ui/Menu.tsx", // a menu item
  "src/ui/ModePill.tsx", // a segment of a toggle group
  "src/ui/SearchDisclosure.tsx", // the disclosure and its options
];

// TODO 120 hand-rolled buttons in 28 files. Remove a file here once it renders Button.
const TODO_BUTTON = [
  "src/shell/App.tsx",
  "src/shell/Toaster.tsx",
  "src/shell/connection.tsx",
  "src/shell/palette.tsx",
  "src/tools/lorebooks/BookAudit.tsx",
  "src/tools/lorebooks/Picker.tsx",
  "src/tools/lorebooks/entries.tsx",
  "src/tools/memory/ClaimDetail.tsx",
  "src/tools/memory/MemoryTool.tsx",
  "src/tools/memory/Review.tsx",
  "src/tools/memory/Sources.tsx",
  "src/tools/memory/Vault.tsx",
  "src/tools/memory/components/NoteRef.tsx",
  "src/tools/memory/detail/MemoryDetail.tsx",
  "src/tools/memory/detail/RetrievalCard.tsx",
  "src/tools/memory/detail/SectionRow.tsx",
  "src/tools/memory/review/FilterSheet.tsx",
  "src/tools/memory/review/ViewSheet.tsx",
  "src/tools/presets/PresetsTool.tsx",
  "src/ui/CopyableText.tsx",
  "src/ui/ErrorState.tsx",
  "src/ui/FullscreenText.tsx",
  "src/ui/JsonView.tsx",
  "src/ui/ListEmpty.tsx",
  "src/ui/Loading.tsx",
  "src/ui/NotFound.tsx",
  "src/ui/SaveBar.tsx",
  "src/ui/Sheet.tsx",
];

// TODO 80 template literals and space joins in 26 files. Remove a file here once it composes with cn().
const TODO_STRING = [
  "src/shell/App.tsx",
  "src/shell/Toaster.tsx",
  "src/shell/palette.tsx",
  "src/tools/lorebooks/BookAudit.tsx",
  "src/tools/lorebooks/entries.tsx",
  "src/tools/memory/ClaimDetail.tsx",
  "src/tools/memory/Review.tsx",
  "src/tools/memory/Sources.tsx",
  "src/tools/memory/Vault.tsx",
  "src/tools/memory/components/StatusPill.tsx",
  "src/tools/memory/detail/MemoryDetail.tsx",
  "src/tools/memory/detail/RetrievalCard.tsx",
  "src/tools/memory/detail/SectionRow.tsx",
  "src/tools/memory/icons.tsx",
  "src/tools/memory/review/DockSheet.tsx",
  "src/tools/memory/review/FilterSheet.tsx",
  "src/tools/memory/review/ViewSheet.tsx",
  "src/tools/presets/PresetsTool.tsx",
  "src/ui/CopyableText.tsx",
  "src/ui/EmptyState.tsx",
  "src/ui/FullscreenText.tsx",
  "src/ui/SaveBar.tsx",
  "src/ui/SectionKey.tsx",
  "src/ui/Term.tsx",
];

// One override per combination, since a later override replaces the whole rule.
function restricted() {
  const noButton = new Set([...BUTTON_OK, ...TODO_BUTTON]);
  const noString = new Set(TODO_STRING);
  const all = [...new Set([...noButton, ...noString])];
  const rule = (files, keep) => ({ files, rules: { "no-restricted-syntax": ["error", ...keep] } });
  return [
    rule(["src/ui/Button.tsx"], [...COPY_SELECTORS, ...CLASS_SELECTORS]),
    rule(
      all.filter((f) => noString.has(f) && noButton.has(f)),
      COPY_SELECTORS,
    ),
    rule(
      all.filter((f) => noString.has(f) && !noButton.has(f)),
      [...COPY_SELECTORS, BUTTON_SELECTOR],
    ),
    rule(
      all.filter((f) => !noString.has(f) && noButton.has(f)),
      [...COPY_SELECTORS, ...CLASS_SELECTORS],
    ),
  ];
}

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
    plugins: { "react-hooks": reactHooks, import: importPlugin, i18next, "better-tailwindcss": betterTailwindcss },
    settings: {
      // The defaults cover className, cn() and cva().
      "better-tailwindcss": { entryPoint: "src/styles/theme.css", selectors: getDefaultSelectors() },
      // Resolution is the node resolver's, over TypeScript extensions.
      "import/resolver": { node: { extensions: [".ts", ".tsx", ".js", ".json"] } },
      "import/parsers": { "@babel/eslint-parser": [".ts", ".tsx"] },
    },
    rules: {
      // Gotcha: `words` and `callees` replace the plugin's default excludes rather than extending them.
      "i18next/no-literal-string": [
        "error",
        {
          mode: "all",
          // A class string inside cn() or cva() reaches no reader.
          callees: { exclude: [...i18nDefaults.callees.exclude, "cn", "cva"] },
          words: {
            exclude: [
              /^[^\p{L}]+$/u, // no letter anywhere: a number, a separator, a glyph
              /^[kst]$/, // unit suffixes glued to a number: k, seconds, tokens
              /^(?:GET|POST|PUT|PATCH|DELETE)$/, // an HTTP method
              /^_*[a-z][A-Za-z0-9]*$/, // an identifier
              /^[.#/]{0,1}-{0,2}[a-z0-9]+(?:[_./:-][a-z0-9]+)*\/?$/, // a route, a class, a data attribute
              /^[a-z][A-Za-z0-9]*(?:\.[A-Za-z0-9]+)+$/, // a catalog key passed as a prop
              /^\p{Emoji}+$/u,
            ],
          },
        },
      ],
      "no-restricted-syntax": ["error", ...COPY_SELECTORS, ...CLASS_SELECTORS, BUTTON_SELECTOR],
      "better-tailwindcss/no-conflicting-classes": "error",
      "better-tailwindcss/no-duplicate-classes": "error",
      "better-tailwindcss/no-unknown-classes": ["error", { ignore: HOOK_CLASSES }],
      "better-tailwindcss/enforce-consistent-class-order": "error",
      "better-tailwindcss/no-restricted-classes": [
        "error",
        {
          restrict: [
            {
              pattern: "^rounded-(s|e|l)$",
              message: "A side utility, not a house radius. Use rounded-sm, rounded-md or rounded-lg.",
            },
            {
              pattern: "^rounded-\\(--radius-(s|m|l)\\)$",
              message: "The token is --radius-sm, --radius-md or --radius-lg.",
            },
          ],
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
    files: ["src/tools/lorebooks/data.ts", "src/tools/presets/data.ts"],
    rules: {
      "no-restricted-syntax": ["error", ...COPY_SELECTORS, ...CLASS_SELECTORS, BUTTON_SELECTOR, COPY_TABLE_SELECTOR],
    },
  },
  {
    // TODO 1254 classes from the legacy stylesheets in 40 files. Remove a file here once it is utilities.
    files: [
      "src/shell/App.tsx",
      "src/shell/Toaster.tsx",
      "src/shell/connection.tsx",
      "src/shell/hotkeys.tsx",
      "src/shell/palette.tsx",
      "src/tools/lorebooks/BookAudit.tsx",
      "src/tools/lorebooks/Picker.tsx",
      "src/tools/lorebooks/entries.tsx",
      "src/tools/memory/ClaimDetail.tsx",
      "src/tools/memory/MemoryTool.tsx",
      "src/tools/memory/Review.tsx",
      "src/tools/memory/ScopeBar.tsx",
      "src/tools/memory/Sources.tsx",
      "src/tools/memory/Vault.tsx",
      "src/tools/memory/components/NoteRef.tsx",
      "src/tools/memory/components/StatusPill.tsx",
      "src/tools/memory/detail/MemoryDetail.tsx",
      "src/tools/memory/detail/RetrievalCard.tsx",
      "src/tools/memory/detail/SectionRow.tsx",
      "src/tools/memory/icons.tsx",
      "src/tools/memory/review/DockSheet.tsx",
      "src/tools/memory/review/FilterSheet.tsx",
      "src/tools/memory/review/ViewSheet.tsx",
      "src/tools/presets/PresetsTool.tsx",
      "src/ui/CopyableText.tsx",
      "src/ui/EmptyState.tsx",
      "src/ui/ErrorState.tsx",
      "src/ui/FullscreenText.tsx",
      "src/ui/JsonView.tsx",
      "src/ui/ListEmpty.tsx",
      "src/ui/ListGroup.tsx",
      "src/ui/ListItem.stories.tsx",
      "src/ui/Loading.tsx",
      "src/ui/MiddleTruncate.tsx",
      "src/ui/NotFound.tsx",
      "src/ui/RawJson.tsx",
      "src/ui/SaveBar.tsx",
      "src/ui/Term.tsx",
    ],
    rules: { "better-tailwindcss/no-unknown-classes": "off" },
  },
  {
    // A primitive keeps its class lists in ALL-CAPS constants, which the default selectors skip.
    files: ["src/ui/**/*.tsx"],
    ignores: ["src/ui/**/*.stories.tsx"],
    settings: {
      "better-tailwindcss": {
        entryPoint: "src/styles/theme.css",
        selectors: [
          ...getDefaultSelectors(),
          { kind: "variable", name: "^[A-Z][A-Z_0-9]*$", match: [{ type: "strings" }] },
        ],
      },
    },
  },
  ...restricted(),
  {
    // Fixtures.
    files: ["src/**/*.test.ts", "src/**/*.test.tsx", "src/**/test/**"],
    rules: { "i18next/no-literal-string": "off", "no-restricted-syntax": "off" },
  },
  {
    // Story strings reach no reader.
    files: ["src/**/*.stories.tsx", ".storybook/**/*.ts", ".storybook/**/*.tsx"],
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
      "import/no-cycle": ["error", { ignoreExternal: true }],
    },
  },
  {
    // These two drive a real Chromium. The callback inside page.evaluate runs
    // in the page, so document and friends are defined there and nowhere else
    // in scripts/ -- listing the files keeps a stray `document` in a Node-only
    // script reportable.
    files: ["scripts/domsnap.mjs", "scripts/lib/browser.mjs"],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
];
