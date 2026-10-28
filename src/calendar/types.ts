/**
 * Contratos de tipos para calendários versionados.
 */

export interface HolidayEntry {
  date: string; // Formato ISO estrito: YYYY-MM-DD
  name: string;
  type?: string;
}

export interface CalendarMetadata {
  year: number;
  source: string;
  version: string;
  updatedAt: string;
}

export interface YearCalendar {
  metadata: CalendarMetadata;
  holidays: HolidayEntry[];
}

/**
 * Placeholder para o serviço de calendários anuais.
 * Nas fases 2-4 será integrado com arquivos JSON versionados.
 */
export function getCalendarForYear(year: number): YearCalendar {
  throw new Error(`Calendário para o ano ${year} ainda não implementado na fase 1.`);
}
