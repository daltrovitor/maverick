// Hello World
"use client";

import { useSearchParams } from "next/navigation";
import { useEffect } from "react";

export const COUPON_STORAGE_KEY = "maverick.coupon.v1";

/**
 * Guarda o código vindo de links de afiliado (?cupom=CODIGO) para pré-preencher o checkout.
 * A validade real (24h, 1 uso por cliente) é sempre conferida no banco.
 */
export function CouponCapture() {
  const params = useSearchParams();
  useEffect(() => {
    const raw = params.get("cupom");
    if (!raw) return;
    const code = raw.trim().toUpperCase();
    if (!/^[A-Z0-9-]{3,32}$/.test(code)) return;
    try {
      window.localStorage.setItem(COUPON_STORAGE_KEY, code);
    } catch {
      // armazenamento indisponível
    }
  }, [params]);
  return null;
}

export function readStoredCoupon(): string {
  try {
    return window.localStorage.getItem(COUPON_STORAGE_KEY) ?? "";
  } catch {
    return "";
  }
}

export function clearStoredCoupon() {
  try {
    window.localStorage.removeItem(COUPON_STORAGE_KEY);
  } catch {
    // ignore
  }
}
