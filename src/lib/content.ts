// Hello World
/** Conteúdo editorial da proposta ViraWeb × Maverick. */

export const NAV_ITEMS = [
  { href: "#produto-3d", label: "Produto 3D" },
  { href: "#ecommerce", label: "E-commerce" },
  { href: "#afiliados", label: "Afiliados" },
  { href: "#gym", label: "Linha Gym" },
  { href: "#conteudo", label: "Conteúdo" },
  { href: "#proposta", label: "O acordo" },
] as const;

export const HERO_FACTS = [
  { label: "Modelo", value: "Tech Partner & Venture Studio" },
  { label: "Investimento da Maverick", value: "R$ 0,00 em software" },
  { label: "Contrapartida", value: "25% equity + 25% dos lucros" },
] as const;

export interface DiagnosisItem {
  readonly id: string;
  readonly problem: string;
  readonly detail: string;
  readonly answer: string;
}

export const DIAGNOSIS: readonly DiagnosisItem[] = [
  {
    id: "dm",
    problem: "Venda manual no “chama na DM”",
    detail:
      "Cada pedido depende de conversa no WhatsApp ou no Direct. Fora do horário comercial a venda esfria e escalar exigiria contratar atendentes.",
    answer: "Checkout transparente com Pix e cartão em 1 clique, aberto 24 horas.",
  },
  {
    id: "prova",
    problem: "Sem prova de valor imersiva",
    detail:
      "Fotos estáticas não mostram a costura reforçada, o relevo do bordado, a aba estruturada nem a textura da sarja, da camurça ou do veludo cotelê.",
    answer: "Boné em 3D interativo com vista explodida e pontos técnicos clicáveis.",
  },
  {
    id: "categoria",
    problem: "Uma única categoria de produto",
    detail: "Operar só com bonés limita o ticket médio e o valor de cada cliente fiel ao longo do tempo.",
    answer: "Linha Maverick Gym: combo boné + camiseta eleva o ticket de R$ 159 para R$ 420.",
  },
  {
    id: "base",
    problem: "Marca em fase de lançamento",
    detail:
      "92 seguidores e 9 publicações: o momento ideal para construir a base certa antes de escalar, sem retrabalho.",
    answer: "Rede de criadores com link rastreável e roteiros de conteúdo orgânico validados.",
  },
];

export interface CapHotspotContent {
  readonly id: "bordado" | "fecho" | "forro" | "selo";
  readonly title: string;
  readonly spec: string;
  readonly body: string;
}

export const CAP_HOTSPOTS: readonly CapHotspotContent[] = [
  {
    id: "bordado",
    title: "Bordado 3D frontal de alta densidade",
    spec: "+15.000 pontos · enchimento puff",
    body: "Relevo com espuma interna que não achata depois das lavagens. Cada cavalo é bordado em fio de alta tenacidade.",
  },
  {
    id: "fecho",
    title: "Fecho em couro legítimo",
    spec: "Couro curtido ao vegetal · fivela gravada",
    body: "Tira em couro legítimo com fivela metálica personalizada com o monograma Maverick. Ajuste preciso que envelhece bem.",
  },
  {
    id: "forro",
    title: "Forro interno antissuor acetinado",
    spec: "Toque frio · faixa absorvente",
    body: "Forro acetinado e faixa antissuor que absorvem a umidade e protegem a estrutura da copa contra deformação.",
  },
  {
    id: "selo",
    title: "Etiqueta selo numerado",
    spec: "Edição de lançamento · Nº 027 / 100",
    body: "Cada peça do primeiro lote recebe numeração individual tecida: autenticidade e colecionismo desde o dia um.",
  },
];

export interface CommerceFeature {
  readonly id: string;
  readonly title: string;
  readonly body: string;
}

export const COMMERCE_FEATURES: readonly CommerceFeature[] = [
  {
    id: "checkout",
    title: "Checkout transparente",
    body: "Pix com confirmação em tempo real e cartão de crédito em 1 clique, sem sair da loja.",
  },
  {
    id: "pedidos",
    title: "Pedidos em tempo real",
    body: "Painel do lojista com alerta no WhatsApp e status Separando, Enviado e Entregue.",
  },
  {
    id: "frete",
    title: "Frete automático",
    body: "Melhor Envio e Correios (PAC, SEDEX) e Jadlog calculando prazo e valor pelo CEP.",
  },
  {
    id: "vitrines",
    title: "Categorias & drops",
    body: "Trucker Premium, Snapback Clássico e Edições Limitadas com cronômetro regressivo.",
  },
  {
    id: "banners",
    title: "Banners com micro-motion",
    body: "Vitrines institucionais com transições suaves do lifestyle Maverick.",
  },
];

export interface GymProduct {
  readonly id: "camiseta" | "dryfit" | "bermuda" | "regata";
  readonly name: string;
  readonly spec: string;
  readonly price: number;
}

export const GYM_PRODUCTS: readonly GymProduct[] = [
  {
    id: "camiseta",
    name: "Camiseta Oversized Heavyweight",
    spec: "Algodão 260 g/m² · estampa rústica minimalista nas costas",
    price: 279,
  },
  {
    id: "dryfit",
    name: "Boné técnico Dry-Fit",
    spec: "Impermeável e resistente ao suor para treinos intensos",
    price: 169,
  },
  {
    id: "bermuda",
    name: "Bermuda de compressão",
    spec: "Compressão graduada com bolso lateral para celular",
    price: 149,
  },
  {
    id: "regata",
    name: "Regata cavada",
    spec: "Modelagem aesthetic com cava profunda",
    price: 129,
  },
];

export interface ScriptBeat {
  readonly label: string;
  readonly from: number;
  readonly to: number;
  readonly text: string;
}

export interface ViralScript {
  readonly id: string;
  readonly title: string;
  readonly angle: string;
  readonly beats: readonly ScriptBeat[];
}

export const VIRAL_SCRIPTS: readonly ViralScript[] = [
  {
    id: "resistencia",
    title: "O teste extremo de resistência",
    angle: "Curiosidade & prova",
    beats: [
      { label: "Gancho", from: 0, to: 3, text: "“Tentamos destruir o boné mais resistente do Brasil.”" },
      {
        label: "Desenvolvimento",
        from: 3,
        to: 15,
        text: "A caminhonete passa por cima, o boné afunda na lama, vai para a lavagem e volta com a estrutura intacta.",
      },
      { label: "CTA", from: 15, to: 20, text: "“Acesse o site no link da bio e garanta o seu no primeiro lote.”" },
    ],
  },
  {
    id: "unboxing",
    title: "O unboxing cinematográfico",
    angle: "Desejo & luxo silencioso",
    beats: [
      {
        label: "Gancho",
        from: 0,
        to: 3,
        text: "ASMR da caixa de madeira ou do papel kraft selado com lacre de cera.",
      },
      {
        label: "Desenvolvimento",
        from: 3,
        to: 15,
        text: "Câmera macro no bordado do cavalo, no toque do tecido e no brilho da fivela.",
      },
      { label: "CTA", from: 15, to: 20, text: "“Edição de lançamento limitada a 100 unidades numeradas.”" },
    ],
  },
  {
    id: "campo-ferro",
    title: "Estética rural & academia",
    angle: "Identidade & tribo",
    beats: [
      { label: "Gancho", from: 0, to: 3, text: "“A transição de quem trabalha no campo e treina pesado.”" },
      {
        label: "Desenvolvimento",
        from: 3,
        to: 15,
        text: "Cortes ritmados ao som de country contemporâneo ou phonk rústico: o mesmo boné na fazenda e no treino.",
      },
      { label: "CTA", from: 15, to: 20, text: "“Para quem carrega o mesmo estilo na terra e no ferro. Linha Maverick.”" },
    ],
  },
];

export interface ViralFormat {
  readonly format: string;
  readonly hook: string;
  readonly retention: string;
  readonly cta: string;
  readonly audio: string;
}

export const VIRAL_FORMATS: readonly ViralFormat[] = [
  {
    format: "Teste de durabilidade extrema",
    hook: "Cortar a aba com tesoura (não corta) ou pisar com bota de montaria",
    retention: "Memória elástica da estrutura e costura quádrupla em close macro",
    cta: "“O boné oficial de quem não aceita produto descartável. Link na bio.”",
    audio: "Áudio original ASMR de impacto",
  },
  {
    format: "Unboxing sensorial premium",
    hook: "Corte do selo de cera ou abertura da fita gomada personalizada",
    retention: "Cheiro do tecido novo, textura do fecho de metal, encaixe perfeito na cabeça",
    cta: "“Edição de lançamento limitada a 100 unidades numeradas. Garanta o seu.”",
    audio: "Batida grave lo-fi ou trilha cinematográfica",
  },
  {
    format: "Get ready with me — country to gym",
    hook: "Colocando a bota e o boné às 5h da manhã para a fazenda",
    retention: "Transição de corte rápido para o treino pesado usando o mesmo boné",
    cta: "“Para quem carrega o mesmo estilo na terra e no ferro. Linha Maverick.”",
    audio: "Country rock moderno ou phonk suave",
  },
  {
    format: "O erro dos bonés comuns",
    hook: "Pegar um boné promocional amassado e deformado",
    retention: "Por que o forro da Maverick não deforma e absorve o suor",
    cta: "“Pare de usar boné que parece brinde. Eleve seu padrão no link da bio.”",
    audio: "Narração dinâmica com tom seguro",
  },
  {
    format: "Bastidores do bordado",
    hook: "Agulha industrial em alta velocidade bordando a cabeça do cavalo",
    retention: "A precisão dos mais de 15.000 pontos do bordado frontal 3D",
    cta: "“Cada detalhe foi desenhado para durar uma vida inteira. Conheça no site.”",
    audio: "Sons mecânicos ritmados com trilha",
  },
];

export const VIRAWEB_CONTRIBUTIONS = [
  "Desenvolvimento completo da plataforma de e-commerce de elite",
  "Modelagem e renderização 3D do boné e das próximas peças",
  "Automação de pagamentos (Pix e cartão) e cálculo de frete",
  "Sistema próprio de afiliados com comissões via Pix",
  "Suporte técnico contínuo, infraestrutura e segurança",
  "Consultoria de growth, CRO e roteiros de conteúdo",
] as const;

export const DEAL_REASONS = [
  {
    title: "Risco zero de capital em software",
    body: "Uma plataforma deste nível custaria entre R$ 35.000 e R$ 70.000 numa software house tradicional, além das mensalidades de manutenção.",
  },
  {
    title: "Alinhamento total de interesses",
    body: "A ViraWeb não entrega um site e vai embora: como sócia, otimiza conversão, infraestrutura e automação todos os meses.",
  },
  {
    title: "Multiplicador de valuation",
    body: "Tecnologia proprietária, base de afiliados rastreada e esteira diversificada (bonés + Gym) valem mais no mercado.",
  },
] as const;

export const ROADMAP = [
  { window: "Semanas 1–2", title: "Imersão & identidade digital", body: "Arquitetura da loja, catálogo, fotografia e modelagem 3D." },
  { window: "Semanas 3–6", title: "Loja no ar", body: "Checkout Pix/cartão, frete automático, painel de pedidos e boné 3D." },
  { window: "Semanas 7–8", title: "Creator Network", body: "Painel de afiliados, cupons, links rastreáveis e comissões via Pix." },
  { window: "Mês 3 em diante", title: "Growth contínuo", body: "Roteiros virais, CRO mensal e preparação do drop Maverick Gym." },
] as const;
