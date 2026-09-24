# 033 — Catálogo e resgates por streamer

## Status

Implementação da [#222](https://github.com/ludmila-omlopes/ludylops-live/issues/222), parte da #203. Pendente de migração e merge pela usuária.

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

0027 ainda ausente no banco configurado na consulta somente de leitura de 24/09/2026. Aplicar 0027 e 0028 antes do deploy. Migrações reais, ativação da economia e configuração do Streamer.bot não foram executadas. [Procedimento e configuração](../docs/creator-redemptions.md).

Presença, inscrições e demais regras automáticas da #203 permanecem fora desta entrega.
