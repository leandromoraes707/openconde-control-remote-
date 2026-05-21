# Manual de uso

## Conceito

Cada mensagem de demanda cria um card. O bot guarda a demanda no SQLite, cria uma sessão no OpenCode e acompanha eventos pelo stream `/event`.

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

No Telegram, abra o link do bot e envie `/start`. O primeiro `/start` registra seu usuário em `TELEGRAM_ALLOWED_USER_IDS`. A partir daí, envie texto normal para criar demandas.

Não envie `npm start` no Telegram; esse comando é apenas do terminal.

## Comandos

```text
/start
/ajuda
texto normal para criar demanda
/nova <descrição>
/kanban
/listar
/status <id>
/eventos <id>
/responder <id> <texto>
/cancelar <id>
```

## Fluxo recomendado

1. Envie uma mensagem normal, por exemplo: `corrigir erro X e rodar validações`.
2. Use `/kanban` para ver a demanda na coluna `Executando`.
3. Se o OpenCode pedir decisão, o card muda para `Aguardando`.
4. Responda com `/responder <id> <texto>`.
5. Ao finalizar, o card vai para `Concluídas`; consulte `/eventos <id>` para auditoria.

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

Para perguntas normais, o texto é enviado como resposta humana.
