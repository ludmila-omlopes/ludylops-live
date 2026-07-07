export type StreamerbotScriptCategory =
  | "live"
  | "pipetz"
  | "apostas"
  | "quotes"
  | "contadores"
  | "chat";

export type StreamerbotScriptDefinition = {
  id: string;
  filename: string;
  title: string;
  description: string;
  category: StreamerbotScriptCategory;
  trigger: string;
  setupInstructions: string;
  sortOrder: number;
};

export type StreamerbotScriptRecord = StreamerbotScriptDefinition & {
  source: string;
};

export const streamerbotScriptCategories: Record<
  StreamerbotScriptCategory,
  { label: string; description: string }
> = {
  live: {
    label: "Live e recompensas",
    description: "Eventos automáticos da transmissão, metas de likes e presença na live.",
  },
  pipetz: {
    label: "Pipetz e vínculo",
    description: "Comandos de saldo e vinculação da conta YouTube com o app.",
  },
  apostas: {
    label: "Apostas",
    description: "Entrada de apostas pelo chat durante a live.",
  },
  quotes: {
    label: "Quotes",
    description: "Cadastro, consulta e exibição de quotes pagas em pipetz.",
  },
  contadores: {
    label: "Contadores",
    description: "Contagem de mortes e integração com o jogo ativo da live.",
  },
  chat: {
    label: "Chat e comandos",
    description: "Respostas locais no chat sem chamada HTTP ao app.",
  },
};

export const streamerbotGlobalVariables = [
  {
    name: "lojaneon.appBaseUrl",
    description: "URL pública do app, sem barra no final. Exemplo: https://live.ludylops.com.br",
    required: true,
  },
  {
    name: "lojaneon.streamerbotSharedSecret",
    description: "Segredo compartilhado usado para assinar requisições HMAC enviadas ao app.",
    required: true,
  },
  {
    name: "lojaneon.useBotAccount",
    description: "Quando true, respostas de chat saem pela conta do bot. Padrão varia por script.",
    required: false,
  },
  {
    name: "lojaneon.activeBetId",
    description: "ID da aposta aberta usada pelo comando !bet quando o chat não informa outra.",
    required: false,
  },
  {
    name: "lojaneon.quoteOverlayDurationSeconds",
    description: "Tempo em segundos que a quote fica visível no overlay OBS.",
    required: false,
  },
  {
    name: "lojaneon.counterGameKey",
    description: "Chave do jogo ativo para o contador de mortes quando não vem do argumento da action.",
    required: false,
  },
  {
    name: "lojaneon.counterGameLabel",
    description: "Nome exibido do jogo ativo no contador de mortes.",
    required: false,
  },
];

export const streamerbotScriptDefinitions: StreamerbotScriptDefinition[] = [
  {
    id: "channel-subscription-reward",
    filename: "channel-subscription-reward.cs",
    title: "Recompensa de nova inscrição",
    description:
      "Envia evento channel_subscription para o app e habilita o overlay de novos inscritos.",
    category: "live",
    trigger: "YouTube > General > New Subscriber",
    setupInstructions:
      "Crie uma Sub-Action com Execute C# Code apontando para este arquivo. Confirme que a integração do StreamElements está ativa no Streamer.bot, pois o trigger de New Subscriber depende dela. Abra /obs/subscribers como Browser Source no OBS.",
    sortOrder: 10,
  },
  {
    id: "like-count-update",
    filename: "like-count-update.cs",
    title: "Atualização de likes da live",
    description:
      "Publica like_count_update com o total atual de likes e alimenta a meta cadastrada no admin.",
    category: "live",
    trigger: "YouTube > Broadcast > Statistics Updated",
    setupInstructions:
      "Use este script na action ligada ao trigger Statistics Updated. Garanta que a variável likeCount esteja disponível. Abra /obs/likes como Browser Source para exibir o progresso da meta.",
    sortOrder: 20,
  },
  {
    id: "presence-tick-from-present-viewers",
    filename: "presence-tick-from-present-viewers.cs",
    title: "Presença na live",
    description:
      "Marca viewers presentes na transmissão para elegibilidade de recompensas como metas de likes.",
    category: "live",
    trigger: "YouTube > General > Present Viewers",
    setupInstructions:
      "Configure uma action periódica no trigger Present Viewers. O script percorre a lista users e envia presence_tick para cada viewer elegível.",
    sortOrder: 30,
  },
  {
    id: "link-account-from-chat",
    filename: "link-account-from-chat.cs",
    title: "Vincular conta pelo chat",
    description: "Processa !link CODIGO e associa o canal YouTube ao viewer no app.",
    category: "pipetz",
    trigger: "Comando de chat !link",
    setupInstructions:
      "Crie um comando !link com argumento de código. Use este script na Sub-Action Execute C# Code. O viewer precisa gerar o código em /conta no site antes de usar o comando.",
    sortOrder: 40,
  },
  {
    id: "get-points-from-chat",
    filename: "get-points-from-chat.cs",
    title: "Consultar saldo de pipetz",
    description: "Responde !pontos, !saldo, !pipetz ou !points com o saldo atual do viewer.",
    category: "pipetz",
    trigger: "Comandos de chat !pontos / !saldo / !pipetz / !points",
    setupInstructions:
      "Registre os aliases desejados apontando para a mesma action com este script. A conta precisa estar vinculada para retornar saldo.",
    sortOrder: 50,
  },
  {
    id: "place-bet-from-chat",
    filename: "place-bet-from-chat.cs",
    title: "Apostar pelo chat",
    description: "Processa !bet <opção> <valor> e registra a aposta aberta no app.",
    category: "apostas",
    trigger: "Comando de chat !bet",
    setupInstructions:
      "Configure !bet com dois argumentos: opção ou resposta, e valor. Opcionalmente defina lojaneon.activeBetId para fixar a aposta aberta. Abra /obs/bets como Browser Source para mostrar o placar ao vivo.",
    sortOrder: 60,
  },
  {
    id: "add-quote-from-chat",
    filename: "add-quote-from-chat.cs",
    title: "Adicionar quote",
    description: "Cadastra uma nova quote paga em pipetz a partir do chat.",
    category: "quotes",
    trigger: "Comando de chat !addquote ou fluxo equivalente",
    setupInstructions:
      "Use em uma action de moderador ou comando configurado no Streamer.bot. O script envia o texto informado para POST /api/internal/streamerbot/quotes.",
    sortOrder: 70,
  },
  {
    id: "get-quote-from-chat",
    filename: "get-quote-from-chat.cs",
    title: "Consultar quote",
    description: "Responde !quote [número] com o texto da quote solicitada.",
    category: "quotes",
    trigger: "Comando de chat !quote",
    setupInstructions:
      "Registre !quote com argumento opcional de número. Sem número, o script pode retornar uma quote aleatória conforme a lógica do arquivo.",
    sortOrder: 80,
  },
  {
    id: "show-quote-on-obs",
    filename: "show-quote-on-obs.cs",
    title: "Exibir quote no OBS",
    description: "Dispara a quote escolhida no overlay /obs/quotes com duração configurável.",
    category: "quotes",
    trigger: "Comando de chat !quoteobs",
    setupInstructions:
      "Configure !quoteobs <número> para moderadores. Defina lojaneon.quoteOverlayDurationSeconds se quiser alterar o tempo na tela. Abra /obs/quotes como Browser Source.",
    sortOrder: 90,
  },
  {
    id: "death-counter-from-chat",
    filename: "death-counter-from-chat.cs",
    title: "Contador de mortes",
    description: "Incrementa ou consulta mortes do jogo ativo da live via !deaths.",
    category: "contadores",
    trigger: "Comando de chat !deaths",
    setupInstructions:
      "Configure !deaths na action desejada. O jogo ativo pode vir do admin ou das globals lojaneon.counterGameKey e lojaneon.counterGameLabel.",
    sortOrder: 100,
  },
  {
    id: "list-commands-from-chat",
    filename: "list-commands-from-chat.cs",
    title: "Listar comandos disponíveis",
    description:
      "Responde no chat com a lista pública de comandos e uma versão estendida para moderadores.",
    category: "chat",
    trigger: "Comando de chat !comandos ou !help",
    setupInstructions:
      "Este script não chama o app. Personalize as linhas com lojaneon.commandsListPublic1, lojaneon.commandsListPublic2 e lojaneon.commandsListMod se quiser textos diferentes.",
    sortOrder: 110,
  },
];

export function groupStreamerbotScripts(scripts: StreamerbotScriptRecord[]) {
  const grouped = new Map<StreamerbotScriptCategory, StreamerbotScriptRecord[]>();

  for (const script of scripts) {
    const current = grouped.get(script.category) ?? [];
    current.push(script);
    grouped.set(script.category, current);
  }

  return (Object.keys(streamerbotScriptCategories) as StreamerbotScriptCategory[])
    .map((category) => ({
      category,
      ...streamerbotScriptCategories[category],
      scripts: grouped.get(category) ?? [],
    }))
    .filter((entry) => entry.scripts.length > 0);
}
