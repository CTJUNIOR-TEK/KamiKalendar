# KamiKalendar

Calculadora de dias úteis baseada nas datas retornadas pela BrasilAPI nacional.

## Arquitetura e Estrutura

Projeto cliente React + TypeScript estático (Vite) preparado para deploy no Cloudflare Pages.

### Estrutura de Diretórios (`src/`)

- `src/calendar/`: Gerenciamento e carregamento de calendários anuais JSON locais versionados (feriados, finais de semana, metadata).
- `src/calculation/`: Regras de contagem e adição de dias úteis.
- `src/ui/`: Componentes visuais de interface, formulários e layouts.

## Regras de Negócio Previstas

1. **Intervalo Inclusivo (`/contar`)**:
   - A contagem entre duas datas inclui a data de início e a data de término (se forem dias úteis).
2. **Adição de Dias Úteis (`/adicionar`)**:
   - A adição de $N$ dias começa a contar a partir do dia seguinte à data inicial.
   - Caso $N = 0$, a função retorna a própria data inicial sem deslocamento.
3. **Exclusões**:
   - Sábados e domingos são excluídos da contagem de dias úteis.
   - Datas exatas retornadas pela BrasilAPI nacional (incluindo pontos facultativos/bancários como Carnaval e Corpus Christi) são excluídas literalmente.
4. **Formato de Datas**:
   - Padrão ISO 8601 de data pura (`YYYY-MM-DD`), manipulado sem conversão de fuso horário local/UTC para evitar desvios de dia.
5. **Calendário Local Versionado**:
   - Os feriados são mantidos em arquivos JSON locais versionados por ano com metadata de origem e versão.
   - Tentativa de consulta em ano ausente deve lançar erro explícito orientando a inclusão do respectivo calendário.
6. **Rotas Cliente Futuras**:
   - `/contar`: Interface para contar dias úteis entre duas datas.
   - `/adicionar`: Interface para adicionar $N$ dias úteis a uma data base.

## Scripts

- `npm run dev`: Inicia servidor de desenvolvimento Vite.
- `npm run build`: Gera o build estático para produção (Cloudflare Pages).
- `npm run typecheck`: Valida tipos com `tsc --noEmit`.
- `npm run test`: Executa testes unitários com Vitest.
