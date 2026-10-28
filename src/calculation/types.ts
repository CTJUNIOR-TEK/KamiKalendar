/**
 * Tipos e contratos de funções de cálculo de dias úteis.
 */

export interface CountBusinessDaysParams {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
}

export interface AddBusinessDaysParams {
  startDate: string; // ISO YYYY-MM-DD
  days: number;      // Inteiro >= 0
}

/**
 * Placeholder inicial de contagem de dias úteis (não simula cálculo funcional).
 */
export function countBusinessDays(_params: CountBusinessDaysParams): number {
  throw new Error('countBusinessDays não implementado: reservado para a fase 2.');
}

/**
 * Placeholder inicial de adição de dias úteis (não simula cálculo funcional).
 */
export function addBusinessDays(_params: AddBusinessDaysParams): string {
  throw new Error('addBusinessDays não implementado: reservado para a fase 2.');
}
