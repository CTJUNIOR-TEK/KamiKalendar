import { describe, it, expect } from 'vitest';
import { countBusinessDays, addBusinessDays } from './calculation';
import { getCalendarForYear } from './calendar';

describe('KamiKalendar Phase 1 Smoke Test', () => {
  it('calendar placeholder is defined and throws pending phase 2', () => {
    expect(() => getCalendarForYear(2024)).toThrowError(/não implementado/);
  });

  it('calculation placeholders are defined and throw pending phase 2', () => {
    expect(() => countBusinessDays({ startDate: '2024-01-01', endDate: '2024-01-05' })).toThrowError(/não implementado/);
    expect(() => addBusinessDays({ startDate: '2024-01-01', days: 5 })).toThrowError(/não implementado/);
  });
});
