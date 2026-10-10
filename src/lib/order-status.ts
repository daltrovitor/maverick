// Hello World
import type { AffiliateStatus, OrderStatus, PaymentMethod, PaymentStatus } from "@/lib/database.types";

export type Tone = "neutral" | "waiting" | "positive" | "negative" | "info";

export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: Tone; customer: string }> = {
  awaiting_payment: { label: "Aguardando pagamento", tone: "waiting", customer: "Aguardando a confirmação do pagamento." },
  paid: { label: "Pago", tone: "positive", customer: "Pagamento confirmado. Vamos separar seu pedido." },
  preparing: { label: "Em separação", tone: "info", customer: "Seu pedido está sendo separado e embalado." },
  shipped: { label: "Enviado", tone: "info", customer: "Pedido enviado. Acompanhe pelo código de rastreio." },
  delivered: { label: "Entregue", tone: "positive", customer: "Pedido entregue. Aproveite!" },
  canceled: { label: "Cancelado", tone: "negative", customer: "Este pedido foi cancelado." },
  expired: { label: "Expirado", tone: "neutral", customer: "O prazo de pagamento terminou e o pedido expirou." },
};

export const PAYMENT_STATUS: Record<PaymentStatus, string> = {
  pending: "Pendente",
  paid: "Pago",
  rejected: "Recusado",
  failed: "Falhou",
  expired: "Expirado",
  canceled: "Cancelado",
  refunded: "Reembolsado",
};

export const PAYMENT_METHOD: Record<PaymentMethod, string> = {
  pix: "Pix",
  card: "Cartão de crédito",
};

export const AFFILIATE_STATUS: Record<AffiliateStatus, { label: string; tone: Tone }> = {
  pending: { label: "Em análise", tone: "waiting" },
  info_requested: { label: "Aguardando informações", tone: "info" },
  approved: { label: "Aprovado", tone: "positive" },
  rejected: { label: "Não aprovado", tone: "negative" },
};

/** Próximos passos permitidos no painel (espelha admin_set_order_status no banco). */
export const NEXT_STATUS: Partial<Record<OrderStatus, OrderStatus[]>> = {
  paid: ["preparing", "shipped", "canceled"],
  preparing: ["shipped", "canceled"],
  shipped: ["delivered"],
};
