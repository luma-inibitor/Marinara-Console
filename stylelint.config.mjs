// stylelint over the app's stylesheets.
export default {
  plugins: ["./scripts/stylelint/font-size-token.mjs"],
  rules: {
    "marinara/font-size-token": [true, { severity: "warning" }],
  },
};
