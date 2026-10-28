# KamiKalendar

Calculadora de dias úteis baseada nas datas retornadas pela BrasilAPI nacional.

## Arquitetura e Estrutura

Projeto cliente React + TypeScript estático (Vite) preparado para deploy no Cloudflare Pages.

### Estrutura de Diretórios

- `calendars/`: Snapshots JSON versionados de feriados por ano (ex.: `2025.json`, `2026.json`, `2027.json`, `2028.json`, `2029.json`).
- `scripts/`: Scripts utilitários de automação Node.js (`update-calendars.mjs`).
- `src/calendar/`: Gerenciamento e carregamento estático em memória (`getCalendarForYear`) de calendários anuais JSON locais com tipagem estrita e validação contra duplicatas/nome de arquivo.
- `src/calculation/`: Motor de contagem e adição de dias úteis com suporte a detalhamento de dias descartados e metadados.
- `src/ui/`: Componentes visuais de interface acessível e responsiva (`CountView`, `AddView`, `NotFoundView`) e utilitários de apresentação/parsing de datas (`dateFormat.ts`, `filterUtils.ts`).

## Rotas e Interface (Fase 3)

A aplicação cliente é uma SPA pura sem backend e sem dependências pesadas de roteamento:
- `/contar`: Interface para contagem inclusiva de dias úteis entre duas datas no formato visual `DD/MM/YYYY`.
- `/adicionar`: Interface para adição de N dias úteis a partir do dia útil seguinte à data inicial informada em `DD/MM/YYYY` (N=0 retorna a própria data inicial).
- `/`: Redirecionamento amigável e automático no cliente para `/contar`.
- Rota desconhecida: Apresenta tela 404 limpa e acessível com links diretos para `/contar` e `/adicionar`.
- **Acessibilidade, Usabilidade e Formato de Datas**: Formulários utilizam campos textuais controlados com `inputMode="numeric"`, `placeholder="3/10/26 ou 031026"`, `maxLength={14}` (permitindo colagem com espaços e trim automático) e validação estrita de calendário real (incluindo validação de anos bissextos e faixa 1900..9999). A entrada aceita formatos amigáveis como `3/10/26`, `03/10/2026`, `031026` e `03102026`, interpretando anos de 2 dígitos (00..99) sem ambiguidade como 2000..2099 (ex.: 26 = 2026). Conta com inserção incremental suave de barras durante digitação ao final sem atrapalhar navegação/Backspace, normalização para `DD/MM/YYYY` no `blur` se válido e retenção do texto digitado para correção amigável em caso de erro. Toda data apresentada visualmente ao usuário (inputs, exemplos, resultados apurados, linhas de tabela de dias descartados e metadados de snapshot) é formatada estritamente em `DD/MM/YYYY` (ou `DD/MM/YYYY às HH:mm (horário de Brasília)` para carimbos de atualização).
- **Filtro de Fins de Semana**: Disponível em ambas as visões (`/contar` e `/adicionar`), permitindo alternar a exibição da tabela de dias descartados com botão acessível com estado `aria-pressed`, preservando feriados nacionais e ocorrências coincidentes com finais de semana sem alterar os totais do motor de cálculo.
- **Escopo das Datas**: O sistema opera estritamente com as datas da lista nacional da BrasilAPI e finais de semana (sábado/domingo); não inclui feriados estaduais ou municipais específicos.

## Regras de Negócio e Calendários (Fase 2)

1. **Calendário Nacional BrasilAPI**:
   - Origem dos dados: endpoint nacional `https://brasilapi.com.br/api/feriados/v1/{year}` sem especificação de UF.
   - Escopo temporal do sync: ano corrente UTC -1 até ano corrente UTC +3 (janela móvel de 5 anos; atualmente 2025 a 2029).
   - Validações: array não vazio, datas no formato ISO estrito `YYYY-MM-DD`, verificação de data UTC real (roundtrip rejeitando datas inexistentes como 29 de fevereiro em ano não bissexto ou 30 de fevereiro), pertencentes ao ano correspondente, sem duplicatas, ordenadas de forma estável.
   - Versionamento de conteúdo: hash determinístico sha256 (`version`) dos feriados. O carimbo `updatedAt` só é alterado quando o conteúdo dos feriados efetivamente muda (se apenas o hash de versão estiver inconsistente, ele é corrigido mantendo `updatedAt`).
   - Política Fail-Closed: valida todos os arquivos existentes antes de qualquer operação; se qualquer arquivo estiver malformado ou se houver falha de rede/validação nos novos dados, o processo é abortado sem sobrescrever snapshots.
   - Gravação atômica por arquivo individual via arquivo temporário seguido de renomeação.
2. **Carregamento Estático no Cliente**:
   - `getCalendarForYear(year)`: Carrega os calendários compilados via `import.meta.glob(..., { eager: true })` sem chamadas de rede em runtime.
   - Valida que o nome do arquivo corresponde a `metadata.year` e impede anos duplicados.
   - Tentativa de consulta em ano ausente lança erro explícito com lista de anos disponíveis.
3. **Exclusões Literais**:
   - Todas as datas retornadas nacionalmente pela BrasilAPI (como Carnaval e Corpus Christi, sem classificação jurídica) são tratadas literalmente como dias não úteis e descartadas.
4. **Formato de Datas**:
   - Padrão ISO 8601 de data pura (`YYYY-MM-DD`), manipulado sem conversão de fuso horário local/UTC.

## Automação e Deploy

- **GitHub Actions (`.github/workflows/sync-calendars.yml`)**:
  - Execução programada semanalmente (domingos às 03:00 UTC) e acionamento manual (`workflow_dispatch`).
  - Executa `npm run sync-calendars`, `npm run typecheck`, `npm test`, `npm run build`.
  - Comita e publica exclusivamente alterações no diretório `calendars/` (sem `[skip ci]` para garantir que pipelines de deploy como Cloudflare Pages possam processar as atualizações).
  - Caso ocorra falha de rede ou validação no endpoint, a pipeline é interrompida com erro sem comitar arquivos corrompidos.
- **Cloudflare Pages**:
  - Saída configurada no diretório estático padrão `dist/`.
  - **Nota de Configuração**: A integração contínua via Git com o Cloudflare Pages requer configuração manual do repositório no painel do Cloudflare (Cloudflare Pages Dashboard -> Connect to Git) pelo mantenedor, além de verificação manual de deploy posterior. A integração NÃO está previamente ativa no repositório.

## Scripts

- `npm run dev`: Inicia servidor de desenvolvimento Vite.
- `npm run build`: Gera o build estático para produção (`dist/`).
- `npm run typecheck`: Valida tipos com `tsc --noEmit`.
- `npm run test`: Executa testes unitários com Vitest.
- `npm run sync-calendars`: Sincroniza snapshots locais de feriados nacionais a partir da BrasilAPI.
