# Arquitetura KamiKalendar

## Visão Geral
KamiKalendar é uma aplicação web cliente desenvolvida em React + TypeScript com empacotamento Vite, concebida para execução estática sem backend dedicado e preparada para deploy no Cloudflare Pages.

## Estrutura do Repositório

```
├── .github/workflows/
│   └── sync-calendars.yml    # Workflow de sincronização periódica e validação de snapshots
├── calendars/                 # Snapshots locais versionados de feriados (JSON por ano)
├── scripts/
│   └── update-calendars.mjs  # Script Node.js de sincronização automatizada não interativa
└── src/
    ├── calendar/              # Tipos e loader estático em memória (getCalendarForYear)
    ├── calculation/           # Motor de cálculo de dias úteis e wrappers exportados
    ├── ui/                    # Componentes visuais (CountView, AddView, NotFoundView)
    ├── App.tsx                # Roteamento SPA nativo (window.location.pathname) e casca
    ├── main.tsx
    └── smoke.test.ts          # Testes unitários do loader e motor de cálculo
```

## Decisões da Fase 3: Roteamento Cliente e Motor de Cálculo

### 1. Roteamento SPA sem dependências adicionais
- Utiliza `window.location.pathname` com interceptação de cliques em links (`<a>`) e listener de evento `popstate`.
- Rota raiz `/` realiza `history.replaceState` amigável para `/contar`.
- Rotas desconhecidas acionam `NotFoundView` como tela de não encontrado na SPA (em resposta HTTP potencialmente 200 no Cloudflare Pages) com links de navegação.
- Sem dependência de bibliotecas pesadas de roteamento, garantindo bundle leve para o Cloudflare Pages.

### 2. Motor de Cálculo de Dias Úteis (`src/calculation/types.ts`)
- **Aritmética e Datas**: Manipulação estrita em UTC de datas ISO `YYYY-MM-DD` (intervalo 1900..9999) com roundtrip `Date.UTC` que invalida datas inexistentes como 29 de fevereiro em anos comuns ou 30 de fevereiro.
- **Feriados e Finais de Semana**:
  - Usa apenas sábado (`getUTCDay() === 6`), domingo (`getUTCDay() === 0`) e as datas exatas contidas nos snapshots anuais da BrasilAPI.
  - Não faz filtragem pelo campo `type`.
  - Tratamento sem dupla subtração: quando um feriado nacional coincide com sábado ou domingo, o dia é catalogado sob o motivo unificado `weekend_and_holiday`, subtraindo apenas 1 dia do total.
- **Regras Operacionais**:
  - `countBusinessDays` / `countBusinessDaysDetailed`: Intervalo inclusivo (data inicial e final são avaliadas). Validação de ordem (erro se `startDate > endDate`).
  - `addBusinessDays` / `addBusinessDaysDetailed`: Contagem a partir do dia seguinte à data inicial. Se `days === 0`, retorna a própria data inicial (após validar presença do ano no calendário).
  - Limite de segurança de dias para evitar travamento de interface em adições gigantescas.
- **Metadados e Rastreabilidade**:
  - Retorna lista detalhada de dias descartados (data, motivo e nome do feriado).
  - Na visualização de contagem (`CountView`), suporte a alternância acessível para ocultar/mostrar finais de semana na auditoria de dias descartados, mantendo eventos mistos (`weekend_and_holiday`) sempre visíveis.
  - Coleta e expõe metadados de versão (`version`, `source`, `updatedAt`) de todos os calendários consultados (inclusive ao atravessar anos, ex.: Dezembro -> Janeiro).
  - Mantém assinaturas de wrappers `countBusinessDays(params): number` e `addBusinessDays(params): string` sobre os métodos detalhados para compatibilidade estrita.

## Decisões da Fase 2: Calendários e Snapshots Estáticos

### 1. Fonte da Verdade e Snapshots Determinísticos
- **Endpoint**: BrasilAPI nacional (`https://brasilapi.com.br/api/feriados/v1/{year}`) sem filtro por UF.
- **Janela de Sincronização**: `[UTC_current_year - 1, UTC_current_year + 3]`.
- **Validação Rigorosa e Fail-Closed**:
  - Antes de qualquer escrita, todos os arquivos existentes em `calendars/` são carregados e parseados. Se algum arquivo estiver corrompido ou malformado, o processo falha imediatamente (fail-closed).
  - O script busca e valida em memória toda a janela temporal antes de tocar no disco. Qualquer erro cancela o processo sem sobrescrever arquivos.
  - As datas sofrem roundtrip UTC (`Date.UTC`), rejeitando datas de calendário impossíveis (ex.: `2026-02-30`).
- **Deduplicação, Ordenação e Versionamento**:
  - Datas são ordenadas estavelmente e deduplicadas.
  - A chave `version` no metadata é gerada pelo hash sha256 (`slice(0, 12)`) dos feriados normalizados.
  - Se os feriados forem idênticos mas o hash no arquivo existente estiver inconsistente, o script alinha a `version` preservando o `updatedAt`. Se os feriados mudarem, gera-se um novo `updatedAt`.
- **Gravação Atômica por Arquivo**:
  - Cada arquivo é escrito primeiro em um arquivo temporário (`.tmp-...`) e renomeado atomicamente para `{year}.json`.
  - Nota de resiliência: O sistema de arquivos local não provê transação atômica multi-arquivos; em caso de interrupção inesperada a nível de SO, arquivos concluídos permanecem íntegros e a próxima execução do workflow converge.

### 2. Loader em Runtime Estático (`src/calendar/loader.ts`)
- Carregamento síncrono no bundle estático com `import.meta.glob('../../calendars/*.json', { eager: true })`.
- Utiliza a chave `path` de cada módulo para validar o ano no nome do arquivo contra `metadata.year` e previne duplicidade de registros de um mesmo ano.
- Não há requisições de rede durante a execução da aplicação pelo usuário final.
- Validação estrutural de tipos em runtime.
- Lançamento de erro explícito com lista de anos suportados quando consultado um ano não catalogado.

### 3. CI/CD e Integrações
- **GitHub Actions**: Agenda semanalmente o sync e roda a suíte de validação (`typecheck`, `test`, `build`). Não utiliza `[skip ci]` na mensagem de commit para permitir que a integração de deploy do Cloudflare Pages seja disparada adequadamente.
- **Cloudflare Pages**: A aplicação estática é construída em `dist/`. O vínculo do repositório no Cloudflare Pages exige configuração manual no dashboard da Cloudflare pelo administrador da conta; não é configurado automaticamente via repositório.
