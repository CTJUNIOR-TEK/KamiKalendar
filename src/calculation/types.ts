import { getCalendarForYear } from '../calendar';
import type { CalendarMetadata } from '../calendar/types';

export interface CountBusinessDaysParams {
  startDate: string; // ISO YYYY-MM-DD
  endDate: string;   // ISO YYYY-MM-DD
}

export interface AddBusinessDaysParams {
  startDate: string; // ISO YYYY-MM-DD
  days: number;      // Inteiro >= 0
}

export type DiscardReason = 'weekend' | 'holiday' | 'weekend_and_holiday';

export interface DiscardedDayDetail {
  date: string;
  reason: DiscardReason;
  holidayName?: string;
}

export interface DetailedCountResult {
  businessDays: number;
  totalDays: number;
  startDate: string;
  endDate: string;
  discardedDays: DiscardedDayDetail[];
  calendarMetadata: CalendarMetadata[];
}

export interface DetailedAddResult {
  startDate: string;
  targetBusinessDays: number;
  endDate: string;
  discardedDays: DiscardedDayDetail[];
  calendarMetadata: CalendarMetadata[];
}

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MAX_ADD_BUSINESS_DAYS_LIMIT = 50000;
const MAX_SEARCH_CALENDAR_DAYS = 200000;

export function parseAndValidateISODate(dateStr: string): { year: number; month: number; day: number; utcTime: number } {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    throw new Error(`Data "${dateStr}" inválida. Formato esperado estrito: YYYY-MM-DD.`);
  }

  const [yStr, mStr, dStr] = dateStr.split('-');
  const year = Number(yStr);
  const month = Number(mStr);
  const day = Number(dStr);

  if (year < 1900 || year > 9999) {
    throw new Error(`Ano ${year} fora do intervalo suportado (1900 a 9999).`);
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Data de calendário inexistente: "${dateStr}".`);
  }

  return { year, month, day, utcTime: utc.getTime() };
}

export function formatISODate(utcTime: number): string {
  const d = new Date(utcTime);
  const y = d.getUTCFullYear().toString().padStart(4, '0');
  const m = (d.getUTCMonth() + 1).toString().padStart(2, '0');
  const day = d.getUTCDate().toString().padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function isWeekendDay(utcTime: number): boolean {
  const dayOfWeek = new Date(utcTime).getUTCDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0 = Domingo, 6 = Sábado
}

interface YearHolidaysCache {
  holidaysMap: Map<string, string>;
  metadata: CalendarMetadata;
}

function createYearCalendarResolver() {
  const cache = new Map<number, YearHolidaysCache>();

  return {
    getYearData(year: number): YearHolidaysCache {
      let data = cache.get(year);
      if (!data) {
        const cal = getCalendarForYear(year);
        const map = new Map<string, string>();
        for (const h of cal.holidays) {
          map.set(h.date, h.name);
        }
        data = { holidaysMap: map, metadata: cal.metadata };
        cache.set(year, data);
      }
      return data;
    },
    getCollectedMetadata(): CalendarMetadata[] {
      return Array.from(cache.values()).map((v) => v.metadata);
    },
  };
}

const ONE_DAY_MS = 24 * 60 * 60 * 1000;

export function countBusinessDaysDetailed(params: CountBusinessDaysParams): DetailedCountResult {
  const { startDate, endDate } = params;
  const startParsed = parseAndValidateISODate(startDate);
  const endParsed = parseAndValidateISODate(endDate);

  if (startParsed.utcTime > endParsed.utcTime) {
    throw new Error(
      `Data inicial (${startDate}) não pode ser posterior à data final (${endDate}). Para contar intervalos invertidos, inverta as datas.`
    );
  }

  const resolver = createYearCalendarResolver();
  const discardedDays: DiscardedDayDetail[] = [];
  let businessDays = 0;
  let totalDays = 0;

  for (let currentMs = startParsed.utcTime; currentMs <= endParsed.utcTime; currentMs += ONE_DAY_MS) {
    totalDays++;
    const currentDateStr = formatISODate(currentMs);
    const curYear = new Date(currentMs).getUTCFullYear();
    const yearData = resolver.getYearData(curYear);

    const isWeekend = isWeekendDay(currentMs);
    const holidayName = yearData.holidaysMap.get(currentDateStr);
    const isHoliday = holidayName !== undefined;

    if (isWeekend && isHoliday) {
      discardedDays.push({
        date: currentDateStr,
        reason: 'weekend_and_holiday',
        holidayName,
      });
    } else if (isWeekend) {
      discardedDays.push({
        date: currentDateStr,
        reason: 'weekend',
      });
    } else if (isHoliday) {
      discardedDays.push({
        date: currentDateStr,
        reason: 'holiday',
        holidayName,
      });
    } else {
      businessDays++;
    }
  }

  return {
    businessDays,
    totalDays,
    startDate,
    endDate,
    discardedDays,
    calendarMetadata: resolver.getCollectedMetadata(),
  };
}

export function addBusinessDaysDetailed(params: AddBusinessDaysParams): DetailedAddResult {
  const { startDate, days } = params;
  parseAndValidateISODate(startDate);

  if (typeof days !== 'number' || !Number.isInteger(days) || days < 0) {
    throw new Error(`Quantidade de dias (${days}) inválida. Deve ser um número inteiro maior ou igual a zero.`);
  }

  if (days > MAX_ADD_BUSINESS_DAYS_LIMIT) {
    throw new Error(
      `Quantidade de dias solicitada (${days}) excede o limite máximo permitido de ${MAX_ADD_BUSINESS_DAYS_LIMIT} dias úteis.`
    );
  }

  const resolver = createYearCalendarResolver();
  const startParsed = parseAndValidateISODate(startDate);

  // Valida e carrega o calendário do ano da data inicial antes de avançar, incluindo seus metadados
  resolver.getYearData(startParsed.year);

  // Se N = 0, retorna a própria data inicial conforme especificação
  if (days === 0) {
    return {
      startDate,
      targetBusinessDays: 0,
      endDate: startDate,
      discardedDays: [],
      calendarMetadata: resolver.getCollectedMetadata(),
    };
  }

  const discardedDays: DiscardedDayDetail[] = [];
  let addedBusinessDays = 0;
  let currentMs = startParsed.utcTime;
  let iterations = 0;

  // Adição a partir do DIA SEGUINTE
  while (addedBusinessDays < days) {
    currentMs += ONE_DAY_MS;
    iterations++;

    if (iterations > MAX_SEARCH_CALENDAR_DAYS) {
      throw new Error(`Limite de segurança de dias de busca (${MAX_SEARCH_CALENDAR_DAYS}) atingido.`);
    }

    const currentDateStr = formatISODate(currentMs);
    const curYear = new Date(currentMs).getUTCFullYear();
    const yearData = resolver.getYearData(curYear);

    const isWeekend = isWeekendDay(currentMs);
    const holidayName = yearData.holidaysMap.get(currentDateStr);
    const isHoliday = holidayName !== undefined;

    if (isWeekend && isHoliday) {
      discardedDays.push({
        date: currentDateStr,
        reason: 'weekend_and_holiday',
        holidayName,
      });
    } else if (isWeekend) {
      discardedDays.push({
        date: currentDateStr,
        reason: 'weekend',
      });
    } else if (isHoliday) {
      discardedDays.push({
        date: currentDateStr,
        reason: 'holiday',
        holidayName,
      });
    } else {
      addedBusinessDays++;
    }
  }

  return {
    startDate,
    targetBusinessDays: days,
    endDate: formatISODate(currentMs),
    discardedDays,
    calendarMetadata: resolver.getCollectedMetadata(),
  };
}

export function countBusinessDays(params: CountBusinessDaysParams): number {
  return countBusinessDaysDetailed(params).businessDays;
}

export function addBusinessDays(params: AddBusinessDaysParams): string {
  return addBusinessDaysDetailed(params).endDate;
}
