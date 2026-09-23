# Plan 024: Ganhos por mensagem por comunidade

Issue: [#207](https://github.com/ludmila-omlopes/ludylops-live/issues/207).
Parte de [#203](https://github.com/ludmila-omlopes/ludylops-live/issues/203).

Estado: IMPLEMENTED, aguardando merge. Base: `6477cff`, com o núcleo da economia
do PR #206 e a migração 0026 já aplicada em produção.

## Entrega

- Regra do dono com ativação, quantidade e intervalo por espectador, persistida
  no módulo points. Desligada por padrão e sem alterar a moeda ou outros campos.
- Formulário em `/criar-area` e `/c/<slug>/moeda`, com proteção de sessão,
  propriedade, origem, creator e disponibilidade do módulo.
- Endpoint assinado por credencial e ação C# dedicada ao trigger de mensagem
  do YouTube. O servidor determina o valor e o creator.
- Crédito atômico, intervalo serializado por identidade e recibos de eventos
  ignorados. Reenvios e vínculos de canais preservam o resultado original.
- Nenhuma migração estrutural ou alteração de configuração de produção.

## Verificação e operação

Testes gerais, PostgreSQL descartável, types, lint, build, UI desktop/mobile e
contrato HTTP da ação C# passaram. Configuração e limites estão em
[docs/creator-chat-rewards.md](../docs/creator-chat-rewards.md).

O merge continua com a usuária. A ação precisa ser instalada no Streamer.bot de
cada streamer interessado, após o deploy e a liberação da economia. Presença,
inscrições, preços e demais verticais permanecem na #203.
