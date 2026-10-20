// Hello World
import { formatCpf } from "@/lib/br";
import type { DimonaFiles, DimonaShippingSpeed, ShippingAddress } from "@/lib/database.types";

/**
 * Montagem do corpo do POST /api/v3/order da Dimona (módulo puro, testável).
 * Referência: https://api.camisadimona.com.br/ (coleção "Dimona API V2", requisição
 * "Create Order - Named Attributes on Design").
 */
export interface DimonaOrderItemInput {
  productName: string;
  variantLabel: string | null;
  sku: string | null;
  quantity: number;
  dimonaSkuId: string;
  designs: DimonaFiles;
  mocks: DimonaFiles;
}

export interface DimonaOrderInput {
  orderNumber: number;
  customerName: string;
  customerEmail: string;
  /** Telefone E.164 sem "+", como gravado no pedido (ex.: 5562999990000). */
  customerPhone: string;
  customerDocument: string | null;
  address: ShippingAddress;
  shippingSpeed: DimonaShippingSpeed;
  webhookUrl: string | null;
  items: DimonaOrderItemInput[];
}

export interface DimonaOrderPayload {
  order_id: string;
  shipping_speed: DimonaShippingSpeed;
  customer_name: string;
  customer_document?: string;
  customer_email: string;
  webhook_url?: string;
  items: {
    name: string;
    sku: string;
    qty: number;
    dimona_sku_id: string;
    designs: DimonaFiles;
    mocks: DimonaFiles;
  }[];
  address: {
    name: string;
    street: string;
    number: string;
    complement: string;
    city: string;
    state: string;
    zipcode: string;
    neighborhood: string;
    phone: string;
    country: "BR";
  };
}

/** Identificador do nosso pedido na Dimona (volta no webhook como seller_id). */
export function dimonaOrderRef(orderNumber: number): string {
  return `MAV-${orderNumber}`;
}

/** 5562999990000 → "62 999990000" (formato do exemplo da API). */
export function dimonaPhone(e164: string): string {
  const national = e164.replace(/\D/g, "").replace(/^55/, "");
  return national.length >= 10 ? `${national.slice(0, 2)} ${national.slice(2)}` : national;
}

/** Mantém apenas URLs https nos lados aceitos pela API. */
export function cleanDimonaFiles(files: DimonaFiles | null | undefined): DimonaFiles {
  const out: DimonaFiles = {};
  for (const [side, url] of Object.entries(files ?? {}) as [keyof DimonaFiles, string | undefined][]) {
    if (typeof url === "string" && /^https:\/\/\S+$/i.test(url.trim())) out[side] = url.trim();
  }
  return out;
}

export function buildDimonaOrderPayload(input: DimonaOrderInput): DimonaOrderPayload {
  const ref = dimonaOrderRef(input.orderNumber);
  const payload: DimonaOrderPayload = {
    order_id: ref,
    shipping_speed: input.shippingSpeed,
    customer_name: input.customerName,
    customer_email: input.customerEmail,
    items: input.items.map((item, i) => ({
      name: [item.productName, item.variantLabel].filter(Boolean).join(" "),
      sku: item.sku ?? `${ref}-${i + 1}`,
      qty: item.quantity,
      dimona_sku_id: item.dimonaSkuId,
      designs: cleanDimonaFiles(item.designs),
      mocks: cleanDimonaFiles(item.mocks),
    })),
    address: {
      name: input.customerName,
      street: input.address.street,
      number: input.address.number,
      complement: input.address.complement ?? "",
      city: input.address.city,
      state: input.address.uf,
      zipcode: input.address.cep.replace(/\D/g, ""),
      neighborhood: input.address.district,
      phone: dimonaPhone(input.customerPhone),
      country: "BR",
    },
  };
  if (input.customerDocument) payload.customer_document = formatCpf(input.customerDocument);
  if (input.webhookUrl) payload.webhook_url = input.webhookUrl;
  return payload;
}
