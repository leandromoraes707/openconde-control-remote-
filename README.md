# Telegram OpenCode Bot

Ponte local-first entre Telegram e OpenCode. O Telegram vira chat do OpenCode: texto normal conversa com o agente, enquanto o Kanban fica só como gestor/auditoria das tarefas e sessões controladas pelo `opencode serve`.

## Instalação prática

### Comando único

Cole no terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/leandromoraes707/openconde-control-remote-/main/scripts/bootstrap.sh | bash
```

Ele clona o repositório, roda `npm run setup` e depois mantém `npm start` rodando. O setup pede o token do BotFather em prompt interativo; não passe token por argumento de linha de comando.

Se preferir sem `curl`:

```bash
git clone https://github.com/leandromoraes707/openconde-control-remote-.git openconde-control-remote && cd openconde-control-remote && npm run setup && npm start
```

Se você já está dentro da pasta do projeto:

```bash
npm run setup && npm start
```

Depois que o terminal mostrar que o bot está pronto, abra o link `https://t.me/<seu_bot>` no Telegram e envie `/start`. Esse primeiro `/start` registra e persiste seu usuário autorizado. Depois disso, envie qualquer texto normal para conversar com o OpenCode; as respostas do agente voltam no próprio Telegram. Não envie `npm start` no Telegram; esse comando é só do terminal.

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

1. pede apenas o token do BotFather em prompt interativo;
2. valida o token no Telegram e mostra o link do bot;
3. gera `.env` com workspace atual, `127.0.0.1`, SQLite e allowlist vazia;
4. instala dependências;
5. não roda validações por padrão; use `npm run setup -- --checks` para rodar `typecheck`, testes e QA fake durante o setup.

O `npm start` sobe `opencode serve` local e o bot Telegram juntos.

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

## Uso no Telegram

- `/start`, `/help` ou `/ajuda`: registra o usuário e mostra ajuda.
- Texto normal: conversa com o OpenCode; se já houver conversa ativa, continua a sessão ativa mais recente.
- Resposta a pergunta/permissão pendente: envie texto normal no chat, ou use `/responder <id> <texto>` quando houver mais de uma conversa ativa.
- `/new [mensagem]` ou `/clear [mensagem]`: abre uma nova conversa OpenCode mesmo se já existir outra ativa; sem mensagem, a próxima mensagem normal continua essa conversa nova.
- `/nova [mensagem]`: alias em português para `/new`.
- `/kanban`: mostra o gestor/auditoria das conversas por coluna.
- `/listar`: lista as últimas demandas.
- `/status <id>`: mostra estado detalhado.
- `/eventos <id>`: mostra histórico auditável.
- `/responder <id> <texto>`: alternativa explícita para responder pergunta/permissão pendente.
- `/cancelar <id>`: cancela demanda ativa.

## Segurança

Este bot é uma ponte para execução local. Se o token do Telegram ou a allowlist vazarem, alguém pode acionar mudanças no workspace.

- Nunca cole o token do BotFather em chat, issue, log ou argumento CLI. Se isso acontecer, revogue e gere outro token no BotFather.
- O setup grava `.env` com permissão `0600`; mantenha `.env` e SQLite fora do Git.
- O primeiro `/start` persiste `TELEGRAM_ALLOWED_USER_IDS`; revise esse valor se usar a máquina com outras pessoas.
- Mantenha o OpenCode em `127.0.0.1`; não use `--mdns` nem porta pública para este MVP.
- `OPENCODE_SERVER_PASSWORD` não é gerado pelo setup porque o `opencode serve` atual não expõe flag de senha local.

## Licença

MIT. Veja `LICENSE`.

Documentação detalhada:

- `docs/manual.md`
- `docs/runbook.md`
