import React, { useState } from 'react';
import { addBusinessDaysDetailed, type DetailedAddResult } from '../calculation';
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
  days: string;
}

export const AddView: React.FC = () => {
  const [form, setForm] = useState<FormState>({
    startDate: '01/01/2026',
    days: '5',
  });
  const [result, setResult] = useState<DetailedAddResult | null>(null);
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

  const handleDaysChange = (val: string) => {
    setForm((prev) => ({ ...prev, days: val }));
    setResult(null);
    setError(null);
  };

  const toggleHideWeekends = () => {
    setHideWeekends((prev) => !prev);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    let startIso: string;
    try {
      startIso = parseDisplayDateToIso(form.startDate).iso;
    } catch (err: unknown) {
      setResult(null);
      setError(err instanceof Error ? err.message : 'Data inicial inválida.');
      return;
    }

    try {
      const daysNum = Number(form.days);
      const res = addBusinessDaysDetailed({
        startDate: startIso,
        days: daysNum,
      });
      setResult(res);
    } catch (err: unknown) {
      setResult(null);
      if (err instanceof Error) {
        setError(formatErrorMessageDates(err.message));
      } else {
        setError('Erro desconhecido ao adicionar dias úteis.');
      }
    }
  };

  // Filtra SOMENTE reason === 'weekend'; weekend_and_holiday permanece visível para auditoria
  const displayedDiscarded = result
    ? filterDiscardedDays(result.discardedDays, hideWeekends)
    : [];

  return (
    <section aria-labelledby="heading-add" className="view-section">
      <div className="view-header">
        <h2 id="heading-add">
          Adicionar Dias Úteis
        </h2>
        <p className="view-description">
          Escolha uma data e quantos dias úteis deseja acrescentar. Começamos a contar no dia seguinte e pulamos dias não úteis.
        </p>
        <div className="example-box">
          <strong>Exemplo:</strong> A partir de <code>01/01/2026</code> (quinta-feira, feriado de Ano Novo), adicionar <strong>2</strong> dias úteis pula o próprio dia 01/01/2026, conta sexta-feira <code>02/01/2026</code> (1º dia útil), pula sábado 03/01/2026 e domingo 04/01/2026, e conclui em <code>05/01/2026</code> (segunda-feira, 2º dia útil).
        </div>
      </div>

      <form onSubmit={handleSubmit} className="form-card">
        <div className="form-group">
          <label htmlFor="input-add-start-date" className="form-label">
            Data inicial:
            <span className="form-hint"> (ex.: 03/10/2026, 3/10/26 ou 031026; ano de 2 dígitos como 26 equivale a 2026)</span>
          </label>
          <input
            id="input-add-start-date"
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
          <label htmlFor="input-add-days" className="form-label">
            Dias úteis a acrescentar:
            <span className="form-hint"> (se 0, retorna a própria data inicial)</span>
          </label>
          <input
            id="input-add-days"
            type="number"
            min="0"
            step="1"
            required
            value={form.days}
            onChange={(e) => handleDaysChange(e.target.value)}
            className="form-input"
          />
        </div>

        <div className="form-actions">
          <button type="submit" className="btn-primary">
            Acrescentar Dias Úteis
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
          aria-label="Resultado da adição de dias úteis"
          className="result-card"
        >
          <div className="result-metrics">
            <div>
              <span className="metric-label">Data de término calculada:</span>
              <p className="metric-value-highlight">
                {formatIsoToDisplay(result.endDate)}
              </p>
            </div>
            <div>
              <span className="metric-label">Dias úteis acrescentados:</span>
              <p className="metric-value-secondary">
                {result.targetBusinessDays}
              </p>
            </div>
            <div>
              <span className="metric-label">Dias descartados no percurso:</span>
              <p className="metric-value-secondary">
                {result.discardedDays.length}
              </p>
            </div>
          </div>

          <div>
            <div className="table-header-row">
              <h3 className="table-title">
                Dias descartados no percurso ({displayedDiscarded.length} de {result.discardedDays.length})
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
              <p className="empty-state">Nenhum dia não útil percorrido no intervalo.</p>
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
