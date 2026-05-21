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

O setup interativo valida o token do Telegram, gera `.env`, instala dependências e deixa a allowlist vazia para bootstrap. O primeiro `/start` recebido pelo bot em execução registra e persiste o usuário em `TELEGRAM_ALLOWED_USER_IDS`.

Validações são opt-in no setup:

```bash
npm run setup -- --checks
```

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

O usuário autorizado fica persistido em `.env`. Se a allowlist estiver vazia de propósito, o próximo `/start` autorizado será o primeiro usuário que falar com o bot.

## Queda de SSE

O client HTTP reconecta o stream `/event`. A cada erro/reconexão, o gerenciador reconcilia demandas ativas com `/session/status` para reduzir perda de evento crítico.

## Segurança mínima

- `TELEGRAM_BOT_TOKEN` nunca deve ir para argumento CLI, chat, issue ou log. Se vazou, revogue no BotFather e gere outro.
- `TELEGRAM_ALLOWED_USER_IDS` pode começar vazio apenas para bootstrap; após o primeiro `/start`, deve ficar preenchido no `.env`.
- `OPENCODE_SERVER_URL` deve apontar para `127.0.0.1`.
- `OPENCODE_SERVER_PASSWORD` não é gerado pelo setup porque o `opencode serve` atual não expõe flag de senha local.
- Não use `opencode serve --mdns` para este MVP.
- Não exponha a porta do OpenCode para internet.
- Preferir workspace limitado ou container sem privilégios para uso remoto frequente.
- `npm audit --omit=dev` deve continuar limpo; avisos de pacote deprecado sem CVE devem ser acompanhados, não ignorados como vulnerabilidade.

## QA manual sem Telegram

```bash
npm run qa:fake
```

O script cria uma demanda, simula pergunta, envia resposta, simula conclusão e imprime Kanban/eventos.
