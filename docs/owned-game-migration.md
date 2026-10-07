# Aplicação da coluna de posse de jogos

Aplicada em 6 de outubro de 2026, no banco configurado no ambiente do projeto, após autorização explícita da usuária. Código de referência: `bfba69e` (`codex/owned-game-bonus`). Credenciais e endereço do banco não são registrados aqui.

Foi usado `drizzle-kit push` com configuração temporária que exportava apenas `gameSuggestions` do schema atual e filtrava `game_suggestions`, mantendo `strict` e `verbose`. O plano revisado e autorizado continha exclusivamente:

```sql
ALTER TABLE "game_suggestions" ADD COLUMN "is_owned" boolean DEFAULT false NOT NULL;
```

A comparação geral propôs também recriar constraints de outros módulos; esse plano foi cancelado. Nenhuma dessas alterações foi aplicada. Não foram executados seeds nem inseridas entradas artificiais no histórico de migrações.

Verificação independente, com uma nova conexão após a aplicação:

- `is_owned`: tipo `boolean`, `NOT NULL`, padrão `false`.
- 58 sugestões e soma de 53.152 votos antes e depois.
- Nenhum jogo marcado como possuído e nenhum valor nulo na coluna nova.
- `creator-baseline.ts check`: `ready=true`, nenhum registro ausente, nenhum insert, antes e depois.

O CLI mostrou `Changes applied`, mas teve um erro de encerramento do libuv no Windows. A conclusão acima vem da leitura independente do banco, que terminou com código 0. Os arquivos temporários de execução foram removidos.

Este registro confirma a alteração do banco; não confirma publicação do código da funcionalidade.
