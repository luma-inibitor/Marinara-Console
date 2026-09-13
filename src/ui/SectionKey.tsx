import { cn } from "./cn";

/** The `§key` that addresses one section of a memory; the `§` belongs to the renderer. */
export function SectionKey(props: { k: string; className?: string }) {
  return (
    <span
      className={cn(
        "skey font-data text-data-s tracking-normal text-ink normal-case [font-variant-ligatures:none]",
        props.className,
      )}
    >
      §{props.k}
    </span>
  );
}
