import { createHash } from 'node:crypto';
import { existsSync } from 'node:fs';
import { readFile, writeFile, rename, unlink, mkdir, readdir } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REPO_ROOT = resolve(__dirname, '..');
const CALENDARS_DIR = resolve(REPO_ROOT, 'calendars');

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BASE_URL = 'https://brasilapi.com.br/api/feriados/v1';

export function computeHolidaysHash(holidays) {
  const normalized = holidays.map((h) => ({
    date: h.date,
    name: h.name,
    ...(h.type ? { type: h.type } : {}),
  }));
  return createHash('sha256').update(JSON.stringify(normalized)).digest('hex').slice(0, 12);
}

function isValidCalendarMetadata(meta) {
  if (!meta || typeof meta !== 'object') return false;
  return (
    typeof meta.year === 'number' &&
    typeof meta.source === 'string' &&
    typeof meta.version === 'string' &&
    typeof meta.updatedAt === 'string'
  );
}

/**
 * Validação rigorosa dos dados retornados para o ano especificado:
 * 1. Formato ISO e prefixo de ano
 * 2. Validação de calendário real com round-trip UTC (rejeita datas inexistentes como 2026-02-30)
 * 3. Sem duplicatas
 * 4. Nomes não vazios
 * 5. Campo `type`: se PRESENTE, DEVE ser string não vazia (rejeita tipo inválido ou string vazia; se omitido/undefined, aceito)
 */
export function validateYearData(year, rawData) {
  if (!Array.isArray(rawData)) {
    throw new Error(`Dados inválidos para o ano ${year}: resposta não é um array.`);
  }

  if (rawData.length === 0) {
    throw new Error(`Dados inválidos para o ano ${year}: lista de feriados vazia.`);
  }

  const seenDates = new Set();
  const yearPrefix = `${year}-`;
  const validatedHolidays = [];

  for (const item of rawData) {
    if (!item || typeof item !== 'object') {
      throw new Error(`Entrada de feriado inválida no ano ${year}: ${JSON.stringify(item)}`);
    }

    const { date, name, type } = item;

    if (typeof date !== 'string' || !DATE_REGEX.test(date)) {
      throw new Error(`Data inválida "${date}" encontrada no ano ${year}. Formato esperado: YYYY-MM-DD.`);
    }

    if (!date.startsWith(yearPrefix)) {
      throw new Error(`Data "${date}" não pertence ao ano esperado ${year}.`);
    }

    // Validação de data UTC estrita (roundtrip sem ambiguidades de fuso horário)
    const [yStr, mStr, dStr] = date.split('-');
    const yNum = Number(yStr);
    const mNum = Number(mStr);
    const dNum = Number(dStr);

    const utcDate = new Date(Date.UTC(yNum, mNum - 1, dNum));
    if (
      utcDate.getUTCFullYear() !== yNum ||
      utcDate.getUTCMonth() !== mNum - 1 ||
      utcDate.getUTCDate() !== dNum
    ) {
      throw new Error(`Data impossível/inválida no calendário UTC detectada no ano ${year}: ${date}.`);
    }

    if (typeof name !== 'string' || name.trim().length === 0) {
      throw new Error(`Nome inválido ou vazio para feriado em ${date} no ano ${year}.`);
    }

    if (seenDates.has(date)) {
      throw new Error(`Data duplicada encontrada no ano ${year}: ${date}.`);
    }
    seenDates.add(date);

    // Validação estrita do campo opcional type: se presente, não pode ser vazio nem não-string
    let cleanType;
    if ('type' in item && type !== undefined) {
      if (typeof type !== 'string' || type.trim().length === 0) {
        throw new Error(
          `Propriedade "type" inválida para o feriado em ${date} no ano ${year}: esperada string não vazia.`
        );
      }
      cleanType = type.trim();
    }

    const entry = {
      date,
      name: name.trim(),
    };
    if (cleanType !== undefined) {
      entry.type = cleanType;
    }

    validatedHolidays.push(entry);
  }

  // Ordenação estável por data ISO crescente
  validatedHolidays.sort((a, b) => a.date.localeCompare(b.date));

  return validatedHolidays;
}

export async function fetchCalendarForYear(year) {
  const url = `${BASE_URL}/${year}`;
  console.log(`Buscando feriados para ${year} em ${url}...`);

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'KamiKalendar-Sync/1.0 (+https://github.com/CTJunior/KamiKalendar)',
      Accept: 'application/json',
    },
  });

  if (!response.ok) {
    throw new Error(`Falha HTTP ${response.status} (${response.statusText}) ao buscar ano ${year} em ${url}`);
  }

  const json = await response.json();
  const holidays = validateYearData(year, json);
  return { year, holidays, sourceUrl: url };
}

/**
 * Carrega e valida rigorosamente todos os arquivos existentes em calendars/ (fail-closed).
 * Valida todos os arquivos históricos:
 * 1. Nome do arquivo {year}.json e correspondência com metadata.year
 * 2. Metadados estruturados
 * 3. Lista de feriados usando a mesma validação estrita (ano do feriado, datas UTC reais, sem duplicatas, type se presente)
 * 4. Sem duplicatas de arquivos/anos
 * Se qualquer arquivo histórico estiver corrompido ou malformado, lança erro antes de qualquer escrita ou fetch.
 */
async function loadAndValidateExistingCalendars() {
  const existingMap = new Map();
  if (!existsSync(CALENDARS_DIR)) {
    return existingMap;
  }

  const entries = await readdir(CALENDARS_DIR, { withFileTypes: true });
  for (const entry of entries) {
    if (!entry.isFile() || !entry.name.endsWith('.json')) {
      continue;
    }

    const yearMatch = entry.name.match(/^(\d{4})\.json$/);
    if (!yearMatch || !yearMatch[1]) {
      throw new Error(
        `Arquivo inesperado ou nome inválido em calendars/: ${entry.name}. Esperado: {year}.json.`
      );
    }

    const fileYear = Number(yearMatch[1]);
    const filePath = resolve(CALENDARS_DIR, entry.name);
    let parsed;
    try {
      const raw = await readFile(filePath, 'utf-8');
      parsed = JSON.parse(raw);
    } catch (err) {
      throw new Error(`Falha ao ler/parsear arquivo existente ${filePath}: ${err.message}`);
    }

    if (!isValidCalendarMetadata(parsed.metadata)) {
      throw new Error(`Metadados inválidos ou ausentes no arquivo existente ${filePath}.`);
    }

    if (parsed.metadata.year !== fileYear) {
      throw new Error(
        `Inconsistência no arquivo ${filePath}: metadata.year (${parsed.metadata.year}) difere do nome (${fileYear}).`
      );
    }

    // Validação estrita de todos os feriados do arquivo histórico
    // Rejeita datas impossíveis, datas com ano diferente do arquivo, duplicatas, type inválido
    try {
      validateYearData(fileYear, parsed.holidays);
    } catch (err) {
      throw new Error(`Arquivo existente inválido ${filePath}: ${err.message}`);
    }

    if (existingMap.has(fileYear)) {
      throw new Error(`Ano duplicado detectado nos arquivos existentes: ${fileYear}.`);
    }

    existingMap.set(fileYear, { filePath, calendar: parsed });
  }

  return existingMap;
}

export async function syncCalendars() {
  const currentUtcYear = new Date().getUTCFullYear();
  const startYear = currentUtcYear - 1;
  const endYear = currentUtcYear + 3;

  console.log(`Iniciando sincronização de calendários (${startYear} a ${endYear})...`);

  // 1. Carregar e validar estritamente todos os arquivos históricos existentes (fail-closed) antes de fetch/escrita
  const existingMap = await loadAndValidateExistingCalendars();

  // 2. Buscar e validar todos os novos anos em memória antes de tocar no disco
  const fetchedYears = [];
  for (let year = startYear; year <= endYear; year++) {
    const yearData = await fetchCalendarForYear(year);
    fetchedYears.push(yearData);
  }

  await mkdir(CALENDARS_DIR, { recursive: true });

  const nowIso = new Date().toISOString();
  let updatedCount = 0;
  let createdCount = 0;
  let unchangedCount = 0;

  // 3. Processar escrita arquivo por arquivo com escrita em temporário e rename atômico.
  // Nota de arquitetura: A gravação é atômica por arquivo individual (write tmp + rename).
  // Não há transação trans-arquivos no sistema de arquivos local; se ocorrer uma falha inesperada
  // no SO no meio do loop, os arquivos já concluídos permanecem válidos e uma nova execução converge.
  for (const { year, holidays, sourceUrl } of fetchedYears) {
    const targetFilePath = resolve(CALENDARS_DIR, `${year}.json`);
    const existingEntry = existingMap.get(year);
    const existingCalendar = existingEntry ? existingEntry.calendar : null;

    const currentHash = computeHolidaysHash(holidays);
    const existingHolidaysHash =
      existingCalendar && Array.isArray(existingCalendar.holidays)
        ? computeHolidaysHash(existingCalendar.holidays)
        : null;

    let calendarToWrite;

    if (existingCalendar && existingHolidaysHash === currentHash) {
      // O conteúdo dos feriados não mudou.
      // Se metadata.version estiver incorreto/desalinhado com o hash calculado, corrigimos a version
      // preservando rigorosamente o updatedAt existente.
      if (existingCalendar.metadata.version !== currentHash) {
        console.log(`[${year}] Feriados idênticos, mas versão inconsistente. Corrigindo version para ${currentHash} e preservando updatedAt.`);
        calendarToWrite = {
          metadata: {
            ...existingCalendar.metadata,
            sourceUrl: existingCalendar.metadata.sourceUrl || sourceUrl,
            version: currentHash,
          },
          holidays,
        };
      } else {
        console.log(`[${year}] Sem alterações nos feriados e versão consistente. Metadados preservados.`);
        unchangedCount++;
        continue;
      }
    } else {
      // Novo arquivo ou feriados alterados: atualiza version e gera novo updatedAt
      calendarToWrite = {
        metadata: {
          year,
          source: 'BrasilAPI',
          sourceUrl,
          version: currentHash,
          updatedAt: existingCalendar ? nowIso : (existingCalendar?.metadata?.updatedAt || nowIso),
        },
        holidays,
      };
    }

    const tempFilePath = resolve(CALENDARS_DIR, `${year}.json.tmp-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`);

    try {
      await writeFile(tempFilePath, `${JSON.stringify(calendarToWrite, null, 2)}\n`, 'utf-8');
      await rename(tempFilePath, targetFilePath);
    } catch (err) {
      try {
        if (existsSync(tempFilePath)) {
          await unlink(tempFilePath);
        }
      } catch {
        // ignorar erro de limpeza de temp
      }
      throw new Error(`Falha ao gravar snapshot atômico para o ano ${year}: ${err.message}`);
    }

    if (existingCalendar) {
      console.log(`[${year}] Atualizado com sucesso (versão: ${currentHash}).`);
      updatedCount++;
    } else {
      console.log(`[${year}] Criado com sucesso (versão: ${currentHash}).`);
      createdCount++;
    }
  }

  console.log(
    `Sincronização concluída: ${createdCount} criados, ${updatedCount} atualizados, ${unchangedCount} inalterados.`
  );
}

// Execução como script CLI direto
if (process.argv[1] && resolve(process.argv[1]) === __filename) {
  syncCalendars().catch((err) => {
    console.error(`Erro crítico na sincronização de calendários:`, err);
    process.exit(1);
  });
}
