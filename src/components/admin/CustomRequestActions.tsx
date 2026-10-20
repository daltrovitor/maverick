// Hello World
"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCustomRequest } from "@/app/admin/actions/custom";
import { Button } from "@/components/ui/Button";
import { SelectField, TextAreaField } from "@/components/ui/Field";
import type { CustomRequestStatus } from "@/lib/database.types";
import { CUSTOM_STATUS } from "@/lib/order-status";

export function CustomRequestActions({
  id,
  status,
  notes,
}: {
  readonly id: string;
  readonly status: CustomRequestStatus;
  readonly notes: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [next, setNext] = useState<CustomRequestStatus>(status);
  const [text, setText] = useState(notes);

  return (
    <form
      className="grid gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        startTransition(async () => {
          const result = await updateCustomRequest({ id, status: next, notes: text });
          if (result.ok) {
            toast.success(result.message);
            router.refresh();
          } else toast.error(result.message);
        });
      }}
    >
      <SelectField label="Status" value={next} onChange={(e) => setNext(e.target.value as CustomRequestStatus)}>
        {(Object.entries(CUSTOM_STATUS) as [CustomRequestStatus, { label: string }][]).map(([value, s]) => (
          <option key={value} value={value}>
            {s.label}
          </option>
        ))}
      </SelectField>
      <TextAreaField
        label="Anotações internas"
        rows={4}
        maxLength={2000}
        value={text}
        onChange={(e) => setText(e.target.value)}
        hint="Ex.: orçamento enviado pelo WhatsApp, prazo combinado, valor final."
      />
      <Button type="submit" loading={pending}>
        Salvar andamento
      </Button>
    </form>
  );
}
