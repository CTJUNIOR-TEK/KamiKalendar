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
  sourceUrl?: string;
  version: string;
  updatedAt: string;
}

export interface YearCalendar {
  metadata: CalendarMetadata;
  holidays: HolidayEntry[];
}
