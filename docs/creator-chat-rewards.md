# Ganhos por mensagem de cada comunidade

Entrega [#207](https://github.com/ludmila-omlopes/ludylops-live/issues/207), parte da
[#203](https://github.com/ludmila-omlopes/ludylops-live/issues/203).

O dono define a quantidade da própria moeda por mensagem no chat do YouTube e
o intervalo mínimo entre ganhos do mesmo espectador. Por exemplo, 7 cristais
a cada 60 segundos em uma comunidade e 11 estrelas em outra. A primeira mensagem
elegível gera o crédito; mensagens durante o intervalo não geram crédito e não
prolongam a espera. Canais vinculados à mesma identidade compartilham o intervalo.

## Configuração e implantação

- A regra começa **desligada**. A sugestão inicial é 5 unidades e 60 segundos.
  Limites: 1–10.000 unidades e 10–86.400 segundos, sempre inteiros.
- O dono encontra **Configurar ganhos no chat** junto da edição da moeda em
  `/criar-area` e também em `/c/<slug>/moeda` quando a economia está disponível.
- Os ajustes são persistidos em `creator_modules.config_json.chatRewards` do
  módulo `points`. A atualização preserva o nome da moeda e outros campos,
  inclusive sob alterações simultâneas. Pausar não altera saldos acumulados.
- **Não há migração estrutural nova.** A entrega usa as três tabelas da migração
  0026, já aplicada. Não executar push, seeds ou migrações antigas para esta etapa.
- A liberação econômica continua exigindo `CREATOR_ECONOMY_ENABLED=true` depois
  do deploy da revisão com suporte a identidades/moedas, conforme
  [o procedimento da economia](creator-economy.md#aplicação-e-ativação).
  Salvar uma regra ligada não modifica essa variável nem instala uma ação.
- Nenhuma configuração, credencial ou ação da Ludylops precisa ser substituída.
  Este endpoint recusa a comunidade legada; seus pipetz continuam no fluxo atual.

## Ação do Streamer.bot para cada streamer

Documentação oficial consultada em 2026-09-23:
[YouTube > Chat > Message](https://docs.streamer.bot/api/triggers/youtube/chat/message),
[variáveis de usuário](https://github.com/Streamerbot/docs/blob/main/streamerbot/3.api/.variables/youtube/YouTubeUser.md)
e [variáveis da transmissão](https://github.com/Streamerbot/docs/blob/main/streamerbot/3.api/.variables/youtube/YouTubeBroadcast.md).

1. Configurar as variáveis persistidas `lojaneon.appBaseUrl`,
   `lojaneon.streamerbotCredentialId` e `lojaneon.streamerbotCredentialSecret`
   com a credencial exclusiva deste streamer, seguindo o fluxo já existente.
2. Criar uma ação dedicada, adicionar o trigger **YouTube > Chat > Message**
   e uma subação **Execute C# Code** com
   [community-chat-reward.cs](../streamerbot/community-chat-reward.cs).
3. O trigger fornece `userId`, `broadcast.id` e `messageId`. Não gerar uma chave
   aleatória, nem substituir esses argumentos por IDs de outro usuário/live.
   A ação não envia o conteúdo da mensagem, não aceita quantidade como argumento
   e não responde publicamente no chat. Triggers marcados `isTest` são ignorados.
4. Configurar e ativar a regra do streamer. Confirmar que `points`, `streamerbot`
   e a comunidade estão ativos e que a economia foi liberada após o deploy.
5. Enviar uma mensagem real. Conferir o ganho no saldo/histórico do espectador.
   Enviar outra durante o intervalo e confirmar que não há ganho adicional.
   Depois do intervalo, uma nova mensagem deve gerar outro crédito.

A subação retorna `chatRewardHttpStatus` e `chatRewardResponse`. HTTP 200 não
significa necessariamente crédito: `data.outcome` informa `credited`, `cooldown`
ou `paused`; `data.duplicate` indica que o mesmo evento já foi processado.
Em falha de transporte, não há retry automático. Qualquer reenvio deve preservar
os três IDs originais; o script renova apenas o timestamp e a assinatura HTTP.

O intervalo é medido pelo horário de processamento no servidor, depois dos locks,
e vale entre transmissões da mesma comunidade. A integração autentica o emissor;
ela não consulta o YouTube para provar que uma mensagem existe ou verificar o
estado da transmissão. Conectar a ação somente ao trigger indicado, sem replay
de histórico ou comandos públicos que permitam escolher os IDs.

## Contrato e proteção contra duplicação

`POST /api/internal/streamerbot/chat-rewards` usa a assinatura v2 existente.
O creator vem da credencial verificada. O corpo aceita apenas `viewerExternalId`,
`broadcastId`, `messageId` e, opcionalmente, `youtubeDisplayName`. Quantidade,
motivo, creator e IDs internos enviados no corpo são recusados.

- A chave é `chat:` + SHA-256 dos IDs da transmissão/mensagem. Ajustes manuais
  recusam esse prefixo. A mesma chave em outra comunidade é independente.
- A transação verifica creator e módulos ativos, lê a regra sob lock e resolve
  a identidade vinculada. Locks por evento e por comunidade/espectador protegem
  retries e mensagens diferentes simultâneas. Saldo e registro são atômicos.
- Reenvios conservam o resultado original mesmo após mudança do valor, pausa,
  fim do intervalo ou fusão de identidades. Outro espectador usando o mesmo
  evento recebe conflito. Falha por limite de saldo desfaz toda a transação.
- `creator_ledger.kind` distingue `chat_reward`, `chat_paused` e `chat_cooldown`.
  Eventos sem ganho têm valor zero, não criam saldo e não aparecem nas últimas
  movimentações do espectador. Esses registros garantem que uma mensagem
  inicialmente ignorada não seja creditada em um reenvio posterior.
- Há um registro por mensagem recebida, inclusive quando pausada/dentro do
  intervalo. Isso aumenta o volume do ledger; não apagar esses registros sem
  outro mecanismo durável de deduplicação. Nenhuma limpeza automática foi criada.

Presença, inscrições, preços, ranking e demais verticais continuam fora desta
entrega. As taxas legadas da Ludylops não são copiadas.

## Validação

- 865 testes gerais passaram; 19 casos de PostgreSQL são opt-in nessa execução.
- 15 testes de economia passaram separadamente em PostgreSQL local descartável,
  incluindo seis cenários novos de concorrência, reenvio, expiração, mudança de
  regra, isolamento, fusão de identidade, overflow e autorização.
- TypeScript, ESLint e build de produção passaram sem credenciais de produção.
- UI em desktop e celular: configuração inicial desligada, salvar/recarregar,
  intervalo inválido, pausa, isolamento entre donos e controles ocultos para
  espectadores. Sem overflow horizontal ou erros de JavaScript.
- C# compilado com stub do CPH; duas requisições HTTP verificaram assinatura,
  escape JSON, IDs preservados no retry e argumentos de resposta. IDs ausentes
  e trigger de teste não enviaram requisição. Não executado no Streamer.bot real.
