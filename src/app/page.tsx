// Hello World
import { Suspense } from "react";
import { SiteFooter } from "@/components/layout/SiteFooter";
import { SiteHeader } from "@/components/layout/SiteHeader";
import { Affiliates } from "@/components/sections/Affiliates";
import { CapShowcase } from "@/components/sections/CapShowcase";
import { Commerce } from "@/components/sections/Commerce";
import { Deal } from "@/components/sections/Deal";
import { Diagnosis } from "@/components/sections/Diagnosis";
import { GymLine } from "@/components/sections/GymLine";
import { Hero } from "@/components/sections/Hero";
import { ViralMachine } from "@/components/sections/ViralMachine";

export default function ProposalPage() {
  return (
    <>
      <a
        href="#conteudo-principal"
        className="sr-only z-50 rounded-sm bg-ink px-4 py-3 text-sm text-white focus:not-sr-only focus:fixed focus:left-4 focus:top-4"
      >
        Pular para o conteúdo
      </a>
      <SiteHeader />
      <main id="conteudo-principal">
        <Hero />
        <Suspense>
          <Diagnosis />
        </Suspense>
        <Suspense>
          <CapShowcase />
        </Suspense>
        <Suspense>
          <Commerce />
        </Suspense>
        <Suspense>
          <Affiliates />
        </Suspense>
        <Suspense>
          <GymLine />
        </Suspense>
        <Suspense>
          <ViralMachine />
        </Suspense>
        <Suspense>
          <Deal />
        </Suspense>
      </main>
      <SiteFooter />
    </>
  );
}
