# Controlador de Live - Ludylops

Painel de operação e participação da live da Ludylops no YouTube. Ele conecta chat, viewers, pipetz, apostas, resgates, sugestões, overlays e Streamer.bot em um fluxo só: o público interage pelo site ou pelo chat, o app registra tudo, e a stream reage ao vivo.

## Funcionalidades

- Ranking público de viewers por saldo de pipetz.
- Ganho de pipetz por presença e bônus vindos do Streamer.bot.
- Consulta de saldo pelo site e por comando de chat.
- Login com Google para área do viewer.
- Vínculo entre conta Google e canal do chat usando `!link CODIGO`.
- Catálogo de resgates que podem acionar ações locais na máquina da stream.
- Fila de resgates com claim, conclusão e falha pela bridge local.
- Apostas abertas pela administração e entradas pelo site ou chat.
- Sugestões de jogos e vídeos com boost usando pipetz.
- Quotes criadas, consultadas e exibidas em overlay no OBS.
- Contadores operados por comando de chat.
- Painel admin para live status, bridge, ranking, fila, catálogo, apostas, sugestões, recomendações, preços e vínculos de viewers.
- Overlay de OBS para quotes em `/obs/quotes`.
- Modo demo em memória quando `DATABASE_URL` não está configurada.

## Como o fluxo funciona

1. O viewer aparece no chat do YouTube.
2. O Streamer.bot envia eventos assinados para a API interna.
3. O app registra presença, pontos, saldo, handle e estado do viewer.
4. O viewer entra com Google no site.
5. Em `/me`, o app gera um código curto de vínculo.
6. O viewer envia `!link CODIGO` no chat.
7. O Streamer.bot chama a rota interna de vínculo com o identificador do canal.
8. O app une conta Google, viewer do chat, saldo, histórico, apostas, sugestões e resgates.
9. Quando um resgate precisa executar algo local, a bridge busca a fila no app hospedado e chama o Streamer.bot no PC da live.

## Áreas de criadores

Criadores logados e aprovados no beta fechado podem reservar uma área em `/owner`.

O fluxo atual cria:

- registro em `creators`, com dono em `owner_user_id`;
- subdomínio padrão em `creator_domains`, no formato `{slug}.ludylops.live`;
- identidade visual básica em `creator_branding`;
- módulos instalados em `creator_modules`;
- rota pública em `/c/{slug}`.

Em modo demo, sem `DATABASE_URL`, as áreas ficam em memória até reiniciar o servidor. Em banco real, os registros são persistidos.

O acesso ao beta é configurado no admin, em `Comunidade > Beta áreas`. Admins gerais continuam liberados para testar mesmo sem aparecer na lista.

Observação: a criação da área já separa creator, domínio, branding e módulos. O isolamento completo de pipetz, apostas, catálogo, sugestões e overlays por criador ainda depende de adicionar `creator_id` nas tabelas operacionais e escopar as consultas do repositório.

## Streamer.bot

As chamadas do Streamer.bot para o app usam HMAC SHA-256. Todas devem enviar:

- `x-timestamp`
- `x-signature`

A assinatura é calculada sobre:

```text
<timestamp>.<body_json>
```

usando `STREAMERBOT_SHARED_SECRET`.

Scripts prontos para colar em `Core > C# > Execute C# Code` ficam em `streamerbot/`:

- `presence-tick-from-present-viewers.cs`
- `link-account-from-chat.cs`
- `get-points-from-chat.cs`
- `place-bet-from-chat.cs`
- `death-counter-from-chat.cs`
- `add-quote-from-chat.cs`
- `get-quote-from-chat.cs`
- `show-quote-on-obs.cs`
- `list-commands-from-chat.cs`

Variáveis globais normalmente usadas no Streamer.bot:

- `lojaneon.appBaseUrl`
- `lojaneon.streamerbotSharedSecret`
- `lojaneon.useBotAccount`
- `lojaneon.activeBetId`
- `lojaneon.counterGameKey`
- `lojaneon.counterGameLabel`
- `lojaneon.quoteOverlayDurationSeconds`

Para comandos e C# actions, confira a documentação oficial do Streamer.bot antes de ajustar a configuração:

- [Execute C# Code](https://docs.streamer.bot/api/sub-actions/core/csharp/execute-csharp-code/)
- [Arguments & Variables](https://docs.streamer.bot/api/csharp/guide/variables)
- [SendYouTubeMessageToLatestMonitored](https://docs.streamer.bot/api/csharp/methods/youtube/chat/send-youtube-message-to-latest-monitored)

## Endpoints internos

### Streamer.bot

- `POST /api/internal/streamerbot/events`: registra presença, bônus e eventos vindos da live.
- `POST /api/internal/streamerbot/link`: vincula um código de `/me` ao canal do viewer no chat.
- `POST /api/internal/streamerbot/points`: responde saldo do viewer para comandos como `!pontos`.
- `POST /api/internal/streamerbot/bets/place`: registra aposta feita pelo chat.
- `POST /api/internal/streamerbot/counters`: opera contadores genéricos.
- `POST /api/internal/streamerbot/deaths`: atalho para contador de mortes do jogo atual.
- `POST /api/internal/streamerbot/quotes`: cria, consulta ou envia quote para o overlay.

### Bridge

- `POST /api/internal/bridge/heartbeat`
- `POST /api/internal/bridge/pull`
- `POST /api/internal/bridge/:redemptionId/claim`
- `POST /api/internal/bridge/:redemptionId/complete`
- `POST /api/internal/bridge/:redemptionId/fail`

### Google

- `POST /api/internal/google/cross-account-protection`: receiver do Google Cross-Account Protection (RISC).

### PS Plus

- `POST /api/internal/ps-plus/sync`: atualiza o índice local do catálogo PS Plus Deluxe (`pt-BR`) e reavalia as tags das indicações de jogos.

Proteja a chamada com `Authorization: Bearer $PS_PLUS_SYNC_SECRET` e configure um agendador externo para chamar esse endpoint uma vez por dia. A criação/correção de indicações também tenta atualizar o índice quando ele está vencido, mas continua funcionando se a PlayStation Store estiver indisponível.

### Steam

- `POST /api/internal/steam/sync`: atualiza os metadados e preços Steam das indicações de jogos visíveis na página.

Proteja a chamada com `Authorization: Bearer $STEAM_SYNC_SECRET` e configure um agendador externo para chamar esse endpoint uma vez por dia. O sync usa `STEAM_STORE_COUNTRY_CODE=BR` e `STEAM_STORE_LANGUAGE=brazilian` por padrão; a criação/correção de indicações também tenta resolver a Steam em modo de melhor esforço.

A API oficial da Steam documenta a consulta de catálogo/lista de apps, mas preço por região/moeda fica encapsulado em `src/lib/steam/store.ts` porque depende dos endpoints públicos da Store usados para busca e detalhes. Se a Store mudar formato ou política, o ajuste fica isolado nessa camada.

## Bridge local

A bridge roda no PC da live e liga o app hospedado ao Streamer.bot local.

Ela faz:

- heartbeat para o admin saber que a máquina da stream está viva;
- pull da fila de resgates;
- claim de resgate antes de executar;
- chamada local para `POST /DoAction` no Streamer.bot;
- marcação de `complete` ou `fail` no app hospedado.

Configure `bridge/.env`:

```env
BRIDGE_API_BASE_URL=https://seu-app.vercel.app
BRIDGE_MACHINE_KEY=stream-pc-01
BRIDGE_SHARED_SECRET=
BRIDGE_STREAMERBOT_BASE_URL=http://127.0.0.1:7474
BRIDGE_POLL_INTERVAL_MS=2000
BRIDGE_HEARTBEAT_INTERVAL_MS=30000
BRIDGE_REQUEST_TIMEOUT_MS=10000
BRIDGE_MAX_BACKOFF_MS=30000
BRIDGE_LOG_LEVEL=info
```

O Streamer.bot precisa estar com o HTTP Server acessível para a bridge:

- [HTTP Server Configuration](https://docs.streamer.bot/api/http/guide/configuration)
- [DoAction](https://docs.streamer.bot/api/http/requests/do-action)

Mais detalhes ficam em `bridge/README.md`.

## Rotas do app

- `/`: home da live, com estado da comunidade e atalhos.
- `/me`: área do viewer logado.
- `/owner`: área do criador aprovado no beta fechado.
- `/criar-area`: redireciona para `/owner`.
- `/c/:slug`: entrada pública da área de um criador.
- `/ranking`: ranking público de pipetz.
- `/apostas`: apostas abertas e histórico.
- `/jogos`: sugestões de jogos com boost.
- `/videos`: sugestões de vídeos com boost.
- `/indicacoes`: recomendações e produtos.
- `/quotes`: quotes cadastradas.
- `/contadores`: contadores públicos.
- `/privacy`: política de privacidade.
- `/admin`: operação da live.
- `/obs/likes`: browser source para a meta de likes no OBS.
- `/obs/quotes`: browser source para quotes no OBS.
- `/obs/bets`: browser source para apostas abertas no OBS.
- `/obs/subscribers`: browser source para alertas de novas inscrições no canal.
- O estilo ativo dos overlays é escolhido no admin, sem trocar a URL usada no OBS. `?style=obscur` continua disponível como override manual para teste.

## Setup local

Instale as dependências:

```bash
npm install
```

Copie as variáveis de ambiente:

```powershell
Copy-Item .env.example .env.local
Copy-Item bridge/.env.example bridge/.env
```

Preencha pelo menos:

```env
NEXTAUTH_SECRET=
STREAMERBOT_SHARED_SECRET=
BRIDGE_SHARED_SECRET=
APP_URL=http://localhost:3000
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

Para usar banco, login Google e integrações reais:

```env
DATABASE_URL=
AUTH_GOOGLE_ID=
AUTH_GOOGLE_SECRET=
ADMIN_EMAILS=
YOUTUBE_API_KEY=
STREAM_YOUTUBE_CHANNEL_ID=
IGDB_CLIENT_ID=
IGDB_CLIENT_SECRET=
PS_PLUS_SYNC_SECRET=
STEAM_SYNC_SECRET=
STEAM_STORE_COUNTRY_CODE=BR
STEAM_STORE_LANGUAGE=brazilian
```

Checklist de deploy para Google OAuth:

- Em produção, o app não inicia sem `NEXTAUTH_SECRET` configurado; defina o valor no ambiente de deploy antes de publicar.
- Em `APP_URL` e `NEXT_PUBLIC_APP_URL`, use as URLs públicas finais do deploy, sem barra no fim.
- No Google Cloud Console, em **Authorized redirect URIs**, cadastre uma callback para cada domínio público usado pelo app, no formato `https://seu-dominio/api/auth/callback/google`.
- Para este projeto, o domínio principal deve ter `https://ludylops.live/api/auth/callback/google`; se o deploy da Vercel também for usado para login, cadastre também a URL equivalente de `*.vercel.app`.
- Depois do deploy, confira `GET /api/health/public`: `data.auth.googleOAuthConfigured` deve ser `true` e `data.auth.googleOAuthCallbackUrls` mostra as callbacks esperadas.
- Rode `npm run smoke:auth -- https://seu-dominio` para validar `/api/auth/providers` e o início do login antes de divulgar o deploy.

Para Google Cross-Account Protection (RISC), configure também:

```env
GOOGLE_RISC_ALLOWED_AUDIENCES=
GOOGLE_RISC_SERVICE_ACCOUNT_JSON=
GOOGLE_RISC_SERVICE_ACCOUNT_FILE=
GOOGLE_RISC_RECEIVER_URL=
```

Suba a aplicação:

```bash
npm run dev
```

Em outro terminal, quando for testar resgates reais com Streamer.bot:

```bash
npm run bridge:dev
```

## Google Cross-Account Protection

Ainda está sendo usado.

O projeto tem receiver RISC em `POST /api/internal/google/cross-account-protection`, variáveis `GOOGLE_RISC_*`, script `npm run google:risc`, campos no banco para estado de proteção da conta e bloqueio de login quando o Google sinaliza risco.

O passo a passo de produção fica em `docs/google-cross-account-protection.md`.

## Banco de dados

Gerar migração:

```bash
npm run db:generate
```

Aplicar schema no banco configurado:

```bash
npm run db:push
```

Sem `DATABASE_URL`, o app usa dados em memória para desenvolvimento visual e testes simples.

## Scripts úteis

```bash
npm run dev
npm run build
npm run lint
npm test
npm run test:watch
npm run db:generate
npm run db:push
npm run bridge:dev
npm run smoke:auth
npm run google:risc -- status
npm run backfill:youtube-names -- --dry-run
```

Scripts de manutenção disponíveis:

- `npm run db:ensure-youtube-handle`
- `npm run fix:users-ranking-state`
- `npm run merge:duplicate-youtube-users`
- `npm run merge:viewers`
- `npm run backfill:youtube-names`

## Stack

- Next.js `16.2.1`
- React `19.2.4`
- Tailwind CSS v4
- Auth.js / NextAuth v5 beta
- Drizzle ORM
- Neon Serverless Postgres
- Vitest
- Streamer.bot via C# actions e HTTP `/DoAction`

Antes de mexer em código Next.js, leia a documentação instalada em `node_modules/next/dist/docs/`, porque esta versão pode ter diferenças em relação a versões anteriores.

## Checklist antes de abrir PR

```bash
npm run lint
npm test
npm run build
```

Se a mudança tocar Streamer.bot, valide também o fluxo correspondente com os scripts em `streamerbot/` e confirme se a bridge continua registrando heartbeat no admin.
