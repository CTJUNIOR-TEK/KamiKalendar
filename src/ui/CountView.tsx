import React, { useState } from 'react';
import { countBusinessDaysDetailed, type DetailedCountResult } from '../calculation';
import {
  formatIsoToDisplay,
  parseDisplayDateToIso,
  normalizeDisplayDate,
  formatIncrementalDateInput,
  formatUpdatedAt,
  formatErrorMessageDates,
} from './dateFormat';
import { filterDiscardedDays } from './filterUtils';

interface FormState {
  startDate: string;
  endDate: string;
}

export const CountView: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    startDate: '01/01/2026',
    endDate: '10/01/2026',
  });
  const [result, setResult] = useState<DetailedCountResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [hideWeekends, setHideWeekends] = useState<boolean>(false);

  const handleStartDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const nativeEvent = e.nativeEvent as InputEvent | undefined;
    const inputType = nativeEvent?.inputType;

    const formatted = formatIncrementalDateInput(rawVal, form.startDate, {
      selectionStart: e.target.selectionStart,
      inputType,
    });

    setForm((prev) => ({ ...prev, startDate: formatted }));
    setResult(null);
    setError(null);
  };

  const handleStartDateBlur = () => {
    setForm((prev) => ({
      ...prev,
      startDate: normalizeDisplayDate(prev.startDate),
    }));
  };

  const handleEndDateChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const rawVal = e.target.value;
    const nativeEvent = e.nativeEvent as InputEvent | undefined;
    const inputType = nativeEvent?.inputType;

    const formatted = formatIncrementalDateInput(rawVal, form.endDate, {
      selectionStart: e.target.selectionStart,
      inputType,
    });

    setForm((prev) => ({ ...prev, endDate: formatted }));
    setResult(null);
    setError(null);
  };

  const handleEndDateBlur = () => {
    setForm((prev) => ({
      ...prev,
      endDate: normalizeDisplayDate(prev.endDate),
    }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let startIso: string;
    let endIso: string;

    try {
      startIso = parseDisplayDateToIso(form.startDate).iso;
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Data inicial inválida.');
      return;
    }

    try {
      endIso = parseDisplayDateToIso(form.endDate).iso;
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Data final inválida.');
      return;
    }

    try {
      const res = countBusinessDaysDetailed({
        startDate: startIso,
        endDate: endIso,
      });
      setResult(res);
    } catch (err: unknown) {
      setResult(null);
      if (err instanceof Error) {
        setError(formatErrorMessageDates(err.message));
      } else {
        setError('Erro desconhecido ao calcular dias úteis.');
      }
    }
  };

  const toggleHideWeekends = () => {
    setHideWeekends((prev) => !prev);
  };

  // Filtra SOMENTE reason === 'weekend'; weekend_and_holiday permanece visível para auditoria
  const displayedDiscarded = result
    ? filterDiscardedDays(result.discardedDays, hideWeekends)
    : [];

  return (
    <section aria-labelledby="heading-count" className="view-section">
      <div className="view-header">
        <h2 id="heading-count">
          Contar Dias Úteis no Intervalo
        </h2>
        <p className="view-description">
          Calcule a quantidade exata de dias úteis entre duas datas. O cálculo é <strong>inclusivo</strong> (a data inicial e a final são avaliadas). Descartamos sábados, domingos e as datas da lista nacional da BrasilAPI (feriados estaduais e municipais não entram no cálculo).
        </p>
        <div className="example-box">
          <strong>Exemplo:</strong> De <code>01/01/2026</code> (quinta-feira, feriado de Ano Novo) até <code>05/01/2026</code> (segunda-feira),
          são 5 dias corridos e 2 dias úteis (sexta 02/01/2026 e segunda 05/01/2026), com 3 dias descartados (feriado + sábado + domingo).
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label htmlFor="input-start-date" className="form-label">
            Data inicial:
            <span className="form-hint"> (ex.: 03/10/2026, 3/10/26 ou 031026; ano de 2 dígitos como 26 equivale a 2026)</span>
          </label>
          <input
            id="input-start-date"
            type="text"
            inputMode="numeric"
            placeholder="3/10/26 ou 031026"
            maxLength={14}
            required
            value={form.startDate}
            onChange={handleStartDateChange}
            onBlur={handleStartDateBlur}
            className="form-input"
          />
        </div>

        <div className="form-group">
          <label htmlFor="input-end-date" className="form-label">
            Data final:
            <span className="form-hint"> (ex.: 03/10/2026, 3/10/26 ou 031026; ano de 2 dígitos como 26 equivale a 2026)</span>
          </label>
          <input
            id="input-end-date"
            type="text"
            inputMode="numeric"
            placeholder="3/10/26 ou 031026"
            maxLength={14}
            required
            value={form.endDate}
            onChange={handleEndDateChange}
            onBlur={handleEndDateBlur}
            className="form-input"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Calcular Intervalo
          </button>
        </div>
      </form>

      {/* Região acessível de status de erro com aria-live */}
      <div role="status" aria-live="assertive">
        {error && (
          <div className="error-banner">
            <strong>Erro no cálculo:</strong> {error}
          </div>
        )}
      </div>

      {result && (
        <div
          role="region"
          aria-label="Resultado da contagem de dias úteis"
          className="result-card"
        >
          <div className="result-metrics">
            <div>
              <span className="metric-label">Dias úteis apurados:</span>
              <p className="metric-value-highlight">
                {result.businessDays}
              </p>
            </div>
            <div>
              <span className="metric-label">Total de dias corridos:</span>
              <p className="metric-value-secondary">
                {result.totalDays}
              </p>
            </div>
            <div>
              <span className="metric-label">Total descartado:</span>
              <p className="metric-value-secondary">
                {result.discardedDays.length}
              </p>
            </div>
          </div>

          <div>
            <div className="table-header-row">
              <h3 className="table-title">
                Dias descartados ({displayedDiscarded.length} de {result.discardedDays.length})
              </h3>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', flexWrap: 'wrap' }}>
                <span role="status" aria-live="polite">
                  {hideWeekends && (
                    <span className="filter-status-badge">
                      Filtro ativo: fins de semana ocultados
                    </span>
                  )}
                </span>
                {result.discardedDays.length > 0 && (
                  <button
                    type="button"
                    aria-pressed={hideWeekends}
                    onClick={toggleHideWeekends}
                    className="btn-secondary"
                  >
                    Ocultar fins de semana
                  </button>
                )}
              </div>
            </div>

            {result.discardedDays.length === 0 ? (
              <p className="empty-state">Nenhum dia não útil no intervalo avaliado.</p>
            ) : displayedDiscarded.length === 0 ? (
              <p className="empty-state">
                Todos os dias descartados são fins de semana e estão ocultados pelo filtro.
              </p>
            ) : (
              <div className="table-wrapper">
                <table className="data-table">
                  <thead>
                    <tr>
                      <th>Data</th>
                      <th>Motivo</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {displayedDiscarded.map((d) => (
                      <tr key={d.date}>
                        <td className="data-date">{formatIsoToDisplay(d.date)}</td>
                        <td>
                          {d.reason === 'weekend' && (
                            <span className="reason-badge reason-weekend">Fim de semana</span>
                          )}
                          {d.reason === 'holiday' && (
                            <span className="reason-badge reason-holiday">Data da BrasilAPI</span>
                          )}
                          {d.reason === 'weekend_and_holiday' && (
                            <span className="reason-badge reason-both">Fim de semana e BrasilAPI</span>
                          )}
                        </td>
                        <td style={{ color: 'var(--kami-text-muted)' }}>
                          {d.holidayName || '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="meta-footer">
            <strong>Snapshots de Calendário utilizados:</strong>
            <ul>
              {result.calendarMetadata.map((meta) => (
                <li key={meta.year}>
                  Ano {meta.year}: Fonte {meta.source} | Versão <code>{meta.version}</code> (Atualizado em: {formatUpdatedAt(meta.updatedAt)})
                </li>
              ))}
            </ul>
          </div>
        </div>
      )}
    </section>
  );
};
