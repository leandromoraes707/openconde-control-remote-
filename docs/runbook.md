# Runbook operacional

## Setup

Fluxo máquina zero:

```bash
curl -fsSL https://raw.githubusercontent.com/leandromoraes707/openconde-control-remote-/main/scripts/bootstrap.sh | bash
```

Fluxo alternativo sem `curl`:

```bash
git clone https://github.com/leandromoraes707/openconde-control-remote-.git openconde-control-remote && cd openconde-control-remote && npm run setup && npm start
```

Fluxo quando o OpenCode já abriu dentro da pasta do projeto:

```bash
npm run setup && npm start
```

O setup interativo valida o token do Telegram, captura o usuário autorizado via `/start`, gera `.env`, instala dependências e roda `typecheck`, testes e QA fake.

Para operação em dois terminais:

```bash
npm run opencode:serve
npm run dev
```

Setup manual de contingência:

```bash
cp .env.example .env
npm install
npm run typecheck
npm test
npm run qa:fake
```

## Recuperação após restart

Ao iniciar, o bot lê demandas ativas no SQLite e consulta `/session/status`. Se a sessão ainda existir, reanexa o acompanhamento. Se não existir, marca a demanda como `failed` com evento `session_not_found_after_restart`.

## Queda de SSE

O client HTTP reconecta o stream `/event`. A cada erro/reconexão, o gerenciador reconcilia demandas ativas com `/session/status` para reduzir perda de evento crítico.

## Segurança mínima

- `TELEGRAM_ALLOWED_USER_IDS` é obrigatório.
- `OPENCODE_SERVER_URL` deve apontar para `127.0.0.1`.
- `OPENCODE_SERVER_PASSWORD` deve ser mantido no `.env`; o instalador gera esse valor automaticamente.
- Não use `opencode serve --mdns` para este MVP.
- Não exponha a porta do OpenCode para internet.
- Preferir workspace limitado ou container sem privilégios para uso remoto frequente.

## QA manual sem Telegram

```bash
npm run qa:fake
```

O script cria uma demanda, simula pergunta, envia resposta, simula conclusão e imprime Kanban/eventos.
