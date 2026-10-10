// Hello World
import { useId, type ComponentPropsWithRef, type InputHTMLAttributes, type ReactNode, type SelectHTMLAttributes, type TextareaHTMLAttributes } from "react";

export const CONTROL =
  "block w-full rounded-sm border border-line-strong bg-paper px-3.5 text-ink placeholder:text-muted/80 " +
  "transition-colors duration-150 hover:border-ink-soft focus:border-ink focus:outline-none focus-visible:outline-2 " +
  "focus-visible:outline-offset-2 focus-visible:outline-gold-ink aria-invalid:border-danger disabled:bg-cream disabled:text-muted";

interface FieldShellProps {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly id: string;
  readonly required?: boolean;
  readonly className?: string;
  readonly children: ReactNode;
}

function FieldShell({ label, hint, error, id, required, className, children }: FieldShellProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-ink">
        {label}
        {required ? (
          <span className="text-danger" aria-hidden="true">
            {" "}
            *
          </span>
        ) : null}
      </label>
      {children}
      {hint && !error ? (
        <p id={`${id}-hint`} className="mt-1.5 text-xs leading-relaxed text-muted">
          {hint}
        </p>
      ) : null}
      {error ? (
        <p id={`${id}-error`} role="alert" className="mt-1.5 text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}

function describedBy(id: string, hint: unknown, error: unknown): string | undefined {
  if (error) return `${id}-error`;
  if (hint) return `${id}-hint`;
  return undefined;
}

type Common = {
  readonly label: ReactNode;
  readonly hint?: ReactNode;
  readonly error?: string | null;
  readonly wrapperClassName?: string;
};

export function TextField({ label, hint, error, wrapperClassName, id, className, ...rest }: Common & ComponentPropsWithRef<"input">) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} required={rest.required} className={wrapperClassName}>
      <input
        id={fieldId}
        className={`${CONTROL} min-h-12 ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

export function TextAreaField({
  label,
  hint,
  error,
  wrapperClassName,
  id,
  className,
  ...rest
}: Common & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} required={rest.required} className={wrapperClassName}>
      <textarea
        id={fieldId}
        className={`${CONTROL} min-h-28 py-3 leading-relaxed ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      />
    </FieldShell>
  );
}

export function SelectField({
  label,
  hint,
  error,
  wrapperClassName,
  id,
  className,
  children,
  ...rest
}: Common & SelectHTMLAttributes<HTMLSelectElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <FieldShell label={label} hint={hint} error={error} id={fieldId} required={rest.required} className={wrapperClassName}>
      <select
        id={fieldId}
        className={`${CONTROL} min-h-12 appearance-none bg-[url("data:image/svg+xml,%3Csvg%20xmlns='http://www.w3.org/2000/svg'%20viewBox='0%200%2016%2016'%3E%3Cpath%20d='M4%206l4%204%204-4'%20fill='none'%20stroke='%2326170a'%20stroke-width='1.5'/%3E%3C/svg%3E")] bg-[length:16px] bg-[right_0.9rem_center] bg-no-repeat pr-10 ${className ?? ""}`}
        aria-invalid={error ? true : undefined}
        aria-describedby={describedBy(fieldId, hint, error)}
        {...rest}
      >
        {children}
      </select>
    </FieldShell>
  );
}

export function CheckboxField({
  label,
  error,
  id,
  className,
  ...rest
}: { readonly label: ReactNode; readonly error?: string | null } & InputHTMLAttributes<HTMLInputElement>) {
  const auto = useId();
  const fieldId = id ?? auto;
  return (
    <div className={className}>
      <label htmlFor={fieldId} className="flex min-h-12 items-start gap-3 py-2 text-sm leading-relaxed text-ink-soft">
        <input
          id={fieldId}
          type="checkbox"
          className="mt-0.5 size-5 shrink-0 rounded-xs border-line-strong accent-ink"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? `${fieldId}-error` : undefined}
          {...rest}
        />
        <span>{label}</span>
      </label>
      {error ? (
        <p id={`${fieldId}-error`} role="alert" className="text-xs font-medium text-danger">
          {error}
        </p>
      ) : null}
    </div>
  );
}
