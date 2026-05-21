# Manual de uso

## Conceito

Cada `/nova` cria uma demanda-card. O bot guarda a demanda no SQLite, cria uma sessão no OpenCode e acompanha eventos pelo stream `/event`.

## Instalação cola-token

Se o repositório ainda não está na máquina, cole no OpenCode/terminal:

```bash
git clone https://github.com/leandromoraes707/openconde-control-remote-.git openconde-control-remote && cd openconde-control-remote && npm run setup && npm start
```

Se você já está dentro da pasta do projeto:

```bash
npm run setup && npm start
```

O instalador pede só o token do BotFather. Depois ele mostra o link do bot, você envia `/start` no Telegram e aperta Enter no terminal. Com isso ele captura seu Telegram user id, grava a allowlist em `.env`, instala dependências e roda as validações.

Para usar depois do setup:

```bash
npm start
```

Esse comando sobe `opencode serve` em `127.0.0.1` e inicia o bot.

## Comandos

```text
/start
/ajuda
/nova <descrição>
/kanban
/listar
/status <id>
/eventos <id>
/responder <id> <texto>
/cancelar <id>
```

## Fluxo recomendado

1. Envie `/nova corrigir erro X e rodar validações`.
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
