# Telegram OpenCode Bot

Ponte local-first entre Telegram e OpenCode. O bot cria demandas, controla sessões pelo `opencode serve`, mostra um Kanban textual no Telegram e notifica decisão, atenção, erro e conclusão.

## Instalação prática

### Comando único para colar no OpenCode

Se o repositório ainda não está na máquina, cole este bloco no OpenCode/terminal:

```bash
git clone https://github.com/leandromoraes707/openconde-control-remote-.git openconde-control-remote && cd openconde-control-remote && npm run setup && npm start
```

Se você já abriu o OpenCode dentro da pasta do projeto, cole só:

```bash
npm run setup && npm start
```

Durante o setup, você só precisa colar o token do BotFather, abrir o link do bot no Telegram, enviar `/start` e apertar Enter no terminal.

### Pré-requisitos

- Node.js/npm instalados.
- OpenCode CLI instalado e logado.
- Token de bot criado no Telegram com `@BotFather` (`/newbot`).

### Rodar depois da primeira instalação

Depois que `.env` já existe, o comando normal é:

```bash
npm start
```

O `npm run setup`:

1. instala dependências;
2. pede apenas o token do BotFather;
3. valida o token no Telegram;
4. mostra o link do bot e pede para você enviar `/start`;
5. captura seu Telegram user id e grava `TELEGRAM_ALLOWED_USER_IDS`;
6. gera `.env` com workspace atual, `127.0.0.1`, senha local do OpenCode e SQLite;
7. roda `npm run typecheck`, `npm test` e `npm run qa:fake`.

Depois, `npm start` sobe `opencode serve` local e o bot Telegram juntos.

Se quiser rodar em dois terminais:

```bash
npm run opencode:serve
npm run dev
```

## Setup manual opcional

Se não quiser usar o instalador:

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run qa:fake
```

Depois preencha `.env`, rode `npm run opencode:serve` e `npm run dev`.

## Comandos Telegram

- `/start` ou `/ajuda`: mostra ajuda.
- `/nova <demanda>`: cria uma demanda e envia para o OpenCode.
- `/kanban`: mostra demandas por coluna.
- `/listar`: lista as últimas demandas.
- `/status <id>`: mostra estado detalhado.
- `/eventos <id>`: mostra histórico auditável.
- `/responder <id> <texto>`: responde pergunta/permissão pendente.
- `/cancelar <id>`: cancela demanda ativa.

## Segurança

Este bot é uma ponte para execução local. Se token e allowlist vazarem, alguém pode acionar mudanças no workspace. Use `TELEGRAM_ALLOWED_USER_IDS`, mantenha o OpenCode em `127.0.0.1`, não use `--mdns` nem porta pública, e mantenha `.env`/SQLite fora do Git. O instalador gera `OPENCODE_SERVER_PASSWORD` e o `npm start` repassa essa senha ao `opencode serve`.

## Licença

MIT. Veja `LICENSE`.

Documentação detalhada:

- `docs/manual.md`
- `docs/runbook.md`
