// Hello World
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createTestDb, type TestDb } from "./harness";

/** Gera um CPF sintético com dígitos verificadores válidos a partir de 9 dígitos-base. */
function syntheticCpf(base9: string): string {
  const digits = base9.split("").map(Number);
  const dv = (len: number) => {
    const sum = digits.slice(0, len).reduce((acc, d, i) => acc + d * (len + 1 - i), 0);
    const r = (sum * 10) % 11;
    return r === 10 ? 0 : r;
  };
  digits.push(dv(9));
  digits.push(dv(10));
  return digits.join("");
}

interface SavedProduct {
  productId: string;
  variantId: string;
}

let t: TestDb;
let adminId: string;
let customerId: string;

async function saveProduct(slug: string, stock: number, priceCents = 12990, status = "active"): Promise<SavedProduct> {
  const productId = crypto.randomUUID();
  await t.as("authenticated", adminId, () =>
    t.call(`select public.admin_save_product($1::jsonb) as r`, [
      JSON.stringify({
        id: productId,
        slug,
        name: `Boné ${slug}`,
        status,
        variants: [{ color: "Preto", size: "Único", price_cents: priceCents, stock }],
        images: [{ storage_path: `products/${productId}/frente.webp`, alt: "Frente" }],
      }),
    ]),
  );
  const res = await t.db.query<{ id: string }>(
    "select id from public.product_variants where product_id = $1",
    [productId],
  );
  return { productId, variantId: res.rows[0]!.id };
}

function orderPayload(variantId: string, quantity: number, overrides: Record<string, unknown> = {}) {
  return {
    idempotency_key: crypto.randomUUID(),
    payment_method: "pix",
    customer: { name: "Cliente Teste", email: "cliente@example.com", phone: "5562999990000" },
    address: {
      cep: "74000000",
      street: "Rua das Palmeiras",
      number: "100",
      district: "Centro",
      city: "Goiânia",
      uf: "GO",
    },
    items: [{ variant_id: variantId, quantity }],
    ...overrides,
  };
}

async function createOrder(payload: unknown, userId: string | null = null) {
  return t.as("service_role", null, () =>
    t.call<Record<string, unknown>>(`select public.create_order($1::jsonb, $2::uuid) as r`, [
      JSON.stringify(payload),
      userId,
    ]),
  );
}

async function stockOf(variantId: string): Promise<number> {
  const res = await t.db.query<{ stock: number }>("select stock from public.product_variants where id = $1", [variantId]);
  return res.rows[0]!.stock;
}

beforeAll(async () => {
  t = await createTestDb();
  adminId = await t.createUser("admin@maverick.test", "admin");
  customerId = await t.createUser("cliente@example.com");
  await t.as("authenticated", adminId, async () => {
    await t.db.query("insert into public.shipping_rates (uf, price_cents, delivery_estimate) values ('GO', 1990, '3 a 5 dias úteis'), ('SP', 2490, null)");
    await t.db.query(
      "update public.store_settings set pix_key = 'pix@maverick.test', pix_key_type = 'email', pix_holder_name = 'MAVERICK CAPSHOP', pix_city = 'GOIANIA'",
    );
  });
}, 60_000);

afterAll(async () => {
  await t?.close();
});

describe("catálogo e RLS", () => {
  it("começa vazio e o público só enxerga produtos ativos", async () => {
    const empty = await t.as("anon", null, () => t.db.query("select count(*)::int as n from public.products"));
    expect(empty.rows[0]).toEqual({ n: 0 });

    await saveProduct("rascunho", 5, 9990, "draft");
    await saveProduct("ativo", 5);
    const visible = await t.as("anon", null, () => t.db.query<{ slug: string }>("select slug from public.products"));
    expect(visible.rows.map((r) => r.slug)).toEqual(["ativo"]);
  });

  it("cliente não consegue gravar produtos nem promover o próprio papel", async () => {
    await expect(
      t.as("authenticated", customerId, () =>
        t.call(`select public.admin_save_product($1::jsonb) as r`, [JSON.stringify({ id: crypto.randomUUID() })]),
      ),
    ).rejects.toThrow(/forbidden/);

    await expect(
      t.as("authenticated", customerId, () =>
        t.db.query("update public.profiles set role = 'admin' where id = $1", [customerId]),
      ),
    ).rejects.toThrow(/permission denied/);
  });

  it("anônimo não lê pedidos, cupons nem candidaturas", async () => {
    for (const table of ["orders", "coupons", "affiliate_applications"]) {
      await expect(t.as("anon", null, () => t.db.query(`select * from public.${table}`))).rejects.toThrow(
        /permission denied/,
      );
    }
  });

  it("não chama create_order diretamente como anônimo/autenticado", async () => {
    await expect(
      t.as("anon", null, () => t.call(`select public.create_order('{}'::jsonb, null) as r`)),
    ).rejects.toThrow(/permission denied/);
  });
});

describe("pedido", () => {
  it("calcula pelo banco, congela o frete e reserva o estoque", async () => {
    const { variantId } = await saveProduct("calculo", 4, 12990);
    const payload = orderPayload(variantId, 2);
    // Preço adulterado no payload é ignorado: só variant_id e quantidade importam.
    (payload.items[0] as Record<string, unknown>).price_cents = 1;
    const order = await createOrder(payload, customerId);

    expect(order.total_cents).toBe(2 * 12990 + 1990);
    expect(await stockOf(variantId)).toBe(2);

    const row = await t.db.query<{ shipping_cents: number; shipping_uf: string; status: string }>(
      "select shipping_cents, shipping_uf, status from public.orders where id = $1",
      [order.id],
    );
    expect(row.rows[0]).toEqual({ shipping_cents: 1990, shipping_uf: "GO", status: "awaiting_payment" });

    // Alterar o frete depois não muda o pedido.
    await t.as("authenticated", adminId, () => t.db.query("update public.shipping_rates set price_cents = 5000 where uf = 'GO'"));
    const after = await t.db.query<{ shipping_cents: number }>("select shipping_cents from public.orders where id = $1", [order.id]);
    expect(after.rows[0]!.shipping_cents).toBe(1990);
    await t.as("authenticated", adminId, () => t.db.query("update public.shipping_rates set price_cents = 1990 where uf = 'GO'"));
  });

  it("bloqueia UF sem frete configurado e estoque insuficiente", async () => {
    const { variantId } = await saveProduct("bloqueios", 1);
    const noShipping = orderPayload(variantId, 1);
    noShipping.address.uf = "AM";
    await expect(createOrder(noShipping)).rejects.toThrow(/shipping_unavailable/);
    await expect(createOrder(orderPayload(variantId, 2))).rejects.toThrow(/insufficient_stock/);
    expect(await stockOf(variantId)).toBe(1);
  });

  it("é idempotente pela chave do checkout", async () => {
    const { variantId } = await saveProduct("idempotente", 3);
    const payload = orderPayload(variantId, 1);
    const first = await createOrder(payload);
    const replay = await createOrder(payload);
    expect(replay.id).toBe(first.id);
    expect(replay.replayed).toBe(true);
    expect(await stockOf(variantId)).toBe(2);
  });

  it("cliente vê apenas os próprios pedidos; o link secreto funciona sem login", async () => {
    const { variantId } = await saveProduct("privacidade", 2);
    const mine = await createOrder(orderPayload(variantId, 1), customerId);
    const otherId = await t.createUser("outra@example.com");
    const visible = await t.as("authenticated", otherId, () =>
      t.db.query("select id from public.orders where id = $1", [mine.id]),
    );
    expect(visible.rows).toHaveLength(0);

    const viaToken = await t.as("anon", null, () =>
      t.call<{ number: number; items: unknown[] }>(`select public.get_order_by_token($1) as r`, [mine.public_token]),
    );
    expect(viaToken.number).toBe(mine.number);
    expect(viaToken.items).toHaveLength(1);
    const bogus = await t.as("anon", null, () => t.call(`select public.get_order_by_token($1) as r`, ["x".repeat(64)]));
    expect(bogus).toBeNull();
  });
});

describe("Pix manual", () => {
  it("só admin confirma; a confirmação fica auditada", async () => {
    const { variantId } = await saveProduct("pix-ok", 2);
    const order = await createOrder(orderPayload(variantId, 1));
    await expect(
      t.as("authenticated", customerId, () => t.call(`select public.admin_confirm_pix($1, null) as r`, [order.id])),
    ).rejects.toThrow(/forbidden/);

    await t.as("authenticated", adminId, () =>
      t.call(`select public.admin_confirm_pix($1, 'Conferido no extrato') as r`, [order.id]),
    );
    const ev = await t.db.query<{ actor_id: string; message: string }>(
      "select actor_id, message from public.order_events where order_id = $1 and type = 'pix_confirmed'",
      [order.id],
    );
    expect(ev.rows[0]).toEqual({ actor_id: adminId, message: "Conferido no extrato" });
  });

  it("recusa exige motivo e devolve o estoque", async () => {
    const { variantId } = await saveProduct("pix-recusa", 2);
    const order = await createOrder(orderPayload(variantId, 2));
    expect(await stockOf(variantId)).toBe(0);
    await expect(
      t.as("authenticated", adminId, () => t.call(`select public.admin_reject_pix($1, '') as r`, [order.id])),
    ).rejects.toThrow(/invalid_input/);
    await t.as("authenticated", adminId, () =>
      t.call(`select public.admin_reject_pix($1, 'Pix não encontrado no extrato') as r`, [order.id]),
    );
    expect(await stockOf(variantId)).toBe(2);
  });

  it("pedidos vencidos expiram e liberam estoque", async () => {
    const { variantId } = await saveProduct("pix-expira", 3);
    const order = await createOrder(orderPayload(variantId, 3));
    await t.db.query("update public.orders set expires_at = now() - interval '1 minute' where id = $1", [order.id]);
    const n = await t.as("service_role", null, () => t.call<number>(`select public.expire_stale_orders() as r`));
    expect(n).toBeGreaterThanOrEqual(1);
    expect(await stockOf(variantId)).toBe(3);
  });
});

describe("Stripe", () => {
  it("aplica cada evento uma única vez e cancela recusas devolvendo estoque", async () => {
    const { variantId } = await saveProduct("cartao", 2);
    const order = await createOrder(orderPayload(variantId, 1, { payment_method: "card" }));
    await t.as("service_role", null, () =>
      t.db.query("select public.attach_stripe_session($1, 'cs_test_1')", [order.id]),
    );
    const call = (eventId: string, outcome: string) =>
      t.as("service_role", null, () =>
        t.call<string>(
          `select public.process_stripe_event($1, 'checkout.session.completed', $2, 'cs_test_1', 'pi_1', $3) as r`,
          [eventId, order.id, outcome],
        ),
      );
    expect(await call("evt_1", "paid")).toBe("paid");
    expect(await call("evt_1", "paid")).toBe("duplicate");
    expect(await call("evt_2", "paid")).toBe("already_paid");

    const failed = await createOrder(orderPayload(variantId, 1, { payment_method: "card" }));
    expect(await stockOf(variantId)).toBe(0);
    const r = await t.as("service_role", null, () =>
      t.call<string>(`select public.process_stripe_event('evt_3', 'checkout.session.async_payment_failed', $1, null, null, 'failed') as r`, [failed.id]),
    );
    expect(r).toBe("failed");
    expect(await stockOf(variantId)).toBe(1);
  });

  it("pagamento tardio sem estoque gera alerta de conflito", async () => {
    const { variantId } = await saveProduct("cartao-tardio", 1);
    const order = await createOrder(orderPayload(variantId, 1, { payment_method: "card" }));
    await t.db.query("update public.orders set expires_at = now() - interval '1 minute' where id = $1", [order.id]);
    await t.as("service_role", null, () => t.call(`select public.expire_stale_orders() as r`));
    await createOrder(orderPayload(variantId, 1)); // outro cliente leva a última unidade
    const r = await t.as("service_role", null, () =>
      t.call<string>(`select public.process_stripe_event('evt_late', 'checkout.session.completed', $1, null, 'pi_late', 'paid') as r`, [order.id]),
    );
    expect(r).toBe("stock_conflict");
  });
});

describe("afiliados", () => {
  const base = (cpf: string, phone: string) => ({
    full_name: "João da Silva",
    cpf,
    phone,
    email: "joao@example.com",
    platform: "instagram",
    profile_url: "https://instagram.com/joao",
    followers_declared: 4200,
    audience: "Público jovem de Goiânia interessado em streetwear.",
    sales_forecast_monthly: 15,
    sales_forecast_basis: "Média de 3% de conversão nos últimos stories de produto.",
    strategy: "Stories semanais com cupom fixado e reels de look do dia.",
    channels: ["stories", "reels"],
    truth_confirmed: true,
    privacy_consent: true,
  });
  const submit = (payload: unknown) =>
    t.as("service_role", null, () =>
      t.call<{ status_token?: string; id?: string; error?: string }>(
        `select public.submit_affiliate_application($1::jsonb, null) as r`,
        [JSON.stringify(payload)],
      ),
    );

  it("valida CPF e mínimo de 1.000 seguidores", async () => {
    await expect(submit(base("12345678900", "62999990001"))).rejects.toThrow(/affiliate_invalid_cpf/);
    await expect(submit({ ...base(syntheticCpf("111444777"), "62999990001"), followers_declared: 999 })).rejects.toThrow(
      /affiliate_followers_min/,
    );
  });

  it("bloqueia a mesma combinação CPF + telefone e registra a tentativa", async () => {
    const cpf = syntheticCpf("529982247");
    const first = await submit(base(cpf, "(62) 99999-0002"));
    expect(first.status_token).toMatch(/^[0-9a-f]{64}$/);

    const dup = await submit(base(cpf, "+55 62 99999-0002"));
    expect(dup.error).toBe("affiliate_duplicate");
    const attempts = await t.db.query<{ n: number }>("select count(*)::int as n from public.affiliate_attempts where cpf = $1", [cpf]);
    expect(attempts.rows[0]!.n).toBe(1);

    // Mesmo CPF com outro telefone não é a mesma combinação.
    const other = await submit(base(cpf, "62988887777"));
    expect(other.status_token).toBeDefined();
  });

  it("aprovação exige seguidores verificados e gera cupom de 25% por 24h, 1 uso por cliente", async () => {
    const created = await submit(base(syntheticCpf("390533447"), "62999990003"));
    await expect(
      t.as("authenticated", adminId, () =>
        t.call(`select public.admin_approve_affiliate($1, 800, null) as r`, [created.id]),
      ),
    ).rejects.toThrow(/affiliate_followers_min/);

    const approved = await t.as("authenticated", adminId, () =>
      t.call<{ code: string; expires_at: string }>(`select public.admin_approve_affiliate($1, 4100, 'Perfil conferido') as r`, [created.id]),
    );
    expect(approved.code).toMatch(/^MAV-JOAO-[0-9A-F]{4}$/);

    const coupon = await t.db.query<{ value: number; kind: string; hours: number; per: number }>(
      "select value, kind, extract(epoch from (expires_at - starts_at))/3600 as hours, max_uses_per_customer as per from public.coupons where code = $1",
      [approved.code],
    );
    expect(coupon.rows[0]).toMatchObject({ value: 25, kind: "percent", per: 1 });
    expect(Number(coupon.rows[0]!.hours)).toBe(24);

    const { variantId } = await saveProduct("afiliado", 5, 10000);
    const order = await createOrder(orderPayload(variantId, 1, { coupon_code: approved.code.toLowerCase() }));
    expect(order.total_cents).toBe(10000 - 2500 + 1990);
    await expect(createOrder(orderPayload(variantId, 1, { coupon_code: approved.code }))).rejects.toThrow(
      /coupon_customer_limit/,
    );
    // Outro cliente pode usar o mesmo código dentro das 24h.
    const otherCustomer = orderPayload(variantId, 1, { coupon_code: approved.code });
    otherCustomer.customer.email = "amigo@example.com";
    await expect(createOrder(otherCustomer)).resolves.toMatchObject({ total_cents: 10000 - 2500 + 1990 });

    // Após o vencimento, o backend recusa.
    await t.db.query("update public.coupons set starts_at = now() - interval '25 hours', expires_at = now() - interval '1 hour' where code = $1", [approved.code]);
    const late = orderPayload(variantId, 1, { coupon_code: approved.code });
    late.customer.email = "atrasado@example.com";
    await expect(createOrder(late)).rejects.toThrow(/coupon_expired/);

    const status = await t.as("anon", null, () =>
      t.call<{ status: string; coupon: { code: string } }>(`select public.get_affiliate_status($1) as r`, [created.status_token]),
    );
    expect(status.status).toBe("approved");
    expect(status.coupon.code).toBe(approved.code);
  });
});
