<!-- Hello World -->
# ViraWeb × Maverick — Proposta Interativa

Aplicação de proposta comercial da **ViraWeb** para a **Maverick Headwear & Lifestyle** (`@maverickcapshop`):
ecossistema digital completo (e-commerce com boné em 3D, programa de afiliados, linha Maverick Gym e máquina de
conteúdo orgânico) em troca de **25% de equity + 25% dos lucros líquidos**.

Composição: **Assimétrica Editorial** (grade de 12 colunas, títulos serifados monumentais, micro-metadados em mono).

## Seções

| # | Seção | Destaques interativos |
|---|-------|------------------------|
| — | Hero — A Aliança Estratégica | Logos ViraWeb (13 polígonos oficiais) e Maverick (monograma vetorial) entrando com curva de mola |
| 01 | Diagnóstico | Gargalos atuais → resposta da ViraWeb |
| 02 | Boné 3D (WebGL) | Rotação 360°/inclinação, 3 edições (sarja, camurça, veludo cotelê), 4 hotspots, vista explodida com 9 camadas |
| 03 | E-commerce | Checkout Pix/cartão, painel de pedidos com alerta WhatsApp, frete por CEP (PAC/SEDEX/Jadlog), vitrines com drop cronometrado, banners |
| 04 | Creator Network | Painel do afiliado: KPIs, gráfico de cliques, link rastreável, cupom, saque via Pix |
| 05 | Maverick Gym | Montagem de kit e impacto no ticket médio (R$ 159 → R$ 420) |
| 06 | Conteúdo viral | Storyboards de 20 s com linha do tempo + 5 formatos de vídeo |
| 07 | O acordo | Oferta, simulador de equity (faturamento, margem, 75/25, valuation 12 meses) e aceite via WhatsApp |

## Stack

Next.js 16 (App Router, páginas estáticas) · React 19 · TypeScript estrito · Tailwind CSS 4 · Three.js ·
Motion (`LazyMotion`) · GSAP + ScrollTrigger + `@gsap/react` · Lenis · lucide-react · Vitest.

## Scripts

```bash
npm install
npm run dev        # desenvolvimento
npm run build      # build de produção
npm start          # servir a build
npm run typecheck  # tsc --noEmit
npm run lint       # ESLint
npm test           # Vitest (domínio + geometria do boné)
```

## Estrutura

```
src/
  app/                 layout (metadados, fontes, sprite de marcas), página, ícone, robots
  components/
    brand/             geometria das marcas (fonte única SVG + Canvas), sprite, lockups
    cap/               modelo 3D procedural (geometria, texturas, cena, canvas) e ilustração SVG
    commerce/          demos da loja
    sections/          seções da proposta
    providers/         Motion, Lenis + GSAP (loop RAF único), revelações por scroll
    ui/                tipografia cinética, revelação, link magnético, parallax
  lib/                 simulador do acordo, frete, countdown, afiliados, kit Gym, conteúdo, formatação
```

## Decisões técnicas

- **Boné 100% procedural**: a copa é uma superfície paramétrica `P(u, v)` (testada em `capGeometry.test.ts`);
  aba, forro, faixa, costuras e bordado derivam dela. O Three.js só é baixado quando a seção se aproxima da tela.
- **Animações sem disputar a primeira pintura**: as marcas do hero animam em CSS com uma curva de mola real
  (stiffness 300, damping 28, amostrada em `linear()`) e só começam após o FCP; títulos cinéticos usam um
  IntersectionObserver por título; revelações usam um ScrollTrigger por grupo, sincronizado ao Lenis pelo ticker do GSAP.
- **Premissas do simulador explícitas** em `src/lib/simulator.ts` (custos, impostos, comissões, múltiplo de valuation).
  Simulação ilustrativa, não constitui garantia de resultado.

## Qualidade (Lighthouse 13, build de produção local)

| | Performance | Acessibilidade | Boas práticas | SEO |
|---|---|---|---|---|
| Desktop | 100 | 100 | 100 | 100 |
| Mobile (simulado) | 82–86 | 100 | 100 | 100 |

CLS 0 em todos os modos. No mobile, o LCP simulado (~3,7 s) é inflado por um adiamento do primeiro frame
(~1,2 s) que ocorre só no Chrome headless com emulação mobile nesta máquina; no Chrome com emulação mobile via
Playwright o título (elemento LCP) pinta em ~300 ms.
