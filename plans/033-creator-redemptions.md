# 033 — Catálogo e resgates por streamer

## Status

Implementação da [#222](https://github.com/ludmila-omlopes/ludylops-live/issues/222), parte da #203, no PR #223. Migrações aplicadas em 24/09/2026; pendente de merge pela usuária.

## Entrega

- Catálogo público, compra e histórico pessoal em `/c/<slug>/resgates`; gestão e histórico da comunidade para o dono.
- Armazenamento aditivo em `creator_catalog_items`/`creator_redemptions`, separado do catálogo e da bridge da Ludylops.
- Compra com saldo, estoque e intervalos verificados na transação; preço/ação preservados na compra.
- Fila e callbacks vinculados à credencial do streamer; claim único, confirmação repetível e estorno único da moeda original.
- Histórico reutiliza a apresentação da #6, com nome de moeda próprio; transferências de identidade preservam compras e estornos.
- Bridge compatível com a configuração antiga, com modo de credenciais por streamer e utilitário de recuperação sem reexecução.

## Verificação

- 1.007 testes gerais passaram; 57 testes opcionais de PostgreSQL não executam sem banco dedicado.
- 23 testes de economia/resgates passaram em PostgreSQL local real, incluindo aplicação dos SQLs, concorrência, rollback, isolamento e transferência de identidade.
- Tipos, lint e build passaram.
- Navegador em desktop e celular: criação/edição, catálogo anônimo, compra, saldo, histórico pessoal/do dono e isolamento entre comunidades; sem erros JavaScript ou overflow horizontal.

## Rollout

0027 e 0028 aplicadas no banco configurado em 24/09/2026, após autorização, backup completo e ensaio em cópia restaurada. Estrutura validada e dados existentes preservados. Ativação da economia e configuração do Streamer.bot continuam separadas. [Registro da aplicação e configuração](../docs/creator-redemptions.md).

Presença, inscrições e demais regras automáticas da #203 permanecem fora desta entrega.
