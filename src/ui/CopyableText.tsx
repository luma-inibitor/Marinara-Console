import { useState } from "react";
import { Button } from "./Button";
import { cn } from "./cn";
import { CopyGlyph } from "./icons";
import { toast } from "../shell/toast";
import { t } from "../copy";

/** A value meant to be taken somewhere else, as monospace text with a copy control beside it. */
export function CopyableText(props: { value: string; label?: string; className?: string }) {
  const [done, setDone] = useState(false);
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(props.value);
      setDone(true);
      setTimeout(() => setDone(false), 1200);
    } catch {
      toast(t("ui.copy.failed"), { kind: "error" });
    }
  };
  return (
    <span className={cn("inline-flex max-w-full min-w-0 items-center gap-[5px]", props.className)}>
      <span className="min-w-0 t-data wrap-anywhere">{props.value}</span>
      <Button
        iconOnly
        variant="ghost"
        size="xs"
        className="shrink-0"
        label={t("ui.copy.value", { what: props.label ?? props.value })}
        icon={<CopyGlyph done={done} />}
        onClick={copy}
      />
      <span role="status" className="sr-only">
        {done ? t("ui.copy.copied") : ""}
      </span>
    </span>
  );
}
