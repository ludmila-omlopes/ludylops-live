# Plan 029: Imagem da recomendação a partir do link

Issue: [#22](https://github.com/ludmila-omlopes/ludylops-live/issues/22).
Estado: IMPLEMENTED, aguardando merge. Base: `85da513`, após o PR #216.

## Entrega

- Busca explícita de imagem pelo link nos formulários da Ludylops e dos streamers.
- Preenchimento com edição manual, estados de carregamento/sucesso/falha e
  descarte de respostas desatualizadas ao trocar produto, link ou imagem.
- Endpoints autorizados, destinos e IPs validados, download e tempo limitados,
  redirects controlados e limites locais de uso.
- Reutilização da autorização de recomendações; nenhuma migração ou nova
  configuração do Streamer.bot.

## Verificação

972 testes gerais, tipagem, lint, build e UI desktop/mobile passaram. Busca real
retornou imagens em links da Amazon e KaBuM!. Detalhes e limitações em
[docs/recommendation-image-lookup.md](../docs/recommendation-image-lookup.md).

O merge continua com a usuária.
