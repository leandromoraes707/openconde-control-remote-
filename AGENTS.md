# Regras locais do projeto

- O bot é local-first e deve falar com `opencode serve` em `127.0.0.1`.
- Nunca commitar `.env`, tokens, senhas ou bancos SQLite.
- Toda mudança relevante deve manter `docs/manual.md` e `docs/runbook.md` coerentes com o comportamento real.
- Antes de dizer que funciona, rodar `npm run typecheck`, `npm test` e `npm run qa:fake`.
- Tratar cada demanda como card auditável: status, eventos, respostas humanas e conclusão precisam ficar persistidos.
- O Kanban Telegram é a visão principal de operação; painel web fica fora do MVP.
