# Recompensas da live pelo Streamer.bot

Esta integração usa `POST /api/internal/streamerbot/events` com HMAC, como os demais eventos do Streamer.bot.

## Inscrição no canal

- Trigger no Streamer.bot: `YouTube > General > New Subscriber`.
- Observação da documentação oficial: esse trigger depende da integração do StreamElements configurada no Streamer.bot.
- Payload esperado pelo app:
  - `eventType`: `channel_subscription`
  - `viewerExternalId`: ID do canal do YouTube da pessoa inscrita
  - `youtubeDisplayName`: nome visível, quando disponível
  - `youtubeHandle`: handle, quando disponível
  - `occurredAt`: data em ISO
  - `payload.broadcastId`: opcional
- Regra de pagamento: 2000 pipetz uma única vez por viewer. Se o Streamer.bot reenviar o evento, o `eventId` evita duplicidade; se outro evento chegar para o mesmo viewer, o app ignora porque já existe ledger `channel_subscription`.

## Metas de likes

- Trigger no Streamer.bot: `YouTube > Broadcast > Statistics Updated`.
- A variável `likeCount` é usada para comparar com as metas cadastradas no admin.
- Payload esperado pelo app:
  - `eventType`: `like_count_update`
  - `balance` ou `payload.likeCount`: número atual de likes
  - `payload.broadcastId`: ID da live, usado para garantir que cada meta pague só uma vez por live
  - `payload.isLive`: `true` quando o evento veio da live monitorada
  - `occurredAt`: data em ISO
- Critério de presença: viewers com ledger `presence_tick` na mesma `broadcastId` do evento de likes, desde o início da live até o momento em que a meta bateu.
- Overlay do OBS: use `/obs/likes` como browser source. Para testar o visual sem live, use `/obs/likes?demo=1`.
- Feed do overlay: `/api/obs/live-like-goals/current`, atualizado pelo último `like_count_update` recebido.

### Overlay da meta de likes

- Abra `/obs/likes` como Browser Source no OBS ou em ferramenta equivalente.
- Use `/obs/likes?demo=1` para testar o visual sem depender de eventos reais.
- O overlay lê a meta ativa cadastrada no admin e o último `like_count_update` aceito pela API.
- Para atualizar o progresso ao vivo, mantenha o script `streamerbot/like-count-update.cs` em uma action ligada ao trigger `YouTube > Broadcast > Statistics Updated`.

Fontes da configuração Streamer.bot:

- https://docs.streamer.bot/api/triggers/youtube/general/new-subscriber
- https://docs.streamer.bot/api/triggers/youtube/broadcast/statistics-updated
- https://docs.streamer.bot/api/triggers/youtube/general/present-viewers
