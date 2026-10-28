import type { YearCalendar, HolidayEntry, CalendarMetadata } from './types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

// Carrega de forma estática e síncrona via Vite glob eager todos os JSONs em ../../calendars/*.json
const calendarModules = import.meta.glob<YearCalendar | { default: YearCalendar }>(
  '../../calendars/*.json',
  { eager: true }
);

function isValidDateStringForYear(date: string, expectedYear: number): boolean {
  if (!DATE_REGEX.test(date)) return false;
  const parts = date.split('-');
  const yStr = parts[0];
  const mStr = parts[1];
  const dStr = parts[2];
  if (!yStr || !mStr || !dStr) return false;

  const y = Number(yStr);
  const m = Number(mStr);
  const d = Number(dStr);

  if (y !== expectedYear) return false;

  const utc = new Date(Date.UTC(y, m - 1, d));
  return (
    utc.getUTCFullYear() === y &&
    utc.getUTCMonth() === m - 1 &&
    utc.getUTCDate() === d
  );
}

function isValidHoliday(item: unknown, expectedYear: number): item is HolidayEntry {
  if (!item || typeof item !== 'object') return false;
  const candidate = item as Record<string, unknown>;
  const date = candidate['date'];
  const name = candidate['name'];
  const type = candidate['type'];

  if (typeof date !== 'string' || !isValidDateStringForYear(date, expectedYear)) {
    return false;
  }
  if (typeof name !== 'string' || name.trim().length === 0) {
    return false;
  }
  if ('type' in candidate && type !== undefined) {
    if (typeof type !== 'string' || type.trim().length === 0) {
      return false;
    }
  }
  return true;
}

function isValidMetadata(meta: unknown): meta is CalendarMetadata {
  if (!meta || typeof meta !== 'object') return false;
  const candidate = meta as Record<string, unknown>;
  return (
    typeof candidate['year'] === 'number' &&
    typeof candidate['source'] === 'string' &&
    typeof candidate['version'] === 'string' &&
    typeof candidate['updatedAt'] === 'string'
  );
}

export function validateAndExtractYearCalendar(
  mod: YearCalendar | { default: YearCalendar },
  path: string
): YearCalendar {
  const match = path.match(/\/(\d{4})\.json$/);
  if (!match || !match[1]) {
    throw new Error(`Caminho de calendário com formato inválido: "${path}". Esperado: */{year}.json`);
  }
  const fileYear = Number(match[1]);

  const content = 'default' in mod ? mod.default : mod;
  if (!isValidMetadata(content.metadata)) {
    throw new Error(`Metadados de calendário inválidos no arquivo "${path}".`);
  }

  if (content.metadata.year !== fileYear) {
    throw new Error(
      `Inconsistência no calendário em "${path}": metadata.year (${content.metadata.year}) difere do ano do arquivo (${fileYear}).`
    );
  }

  if (!Array.isArray(content.holidays) || content.holidays.length === 0) {
    throw new Error(`Lista de feriados inválida ou vazia no arquivo "${path}".`);
  }

  const seenDates = new Set<string>();
  for (const holiday of content.holidays) {
    if (!isValidHoliday(holiday, fileYear)) {
      throw new Error(
        `Feriado inválido encontrado no arquivo "${path}": data deve ser ISO real pertencente a ${fileYear}, nome não vazio e type consistente.`
      );
    }
    if (seenDates.has(holiday.date)) {
      throw new Error(`Data duplicada encontrada no calendário "${path}": ${holiday.date}`);
    }
    seenDates.add(holiday.date);
  }

  return content;
}

const calendarMap = new Map<number, YearCalendar>();

for (const [path, mod] of Object.entries(calendarModules)) {
  const parsed = validateAndExtractYearCalendar(mod, path);
  if (calendarMap.has(parsed.metadata.year)) {
    throw new Error(`Ano duplicado detectado para o calendário ${parsed.metadata.year} no caminho "${path}".`);
  }
  calendarMap.set(parsed.metadata.year, parsed);
}

/**
 * Retorna o calendário para o ano solicitado a partir do mapa estático em memória.
 * Lança erro explícito se o ano não estiver presente.
 */
export function getCalendarForYear(year: number): YearCalendar {
  const calendar = calendarMap.get(year);
  if (!calendar) {
    const availableYears = Array.from(calendarMap.keys()).sort((a, b) => a - b).join(', ');
    throw new Error(
      `Calendário não encontrado para o ano ${year}. Anos disponíveis: [${availableYears}]. ` +
      `Execute 'npm run sync-calendars' para atualizar ou incluir anos necessários.`
    );
  }
  return calendar;
}

export function getAvailableCalendarYears(): number[] {
  return Array.from(calendarMap.keys()).sort((a, b) => a - b);
}
