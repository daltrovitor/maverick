// Hello World
import type { ReactNode } from "react";

interface DemoCardProps {
  readonly index: string;
  readonly title: string;
  readonly description: string;
  readonly children: ReactNode;
  readonly className?: string;
  readonly id?: string;
}

/** Moldura editorial das demonstrações interativas da loja. */
export function DemoCard({ index, title, description, children, className = "", id }: DemoCardProps) {
  return (
    <article id={id} className={`flex flex-col rounded-sm border border-line bg-white ${className}`}>
      <header className="flex items-start justify-between gap-4 border-b border-line px-5 py-4 sm:px-6">
        <div>
          <h3 className="text-base font-medium text-ink">{title}</h3>
          <p className="mt-1 text-sm leading-relaxed text-muted">{description}</p>
        </div>
        <span className="tabular shrink-0 font-mono text-[11px] text-muted">{index}</span>
      </header>
      <div className="flex flex-1 flex-col p-5 sm:p-6">{children}</div>
    </article>
  );
}
