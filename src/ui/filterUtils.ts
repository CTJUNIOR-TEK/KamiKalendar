import type { DiscardedDayDetail } from '../calculation';

export interface DiscardedDaysFilterOptions {
  hideWeekends: boolean;
}

/**
 * Filtra a lista de dias descartados conforme a preferência de ocultação de fins de semana.
 * Regra: Filtra SOMENTE `reason === 'weekend'`. Ocorrências mistas (`reason === 'weekend_and_holiday'`)
 * e feriados puros (`reason === 'holiday'`) permanecem visíveis para auditoria rigorosa.
 */
export function filterDiscardedDays(
  discardedDays: DiscardedDayDetail[],
  hideWeekends: boolean
): DiscardedDayDetail[] {
  if (!hideWeekends) {
    return discardedDays;
  }
  return discardedDays.filter((d) => d.reason !== 'weekend');
}
