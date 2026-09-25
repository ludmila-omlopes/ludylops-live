# Mensagens periódicas por streamer

Entrega da [#165](https://github.com/ludmila-omlopes/ludylops-live/issues/165).

## Configurar os lembretes

- Ludylops: **Admin → Live e OBS → Streamer.bot → Mensagens periódicas**.
- Outros streamers: **Criar área → sua comunidade → Gerenciar mensagens periódicas**.
- Cadastre até 20 mensagens, com até 200 caracteres e intervalo de 60 a 86.400
  segundos. Elas começam desmarcadas para ativação; marque **Ativar mensagem**
  quando quiser começar. Editar ou ativar reinicia o intervalo.
- É possível editar, pausar, reativar e remover. **Atualizar mensagens** busca o
  último contato do Streamer.bot, a última tentativa, o último envio informado e
  o erro recente. Uma edição concorrente exige atualizar antes de salvar.

## Configurar o Streamer.bot

Esta entrega acrescenta uma ação opcional. As ações de saldo, ganhos no chat,
resgates e overlays existentes não precisam ser substituídas.

1. Confirme que o streamer e seu módulo Streamer.bot estão ativos e que existe
   uma credencial válida para essa comunidade. Para Ludylops, use a credencial
   da própria Ludylops. Cada instância/configuração local atende o seu streamer.
2. Nas variáveis globais persistentes, configure `lojaneon.appBaseUrl` com a origem
   HTTPS, sem caminho; `lojaneon.streamerbotCredentialId` e
   `lojaneon.streamerbotCredentialSecret` com a credencial dessa comunidade. Se já
   usa essas variáveis na integração, preserve os valores existentes.
3. Acrescente `lojaneon.periodicYoutubeChannelId` com o ID `UC...` do canal que
   receberá os lembretes. Conecte o YouTube e monitore a transmissão desse canal.
4. Crie uma ação com o código de
   [`streamerbot/periodic-chat-messages.cs`](../streamerbot/periodic-chat-messages.cs)
   em **Execute C# Code**. O código também fica disponível entre os scripts do
   Streamer.bot no admin. Use uma fila bloqueante para não sobrepor a ação.
5. Em **Services → Timers**, crie um timer habilitado, repetido, com intervalo
   de **15 segundos** e **Lines = 0**. Vincule-o à ação pelo trigger
   **Core → Timed Actions**. Em versões com a organização anterior, o trigger
   também oferece **Create Timer**. Os intervalos individuais são controlados
   pela configuração das mensagens, não pelo timer de consulta.
6. Ative um lembrete e confira durante uma transmissão controlada. O primeiro
   envio aguarda o intervalo configurado. Atualize as mensagens para acompanhar
   o resultado. O teste automático da ação (`isTest`) não envia mensagens.

O script consulta os broadcasts monitorados e exige exatamente um com o canal
configurado, status `live` e chat disponível. Envia para aquele `broadcastId`
explicitamente, sem recorrer ao último canal monitorado. Reconfere o estado da
live antes de chamar o envio. Usa a conta bot com fallback para a conta principal
do mesmo broadcast, conforme o comportamento documentado do Streamer.bot.

Referências oficiais verificadas em 2026-09-24:
[Timers](https://docs.streamer.bot/guide/core/timers),
[Timed Actions](https://docs.streamer.bot/api/triggers/core/schedule/timed-actions),
[YouTubeGetMonitoredBroadcasts](https://docs.streamer.bot/api/csharp/methods/youtube/broadcast/youtube-get-monitored-broadcasts),
[YouTubeBroadcastInfo](https://docs.streamer.bot/api/csharp/classes/youtube-broadcast-info),
[SendYouTubeMessage](https://docs.streamer.bot/api/csharp/methods/youtube/chat/send-youtube-message).

## Garantias e limites

- Configuração e estado de envio usam `creator_modules.config_json`, na chave
  `periodicMessages` do módulo `streamerbot`, com locks na comunidade e no módulo.
  Preservam os demais campos de configuração. Não há nova tabela ou migração.
- O dono só gerencia sua comunidade; o admin legado só gerencia Ludylops. A
  credencial determina o creator da integração. Campos de creator no corpo são
  recusados. A operação nova não libera módulos de economia/resgates globais.
- Cada reserva consome o intervalo antes do envio externo. Consultas concorrentes
  não reservam a mesma mensagem. Há pelo menos 15 segundos entre reservas da
  mesma comunidade, mesmo com várias mensagens vencidas. Não se recupera uma
  fila de todos os intervalos perdidos durante uma transmissão offline.
- Antes de enviar, o script pede confirmação de uma reserva com validade de
  30 segundos. Pausar, editar ou remover invalida uma reserva anterior. Desativar
  creator, módulo ou credencial bloqueia novas confirmações. Uma chamada externa
  já iniciada não pode ser desfeita ao pausar.
- O script não repete o envio se perder uma resposta. Só repete a confirmação do
  resultado, que é idempotente. Uma reserva pode ficar sem confirmação e aquele
  intervalo ser perdido; o próximo intervalo segue normalmente. Não há promessa
  de entrega exatamente uma vez no YouTube.
- **Último envio informado** significa que o Streamer.bot chamou seu método de
  envio sem lançar exceção. Esse método retorna `void`, sem recibo do YouTube.
  Confira também o chat e os logs locais. O último contato fica sem atualizar
  enquanto não houver uma live elegível, pois o script evita consultas offline.
- Configurações privadas e tokens não são enviados aos visitantes. O dono recebe
  somente suas mensagens e o resumo operacional, sem o token de reserva.

## Verificação

990 testes gerais passaram; 45 testes PostgreSQL opcionais foram ignorados nessa
suíte. Os 4 testes PostgreSQL desta entrega passaram separadamente. Tipagem,
lint e build passaram. A UI foi verificada em Edge, desktop e 390 px, cobrindo
CRUD, conflito de edição, validações, separação entre streamers/admin legado e
ausência de vazamento para visitantes, sem erro JavaScript ou rolagem horizontal.

Os testes de domínio cobrem intervalo, offline, limite, validações, pausa/edição,
expiração e confirmação repetida. Os handlers testam sessão, origem, credencial
e operação autorizada. Os testes PostgreSQL usam schema descartável para verificar
isolamento de duas comunidades, edição concorrente, reserva única, confirmação
repetida e bloqueio após desativação.

O script C# foi compilado e executado com HTTP e Streamer.bot simulados: assinatura,
canal errado, ausência ou ambiguidade de live, confirmação negada, erro de envio
e repetição do acknowledgement sem repetir o envio. Isso não substitui o teste
da ação na versão de Streamer.bot instalada pelo streamer. Não foi enviado nada
ao YouTube real nem alterada qualquer configuração de produção.
