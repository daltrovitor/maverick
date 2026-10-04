// Hello World
/** WhatsApp comercial da ViraWeb (DDI 55 + DDD 62). */
export const VIRAWEB_WHATSAPP = "5562992516554";

export function buildWhatsAppUrl(message: string, phone: string = VIRAWEB_WHATSAPP): string {
  const digits = phone.replace(/\D/g, "");
  if (digits.length < 12 || digits.length > 13) {
    throw new Error(`Número de WhatsApp inválido: ${phone}`);
  }
  return `https://wa.me/${digits}?text=${encodeURIComponent(message.trim())}`;
}
