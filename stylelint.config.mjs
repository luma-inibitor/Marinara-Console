// stylelint over the app's stylesheets.
//
// The type scale rule is a warning, not an error: `npm run csslint` sits in
// scripts/checks.mjs, and the 89 recorded literals would fail every run there.
// Growth is what fails, and scripts/typescale.mjs ratchets that.
export default {
  plugins: ["./scripts/stylelint/font-size-token.mjs"],
  rules: {
    "marinara/font-size-token": [true, { severity: "warning" }],
  },
};
