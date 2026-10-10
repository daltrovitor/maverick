// Hello World
/**
 * Tradução dos códigos estáveis de erro do banco (SQLSTATE P0001) e de violações
 * conhecidas para mensagens em português. Nada de detalhes internos na interface.
 */
const MESSAGES: Record<string, string> = {
  cart_empty: "Sua sacola está vazia.",
  cart_too_large: "Sua sacola passou do limite por pedido. Divida em pedidos menores.",
  invalid_quantity: "Quantidade inválida para um dos itens.",
  variant_unavailable: "Um dos itens não está mais disponível. Atualize a sacola.",
  insufficient_stock: "Não há estoque suficiente para um dos itens. Ajuste a quantidade.",
  shipping_unavailable: "Ainda não entregamos neste estado. Fale com a gente pelo WhatsApp.",
  coupon_invalid: "Cupom inválido.",
  coupon_not_started: "Este cupom ainda não está valendo.",
  coupon_expired: "Este cupom expirou.",
  coupon_exhausted: "Este cupom atingiu o limite de usos.",
  coupon_customer_limit: "Você já usou este cupom.",
  coupon_min_subtotal: "O valor da sacola não atinge o mínimo deste cupom.",
  pix_unavailable: "O Pix está temporariamente indisponível. Escolha cartão ou tente mais tarde.",
  card_unavailable: "O pagamento com cartão está temporariamente indisponível.",
  amount_too_low: "Valor abaixo do mínimo para cartão.",
  invalid_input: "Confira os dados informados.",
  invalid_transition: "Esta ação não é permitida no estado atual.",
  insufficient_stock_to_reopen: "Sem estoque para reabrir este pedido.",
  not_found: "Registro não encontrado.",
  forbidden: "Você não tem permissão para esta ação.",
  product_needs_variant: "Cadastre ao menos uma variante ativa (preço e estoque).",
  affiliate_invalid_cpf: "CPF inválido.",
  affiliate_invalid_phone: "Telefone inválido. Use DDD + número.",
  affiliate_followers_min: "O programa exige perfil com pelo menos 1.000 seguidores.",
  affiliate_duplicate: "Já existe uma candidatura com este CPF e telefone.",
  rate_limited: "Muitas tentativas em pouco tempo. Aguarde alguns minutos.",
  not_configured: "Serviço ainda não configurado. Tente novamente mais tarde.",
  slug_taken: "Já existe um produto com este endereço (slug).",
  sku_taken: "Já existe uma variante com este SKU.",
  variant_duplicate: "Há variantes repetidas (mesma cor e tamanho).",
  coupon_code_taken: "Já existe um cupom com este código.",
  category_slug_taken: "Já existe uma categoria com este endereço (slug).",
};

const CONSTRAINT_CODES: Record<string, string> = {
  products_slug_key: "slug_taken",
  product_variants_sku_key: "sku_taken",
  product_variants_option_unique: "variant_duplicate",
  coupons_code_unique: "coupon_code_taken",
  categories_slug_key: "category_slug_taken",
};

export interface DbErrorLike {
  code?: string;
  message?: string;
  details?: string | null;
}

/** Extrai o código estável de um erro do Supabase/Postgres. */
export function errorCode(error: DbErrorLike | null | undefined): string {
  if (!error) return "unknown";
  if (error.code === "P0001" && error.message && error.message in MESSAGES) return error.message;
  if (error.code === "42501") return "forbidden";
  if (error.code === "23505") {
    const hit = Object.keys(CONSTRAINT_CODES).find((c) => `${error.message} ${error.details}`.includes(c));
    if (hit) return CONSTRAINT_CODES[hit] ?? "invalid_input";
  }
  if (error.code === "23514" || error.code === "22P02" || error.code === "23502") return "invalid_input";
  if (error.message && error.message in MESSAGES) return error.message;
  return "unknown";
}

export function errorMessage(code: string): string {
  return MESSAGES[code] ?? "Algo deu errado. Tente novamente em instantes.";
}

export function messageFor(error: DbErrorLike | null | undefined): string {
  return errorMessage(errorCode(error));
}
