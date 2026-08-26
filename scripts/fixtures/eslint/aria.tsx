// Untraced copy in the four aria attributes eslint-plugin-i18next cannot see,
// then the same four routed through t(). Only the first four are findings.
import { t } from "../../../src/copy";

export const Untraced = () => (
  <div>
    <span aria-description="Zorple describes this row" />
    <span aria-placeholder="Zorple your name here" />
    <span aria-valuetext="Zorple three of eight" />
    <span aria-roledescription="Zorple carousel widget" />
  </div>
);

export const Traced = () => (
  <div>
    <span aria-description={t("memory.collapse")} />
    <span aria-placeholder={t("memory.collapse")} />
    <span aria-valuetext={t("memory.collapse")} />
    <span aria-roledescription={t("memory.collapse")} />
  </div>
);
