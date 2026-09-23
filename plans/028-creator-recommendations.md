# Plan 028: Produtos indicados por streamer

Issue: [#215](https://github.com/ludmila-omlopes/ludylops-live/issues/215).
Estado: IMPLEMENTED, aguardando merge. Base: `5011aee`, após o PR #214.

## Entrega

- Cadastro, edição, publicação e ocultação pelo dono da comunidade.
- Lista pública isolada em `/c/<slug>/produtinhos` e acesso pelo início.
- Listagens limitadas e paginadas; tentativas repetidas sem duplicação;
  conflito para edição desatualizada; permissão e lifecycle dentro da transação.
- Leitores e gravadores legados restritos à Ludylops, inclusive upsert e
  administração. Nenhuma nova migração ou configuração do Streamer.bot.

## Verificação

946 testes gerais, 6 testes PostgreSQL locais, tipagem, lint, build e UI
desktop/mobile passaram. Detalhes e cuidado com rollback em
[docs/creator-recommendations.md](../docs/creator-recommendations.md).

O merge continua com a usuária. Sugestões de espectadores e preenchimento
automático de produtos não fazem parte desta entrega.
