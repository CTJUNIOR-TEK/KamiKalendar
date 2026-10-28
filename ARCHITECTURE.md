# Arquitetura KamiKalendar - Fase 1

## Visão Geral
KamiKalendar é uma aplicação web cliente desenvolvida em React + TypeScript com empacotamento Vite. O foco do sistema é a precisão no cálculo de dias úteis em âmbito brasileiro.

## Estrutura Modular (`src/`)

```
src/
├── calendar/       # Gerenciamento de anos e feriados locais versionados
├── calculation/    # Interfaces e motores de cálculo de dias úteis
├── ui/             # Componentes de interface do usuário
├── App.tsx         # Componente raiz da aplicação
├── main.tsx        # Ponto de entrada React
└── vite-env.d.ts   # Tipagens do Vite
```

### 1. `src/calendar/`
- Armazena calendários em formato JSON local seguindo a estrutura do tipo `YearCalendar`:
  - `metadata`: Objeto contendo os metadados do calendário:
    - `year`: Ano de referência.
    - `source`: Origem dos dados (ex.: BrasilAPI).
    - `version`: Versão do arquivo/extração.
    - `updatedAt`: Data/hora da última atualização.
  - `holidays`: Lista de feriados (`HolidayEntry[]`) com data ISO (`YYYY-MM-DD`), nome e tipo opcional.
- Fornece funções para carregamento e validação. Se um cálculo referenciar um ano não cadastrado, o sistema lança erro explícito.

### 2. `src/calculation/`
- Responsável por conter as funções puras de contagem e adição de dias úteis:
  - **Intervalo Inclusivo**: A contagem inclui data inicial e final caso sejam dias úteis.
  - **Adição**: $N$ dias adicionados começa no dia útil posterior à data inicial. $N = 0$ retorna a própria data de início.
  - **Exclusões**: Finais de semana (sábado e domingo) e datas exatas listadas como feriado (inclusive Carnaval e Corpus Christi) são excluídas.
  - **Sem fuso**: Manipulação de strings `YYYY-MM-DD` com aritmética de calendário puro.

### 3. `src/ui/`
- Componentes visuais desacoplados da lógica de cálculo.
- Preparado para roteamento futuro no cliente para `/contar` e `/adicionar`.

## Deploy (Cloudflare Pages)
- Saída configurada no diretório estático padrão `dist/`.
- Aplicação 100% estática sem necessidade de backend Node.js ativo.
