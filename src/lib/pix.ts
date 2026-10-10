// Hello World
/**
 * BR Code do Pix (padrão EMV® QRCPS-MPM do Banco Central) para cobrança estática com valor.
 * O pagamento é conferido manualmente no painel; o código só facilita o "copia e cola".
 */

export interface PixPayloadInput {
  key: string;
  holderName: string; // até 25 caracteres, ASCII maiúsculo
  city: string; // até 15 caracteres, ASCII maiúsculo
  amountCents: number;
  txid: string; // até 25 caracteres alfanuméricos
  description?: string;
}

function field(id: string, value: string): string {
  const length = value.length;
  if (length > 99) throw new Error(`Campo Pix ${id} excede 99 caracteres`);
  return `${id}${String(length).padStart(2, "0")}${value}`;
}

/** Remove acentos e caracteres fora do conjunto aceito pelos bancos. */
export function sanitizePixText(value: string, max: number): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[^A-Za-z0-9 ]/g, "")
    .toUpperCase()
    .trim()
    .slice(0, max);
}

/** CRC16/CCITT-FALSE (polinômio 0x1021, inicial 0xFFFF), exigido no campo 63. */
export function crc16(payload: string): string {
  let crc = 0xffff;
  for (let i = 0; i < payload.length; i++) {
    crc ^= payload.charCodeAt(i) << 8;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 0x8000 ? (crc << 1) ^ 0x1021 : crc << 1;
      crc &= 0xffff;
    }
  }
  return crc.toString(16).toUpperCase().padStart(4, "0");
}

export function buildPixPayload(input: PixPayloadInput): string {
  if (!Number.isInteger(input.amountCents) || input.amountCents <= 0) {
    throw new Error("Valor do Pix inválido");
  }
  const key = input.key.trim();
  if (!key) throw new Error("Chave Pix ausente");
  const txid = input.txid.replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
  const description = input.description ? sanitizePixText(input.description, 40) : "";

  const merchantAccount = field(
    "26",
    field("00", "br.gov.bcb.pix") + field("01", key) + (description ? field("02", description) : ""),
  );

  const payload =
    field("00", "01") +
    merchantAccount +
    field("52", "0000") +
    field("53", "986") +
    field("54", (input.amountCents / 100).toFixed(2)) +
    field("58", "BR") +
    field("59", sanitizePixText(input.holderName, 25)) +
    field("60", sanitizePixText(input.city, 15)) +
    field("62", field("05", txid)) +
    "6304";

  return payload + crc16(payload);
}
