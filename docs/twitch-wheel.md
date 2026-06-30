# Roleta estilo Twitch

## Rotas

- Admin: `/admin`, aba `Operação`, painel `Roleta da live`.
- Overlay para OBS: `/obs/wheel`.
- Demo visual do overlay: `/obs/wheel?demo=1`.
- O estilo ativo é escolhido no admin. Demo manual do visual minimalista: `/obs/wheel?demo=1&style=obscur`.
- Feed JSON do overlay: `GET /api/obs/wheel/current`.
- Giro assinado pelo Streamer.bot: `POST /api/internal/streamerbot/wheel`.

## Configuração no app

No painel admin, cadastre as opções da roleta. Cada opção tem:

- nome exibido no overlay;
- peso do sorteio, em que valores maiores aumentam a chance;
- cor do segmento;
- estado ativo ou pausado.

O app salva a configuração em `streamerbot_counters`, na chave `twitch_wheel_config`, então não é necessário alterar código para trocar prêmios.

## OBS

Adicione um `Browser Source` apontando para `/obs/wheel`.
Para ocupar menos tela, escolha o estilo minimalista no admin sem trocar a URL no OBS.

Sugestão de cena:

- largura: `1920`;
- altura: `1080`;
- CSS customizado: deixe vazio, a página já remove a moldura normal do app para rotas `/obs/*`.

O resultado é decidido no servidor antes da animação. O overlay apenas anima até a opção escolhida e mantém o resultado visível pelo tempo configurado.

## Streamer.bot

Crie uma action ou comando no Streamer.bot que faça `POST` para:

```text
{lojaneon.appBaseUrl}/api/internal/streamerbot/wheel
```

Use o mesmo padrão HMAC das outras integrações do projeto:

- header `x-timestamp` com Unix time em milissegundos;
- header `x-signature` com HMAC SHA-256 de `<timestamp>.<body_json>`;
- segredo global `lojaneon.streamerbotSharedSecret`, equivalente a `STREAMERBOT_SHARED_SECRET` no app.

Corpo mínimo:

```json
{
  "requestedBy": "chat",
  "source": "streamerbot_chat"
}
```

Se o comando for acionado por viewer, envie `requestedBy` com o nome do viewer ou do moderador. O endpoint responde com `replyMessage`, `result` e a configuração atual da roleta.

Consulte a documentação oficial atual do Streamer.bot antes de recriar a action:

- Execute C# Code: https://docs.streamer.bot/api/sub-actions/core/csharp/execute-csharp-code/
- Arguments & Variables: https://docs.streamer.bot/api/csharp/guide/variables
- SendYouTubeMessageToLatestMonitored: https://docs.streamer.bot/api/csharp/methods/youtube/chat/send-youtube-message-to-latest-monitored
