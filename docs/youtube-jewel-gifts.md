# Presentes com joias do YouTube no OBS

A fonte `/obs/gifts` mostra a imagem do presente enviado com joias (estrelas, "F no chat" e os outros), o nome de quem enviou e quantas joias foram usadas. Um combo, ou seja, a mesma pessoa mandando o mesmo presente várias vezes seguidas, vira um único alerta com `×2`, `×3`… e o tempo na tela recomeça a cada repetição. O som toca uma vez quando o alerta aparece, não a cada repetição do combo. Sem URL de imagem válida, ou se o download falhar, aparece o nome do presente.

As joias só podem ser enviadas em lives verticais, pelo app do YouTube no celular. A animação que o YouTube mostra no app não entra no vídeo enviado pelo OBS; é esta fonte que coloca o presente na tela.

## Streamer.bot

Requer **Streamer.bot 1.0.5 ou mais recente**, versão que adicionou o trigger de joias.

1. Conecte o canal do YouTube no Streamer.bot e monitore a transmissão.
2. Crie uma action **Presentes com joias no OBS** com o trigger **YouTube → Chat → Jewels Gifted**.
3. Adicione **Core → C# → Execute C# Code** e cole `streamerbot/youtube-jewel-gift.cs`. Clique **Find Refs** e depois **Compile**; o script usa `System.Net.Http` e `Newtonsoft.Json` (disponíveis na instalação do Streamer.bot). Aguarde `Compiled successfully` antes de salvar.
4. Use as globals persistidas `lojaneon.appBaseUrl`, `lojaneon.streamerbotCredentialId` e `lojaneon.streamerbotCredentialSecret`, já usadas nas outras integrações (veja `docs/streamerbot-credentials.md`). Na instalação antiga da Ludylops, que só tem `lojaneon.streamerbotSharedSecret`, defina `UseLegacyAuthentication = true` no C#, como no script de Super Stickers, enquanto `STREAMERBOT_LEGACY_AUTH_ENABLED` estiver habilitado no servidor. O arquivo distribuído vem com `false`.
5. Ative os módulos Streamer.bot e Overlays OBS para a comunidade. A credencial determina o canal que recebe o alerta; o corpo da requisição não aceita outro canal.

O script lê `user`, `userId`, `publishedAt`, `gift.name`, `gift.altText`, `gift.url`, `gift.jewelsAmount` e `gift.comboCount` e envia `eventId`, `displayName`, `giftName`, `giftAltText`, `giftImageUrl`, `jewelsAmount` e `comboCount`.

O trigger não fornece um ID de mensagem. Por isso o `eventId` é montado com `userId`, `publishedAt`, `gift.name` e `gift.comboCount`, e reenviar o mesmo evento não gera outro alerta. Se o YouTube entregar dois presentes iguais, da mesma pessoa, no mesmo instante e fora de combo, eles aparecem como um só.

Referências: [trigger Jewels Gifted](https://docs.streamer.bot/api/triggers/youtube/chat/jewels-gifted) e [changelog 1.0.5](https://docs.streamer.bot/changelogs/v1.0.5).

## OBS

Adicione uma fonte **Navegador**, 1920 × 1080, com `https://ludylops.live/obs/gifts`. Para outro canal, use o domínio próprio ou acrescente `?creator=slug-do-canal` no domínio da plataforma. Mantenha a fonte carregada enquanto quiser receber alertas. Ela é independente da fonte de Super Stickers; as duas podem ficar na mesma cena.

Parâmetros opcionais:

- `duration=6000`: duração de cada alerta em milissegundos, entre 3000 e 30000; padrão 6000.
- `style=obscur`: apresentação escura com destaque dourado.
- `sound=https://…/arquivo.mp3`: troca o som do alerta por um arquivo próprio. Sem o parâmetro, toca o mesmo "plim" do alerta de novos inscritos; `sound=off` deixa o alerta sem som.
- `volume=0.8`: volume do som, de 0 a 1; padrão 0.8.
- `demo=1`: prévia do enquadramento com texto de exemplo, sem gravar eventos.

Exemplo: `/obs/gifts?duration=8000&style=obscur`.

## Teste sem gastar joias

Crie uma action de teste separada, sem trigger, com sub-actions **Set Argument** antes do mesmo C#:

- `eventId=teste-presente-001`
- `user=Teste`
- `gift.name=Thumbs up`
- `gift.url=https://www.gstatic.com/youtube/img/pdg/gift/assets/keep_it_up.png`
- `gift.jewelsAmount=10`
- `gift.comboCount=1`

Repetir o mesmo `eventId` não gera outro alerta; use um novo ID para um novo teste. Para testar o combo, rode de novo com outro `eventId` e `gift.comboCount=2` em até alguns segundos. O alerta pode aparecer no OBS, então teste fora da transmissão ou numa cena de teste.

## Entrega e segurança

O endpoint `POST /api/internal/streamerbot/gifts` usa a autenticação HMAC por credencial. A gravação usa a tabela `streamerbot_event_log` com o tipo `youtube_jewel_gift`, isolada por criador, sem migração e sem alterar pontos, saldos, apostas ou recompensas.

`GET /api/obs/gifts/current` expõe somente nome de quem enviou, presente, imagem, joias e combo, nunca credenciais, IDs de espectadores ou o payload bruto. O feed, o cursor, a fila e a recuperação após recarregar a fonte funcionam como nos Super Stickers (`docs/youtube-super-stickers.md`): consulta a cada 2 segundos, busca os últimos 2 minutos na primeira abertura e recupera até 1 hora de interrupção.

As imagens são carregadas direto do YouTube, com `referrerPolicy=no-referrer`, e só de `www.gstatic.com/youtube/`, `ggpht.com` ou `googleusercontent.com`. Outros endereços viram o nome do presente.
