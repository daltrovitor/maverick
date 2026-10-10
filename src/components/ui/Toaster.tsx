// Hello World
"use client";

import { Toaster as Sonner } from "sonner";

/** Avisos de confirmação/erro (região ARIA live gerenciada pelo Sonner). */
export function Toaster() {
  return (
    <Sonner
      position="bottom-center"
      theme="light"
      toastOptions={{
        classNames: {
          toast: "!rounded-sm !border !border-line !bg-paper !text-ink !shadow-[0_8px_30px_rgba(38,23,10,0.12)] !font-sans",
          description: "!text-muted",
          error: "!border-danger/40",
          success: "!border-success/40",
        },
      }}
    />
  );
}
