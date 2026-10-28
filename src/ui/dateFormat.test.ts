import { describe, it, expect } from 'vitest';
import {
  formatIsoToDisplay,
  parseDisplayDateToIso,
  expandTwoDigitYear,
  normalizeDisplayDate,
  formatIncrementalDateInput,
  formatUpdatedAt,
  formatErrorMessageDates,
} from './dateFormat';
import { filterDiscardedDays } from './filterUtils';
import type { DiscardedDayDetail } from '../calculation';

describe('UI Date Formatting & Parsing', () => {
  describe('expandTwoDigitYear', () => {
    it('expands two-digit years 00..99 TESTED unambiguously to 2000..2099', () => {
      expect(expandTwoDigitYear(0)).toBe(2000);
      expect(expandTwoDigitYear(26)).toBe(2026);
      expect(expandTwoDigitYear(99)).toBe(2099);
    });

    it('preserves four-digit years', () => {
      expect(expandTwoDigitYear(2026)).toBe(2026);
      expect(expandTwoDigitYear(1995)).toBe(1995);
    });
  });

  describe('formatIsoToDisplay', () => {
    it('converts valid ISO YYYY-MM-DD to DD/MM/YYYY', () => {
      expect(formatIsoToDisplay('2026-01-01')).toBe('01/01/2026');
      expect(formatIsoToDisplay('2028-02-29')).toBe('29/02/2028');
      expect(formatIsoToDisplay('2025-12-31')).toBe('31/12/2025');
    });

    it('returns raw value if not standard ISO string', () => {
      expect(formatIsoToDisplay('not-a-date')).toBe('not-a-date');
      expect(formatIsoToDisplay('')).toBe('');
    });
  });

  describe('parseDisplayDateToIso', () => {
    it('parses standard DD/MM/YYYY date to ISO YYYY-MM-DD', () => {
      expect(parseDisplayDateToIso('01/01/2026')).toEqual({
        iso: '2026-01-01',
        year: 2026,
        month: 1,
        day: 1,
      });
      expect(parseDisplayDateToIso('31/12/2025')).toEqual({
        iso: '2025-12-31',
        year: 2025,
        month: 12,
        day: 31,
      });
      expect(parseDisplayDateToIso('03/10/2026')).toEqual({
        iso: '2026-10-03',
        year: 2026,
        month: 10,
        day: 3,
      });
    });

    it('parses short formats with slashes: 3/10/26 -> 03/10/2026 and 1/1/26 -> 01/01/2026', () => {
      expect(parseDisplayDateToIso('3/10/26')).toEqual({
        iso: '2026-10-03',
        year: 2026,
        month: 10,
        day: 3,
      });
      expect(parseDisplayDateToIso('1/1/26')).toEqual({
        iso: '2026-01-01',
        year: 2026,
        month: 1,
        day: 1,
      });
      expect(parseDisplayDateToIso('3/10/2026')).toEqual({
        iso: '2026-10-03',
        year: 2026,
        month: 10,
        day: 3,
      });
    });

    it('parses continuous digits without separators: 031026 (6 digits) and 03102026 (8 digits)', () => {
      expect(parseDisplayDateToIso('031026')).toEqual({
        iso: '2026-10-03',
        year: 2026,
        month: 10,
        day: 3,
      });
      expect(parseDisplayDateToIso('03102026')).toEqual({
        iso: '2026-10-03',
        year: 2026,
        month: 10,
        day: 3,
      });
    });

    it('handles zero year 00 correctly as 2000', () => {
      expect(parseDisplayDateToIso('01/01/00')).toEqual({
        iso: '2000-01-01',
        year: 2000,
        month: 1,
        day: 1,
      });
      expect(parseDisplayDateToIso('010100')).toEqual({
        iso: '2000-01-01',
        year: 2000,
        month: 1,
        day: 1,
      });
    });

    it('correctly handles leap years (e.g. 29/02/2028 and 29/02/28 are valid leap year)', () => {
      expect(parseDisplayDateToIso('29/02/2028')).toEqual({
        iso: '2028-02-29',
        year: 2028,
        month: 2,
        day: 29,
      });
      expect(parseDisplayDateToIso('29/02/28')).toEqual({
        iso: '2028-02-29',
        year: 2028,
        month: 2,
        day: 29,
      });
      expect(parseDisplayDateToIso('290228')).toEqual({
        iso: '2028-02-29',
        year: 2028,
        month: 2,
        day: 29,
      });
      // 2000 is leap year
      expect(parseDisplayDateToIso('290200')).toEqual({
        iso: '2000-02-29',
        year: 2000,
        month: 2,
        day: 29,
      });
    });

    it('rejects 29/02 in non-leap years (e.g. 29/02/2026 or 29/02/26 or 290226)', () => {
      expect(() => parseDisplayDateToIso('29/02/2026')).toThrowError(
        /Data inexistente no calendário/
      );
      expect(() => parseDisplayDateToIso('29/02/26')).toThrowError(
        /Data inexistente no calendário/
      );
      expect(() => parseDisplayDateToIso('290226')).toThrowError(
        /Data inexistente no calendário/
      );
    });

    it('rejects 1-digit and 3-digit years to avoid ambiguity', () => {
      expect(() => parseDisplayDateToIso('3/10/2')).toThrowError(
        /Ano "2" inválido/
      );
      expect(() => parseDisplayDateToIso('3/10/202')).toThrowError(
        /Ano "202" inválido/
      );
      expect(() => parseDisplayDateToIso('03/10/6')).toThrowError(
        /Ano "6" inválido/
      );
    });

    it('rejects ambiguous continuous digit counts other than 6 or 8 digits', () => {
      expect(() => parseDisplayDateToIso('31026')).toThrowError(
        /Formato numérico contínuo ambíguo \(5 dígitos\)/
      );
      expect(() => parseDisplayDateToIso('3102026')).toThrowError(
        /Formato numérico contínuo ambíguo \(7 dígitos\)/
      );
      expect(() => parseDisplayDateToIso('031020261')).toThrowError(
        /Formato numérico contínuo ambíguo \(9 dígitos\)/
      );
    });

    it('rejects invalid days of month (e.g. 31/04/2026, 32/01/2026, 00/01/2026)', () => {
      expect(() => parseDisplayDateToIso('31/04/2026')).toThrowError(
        /Data inexistente no calendário/
      );
      expect(() => parseDisplayDateToIso('32/01/2026')).toThrowError(
        /Data inexistente no calendário/
      );
      expect(() => parseDisplayDateToIso('00/01/2026')).toThrowError(
        /Data inexistente no calendário/
      );
    });

    it('rejects invalid months (e.g. 01/13/2026 or 01/00/2026)', () => {
      expect(() => parseDisplayDateToIso('01/13/2026')).toThrowError(
        /Mês 13 inválido/
      );
      expect(() => parseDisplayDateToIso('01/00/2026')).toThrowError(
        /Mês 0 inválido/
      );
    });

    it('rejects malformed string formats or empty values', () => {
      expect(() => parseDisplayDateToIso('')).toThrowError(/Data deve ser informada/);
      expect(() => parseDisplayDateToIso('   ')).toThrowError(/Data deve ser informada/);
      expect(() => parseDisplayDateToIso('abc')).toThrowError(/Data inválida/);
      expect(() => parseDisplayDateToIso('2026-01-01')).toThrowError(/Data inválida/);
    });

    it('rejects 4-digit years outside supported range 1900..9999', () => {
      expect(() => parseDisplayDateToIso('01/01/1899')).toThrowError(
        /fora do intervalo suportado \(1900 a 9999\)/
      );
      expect(() => parseDisplayDateToIso('01/01/10000')).toThrowError(
        /Ano "10000" inválido/
      );
    });

    it('tolerates surrounding whitespace and trims input', () => {
      expect(parseDisplayDateToIso('  03/10/26  ')).toEqual({
        iso: '2026-10-03',
        year: 2026,
        month: 10,
        day: 3,
      });
    });
  });

  describe('normalizeDisplayDate', () => {
    it('normalizes valid inputs into DD/MM/YYYY on blur', () => {
      expect(normalizeDisplayDate('3/10/26')).toBe('03/10/2026');
      expect(normalizeDisplayDate('031026')).toBe('03/10/2026');
      expect(normalizeDisplayDate('03102026')).toBe('03/10/2026');
      expect(normalizeDisplayDate('1/1/26')).toBe('01/01/2026');
      expect(normalizeDisplayDate(' 03/10/2026 ')).toBe('03/10/2026');
    });

    it('leaves incomplete or invalid inputs unchanged for user correction on blur', () => {
      expect(normalizeDisplayDate('3/10/')).toBe('3/10/');
      expect(normalizeDisplayDate('invalid')).toBe('invalid');
      expect(normalizeDisplayDate('31026')).toBe('31026');
      expect(normalizeDisplayDate('03/10')).toBe('03/10');
    });
  });

  describe('formatIncrementalDateInput typing sequences & robustness', () => {
    it('simulates typing sequence "031026" with auto-slash insertion on next digit', () => {
      // Step 1: type '0'
      let val = formatIncrementalDateInput('0', '', 1);
      expect(val).toBe('0');

      // Step 2: type '3' -> '03' (NO slash yet, wait for next digit)
      val = formatIncrementalDateInput('03', val, 2);
      expect(val).toBe('03');

      // Step 3: type '1' after '03' -> '03/1'
      val = formatIncrementalDateInput('031', val, 3);
      expect(val).toBe('03/1');

      // Step 4: type '0' after '03/1' -> '03/10' (NO slash yet)
      val = formatIncrementalDateInput('03/10', val, 5);
      expect(val).toBe('03/10');

      // Step 5: type '2' after '03/10' -> '03/10/2'
      val = formatIncrementalDateInput('03/102', val, 6);
      expect(val).toBe('03/10/2');

      // Step 6: type '6' after '03/10/2' -> '03/10/26'
      val = formatIncrementalDateInput('03/10/26', val, 8);
      expect(val).toBe('03/10/26');
    });

    it('supports typing explicit slashes like "3/10/26" and "03/10/26" without duplicate slashes', () => {
      // Typing '3'
      let val = formatIncrementalDateInput('3', '', 1);
      expect(val).toBe('3');

      // Typing '/' -> '3/'
      val = formatIncrementalDateInput('3/', val, 2);
      expect(val).toBe('3/');

      // Typing '1' -> '3/1'
      val = formatIncrementalDateInput('3/1', val, 3);
      expect(val).toBe('3/1');

      // Typing '0' -> '3/10'
      val = formatIncrementalDateInput('3/10', val, 4);
      expect(val).toBe('3/10');

      // Explicit slash typed: '3/10/'
      val = formatIncrementalDateInput('3/10/', val, 5);
      expect(val).toBe('3/10/');

      // Typing '2' -> '3/10/2'
      val = formatIncrementalDateInput('3/10/2', val, 6);
      expect(val).toBe('3/10/2');

      // Typing '6' -> '3/10/26'
      val = formatIncrementalDateInput('3/10/26', val, 7);
      expect(val).toBe('3/10/26');

      // Explicit slash after '03'
      const resExplicit = formatIncrementalDateInput('03/', '03', 3);
      expect(resExplicit).toBe('03/');
    });

    it('handles Backspace removing slash "03/10/" -> "03/10" followed by typing "2" -> "03/10/2"', () => {
      // User had '03/10/' and hits backspace -> '03/10'
      const backspaced = formatIncrementalDateInput('03/10', '03/10/', 5);
      expect(backspaced).toBe('03/10');

      // Then user types '2' -> '03/10/2'
      const retyped = formatIncrementalDateInput('03/102', backspaced, 6);
      expect(retyped).toBe('03/10/2');
    });

    it('keeps pasted full values untouched (paste "031026" or "03/10")', () => {
      // Full paste 031026
      const pasteFull = formatIncrementalDateInput('031026', '', 6);
      expect(pasteFull).toBe('031026');

      // Paste partial 03/10
      const pastePartial = formatIncrementalDateInput('03/10', '', 5);
      expect(pastePartial).toBe('03/10');

      // Paste single digit with inputType === 'insertFromPaste'
      const paste1Char = formatIncrementalDateInput('031', '03', {
        selectionStart: 3,
        inputType: 'insertFromPaste',
      });
      expect(paste1Char).toBe('031');
    });

    it('does NOT modify edits in the middle of string', () => {
      // Inserting '5' in the middle: prev '03/10/2026', caret at 2 -> '053/10/2026'
      const midEdit = formatIncrementalDateInput('053/10/2026', '03/10/2026', 2);
      expect(midEdit).toBe('053/10/2026');
    });

    it('handles inputType deleteContentBackward without modifying string', () => {
      const del = formatIncrementalDateInput('03', '03/', {
        selectionStart: 2,
        inputType: 'deleteContentBackward',
      });
      expect(del).toBe('03');
    });
  });

  describe('formatUpdatedAt', () => {
    it('formats UTC ISO timestamp to America/Sao_Paulo (Horário de Brasília)', () => {
      const formatted = formatUpdatedAt('2026-10-28T16:00:00.000Z');
      expect(formatted).toBe('28/10/2026 às 13:00 (horário de Brasília)');
    });

    it('returns friendly fallback when invalid timestamp is provided', () => {
      expect(formatUpdatedAt('invalid-iso')).toBe('Data de atualização indisponível');
      expect(formatUpdatedAt('')).toBe('Data de atualização indisponível');
    });
  });

  describe('formatErrorMessageDates', () => {
    it('replaces ISO dates with DD/MM/YYYY in calculation engine error messages', () => {
      const err = 'Data inicial (2026-01-10) não pode ser posterior à data final (2026-01-01).';
      const formatted = formatErrorMessageDates(err);
      expect(formatted).toBe('Data inicial (10/01/2026) não pode ser posterior à data final (01/01/2026).');
    });

    it('does not corrupt URLs or paths containing dashes and numbers', () => {
      const msg = 'Erro ao consultar https://brasilapi.com.br/api/feriados/v1/2026 e /calendars/2026.json para 2026-05-01';
      const formatted = formatErrorMessageDates(msg);
      expect(formatted).toBe('Erro ao consultar https://brasilapi.com.br/api/feriados/v1/2026 e /calendars/2026.json para 01/05/2026');
    });
  });
});

describe('UI Discarded Days Filter Utility', () => {
  const sampleDiscarded: DiscardedDayDetail[] = [
    { date: '2026-01-01', reason: 'holiday', holidayName: 'Confraternização mundial' },
    { date: '2026-01-03', reason: 'weekend' },
    { date: '2026-01-04', reason: 'weekend' },
    { date: '2026-10-12', reason: 'weekend_and_holiday', holidayName: 'Nossa Senhora Aparecida' },
  ];

  it('returns all discarded days when hideWeekends is false', () => {
    const result = filterDiscardedDays(sampleDiscarded, false);
    expect(result).toHaveLength(4);
    expect(result).toEqual(sampleDiscarded);
  });

  it('filters ONLY weekend days, preserving holiday and weekend_and_holiday for auditability', () => {
    const result = filterDiscardedDays(sampleDiscarded, true);
    expect(result).toHaveLength(2);
    expect(result.some((d) => d.reason === 'weekend')).toBe(false);
    expect(result.some((d) => d.reason === 'holiday')).toBe(true);
    expect(result.some((d) => d.reason === 'weekend_and_holiday')).toBe(true);
  });
});
