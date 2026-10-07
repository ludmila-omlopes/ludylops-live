# Super Stickers do YouTube no OBS

A fonte `/obs/stickers` mostra o asset original informado por `stickerImageUrl`, o nome de quem enviou e o valor. Imagens animadas continuam animadas quando o arquivo fornecido pelo YouTube e o navegador do OBS suportam o formato. Sem URL válida, ou se o download falhar, aparece a descrição do sticker. Nenhuma imagem substituta é escolhida.

## Streamer.bot

1. Conecte o canal do YouTube no Streamer.bot e monitore a transmissão.
2. Crie uma action **Super Sticker no OBS** com o trigger **YouTube → Chat → Super Sticker**.
3. Adicione **Core → C# → Execute C# Code** e cole `streamerbot/youtube-super-sticker.cs`. Clique **Find Refs** e depois **Compile**; o script usa `System.Net.Http` e `Newtonsoft.Json` (disponíveis na instalação do Streamer.bot). Aguarde `Compiled successfully` antes de salvar.
4. Use as globals persistidas `lojaneon.appBaseUrl`, `lojaneon.streamerbotCredentialId` e `lojaneon.streamerbotCredentialSecret`, já usadas nas outras integrações. Não coloque o segredo na URL do OBS nem em arquivos de exportação.
5. Ative os módulos Streamer.bot e Overlays OBS para a comunidade. A credencial determina o canal que recebe o alerta; o corpo da requisição não aceita outro canal.

O script encaminha `messageId`, `user`, `amount`, `stickerId`, `stickerAltText` e `stickerImageUrl`. `messageId` é obrigatório e deve ser preservado em reenvios. Diferentemente do evento de nova inscrição, este trigger vem diretamente do YouTube e não precisa do StreamElements.

Na instalação antiga da Ludylops, que já utiliza `lojaneon.streamerbotSharedSecret`, é possível definir explicitamente `UseLegacyAuthentication = true` no C# enquanto `STREAMERBOT_LEGACY_AUTH_ENABLED` estiver habilitado no servidor. Esse modo sempre pertence à Ludylops e não deve ser usado por outro canal. O arquivo distribuído vem com `false` e não faz fallback automático após erros ou falta de credencial. Na migração da instalação, volte a `false` e use as credenciais individuais conforme `docs/streamerbot-credentials.md`.

Referência: [trigger Super Sticker e suas variáveis](https://docs.streamer.bot/api/triggers/youtube/chat/super-sticker). A [API oficial do YouTube](https://developers.google.com/youtube/v3/live/docs/liveChatMessages#snippet.superStickerDetails.superStickerMetadata.stickerId) retorna o ID, mas não a URL da imagem; por isso o fluxo recebe a URL disponibilizada pelo Streamer.bot.

## OBS

Adicione uma fonte **Navegador**, 1920 × 1080, com `https://ludylops.live/obs/stickers`. Para outro canal, use o domínio próprio ou acrescente `?creator=slug-do-canal` no domínio da plataforma. Mantenha a fonte carregada enquanto quiser receber alertas.

Parâmetros opcionais:

- `duration=8000`: duração de cada alerta em milissegundos, entre 3000 e 30000; padrão 8000.
- `style=obscur`: apresentação escura com destaque dourado.
- `demo=1`: prévia do enquadramento com texto de exemplo, sem gravar eventos ou usar uma imagem fictícia do YouTube.

Exemplo: `/obs/stickers?duration=12000&style=obscur`.

## Teste sem compra

Use uma action de teste separada, sem trigger público, definindo argumentos antes de executar o mesmo C#: `messageId=teste-sticker-001`, `user=Teste`, `amount=R$ 10,00`, `stickerAltText=Teste de Super Sticker` e `stickerImageUrl` com a URL original de um evento real. Deixe a URL vazia para testar a descrição alternativa. Repetir o mesmo `messageId` não gera outro alerta; use um novo ID para um novo teste. Esse envio pode aparecer no OBS, então execute fora da transmissão ou numa cena de teste.

## Entrega e segurança

O endpoint `POST /api/internal/streamerbot/stickers` usa a autenticação HMAC existente. A gravação é isolada por criador na tabela `streamerbot_event_log`, sem migração e sem alterar pontos, saldos, apostas ou recompensas. IDs são derivados do canal e do ID da mensagem. Gravações simultâneas são serializadas por canal para manter a ordem do cursor.

`GET /api/obs/stickers/current` expõe somente os dados públicos do alerta, nunca credenciais, IDs de espectadores ou o payload bruto. Verifica comunidade ativa e módulos instalados em cada consulta. Consulta a cada 2 segundos, com lotes de 50 e controle de fila. Não depende do status global de live, permitindo stickers em estreias e evitando perder um pagamento por atraso dessa detecção.

Na primeira abertura, busca eventos recebidos nos últimos 2 minutos. Na mesma sessão do navegador, mantém cursor e fila; itens já iniciados não são repetidos ao atualizar a fonte. A recuperação cobre até 1 hora de interrupção. Um novo perfil de navegador/fonte independente pode repetir eventos recentes; não há confirmação global de entrega entre vários OBS. A fila de quotes e seus controles de pausa/reembolso são independentes dos stickers.

As imagens são carregadas diretamente, com `referrerPolicy=no-referrer`, de subdomínios HTTPS de `ggpht.com`, `googleusercontent.com` ou de `/youtube/` em `www.gstatic.com`. Outros endereços viram descrição alternativa. O servidor não baixa imagens nem executa HTML fornecido pelo evento. Se o YouTube mudar de CDN, atualize a lista após verificar a origem.
