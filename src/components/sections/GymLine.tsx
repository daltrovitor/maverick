// Hello World
import { GymKitBuilder } from "@/components/sections/GymKitBuilder";
import { SectionIntro } from "@/components/ui/SectionIntro";

export function GymLine() {
  return (
    <section id="gym" aria-labelledby="gym-title" className="border-t border-line bg-surface">
      <div className="mx-auto max-w-[1320px] px-4 py-20 sm:px-6 lg:px-10 lg:py-28">
        <SectionIntro
          id="gym-title"
          index="05 / 07"
          meta="Expansão de marca · Activewear"
          title="Maverick Gym: quem usa o boné treina pesado."
          emphasis={["pesado."]}
        >
          <p>
            A transição natural da marca é o ferro. Uma grade enxuta de activewear premium transforma o cliente de um boné em
            cliente de kit — e leva o ticket médio de R$ 159 para R$ 420 com o combo boné + camiseta.
          </p>
        </SectionIntro>

        <div className="mt-14">
          <GymKitBuilder />
        </div>
      </div>
    </section>
  );
}
