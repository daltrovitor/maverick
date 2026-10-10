// Hello World
import type { ReactNode } from "react";

export function AdminHeader({
  title,
  description,
  actions,
}: {
  readonly title: string;
  readonly description?: ReactNode;
  readonly actions?: ReactNode;
}) {
  return (
    <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">{title}</h1>
        {description ? <p className="mt-1 max-w-2xl text-sm text-muted">{description}</p> : null}
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </header>
  );
}

export function Panel({
  title,
  children,
  className,
  actions,
}: {
  readonly title?: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly actions?: ReactNode;
}) {
  return (
    <section className={`rounded-sm border border-line bg-paper ${className ?? ""}`}>
      {title ? (
        <div className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <h2 className="text-sm font-semibold">{title}</h2>
          {actions}
        </div>
      ) : null}
      <div className="p-5">{children}</div>
    </section>
  );
}

export function Kpi({ label, value, hint }: { readonly label: string; readonly value: ReactNode; readonly hint?: string }) {
  return (
    <div className="rounded-sm border border-line bg-paper p-5">
      <p className="text-xs text-muted">{label}</p>
      <p className="tabular mt-2 text-2xl font-semibold">{value}</p>
      {hint ? <p className="mt-1 text-xs text-muted">{hint}</p> : null}
    </div>
  );
}

export function TableWrap({ children }: { readonly children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-sm border border-line bg-paper">
      <table className="w-full min-w-[640px] border-collapse text-sm [&_td]:border-t [&_td]:border-line [&_td]:px-4 [&_td]:py-3 [&_th]:px-4 [&_th]:py-3 [&_th]:text-left [&_th]:text-xs [&_th]:font-medium [&_th]:text-muted">
        {children}
      </table>
    </div>
  );
}

export function EmptyState({ children }: { readonly children: ReactNode }) {
  return <p className="rounded-sm border border-dashed border-line-strong bg-paper px-5 py-10 text-center text-sm text-muted">{children}</p>;
}
