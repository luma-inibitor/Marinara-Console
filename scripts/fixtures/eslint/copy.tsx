// Copy that eslint-plugin-i18next's own default excludes would let through: an
// ALL-CAPS word, a camelCase word standing alone as JSX text, and a one-word
// copy attribute. Each is repeated below through t(), which must stay silent.
import { t } from "../../../src/copy";

export const Untraced = () => (
  <div>
    <span>ZORPLE</span>
    <span>zorpleAll</span>
    <button title="zorpleAll" />
  </div>
);

export const Traced = () => (
  <div>
    <span>{t("memory.collapse")}</span>
    <span>{t("memory.collapse")}</span>
    <button title={t("memory.collapse")} />
  </div>
);
