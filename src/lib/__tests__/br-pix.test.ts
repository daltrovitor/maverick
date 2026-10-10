// Hello World
import { describe, expect, it } from "vitest";
import {
  formatBRL,
  formatBrPhone,
  formatCpf,
  isValidCpf,
  maskCpf,
  normalizeBrPhone,
  normalizeCep,
  parseBRLToCents,
} from "@/lib/br";
import { buildPixPayload, crc16, sanitizePixText } from "@/lib/pix";
import { errorCode } from "@/lib/errors";

describe("CPF", () => {
  it("valida dígitos verificadores e rejeita sequências", () => {
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(isValidCpf("52998224724")).toBe(false);
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("123")).toBe(false);
  });
  it("formata e mascara", () => {
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(maskCpf("52998224725")).toBe("***.982.247-**");
  });
});

describe("telefone e CEP", () => {
  it("normaliza variações para 55+DDD+número", () => {
    expect(normalizeBrPhone("(62) 99999-0002")).toBe("5562999990002");
    expect(normalizeBrPhone("+55 62 99999-0002")).toBe("5562999990002");
    expect(normalizeBrPhone("6233334444")).toBe("556233334444");
    expect(normalizeBrPhone("62 89999-0002")).toBeNull(); // celular sem o 9
    expect(normalizeBrPhone("12345")).toBeNull();
    expect(formatBrPhone("5562999990002")).toBe("(62) 99999-0002");
  });
  it("aceita CEP com ou sem hífen", () => {
    expect(normalizeCep("74000-000")).toBe("74000000");
    expect(normalizeCep("7400")).toBeNull();
  });
});

describe("dinheiro em centavos", () => {
  it("converte entradas do painel", () => {
    expect(parseBRLToCents("129,90")).toBe(12990);
    expect(parseBRLToCents("1.299,90")).toBe(129990);
    expect(parseBRLToCents("R$ 99")).toBe(9900);
    expect(parseBRLToCents("12,999")).toBeNull();
    expect(parseBRLToCents("abc")).toBeNull();
  });
  it("formata em reais", () => {
    expect(formatBRL(12990).replace(/\s/g, " ")).toBe("R$ 129,90");
  });
});

describe("Pix BR Code", () => {
  it("CRC16/CCITT-FALSE confere com o valor de verificação padrão", () => {
    expect(crc16("123456789")).toBe("29B1");
  });

  it("gera payload com campos EMV, valor e CRC corretos", () => {
    const payload = buildPixPayload({
      key: "pix@maverick.test",
      holderName: "Maverick Capshop",
      city: "Goiânia",
      amountCents: 14980,
      txid: "MAV-1042",
    });
    expect(payload.startsWith("000201")).toBe(true);
    expect(payload).toContain("0014br.gov.bcb.pix0117pix@maverick.test");
    expect(payload).toContain("5406149.80");
    expect(payload).toContain("5916MAVERICK CAPSHOP");
    expect(payload).toContain("6007GOIANIA");
    expect(payload).toContain("62110507MAV1042");
    const body = payload.slice(0, -4);
    expect(payload.slice(-4)).toBe(crc16(body));
  });

  it("limpa acentos e limita tamanhos", () => {
    expect(sanitizePixText("São José dos Campos", 15)).toBe("SAO JOSE DOS CA");
  });

  it("recusa valor inválido", () => {
    expect(() => buildPixPayload({ key: "k", holderName: "A", city: "B", amountCents: 0, txid: "1" })).toThrow();
  });
});

describe("mapeamento de erros do banco", () => {
  it("usa o código estável de P0001 e as constraints conhecidas", () => {
    expect(errorCode({ code: "P0001", message: "insufficient_stock" })).toBe("insufficient_stock");
    expect(errorCode({ code: "23505", message: 'duplicate key value violates unique constraint "products_slug_key"' })).toBe(
      "slug_taken",
    );
    expect(errorCode({ code: "42501", message: "forbidden" })).toBe("forbidden");
    expect(errorCode({ code: "XX000", message: "boom" })).toBe("unknown");
  });
});
