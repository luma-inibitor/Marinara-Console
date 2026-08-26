// stylelint over the app's stylesheets.
export default {
  plugins: ["./scripts/stylelint/font-size-token.mjs"],
  rules: {
    "marinara/font-size-token": [true, { severity: "warning" }],

    // ── things that cannot be right ──
    "property-no-unknown": true,
    "declaration-property-value-no-unknown": true,
    "unit-no-unknown": true,
    // Tailwind 4 declares the palette in @theme; src/styles/theme.css holds it.
    "at-rule-no-unknown": [true, { ignoreAtRules: ["theme"] }],
    "media-feature-name-no-unknown": true,
    "selector-pseudo-class-no-unknown": true,
    "selector-pseudo-element-no-unknown": true,
    "function-calc-no-unspaced-operator": true,
    "custom-property-no-missing-var-function": true,
    "block-no-empty": true,

    // ── a declaration that silently loses to another ──
    "no-duplicate-selectors": true,
    "declaration-block-no-duplicate-properties": true,
    "declaration-block-no-duplicate-custom-properties": true,
    "declaration-block-no-shorthand-property-overrides": true,

    // ── a value that says more than it means ──
    "shorthand-property-no-redundant-values": true,
    "declaration-block-no-redundant-longhand-properties": true,

    // Warning, not error: the 25 findings are still open, and would be fixed
    // by reordering rules. scripts/specificity.mjs holds them at 25.
    "no-descending-specificity": [true, { severity: "warning" }],
  },
};
