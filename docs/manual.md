# Manual de uso

## Conceito

O Telegram é a interface de chat do OpenCode. Texto normal é enviado ao agente e as respostas do agente voltam no próprio Telegram. O Kanban não é a interface principal da conversa; ele é apenas o gestor/auditoria das sessões, estados, eventos e pendências persistidos no SQLite.

## Instalação cola-token

Cole no terminal:

```bash
curl -fsSL https://raw.githubusercontent.com/leandromoraes707/openconde-control-remote-/main/scripts/bootstrap.sh | bash
```

Se preferir sem `curl`:

```bash
git clone https://github.com/leandromoraes707/openconde-control-remote-.git openconde-control-remote && cd openconde-control-remote && npm run setup && npm start
```

Se você já está dentro da pasta do projeto:

```bash
npm run setup && npm start
```

O instalador pede só o token do BotFather em prompt interativo, valida o token, gera `.env`, instala dependências e mostra o link do bot. Ele não pede para capturar `/start` no terminal.

Depois, mantenha este comando rodando no terminal:

```bash
npm start
```

No Telegram, abra o link do bot e envie `/start`. O primeiro `/start` registra seu usuário em `TELEGRAM_ALLOWED_USER_IDS`. A partir daí, envie texto normal para conversar com o OpenCode.

Não envie `npm start` no Telegram; esse comando é apenas do terminal.

## Comandos

```text
/start
/help
/ajuda
texto normal para conversar com o OpenCode
/new [mensagem]
/clear [mensagem]
/nova [mensagem]
/kanban
/listar
/status <id>
/eventos <id>
/responder <id> <texto>
/cancelar <id>
```

## Fluxo recomendado

1. Envie uma mensagem normal, por exemplo: `corrigir erro X e rodar validações`.
2. O bot inicia ou continua a sessão ativa mais recente do OpenCode e responde no próprio Telegram quando o agente falar.
3. Use `/kanban` apenas para acompanhar auditoria/estado da tarefa.
4. Se o OpenCode pedir decisão, o card muda para `Aguardando`; responda com texto normal ou com `/responder <id> <texto>` quando houver mais de uma conversa ativa.
5. Ao finalizar, o card vai para `Concluídas`; consulte `/eventos <id>` para auditoria.

Para abrir outra conversa sem cancelar a atual, use `/new`, `/clear` ou `/nova`. Com texto, por exemplo `/new investigue o login`, o bot cria uma sessão nova e já envia esse prompt. Sem texto, ele abre uma sessão vazia; a próxima mensagem normal vai para essa conversa nova.

## Colunas do Kanban

- `Entrada`: demanda criada, ainda não enviada ao OpenCode.
- `Executando`: sessão ativa no OpenCode.
- `Aguardando`: há pergunta ou permissão pendente.
- `Com erro`: a sessão falhou ou não foi encontrada após recuperação.
- `Concluídas`: OpenCode ficou idle após execução sem erro pendente.
- `Canceladas`: usuário cancelou a demanda.

## Responder permissões

Para permissões do OpenCode, use um destes prefixos no texto:

- `once <mensagem>` ou apenas o texto: permite uma vez.
- `always <mensagem>`: permite sempre quando o OpenCode aceitar essa opção.
- `reject <motivo>`: rejeita.

Para perguntas normais, o texto comum no chat é enviado como resposta humana. `/responder <id> <texto>` continua disponível como forma explícita.
