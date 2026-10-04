// Hello World
export interface TimeLeft {
  readonly days: number;
  readonly hours: number;
  readonly minutes: number;
  readonly seconds: number;
  readonly done: boolean;
}

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;
const DAY = 24 * HOUR;

/** Horário de Brasília é UTC−3 (sem horário de verão desde 2019). */
const BRT_OFFSET_HOURS = 3;
const DROP_WEEKDAY = 5; // sexta-feira
const DROP_HOUR_BRT = 20;

export function getTimeLeft(targetMs: number, nowMs: number): TimeLeft {
  const diff = Math.max(0, targetMs - nowMs);
  return {
    days: Math.floor(diff / DAY),
    hours: Math.floor((diff % DAY) / HOUR),
    minutes: Math.floor((diff % HOUR) / MINUTE),
    seconds: Math.floor((diff % MINUTE) / SECOND),
    done: diff === 0,
  };
}

/**
 * Próximo drop semanal: sexta-feira às 20h (horário de Brasília).
 * Se a sexta das 20h já passou, agenda para a semana seguinte.
 */
export function nextDropDate(now: Date): Date {
  const nowMs = now.getTime();
  // Campos UTC deste Date correspondem ao relógio de Brasília.
  const brt = new Date(nowMs - BRT_OFFSET_HOURS * HOUR);
  const brtMidnightUtcMs = Date.UTC(brt.getUTCFullYear(), brt.getUTCMonth(), brt.getUTCDate()) + BRT_OFFSET_HOURS * HOUR;
  const daysAhead = (DROP_WEEKDAY - brt.getUTCDay() + 7) % 7;

  let target = brtMidnightUtcMs + daysAhead * DAY + DROP_HOUR_BRT * HOUR;
  if (target <= nowMs) target += 7 * DAY;
  return new Date(target);
}
