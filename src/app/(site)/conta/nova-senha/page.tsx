// Hello World
import type { Metadata } from "next";
import { NewPasswordForm } from "@/components/account/AuthForms";

export const metadata: Metadata = { title: "Nova senha", robots: { index: false } };

export default function NewPasswordPage() {
  return (
    <div className="mx-auto max-w-md px-4 pt-16 pb-24">
      <h1 className="type-brand mb-8 text-3xl">Criar nova senha</h1>
      <NewPasswordForm />
    </div>
  );
}
