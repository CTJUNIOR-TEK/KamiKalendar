/**
 * Utilitários para formatação e parsing flexível/estrito de datas de apresentação na UI
 * e conversão segura para/a partir do formato interno ISO (YYYY-MM-DD).
 */

const ISO_DATE_REGEX = /^(\d{4})-(\d{2})-(\d{2})$/;

/**
 * Converte data ISO (YYYY-MM-DD) para exibição textual brasileira (DD/MM/YYYY).
 * Se a string não for uma data ISO válida, retorna o próprio valor para tolerância de fallback.
 */
export function formatIsoToDisplay(isoStr: string): string {
  if (typeof isoStr !== 'string') return '';
  const match = isoStr.match(ISO_DATE_REGEX);
  if (!match) return isoStr;
  const [, year, month, day] = match;
  return `${day}/${month}/${year}`;
}

export interface ParseDisplayDateResult {
  iso: string;
  year: number;
  month: number;
  day: number;
}

/**
 * Normaliza ano de 2 dígitos (00..99) sem ambiguidade para o século 21 (2000..2099).
 * Se o ano já tiver 4 dígitos, retorna o próprio valor numérico.
 */
export function expandTwoDigitYear(yearNum: number): number {
  if (yearNum >= 0 && yearNum <= 99) {
    return 2000 + yearNum;
  }
  return yearNum;
}

/**
 * Converte data de exibição flexível para ISO (YYYY-MM-DD) com validação estrita:
 * Formatos aceitos:
 * - D/M/YY ou DD/MM/YYYY com barras (dias e meses de 1 ou 2 dígitos; anos com 2 ou 4 dígitos)
 * - Sequência pura de dígitos sem separadores:
 *   - 6 dígitos: DDMMYY (ano 2 dígitos 00..99 -> 2000..2099)
 *   - 8 dígitos: DDMMYYYY (ano 4 dígitos)
 *
 * Rejeita:
 * - Dígitos puros que não tenham 6 nem 8 dígitos (ex.: 5 ou 7 dígitos como 31026, pois são ambíguos)
 * - Anos com 1 ou 3 dígitos (ex.: 3/10/2 ou 3/10/202)
 * - Anos fora de 1900..9999
 * - Meses fora de 1..12
 * - Datas inexistentes no calendário real via UTC round-trip (ex.: 29/02/2026, 31/04/2026)
 */
export function parseDisplayDateToIso(displayStr: string): ParseDisplayDateResult {
  if (typeof displayStr !== 'string') {
    throw new Error('Data deve ser informada (ex.: 03/10/2026 ou 031026).');
  }

  const trimmed = displayStr.trim();
  if (!trimmed) {
    throw new Error('Data deve ser informada (ex.: 03/10/2026 ou 031026).');
  }

  let dayStr: string;
  let monthStr: string;
  let rawYearStr: string;

  if (trimmed.includes('/')) {
    const parts = trimmed.split('/');
    if (parts.length !== 3 || parts[0] === undefined || parts[1] === undefined || parts[2] === undefined) {
      throw new Error('Data deve estar no formato DD/MM/YYYY (ex.: 03/10/2026, 3/10/26 ou 031026).');
    }

    const [d, m, y] = parts as [string, string, string];
    if (!/^\d{1,2}$/.test(d) || !/^\d{1,2}$/.test(m)) {
      throw new Error('Dia e mês devem conter apenas 1 ou 2 dígitos numéricos.');
    }

    if (!/^\d{2}$|^\d{4}$/.test(y)) {
      throw new Error(`Ano "${y}" inválido. Informe o ano com 2 dígitos (2000 a 2099) ou 4 dígitos (1900 a 9999).`);
    }

    dayStr = d;
    monthStr = m;
    rawYearStr = y;
  } else if (/^\d+$/.test(trimmed)) {
    // Apenas dígitos sem separadores
    if (trimmed.length === 6) {
      dayStr = trimmed.slice(0, 2);
      monthStr = trimmed.slice(2, 4);
      rawYearStr = trimmed.slice(4, 6);
    } else if (trimmed.length === 8) {
      dayStr = trimmed.slice(0, 2);
      monthStr = trimmed.slice(2, 4);
      rawYearStr = trimmed.slice(4, 8);
    } else {
      throw new Error(
        `Formato numérico contínuo ambíguo (${trimmed.length} dígitos). Use 6 dígitos (DDMMYY), 8 dígitos (DDMMYYYY) ou utilize barras (DD/MM/YYYY).`
      );
    }
  } else {
    throw new Error('Data inválida. Use o formato DD/MM/YYYY (ex.: 03/10/2026, 3/10/26 ou 031026).');
  }

  const day = Number(dayStr);
  const month = Number(monthStr);
  let year = Number(rawYearStr);

  if (rawYearStr.length === 2) {
    year = expandTwoDigitYear(year);
  }

  if (year < 1900 || year > 9999) {
    throw new Error(`Ano ${year} fora do intervalo suportado (1900 a 9999).`);
  }

  if (month < 1 || month > 12) {
    throw new Error(`Mês ${month} inválido. Deve ser entre 01 e 12.`);
  }

  const utc = new Date(Date.UTC(year, month - 1, day));
  if (
    utc.getUTCFullYear() !== year ||
    utc.getUTCMonth() !== month - 1 ||
    utc.getUTCDate() !== day
  ) {
    throw new Error(`Data inexistente no calendário: "${trimmed}".`);
  }

  const iso = `${year.toString().padStart(4, '0')}-${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`;
  return { iso, year, month, day };
}

/**
 * Converte qualquer entrada de data válida para o formato canônico de exibição DD/MM/YYYY.
 * Se a entrada for inválida, retorna o valor original sem alteração.
 */
export function normalizeDisplayDate(displayStr: string): string {
  try {
    const { year, month, day } = parseDisplayDateToIso(displayStr);
    return `${day.toString().padStart(2, '0')}/${month.toString().padStart(2, '0')}/${year.toString().padStart(4, '0')}`;
  } catch {
    return displayStr;
  }
}

export interface IncrementalOptions {
  selectionStart?: number | null;
  inputType?: string;
}

/**
 * Formata incrementalmente a digitação de data no campo de input.
 * Design simples e robusto:
 * NÃO adiciona barra ao completar DD ou DD/MM; apenas ao digitar o PRÓXIMO dígito depois dos grupos completos:
 * - prev '03', next '031' => '03/1'
 * - prev '03/10', next '03/102' => '03/10/2'
 *
 * Garante que:
 * - Barras explícitas digitadas pelo usuário ('03/' e '03/10/') nunca são duplicadas.
 * - Backspace apagando a barra ('03/10/' -> '03/10') nunca reinsere barra até o usuário digitar o próximo dígito.
 * - Colagens (paste) completas como '031026' ou '03/10' permanecem intocadas até o blur/submit.
 * - Edições no meio do texto ou Backspace/Delete nunca acionam a máscara.
 *
 * Como o caractere adicionado ao final é precedido pela barra, o caret nativo do navegador
 * permanece naturalmente no final da string sem requerer requisição de alinhamento por requestAnimationFrame.
 */
export function formatIncrementalDateInput(
  nextVal: string,
  prevVal: string,
  options?: IncrementalOptions | number | null
): string {
  let selectionStart: number | null = null;
  let inputType: string | undefined = undefined;

  if (typeof options === 'number' || options === null) {
    selectionStart = options;
  } else if (options && typeof options === 'object') {
    selectionStart = options.selectionStart ?? null;
    inputType = options.inputType;
  }

  // Se inputType for informado e não representar inserção comum de texto/dígito, preserva
  if (inputType) {
    if (inputType.startsWith('delete')) {
      return nextVal;
    }
    if (inputType === 'insertFromPaste' || inputType === 'insertFromDrop') {
      return nextVal;
    }
    if (inputType !== 'insertText' && inputType !== 'insertCompositionText') {
      return nextVal;
    }
  }

  // Deve ser exatamente a adição de 1 caractere no final
  if (nextVal.length !== prevVal.length + 1) {
    return nextVal;
  }

  if (!nextVal.startsWith(prevVal)) {
    return nextVal;
  }

  const cursorPos = selectionStart ?? nextVal.length;
  if (cursorPos !== nextVal.length) {
    return nextVal;
  }

  const addedChar = nextVal.slice(-1);
  if (!/^\d$/.test(addedChar)) {
    return nextVal;
  }

  // Caso 1: Usuário tinha exatamente 2 dígitos no dia ('03') e digitou o primeiro dígito do mês ('1') -> '03/1'
  if (/^\d{2}$/.test(prevVal)) {
    return `${prevVal}/${addedChar}`;
  }

  // Caso 2: Usuário tinha dia (1 ou 2 dígitos) + barra + 2 dígitos no mês ('03/10' ou '3/10')
  // e digitou o primeiro dígito do ano ('2') -> '03/10/2' ou '3/10/2'
  if (/^\d{1,2}\/\d{2}$/.test(prevVal)) {
    return `${prevVal}/${addedChar}`;
  }

  return nextVal;
}

/**
 * Formata um timestamp de atualização (ISO 8601 UTC) para data/hora de exibição legível
 * no fuso horário oficial de Brasília (America/Sao_Paulo) com legenda explícita.
 */
export function formatUpdatedAt(timestampIso: string): string {
  if (!timestampIso) return 'Data de atualização indisponível';
  try {
    const d = new Date(timestampIso);
    if (isNaN(d.getTime())) return 'Data de atualização indisponível';

    const formatter = new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Sao_Paulo',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });

    const parts = formatter.formatToParts(d);
    const day = parts.find((p) => p.type === 'day')?.value || '';
    const month = parts.find((p) => p.type === 'month')?.value || '';
    const year = parts.find((p) => p.type === 'year')?.value || '';
    const hour = parts.find((p) => p.type === 'hour')?.value || '00';
    const minute = parts.find((p) => p.type === 'minute')?.value || '00';

    return `${day}/${month}/${year} às ${hour}:${minute} (horário de Brasília)`;
  } catch {
    return 'Data de atualização indisponível';
  }
}

/**
 * Substitui ocorrências isoladas de datas ISO (YYYY-MM-DD) por DD/MM/YYYY em mensagens de erro do motor,
 * preservando URLs, rotas e caminhos de arquivo.
 */
export function formatErrorMessageDates(message: string): string {
  if (typeof message !== 'string') return '';
  return message.replace(/(?<![\w/])(\d{4})-(\d{2})-(\d{2})(?![\w/])/g, (_match, y, m, d) => {
    return `${d}/${m}/${y}`;
  });
}
