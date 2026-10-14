# Quotes e novas inscrições no chat

O alerta de nova inscrição dura **7 segundos** quando a URL não informa duração. `duration` e `durationMs` continuam aceitando valores entre 3.000 e 20.000 milissegundos.

A ação `overlay-chat-announcements.cs` acompanha os mesmos feeds de quotes e inscrições usados pelo OBS. Assim, uma quote solicitada pelo site ou pelo comando entra no chat quando fica ativa, inclusive depois de aguardar na fila. Uma quote cancelada ou ainda na fila não é anunciada. Os leitores públicos e suas restrições de comunidade não foram ampliados: os dois feeds ainda têm as limitações de implantação da Ludylops.

Exemplos:

- `Quote #7: “isso aqui vai dar muito certo, confia” — Lud`
- `Ana acabou de se inscrever! Boas-vindas ao canal!`

Quotes longas são divididas em mensagens de até 200 caracteres UTF-16, sem cortar um par de surrogate. O conteúdo completo é preservado; quebras de linha viram espaços. A ação não altera pontos, recompensas, inscritos, duração da quote ou a fila de stickers.

## Configuração no Streamer.bot

1. Crie **uma única** ação `Quotes e inscrições no chat`, com uma subação **Execute C# Code** contendo `streamerbot/overlay-chat-announcements.cs`. Use **Find Refs**, **Compile** e salve.
2. Configure as variáveis persistidas:
   - `lojaneon.appBaseUrl`: o domínio HTTPS usado nas fontes do OBS, sem caminho, query ou fragmento.
   - `lojaneon.overlayChatYoutubeChannelId`: o ID `UC…` do seu canal do YouTube.
   - `lojaneon.overlayChatCreatorSlug`: o mesmo `creator` usado nas fontes. Para Ludylops, `ludylops`. Em um domínio próprio que resolve a comunidade, pode ficar vazio.
3. Em **Services → Timers**, crie um timer habilitado, com **Repeat**, **Interval = 2 segundos** e **Lines = 0**. Na ação, adicione o trigger **Core → Timed Actions** e selecione esse timer.
4. Use uma fila dedicada com **Blocking desmarcado** para não acumular ticks em falhas de rede nem atrasar outros comandos. O mutex descarta execuções sobrepostas. Não duplique a ação nem configure outro envio do mesmo texto nas ações de inscrição e `!quoteobs`. A resposta de confirmação de `!quoteobs` continua existindo.
5. Conecte o bot/conta do YouTube, monitore a live do canal configurado e mantenha o status da live ativo no app. Nenhuma mensagem é enviada para transmissões agendadas, encerradas, de outro canal ou quando há mais de uma live elegível.

A conta do bot é preferida, com fallback para a conta do broadcaster **na mesma transmissão**. A seleção nunca usa “latest monitored” como alternativa. O script faz somente leituras públicas; nenhuma credencial é enviada para os feeds. As variáveis de domínio, comunidade e canal precisam representar o mesmo streamer.

## Entrega e limitações

O registro `lojaneon.overlayChatSeen.*` guarda hashes dos IDs já processados, persistidos antes de chamar o envio. Isso evita repetir mensagens nas próximas consultas ou ao reiniciar o Streamer.bot. Um mutex impede execuções simultâneas da mesma configuração. O registro não deve ser apagado para “tentar de novo”.

O método de envio do Streamer.bot não devolve confirmação de entrega do YouTube. Em falha ambígua ou encerramento entre registrar e enviar, o aviso pode se perder: não há reenvio automático que possa duplicá-lo. Instalações independentes com bancos de globals diferentes não compartilham esse registro; mantenha apenas uma responsável pelos avisos.

As quotes precisam ser observadas durante seu período ativo e as inscrições são recuperadas dos últimos dois minutos, com o limite do feed existente (20 eventos). A ação não é um histórico de mensagens offline. A mensagem no chat pode chegar alguns segundos antes/depois da imagem por causa das consultas e da fila do OBS. O teste `isTest=true` não envia mensagens.

## Validação sem postar no YouTube

Execute `pwsh -NoProfile -File scripts/test-overlay-chat.ps1` com PowerShell 7. O teste compila o C# e usa HTTP, broadcasts, globals e envio simulados. Cobre texto completo, Unicode, deduplicação persistente, reinício, expiração, transmissão errada/ambígua/encerrada, falha de armazenamento e erro ambíguo no envio. Não dispara mensagens reais.

Referências oficiais: [Timers](https://docs.streamer.bot/guide/core/timers), [Timed Actions](https://docs.streamer.bot/api/triggers/core/schedule/timed-actions), [SendYouTubeMessage](https://docs.streamer.bot/api/csharp/methods/youtube/chat/send-youtube-message).
