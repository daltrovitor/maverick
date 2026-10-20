// Hello World
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { quoteCustom } from "../../src/lib/custom-pricing";
import { createTestDb, type TestDb } from "./harness";

let t: TestDb;
let adminId: string;

const CPF = "52998224725";

async function saveProduct(slug: string, stock: number, extra: Record<string, unknown> = {}, variant: Record<string, unknown> = {}) {
  const productId = crypto.randomUUID();
  await t.as("authenticated", adminId, () =>
    t.call(`select public.admin_save_product($1::jsonb) as r`, [
      JSON.stringify({
        id: productId,
        slug,
        name: `Boné ${slug}`,
        status: "active",
        variants: [{ color: "Preto", size: "Único", price_cents: 12990, stock, ...variant }],
        images: [],
        ...extra,
      }),
    ]),
  );
  const res = await t.db.query<{ id: string }>("select id from public.product_variants where product_id = $1", [productId]);
  return { productId, variantId: res.rows[0]!.id };
}

async function createOrder(variantId: string, method: "pix" | "card", quantity = 1) {
  return t.as("service_role", null, () =>
    t.call<{ id: string; number: number; public_token: string }>(`select public.create_order($1::jsonb, null) as r`, [
      JSON.stringify({
        idempotency_key: crypto.randomUUID(),
        payment_method: method,
        customer: { name: "Cliente Teste", email: "cliente@example.com", phone: "5562999990000", document: CPF },
        address: { cep: "74000000", street: "Rua A", number: "1", district: "Centro", city: "Goiânia", uf: "GO" },
        items: [{ variant_id: variantId, quantity }],
      }),
    ]),
  );
}

const service = <T,>(sql: string, params: unknown[] = []) => t.as("service_role", null, () => t.call<T>(sql, params));

async function orderRow(id: string) {
  const res = await t.db.query<Record<string, unknown>>("select * from public.orders where id = $1", [id]);
  return res.rows[0]!;
}

async function stockOf(variantId: string) {
  const res = await t.db.query<{ stock: number }>("select stock from public.product_variants where id = $1", [variantId]);
  return res.rows[0]!.stock;
}

beforeAll(async () => {
  t = await createTestDb();
  adminId = await t.createUser("admin@maverick.test", "admin");
  await t.as("authenticated", adminId, () =>
    t.db.query("insert into public.shipping_rates (uf, price_cents) values ('GO', 1990)"),
  );
}, 60_000);

afterAll(async () => {
  await t?.close();
});

describe("Pix e cartão pelo PaymentIntent", () => {
  it("Pix pelo Stripe dispensa a chave manual e guarda CPF e provedor no pedido", async () => {
    const { variantId } = await saveProduct("pix-stripe", 3);
    const order = await createOrder(variantId, "pix");
    const row = await orderRow(order.id);
    expect(row.pix_provider).toBe("stripe");
    expect(row.customer_document).toBe(CPF);
  });

  it("CPF inválido é recusado pelo banco", async () => {
    const { variantId } = await saveProduct("cpf-invalido", 3);
    await expect(
      t.as("service_role", null, () =>
        t.call(`select public.create_order($1::jsonb, null) as r`, [
          JSON.stringify({
            idempotency_key: crypto.randomUUID(),
            payment_method: "card",
            customer: { name: "Cliente Teste", email: "c@example.com", phone: "5562999990000", document: "12345678900" },
            address: { cep: "74000000", street: "Rua A", number: "1", district: "Centro", city: "Goiânia", uf: "GO" },
            items: [{ variant_id: variantId, quantity: 1 }],
          }),
        ]),
      ),
    ).rejects.toThrow(/invalid_input/);
  });

  it("vincula o QR do Pix e o expõe no link secreto só enquanto aguarda", async () => {
    const { variantId } = await saveProduct("pix-qr", 3);
    const order = await createOrder(variantId, "pix");
    await service(`select public.attach_payment_intent($1, 'pi_pix123', '00020126PIXDATA', now() + interval '1 hour') as r`, [order.id]);
    const view = await t.as("anon", null, () =>
      t.call<{ pix_qr_data: string; pix_provider: string }>(`select public.get_order_by_token($1) as r`, [order.public_token]),
    );
    expect(view.pix_qr_data).toBe("00020126PIXDATA");
    expect(view.pix_provider).toBe("stripe");

    const paid = await service<string>(
      `select public.process_payment_intent_event('evt_pix_ok', 'payment_intent.succeeded', $1, 'pi_pix123', 'paid') as r`,
      [order.id],
    );
    expect(paid).toBe("paid");
    const replay = await service<string>(
      `select public.process_payment_intent_event('evt_pix_ok', 'payment_intent.succeeded', $1, 'pi_pix123', 'paid') as r`,
      [order.id],
    );
    expect(replay).toBe("duplicate");
    const sync = await service<string>(
      `select public.process_payment_intent_event('sync:pi_pix123:succeeded', 'sync.succeeded', $1, 'pi_pix123', 'paid') as r`,
      [order.id],
    );
    expect(sync).toBe("already_paid");

    const after = await t.as("anon", null, () =>
      t.call<{ status: string; pix_qr_data: string | null }>(`select public.get_order_by_token($1) as r`, [order.public_token]),
    );
    expect(after.status).toBe("paid");
    expect(after.pix_qr_data).toBeNull();
    const events = await t.db.query<{ type: string; actor_kind: string }>(
      "select type, actor_kind from public.order_events where order_id = $1 and type = 'pix_confirmed'",
      [order.id],
    );
    expect(events.rows).toEqual([{ type: "pix_confirmed", actor_kind: "stripe" }]);
  });

  it("cartão recusado mantém o pedido aberto; Pix expirado devolve o estoque", async () => {
    const card = await saveProduct("cartao-recusa", 2);
    const cardOrder = await createOrder(card.variantId, "card");
    await service(`select public.attach_payment_intent($1, 'pi_card1') as r`, [cardOrder.id]);
    const failed = await service<string>(
      `select public.process_payment_intent_event('evt_card_fail', 'payment_intent.payment_failed', $1, 'pi_card1', 'failed') as r`,
      [cardOrder.id],
    );
    expect(failed).toBe("attempt_failed");
    expect((await orderRow(cardOrder.id)).status).toBe("awaiting_payment");
    expect(await stockOf(card.variantId)).toBe(1);

    const pix = await saveProduct("pix-expira", 2);
    const pixOrder = await createOrder(pix.variantId, "pix");
    await service(`select public.attach_payment_intent($1, 'pi_pixexp', 'DATA', null) as r`, [pixOrder.id]);
    const expired = await service<string>(
      `select public.process_payment_intent_event('evt_pix_exp', 'payment_intent.payment_failed', $1, 'pi_pixexp', 'failed') as r`,
      [pixOrder.id],
    );
    expect(expired).toBe("expired");
    expect((await orderRow(pixOrder.id)).status).toBe("expired");
    expect(await stockOf(pix.variantId)).toBe(2);
  });

  it("ignora eventos de um PaymentIntent substituído", async () => {
    const { variantId } = await saveProduct("pi-trocado", 2);
    const order = await createOrder(variantId, "card");
    await service(`select public.attach_payment_intent($1, 'pi_antigo') as r`, [order.id]);
    await service(`select public.attach_payment_intent($1, 'pi_novo') as r`, [order.id]);
    const ignored = await service<string>(
      `select public.process_payment_intent_event('evt_antigo', 'payment_intent.succeeded', $1, 'pi_antigo', 'paid') as r`,
      [order.id],
    );
    expect(ignored).toBe("ignored");
    expect((await orderRow(order.id)).status).toBe("awaiting_payment");
  });

  it("admin cancela Pix do Stripe pendente; Pix manual continua exigindo a recusa com motivo", async () => {
    const stripePix = await saveProduct("cancela-pix-stripe", 2);
    const order = await createOrder(stripePix.variantId, "pix");
    await t.as("authenticated", adminId, () =>
      t.call(`select public.admin_set_order_status($1, 'canceled', null, 'cliente desistiu') as r`, [order.id]),
    );
    expect((await orderRow(order.id)).status).toBe("canceled");
    expect(await stockOf(stripePix.variantId)).toBe(2);

    await t.as("authenticated", adminId, () =>
      t.db.query(
        "update public.store_settings set pix_provider = 'manual', pix_key = 'pix@maverick.test', pix_key_type = 'email', pix_holder_name = 'MAVERICK', pix_city = 'GOIANIA'",
      ),
    );
    const manual = await saveProduct("cancela-pix-manual", 2);
    const manualOrder = await createOrder(manual.variantId, "pix");
    expect((await orderRow(manualOrder.id)).pix_provider).toBe("manual");
    await expect(
      t.as("authenticated", adminId, () =>
        t.call(`select public.admin_set_order_status($1, 'canceled', null, null) as r`, [manualOrder.id]),
      ),
    ).rejects.toThrow(/invalid_transition/);
    await t.as("authenticated", adminId, () => t.db.query("update public.store_settings set pix_provider = 'stripe'"));
  });

  it("funções de pagamento não são públicas", async () => {
    await expect(
      t.as("anon", null, () => t.call(`select public.attach_payment_intent(gen_random_uuid(), 'pi_x') as r`)),
    ).rejects.toThrow(/permission denied/);
    await expect(
      t.as("authenticated", adminId, () =>
        t.call(`select public.process_payment_intent_event('e', 't', gen_random_uuid(), 'pi_x', 'paid') as r`),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("Dimona", () => {
  it("produto Dimona publicado exige SKU por variante e ao menos uma arte", async () => {
    await expect(saveProduct("dimona-sem-sku", 999, { fulfillment: "dimona", dimona_designs: { front: "https://x.example/a.png" } })).rejects.toThrow(
      /dimona_incomplete/,
    );
    await expect(saveProduct("dimona-sem-arte", 999, { fulfillment: "dimona", dimona_designs: {} }, { dimona_sku_id: "0106" })).rejects.toThrow(
      /dimona_incomplete/,
    );
    const ok = await saveProduct(
      "dimona-ok",
      999,
      { fulfillment: "dimona", dimona_designs: { front: "https://x.example/a.png" }, dimona_mocks: {} },
      { dimona_sku_id: "010603110108" },
    );
    const files = await t.db.query<{ designs: Record<string, string> }>(
      "select designs from public.product_dimona where product_id = $1",
      [ok.productId],
    );
    expect(files.rows[0]!.designs).toEqual({ front: "https://x.example/a.png" });
  });

  it("artes da Dimona não ficam visíveis ao público", async () => {
    await expect(t.as("anon", null, () => t.db.query("select * from public.product_dimona"))).rejects.toThrow(/permission denied/);
  });

  it("registra o envio e aplica o webhook pelo nosso identificador", async () => {
    const { variantId } = await saveProduct("dimona-pedido", 999, { fulfillment: "dimona", dimona_designs: { front: "https://x.example/a.png" } }, {
      dimona_sku_id: "010603110109",
    });
    const order = await createOrder(variantId, "card");
    await service(`select public.dimona_mark_failed($1, 'Dimona (500): fora do ar') as r`, [order.id]);
    expect((await orderRow(order.id)).dimona_last_error).toBe("Dimona (500): fora do ar");

    // Webhook chega antes de gravarmos o id da Dimona: localiza por seller_id (MAV-<número>).
    const first = await service<string>(
      `select public.dimona_apply_status('123-456-789', $1, 3, 'Em produção', 'https://status.example/123') as r`,
      [`MAV-${order.number}`],
    );
    expect(first).toBe("updated");
    const row = await orderRow(order.id);
    expect(row).toMatchObject({
      dimona_order_id: "123-456-789",
      dimona_status: "Em produção",
      dimona_status_id: 3,
      dimona_tracking_url: "https://status.example/123",
    });
    const repeat = await service<string>(
      `select public.dimona_apply_status('123-456-789', null, 3, 'Em produção', null) as r`,
    );
    expect(repeat).toBe("unchanged");
    const unknown = await service<string>(`select public.dimona_apply_status('999', 'MAV-999999', 1, 'x', null) as r`);
    expect(unknown).toBe("not_found");

    const view = await t.as("anon", null, () =>
      t.call<{ delivery_tracking_url: string }>(`select public.get_order_by_token($1) as r`, [order.public_token]),
    );
    expect(view.delivery_tracking_url).toBe("https://status.example/123");
  });
});

describe("boné personalizado", () => {
  const request = (quantity: number) => ({
    name: "Cliente Personalizado",
    email: "Personal@Example.com",
    phone: "(62) 99999-0000",
    quantity,
    cap_model: "trucker",
    cap_color: "Preto",
    technique: "bordado",
    notes: "Logo na frente",
    design_path: `requests/${crypto.randomUUID()}/arte.png`,
    design_mime: "image/png",
    design_size: 2048,
    privacy_consent: true,
  });

  it("calcula o desconto no banco com a mesma regra da calculadora do site", async () => {
    await t.as("authenticated", adminId, () =>
      t.db.query(
        "update public.store_settings set custom_unit_price_cents = 3333, custom_step_units = 10, custom_step_bps = 250, custom_max_discount_bps = 1000, custom_max_quantity = 500",
      ),
    );
    for (const quantity of [1, 9, 10, 25, 47, 200]) {
      const saved = await service<{ estimated_total_cents: number; discount_bps: number }>(
        `select public.submit_custom_request($1::jsonb, null) as r`,
        [JSON.stringify(request(quantity))],
      );
      const expected = quoteCustom(quantity, {
        unitPriceCents: 3333,
        minQuantity: 1,
        maxQuantity: 500,
        stepUnits: 10,
        stepBps: 250,
        maxDiscountBps: 1000,
      });
      expect(Number(saved.estimated_total_cents)).toBe(expected.totalCents);
      expect(saved.discount_bps).toBe(expected.discountBps);
    }
    const row = await t.db.query<{ customer_email: string; customer_phone: string }>(
      "select customer_email, customer_phone from public.custom_cap_requests order by created_at desc limit 1",
    );
    expect(row.rows[0]).toEqual({ customer_email: "personal@example.com", customer_phone: "5562999990000" });
  });

  it("respeita os limites e a pausa configurados no painel", async () => {
    await expect(service(`select public.submit_custom_request($1::jsonb, null) as r`, [JSON.stringify(request(501))])).rejects.toThrow(
      /custom_quantity_range/,
    );
    await t.as("authenticated", adminId, () => t.db.query("update public.store_settings set custom_enabled = false"));
    await expect(service(`select public.submit_custom_request($1::jsonb, null) as r`, [JSON.stringify(request(5))])).rejects.toThrow(
      /custom_unavailable/,
    );
    await t.as("authenticated", adminId, () => t.db.query("update public.store_settings set custom_enabled = true"));
  });

  it("só o admin lê e atualiza; o público não grava direto", async () => {
    const customerId = await t.createUser("curioso@example.com");
    await expect(t.as("anon", null, () => t.db.query("select * from public.custom_cap_requests"))).rejects.toThrow(/permission denied/);
    const asCustomer = await t.as("authenticated", customerId, () => t.db.query("select id from public.custom_cap_requests"));
    expect(asCustomer.rows).toHaveLength(0);
    await expect(
      t.as("anon", null, () => t.call(`select public.submit_custom_request($1::jsonb, null) as r`, [JSON.stringify(request(5))])),
    ).rejects.toThrow(/permission denied/);

    const asAdmin = await t.as("authenticated", adminId, () =>
      t.db.query<{ id: string }>("select id from public.custom_cap_requests limit 1"),
    );
    const id = asAdmin.rows[0]!.id;
    await t.as("authenticated", adminId, () =>
      t.db.query("update public.custom_cap_requests set status = 'quoted', admin_notes = 'Orçamento enviado' where id = $1", [id]),
    );
    await expect(
      t.as("authenticated", adminId, () =>
        t.db.query("update public.custom_cap_requests set estimated_total_cents = 1 where id = $1", [id]),
      ),
    ).rejects.toThrow(/permission denied/);
  });
});
