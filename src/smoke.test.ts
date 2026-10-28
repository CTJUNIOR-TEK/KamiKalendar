import { describe, it, expect } from 'vitest';
import {
  countBusinessDays,
  addBusinessDays,
  countBusinessDaysDetailed,
  addBusinessDaysDetailed,
} from './calculation';
import { getCalendarForYear, getAvailableCalendarYears, validateAndExtractYearCalendar } from './calendar';
import type { YearCalendar } from './calendar';

describe('KamiKalendar Phase 2 & 3 - Loader and Calculation Engine', () => {
  it('loads existing calendar snapshots statically (2025-2029)', async () => {
    const available = getAvailableCalendarYears();
    expect(available).toContain(2025);
    expect(available).toContain(2026);
    expect(available).toContain(2027);
    expect(available).toContain(2028);
    expect(available).toContain(2029);

    const cal2026 = getCalendarForYear(2026);
    expect(cal2026.metadata.year).toBe(2026);
    expect(cal2026.metadata.source).toBe('BrasilAPI');
    expect(cal2026.metadata.version).toBe('a6c89515d40e');
    expect(cal2026.holidays.length).toBeGreaterThan(0);

    const confraternizacao = cal2026.holidays.find((h) => h.date === '2026-01-01');
    expect(confraternizacao).toBeDefined();
    expect(confraternizacao?.name).toBe('Confraternização mundial');
  });

  it('throws an explicit error when requesting an unavailable calendar year', () => {
    expect(() => getCalendarForYear(1999)).toThrowError(
      /Calendário não encontrado para o ano 1999/
    );
  });

  describe('Validation edge cases (negative testing)', () => {
    const validCalendar: YearCalendar = {
      metadata: {
        year: 2026,
        source: 'BrasilAPI',
        version: 'a6c89515d40e',
        updatedAt: '2026-10-28T16:00:00.000Z',
      },
      holidays: [{ date: '2026-01-01', name: 'Confraternização mundial', type: 'national' }],
    };

    it('rejects impossible dates like 2026-02-30', () => {
      const invalid = {
        ...validCalendar,
        holidays: [{ date: '2026-02-30', name: 'Data impossível' }],
      };
      expect(() => validateAndExtractYearCalendar(invalid, '/calendars/2026.json')).toThrowError(
        /Feriado inválido/
      );
    });

    it('rejects dates belonging to a different year', () => {
      const invalid = {
        ...validCalendar,
        holidays: [{ date: '2025-12-25', name: 'Natal' }],
      };
      expect(() => validateAndExtractYearCalendar(invalid, '/calendars/2026.json')).toThrowError(
        /Feriado inválido/
      );
    });

    it('rejects duplicate holiday dates within the same year', () => {
      const invalid = {
        ...validCalendar,
        holidays: [
          { date: '2026-01-01', name: 'Confraternização' },
          { date: '2026-01-01', name: 'Duplicata' },
        ],
      };
      expect(() => validateAndExtractYearCalendar(invalid, '/calendars/2026.json')).toThrowError(
        /Data duplicada/
      );
    });

    it('rejects empty or non-string holiday types when type property is present', () => {
      const invalidEmptyType = {
        ...validCalendar,
        holidays: [{ date: '2026-01-01', name: 'Ano Novo', type: '' }],
      };
      expect(() => validateAndExtractYearCalendar(invalidEmptyType, '/calendars/2026.json')).toThrowError(
        /Feriado inválido/
      );
    });

    it('rejects filename year mismatching metadata.year', () => {
      expect(() => validateAndExtractYearCalendar(validCalendar, '/calendars/2027.json')).toThrowError(
        /Inconsistência/
      );
    });
  });

  describe('Calculation Engine (Smoke tests)', () => {
    it('counts business days inclusively and identifies holidays & weekends without double deduction', () => {
      // 2026-01-01 é quinta-feira (Feriado Nacional: Confraternização)
      // 2026-01-02 é sexta-feira (Dia útil 1)
      // 2026-01-03 é sábado (Fim de semana)
      // 2026-01-04 é domingo (Fim de semana)
      // 2026-01-05 é segunda-feira (Dia útil 2)
      const count = countBusinessDays({ startDate: '2026-01-01', endDate: '2026-01-05' });
      expect(count).toBe(2);

      const detailed = countBusinessDaysDetailed({ startDate: '2026-01-01', endDate: '2026-01-05' });
      expect(detailed.businessDays).toBe(2);
      expect(detailed.totalDays).toBe(5);
      expect(detailed.discardedDays).toHaveLength(3);
      expect(detailed.discardedDays[0]).toEqual({
        date: '2026-01-01',
        reason: 'holiday',
        holidayName: 'Confraternização mundial',
      });
      expect(detailed.discardedDays[1]?.reason).toBe('weekend');
      expect(detailed.discardedDays[2]?.reason).toBe('weekend');
    });

    it('adds business days starting from the next day, returning initial date if N=0', () => {
      // N=0: retorna a própria data
      expect(addBusinessDays({ startDate: '2026-01-01', days: 0 })).toBe('2026-01-01');

      // A partir de quinta 2026-01-01 (feriado):
      // Dia seguinte: sexta 2026-01-02 (Dia útil 1)
      expect(addBusinessDays({ startDate: '2026-01-01', days: 1 })).toBe('2026-01-02');

      // 2 dias úteis: sexta 2026-01-02 (1) e segunda 2026-01-05 (2)
      expect(addBusinessDays({ startDate: '2026-01-01', days: 2 })).toBe('2026-01-05');

      // Testa detalhamento completo via addBusinessDaysDetailed
      const detailedAdd = addBusinessDaysDetailed({ startDate: '2026-01-01', days: 2 });
      expect(detailedAdd.startDate).toBe('2026-01-01');
      expect(detailedAdd.targetBusinessDays).toBe(2);
      expect(detailedAdd.endDate).toBe('2026-01-05');
      expect(detailedAdd.discardedDays).toHaveLength(2); // sábado 03 e domingo 04
      expect(detailedAdd.calendarMetadata).toHaveLength(1);
      expect(detailedAdd.calendarMetadata[0]?.year).toBe(2026);
    });

    it('requires valid calendar year for initial date in addBusinessDaysDetailed even when crossing into available year', () => {
      // 2024 não está catalogado, mas 2025 está. Data inicial 2024-12-31 deve falhar por falta do calendário de 2024
      expect(() =>
        addBusinessDaysDetailed({ startDate: '2024-12-31', days: 1 })
      ).toThrowError(/Calendário não encontrado para o ano 2024/);
    });

    it('handles year boundary transitions (Dec -> Jan)', () => {
      // 2025-12-30 (terça, útil), 2025-12-31 (quarta, útil), 2026-01-01 (quinta, feriado), 2026-01-02 (sexta, útil)
      const detailed = countBusinessDaysDetailed({ startDate: '2025-12-30', endDate: '2026-01-02' });
      expect(detailed.businessDays).toBe(3);
      expect(detailed.calendarMetadata).toHaveLength(2);
      expect(detailed.calendarMetadata.map((m) => m.year)).toEqual([2025, 2026]);
    });

    it('correctly handles leap year dates and calendar recognition', () => {
      // 2028 é bissexto: 2028-02-28 e 2028-02-29 são reconhecidos como datas válidas,
      // porém constam como Carnaval no snapshot de 2028 (ambos descartados como feriado).
      const detailedLeap = countBusinessDaysDetailed({ startDate: '2028-02-28', endDate: '2028-02-29' });
      expect(detailedLeap.totalDays).toBe(2);
      expect(detailedLeap.businessDays).toBe(0);
      expect(detailedLeap.discardedDays).toHaveLength(2);
      expect(detailedLeap.discardedDays[0]).toEqual({
        date: '2028-02-28',
        reason: 'holiday',
        holidayName: 'Carnaval',
      });
      expect(detailedLeap.discardedDays[1]).toEqual({
        date: '2028-02-29',
        reason: 'holiday',
        holidayName: 'Carnaval',
      });

      // Data bissexta como dia útil: 2028-03-01 (quarta-feira imediatamente seguinte ao Carnaval)
      const count = countBusinessDays({ startDate: '2028-03-01', endDate: '2028-03-02' });
      expect(count).toBe(2);

      // Rejeita data bissexta inexistente em ano comum (2026-02-29)
      expect(() => countBusinessDays({ startDate: '2026-02-29', endDate: '2026-03-01' })).toThrowError(
        /Data de calendário inexistente/
      );
    });

    it('filters weekends in discarded days while preserving mixed weekend_and_holiday entries for audit', () => {
      // 2026-01-01 (quinta, feriado), 2026-01-02 (sexta, útil), 2026-01-03 (sáb, weekend), 2026-01-04 (dom, weekend)
      const res = countBusinessDaysDetailed({ startDate: '2026-01-01', endDate: '2026-01-05' });
      expect(res.discardedDays).toHaveLength(3);

      // Simulação do filtro da UI de CountView:
      // Ocultar fins de semana filtra SOMENTE d.reason === 'weekend'
      const onlyWeekendsFiltered = res.discardedDays.filter((d) => d.reason !== 'weekend');
      expect(onlyWeekendsFiltered).toHaveLength(1);
      expect(onlyWeekendsFiltered[0]?.reason).toBe('holiday');
      expect(onlyWeekendsFiltered[0]?.date).toBe('2026-01-01');

      // Se houvesse 'weekend_and_holiday', não seria filtrado
      const simulatedMixed = [
        ...res.discardedDays,
        { date: '2026-11-15', reason: 'weekend_and_holiday' as const, holidayName: 'Proclamação da República' },
      ];
      const filteredMixed = simulatedMixed.filter((d) => d.reason !== 'weekend');
      expect(filteredMixed).toHaveLength(2);
      expect(filteredMixed.map((m) => m.reason)).toEqual(['holiday', 'weekend_and_holiday']);
    });

    it('rejects inverted intervals and missing calendar years', () => {
      expect(() =>
        countBusinessDays({ startDate: '2026-01-05', endDate: '2026-01-01' })
      ).toThrowError(/não pode ser posterior/);

      expect(() =>
        countBusinessDays({ startDate: '1999-01-01', endDate: '1999-01-05' })
      ).toThrowError(/Calendário não encontrado para o ano 1999/);
    });
  });
});
