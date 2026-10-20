// Hello World
import { describe, expect, it } from "vitest";
import { buildDimonaOrderPayload, cleanDimonaFiles, dimonaOrderRef, dimonaPhone } from "@/lib/dimona-payload";

const input = {
  orderNumber: 1042,
  customerName: "Cliente Teste",
  customerEmail: "cliente@example.com",
  customerPhone: "5562999990000",
  customerDocument: "52998224725",
  address: {
    cep: "74000000",
    street: "Rua das Palmeiras",
    number: "100",
    complement: null,
    district: "Centro",
    city: "Goiânia",
    uf: "GO",
  },
  shippingSpeed: "pac" as const,
  webhookUrl: "https://maverick.viraweb.dev.br/api/webhooks/dimona",
  items: [
    {
      productName: "Boné Trucker",
      variantLabel: "Preto / Único",
      sku: "MAV-TRK-PT",
      quantity: 2,
      dimonaSkuId: "010603110108",
      designs: { front: "https://cdn.example.com/arte-frente.png", back: "http://inseguro.example.com/x.png" },
      mocks: {},
    },
  ],
};

describe("payload da Dimona (API v3)", () => {
  it("usa o nosso número como order_id e formata documento, telefone e CEP", () => {
    const payload = buildDimonaOrderPayload(input);
    expect(payload.order_id).toBe(dimonaOrderRef(1042));
    expect(payload.order_id).toBe("MAV-1042");
    expect(payload.customer_document).toBe("529.982.247-25");
    expect(payload.address).toMatchObject({
      phone: "62 999990000",
      zipcode: "74000000",
      state: "GO",
      neighborhood: "Centro",
      complement: "",
      country: "BR",
    });
    expect(payload.webhook_url).toBe(input.webhookUrl);
    expect(payload.shipping_speed).toBe("pac");
  });

  it("monta os itens com SKU Dimona e só artes https", () => {
    const [item] = buildDimonaOrderPayload(input).items;
    expect(item).toEqual({
      name: "Boné Trucker Preto / Único",
      sku: "MAV-TRK-PT",
      qty: 2,
      dimona_sku_id: "010603110108",
      designs: { front: "https://cdn.example.com/arte-frente.png" },
      mocks: {},
    });
  });

  it("omite campos opcionais vazios", () => {
    const payload = buildDimonaOrderPayload({ ...input, customerDocument: null, webhookUrl: null });
    expect(payload).not.toHaveProperty("customer_document");
    expect(payload).not.toHaveProperty("webhook_url");
  });

  it("normaliza telefone e arquivos", () => {
    expect(dimonaPhone("556232221100")).toBe("62 32221100");
    expect(cleanDimonaFiles({ front: "  https://a.example/x.png  ", back: "" })).toEqual({ front: "https://a.example/x.png" });
  });
});
