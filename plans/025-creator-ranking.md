# Plan 025: Ranking público por comunidade

Issue: [#209](https://github.com/ludmila-omlopes/ludylops-live/issues/209).
Parte de [#203](https://github.com/ludmila-omlopes/ludylops-live/issues/203).

Estado: DONE, integrado no PR #210. Base: `7cf4cec`, após o merge do PR #208.

## Entrega

- Ranking público em `/c/<slug>/ranking` e API com limite de 100 participantes.
- Saldo positivo isolado por creator, respeitando exclusões existentes e
  removendo identidades sintéticas; desempate determinístico.
- Nome da moeda atualizado a cada consulta e saída pública mínima.
- Autorização específica de leitura, dependência de points, lifecycle e flag
  existentes; consultas legadas continuam restritas à Ludylops.
- Links na comunidade e na consulta de moeda. Nenhuma migração ou alteração
  na integração Streamer.bot.

## Validação

894 testes gerais, 6 testes PostgreSQL locais, tipagem, lint e build passaram.
UI desktop/mobile validada com duas comunidades, acesso anônimo, vazio, nome
longo, saldo elevado, renomeação e links. Contrato e limites em
[docs/creator-ranking.md](../docs/creator-ranking.md).

O merge continua com a usuária. A #203 permanece aberta para presença,
inscrições, preços e integração das demais verticais.
