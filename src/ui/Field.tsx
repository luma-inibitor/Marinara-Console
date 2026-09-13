import type { ComponentPropsWithRef, ReactNode } from "react";
import { createContext, useContext, useId } from "react";
import { t } from "../copy";
import { Failure, ICON_SIZE } from "./icons";

/** A label, one control, and the hint and error that belong to it. */

export type FieldWiring = {
  id: string;
  "aria-describedby"?: string;
  "aria-invalid"?: true;
  "aria-required"?: true;
};

const FieldContext = createContext<FieldWiring | null>(null);

function useFieldControl(): Partial<FieldWiring> {
  return useContext(FieldContext) ?? {};
}

/** The ids a control is described by, in reading order. */
export function describedBy(hintId?: string, errorId?: string): string | undefined {
  const ids = [hintId, errorId].filter(Boolean);
  return ids.length ? ids.join(" ") : undefined;
}

export type FieldProps = {
  label: ReactNode;
  /** Reads to assistive technology only. */
  labelHidden?: boolean;
  hint?: ReactNode;
  error?: ReactNode;
  required?: boolean;
  optional?: boolean;
  className?: string;
  children: ReactNode;
};

const LABEL =
  "inline-flex items-baseline gap-2 font-label font-semibold [font-variation-settings:'wdth'_110] " +
  "uppercase tracking-[0.12em] text-label-s text-dim";
const MARK = "font-data font-normal normal-case tracking-normal text-data-s text-dim";
const NOTE = "m-0 font-prose text-data leading-snug";

export function Field(props: FieldProps) {
  const { label, labelHidden, hint, error, required, optional, className, children } = props;
  const id = useId();
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const wiring: FieldWiring = {
    id,
    "aria-describedby": describedBy(hintId, errorId),
    "aria-invalid": error ? true : undefined,
    "aria-required": required || undefined,
  };
  return (
    <div className={["flex min-w-0 flex-col gap-1", className].filter(Boolean).join(" ")}>
      <label htmlFor={id} className={labelHidden ? "sr-only" : LABEL}>
        {label}
        {required && <span className={MARK}>{t("ui.field.required")}</span>}
        {optional && <span className={MARK}>{t("ui.field.optional")}</span>}
      </label>
      {hint && (
        <p id={hintId} className={`${NOTE} text-dim`}>
          {hint}
        </p>
      )}
      <FieldContext.Provider value={wiring}>{children}</FieldContext.Provider>
      {error && (
        <p id={errorId} className={`${NOTE} flex items-center gap-1 text-danger`}>
          <Failure size={ICON_SIZE.sm} stroke={2} aria-hidden />
          <span>{error}</span>
        </p>
      )}
    </div>
  );
}

const CONTROL =
  "w-full min-w-0 rounded-s border border-edge bg-surface-2 text-ink placeholder:text-dim " +
  "focus-visible:outline-none focus-visible:shadow-[var(--focus-ring)] " +
  "aria-[invalid=true]:border-danger disabled:cursor-default disabled:opacity-45";
const LINE = `${CONTROL} min-h-tap px-2 font-data text-data`;
const BLOCK = `${CONTROL} max-w-[var(--measure)] resize-y p-2 font-prose text-prose leading-normal`;

function cx(base: string, className?: string) {
  return className ? `${base} ${className}` : base;
}

export function Input({ className, ...rest }: ComponentPropsWithRef<"input">) {
  return <input {...useFieldControl()} {...rest} className={cx(LINE, className)} />;
}

export function Textarea({ className, ...rest }: ComponentPropsWithRef<"textarea">) {
  return <textarea {...useFieldControl()} {...rest} className={cx(BLOCK, className)} />;
}

export function Select({ className, ...rest }: ComponentPropsWithRef<"select">) {
  return <select {...useFieldControl()} {...rest} className={cx(LINE, className)} />;
}
