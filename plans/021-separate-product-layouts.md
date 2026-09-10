# Plano 021: separar os layouts do builder, da comunidade e do OBS

> Executor: implemente apenas a separação de superfícies descrita aqui. Preserve URLs, permissões, APIs, identidade visual da Ludylops e alterações locais preexistentes. Execute os gates antes de declarar a implementação concluída.
>
> Drift check: `git diff --stat 6f527cc..HEAD -- src/app src/components/app-chrome.tsx src/components/providers.tsx src/lib/auth/session.ts proxy.ts`. Consulte também `git status --short` e `git diff -- src/app src/components`. Se houver diferenças, confronte os trechos e o inventário antes de executar.

## Status

- Prioridade: P1.
- Categoria: arquitetura.
- Esforço: M.
- Risco: médio — desloca layouts, providers e efeitos globais, mantendo regras de negócio.
- Planejado em: `6f527cc`, 2026-09-08, reconciliado com `origin/master`.
- Dependência: direção do plano 020; nenhuma migração ou plano de correção anterior precisa ser executado.
- Estado: DONE; execução revisada em 2026-09-09 no worktree `.worktrees/plan-021`, branch `codex/separate-product-layouts`, base `6f527cc`. Commits do executor: `8f24f46`, `6b5042b`.

## Objetivo e limite da entrega

Existem dois produtos: um builder que configura plataformas de streamers e um motor que atende comunidades. A Ludylops será a primeira instância desse motor. Esta entrega prepara a separação no Next.js atual: o builder deixa de herdar o cabeçalho, rodapé e consulta global da live da Ludylops; o OBS passa a ter um layout independente; a experiência da Ludylops mantém seus endereços e funções.

Não criar aplicações ou deploys adicionais agora. Não implementar isolamento de dados, editor visual, novas permissões ou configuração completa de tenants nesta entrega. A página pública `/c/[creatorSlug]` continua sendo a apresentação existente, não uma comunidade operacional completa.

## Estado atual

Há 21 páginas e 78 handlers de API em `src/app`, com um layout raiz. As páginas usam imports absolutos `@/`; a busca não encontrou imports relativos nas páginas no momento do levantamento.

Em `src/app/layout.tsx:34`, a identidade da Ludylops é global:

```ts
export const metadata: Metadata = {
  title: "Ludylops Games: eu disseco jogos no YouTube",
  description:
    "Faço lives e vídeos de jogos no YouTube, com campanhas longas, sugestões do chat e muito bate-papo. Acompanhe o jogo atual, junte pipetz e participe do que acontece ao vivo.",
};
```

No mesmo arquivo, linha 48:

```ts
const [session, isLive] = await Promise.all([
  auth(),
  isStreamerbotLivestreamActive(),
]);
```

O retorno envolve todas as páginas em `Providers` e `AppChrome`. `src/components/providers.tsx` compõe `SessionProvider`, React Query e devtools.

`src/components/app-chrome.tsx:43` identifica OBS pelo pathname. Seu efeito em `:61` controla a transparência:

```ts
if (isObsView) {
  document.body.dataset.obsOverlay = "true";
  return () => {
    delete document.body.dataset.obsOverlay;
  };
}
```

`src/app/globals.css:259` depende desse atributo para transparência e overflow. Ao retirar o OBS de `AppChrome`, esse comportamento precisa ser transferido, não apagado.

Permissões atuais, que devem ser preservadas:

- `/owner`: `requirePlatformOwnerSession()`, lista todas as instâncias e pode incluir criação de área.
- `/criar-area`: apresentação pública com estados `visitor`, `closed_beta` e `approved`, derivados de `auth()` e `canCreateCreatorArea(email)`. Preservar integralmente esse comportamento da base atual: visitante vê CTA de login, não aprovado vê explicação do beta e aprovado vê formulário/suas áreas. Não introduzir guard ou 404 nessa rota.
- `/admin`: `requireAdminSession()`; administra a live e, temporariamente, a allowlist do beta.
- `/api/admin/creator-area-access`: exige `requireAdminApiSession()`. Migrar a allowlist para um espaço exclusivo de platform owner mudaria quem pode operá-la; isso fica fora desta entrega.
- `/c/[creatorSlug]`: pública, usa `getCreatorAreaBySlug` e `notFound()` para ausência.

## Arquitetura de layouts

```text
src/app/layout.tsx                  raiz neutra: HTML, fontes, CSS, cookie de tema
src/app/(community)/layout.tsx      sessão, estado da live, Providers, AppChrome
src/app/(builder)/layout.tsx        sessão, Providers, BuilderChrome
src/app/(creator-public)/layout.tsx apresentação pública neutra de criador
src/app/obs/layout.tsx              ObsShell + Suspense; sem chrome de comunidade
src/app/api/**                     permanece onde está; handlers têm seus próprios guards
```

Manter uma única raiz com `<html>` e `<body>`. Grupos de rotas são organizacionais e não entram nas URLs. Layouts filhos não devem repetir `<html>`/`<body>`. Não selecionar o layout de produto por pathname dentro de um componente global.

## Mapa completo de páginas

Todos os caminhos abaixo são relativos à raiz do repositório. A coluna Destino define os únicos movimentos permitidos. Em arquivos movidos sem alteração interna, preservar o conteúdo integralmente.

| Origem | Destino | URL preservada | Layout |
| --- | --- | --- | --- |
| `src/app/page.tsx` | `src/app/(community)/page.tsx` | `/` | community |
| `src/app/admin/page.tsx` | `src/app/(community)/admin/page.tsx` | `/admin` | community |
| `src/app/(viewer)/me/page.tsx` | `src/app/(community)/me/page.tsx` | `/me` | community |
| `src/app/(public)/apostas/page.tsx` | `src/app/(community)/apostas/page.tsx` | `/apostas` | community |
| `src/app/(public)/contadores/page.tsx` | `src/app/(community)/contadores/page.tsx` | `/contadores` | community |
| `src/app/(public)/indicacoes/page.tsx` | `src/app/(community)/indicacoes/page.tsx` | `/indicacoes` | community |
| `src/app/(public)/jogos/page.tsx` | `src/app/(community)/jogos/page.tsx` | `/jogos` | community |
| `src/app/(public)/produtinhos/page.tsx` | `src/app/(community)/produtinhos/page.tsx` | `/produtinhos` | community |
| `src/app/(public)/quotes/page.tsx` | `src/app/(community)/quotes/page.tsx` | `/quotes` | community |
| `src/app/(public)/ranking/page.tsx` | `src/app/(community)/ranking/page.tsx` | `/ranking` | community |
| `src/app/(public)/videos/page.tsx` | `src/app/(community)/videos/page.tsx` | `/videos` | community |
| `src/app/privacy/page.tsx` | `src/app/(community)/privacy/page.tsx` | `/privacy` | community |
| `src/app/terms/page.tsx` | `src/app/(community)/terms/page.tsx` | `/terms` | community |
| `src/app/owner/page.tsx` | `src/app/(builder)/owner/page.tsx` | `/owner` | builder |
| `src/app/(viewer)/criar-area/page.tsx` | `src/app/(builder)/criar-area/page.tsx` | `/criar-area` | builder |
| `src/app/c/[creatorSlug]/page.tsx` | `src/app/(creator-public)/c/[creatorSlug]/page.tsx` | `/c/[creatorSlug]` | creator-public |
| `src/app/obs/bets/page.tsx` | igual à origem | `/obs/bets` | obs |
| `src/app/obs/likes/page.tsx` | igual à origem | `/obs/likes` | obs |
| `src/app/obs/quotes/page.tsx` | igual à origem | `/obs/quotes` | obs |
| `src/app/obs/subscribers/page.tsx` | igual à origem | `/obs/subscribers` | obs |
| `src/app/obs/wheel/page.tsx` | igual à origem | `/obs/wheel` | obs |

## Mapa das APIs

Os 78 arquivos `src/app/api/**/route.ts` permanecem integralmente nos mesmos caminhos. Nenhum ganha layout de página. A classificação abaixo é de responsabilidade, não uma mudança de URL ou de autorização.

| Origem | Destino | URL | Responsabilidade |
| --- | --- | --- | --- |
| `src/app/api/owner/**/route.ts` | igual à origem | `/api/owner/**` | Administração das instâncias |
| `src/app/api/me/creator-area/route.ts` | igual à origem | `/api/me/creator-area` | Criação/listagem para streamer autorizado |
| `src/app/api/admin/creator-area-access/route.ts` | igual à origem | `/api/admin/creator-area-access` | Gestão do beta, preservando guard de admin |
| Demais `src/app/api/admin/**/route.ts` | igual à origem | `/api/admin/**` | Operação da comunidade |
| Demais `src/app/api/me/**/route.ts` | igual à origem | `/api/me/**` | Participação do viewer |
| `src/app/api/obs/**/route.ts` | igual à origem | `/api/obs/**` | Consumo dos overlays |
| `src/app/api/internal/**/route.ts` | igual à origem | `/api/internal/**` | Integrações e manutenção |
| `src/app/api/auth/[...nextauth]/route.ts` | igual à origem | `/api/auth/[...nextauth]` | Autenticação compartilhada |
| `src/app/api/health/public/route.ts` | igual à origem | `/api/health/public` | Saúde pública existente |
| `src/app/api/bets/route.ts`, `catalog/route.ts`, `leaderboard/route.ts`, `recommendations/route.ts`, `viewers/route.ts`, `viewers/[youtubeChannelId]/route.ts`, `games/search/route.ts` | igual à origem | URLs correspondentes sob `/api` | Consultas públicas existentes |

## Responsabilidades e consultas

| Arquivo alvo | Consultas e providers | Conteúdo |
| --- | --- | --- |
| `src/app/layout.tsx` | Apenas `cookies()` para tema; sem `auth`, estado da live ou `Providers` | Fontes, CSS, `<html>`, `<body>`, filhos. Remover metadados específicos da Ludylops desta raiz |
| `src/app/(community)/layout.tsx` | Mover a resolução existente de sessão, flags admin/owner, tema e estado da live; envolver com `Providers` | Metadados atuais da Ludylops e `AppChrome`, com os mesmos props |
| `src/app/(builder)/layout.tsx` | `auth()` para apresentação de navegação, cookie de tema, `Providers`; sem consulta de live e sem verificação global de platform owner | `BuilderChrome`; metadados próprios. Guards permanecem nas páginas |
| `src/app/(creator-public)/layout.tsx` | Sem sessão global ou estado da live | `<main>` simples; metadados neutros: título “Comunidade”, sem descrição da Ludylops. A página já carrega branding específico |
| `src/app/obs/layout.tsx` | Sem `auth`, `SessionProvider` ou consulta global da live | `ObsShell` e `Suspense fallback={null}` para filhos com `useSearchParams` |

As cinco páginas OBS continuam consultando `resolveObsOverlayInitialStyle`. Seus componentes já fazem suas próprias requisições e não usam `useSession`/React Query diretamente no levantamento atual. Conferir dependências transitivas antes de remover providers. A meta é remover dependências introduzidas pelo antigo layout, não parar o polling necessário aos overlays.

## Navegação e apresentação do builder

Criar `src/components/builder-chrome.tsx`, reutilizando `Button`, `ThemeToggle` e `AuthButtons`, com HTML semântico e suporte a tela estreita. Não criar marca comercial, logo, novo sistema visual ou menu complexo.

- Rótulo funcional: “Comunidades”. Link principal para `/criar-area`, sujeito à navegação condicional abaixo.
- Mostrar acesso `/criar-area` para todos, pois é a apresentação pública do builder na base atual. A página decide entre visitante, beta fechado e formulário aprovado. Não consultar a allowlist novamente apenas para mostrar navegação.
- Mostrar “Administrar comunidades” (`/owner`) somente com o mesmo predicado de apresentação do platform owner atual. A página continua protegida no servidor.
- Manter uma saída explícita “Ludylops” para `/`; não embutir o catálogo de apostas, ranking e sugestões na navegação do builder.
- Usar os componentes de autenticação atuais e seus callbacks atuais. Não alterar a estratégia de login/logout nesta etapa.
- Não mostrar `LivestreamIndicator`, alerta de vínculo do viewer, Buy Me a Coffee, moeda, redes sociais ou rodapé da Ludylops no builder.
- Manter em `AppChrome` o atalho existente para `/owner` como ligação entre produtos. O atalho não significa herança de layout.
- Título de metadados: “Comunidades”; descrição: “Prepare o encontro da sua comunidade com a próxima live.” Sem kicker acima de headings e sem textos sobre páginas, painéis ou vantagens do próprio site.

O beta permanece temporariamente em `/admin`, pois sua autorização atual é de admin geral. Esse limite deve constar na entrega. Não copiar a allowlist para outro lugar ou mudar seu guard como efeito colateral.

## Escopo de implementação

Modificar/criar apenas:

- Os movimentos de páginas da tabela; modificar conteúdo somente quando necessário para corrigir imports resultantes do movimento, sem alterar lógica. Nenhum import relativo foi encontrado no levantamento.
- `src/app/layout.tsx`.
- `src/app/(community)/layout.tsx` (novo).
- `src/app/(builder)/layout.tsx` (novo).
- `src/app/(creator-public)/layout.tsx` (novo).
- `src/app/obs/layout.tsx` (novo).
- `src/components/app-chrome.tsx`: remover exclusivamente detecção OBS, efeito de dataset e retorno especial para OBS; preservar o restante.
- `src/components/builder-chrome.tsx` (novo).
- `src/components/obs-shell.tsx` (novo): cliente, controla `document.body.dataset.obsOverlay` em montagem/desmontagem e retorna filhos.
- `src/app/product-layouts.test.ts` (novo).
- `src/app/route-map.test.ts` (novo).
- `src/components/builder-chrome.test.ts` e `src/components/obs-shell.test.ts` (novos).
- `plans/README.md` e status deste plano ao concluir.

Fora do escopo: todos os handlers API, `proxy.ts`, `src/auth.ts`, `src/lib/auth/session.ts`, `src/lib/db/**`, `src/lib/creators/**`, `src/lib/env.ts`, `src/lib/streamerbot/**`, `bridge/**`, `streamerbot/**`, `src/app/globals.css`, `src/components/providers.tsx`, `src/components/auth-buttons.tsx`, demais componentes, manifest/lockfile, CI, DNS, deploy e migrações.

## Convenções e preparação

- Repositório: `D:/Codigos_Diversos/lojinha-youtube`, TypeScript estrito, Next.js 16.2.9, React 19, npm, Vitest 4.1.1.
- Ler `AGENTS.md` e a skill local `ludylops-issue-workflow` ao preparar uma implementação. Atualizar a base remota antes de criar branch `codex/separate-product-layouts`. Não publicar PR, issue ou deploy sem autorização correspondente.
- Checkout original permanece intacto. Comparação com `origin/master` mostrou que seu admin local corresponde à versão anterior e que a base nova acrescenta o painel de contadores. Usar e mover integralmente o admin de `6f527cc`; não transportar o arquivo antigo por cima dele. Alterações locais residuais em contadores/repositório ficam fora desta entrega e permanecem no checkout original.
- Na conferência de drift, não ler/exibir conteúdo de `.env`.
- Usar `apply_patch` para edições e APIs de arquivo UTF-8 para scripts. Para movimentos Windows, resolver caminhos absolutos dentro do workspace, usar `Move-Item -LiteralPath` e não sobrepor destinos existentes.
- Antes de código Next.js, ler `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md`, `layout.md` e `../04-functions/generate-metadata.md` a partir do diretório de convenções.
- Padrão de teste: `src/lib/theme.test.ts` usa `describe/it/expect`; `src/lib/api-session.test.ts` exemplifica mocks de auth. A configuração inclui `src/**/*.test.ts`; escrever testes com `React.createElement` em `.test.ts` para não alterar o runner.

## Passos

### 1. Fixar o contrato das rotas e conferir a baseline

Registrar as URLs das 21 páginas da tabela e dos 78 handlers atuais. Criar `src/app/route-map.test.ts`: percorrer recursivamente somente `src/app`, normalizar separadores, remover segmentos de grupos e sufixos `page.tsx`/`route.ts`, e comparar com conjuntos explícitos obtidos antes dos movimentos. Falhar em URLs duplicadas, removidas ou adicionais. Não depender só da contagem.

Verificação: `npm test -- src/app/route-map.test.ts` → passa antes da alteração. Executar `npm run typecheck` e a suíte atual para registrar eventuais falhas preexistentes; não corrigi-las silenciosamente.

### 2. Preparar os componentes específicos

Criar `BuilderChrome` com props simples para flags de navegação/tema, sem consultar dados internamente. O layout servidor calcula essas flags. Criar `ObsShell` com o efeito de dataset transferido integralmente e limpeza no unmount. Não extrair estilos ou redesenhar `AppChrome`.

Verificação: `npm test -- src/components/builder-chrome.test.ts src/components/obs-shell.test.ts` → casos descritos abaixo passam.

### 3. Trocar a composição e mover páginas numa unidade coerente

Mover metadados e consultas da Ludylops para `(community)/layout.tsx`, mantendo root neutro. Adicionar os layouts builder, creator-public e OBS. Mover exatamente as 16 páginas indicadas; as cinco páginas OBS ficam no lugar. Remover detecção OBS de `AppChrome` somente quando `ObsShell` estiver ligado ao layout OBS.

Preservar as exports de metadata existentes em `/privacy`, `/terms`, `/produtinhos` e `/indicacoes`. Builder e creator-public recebem metadados próprios e não herdam descrição da Ludylops. Não há necessidade de alterar guards, rewrites ou callbacks OAuth.

Verificação: `npm test -- src/app/route-map.test.ts src/app/product-layouts.test.ts` → mesmas 21 URLs de páginas e 78 URLs de handlers, sem duplicação; testes de composição passam. `rg -n 'isObsView|dataset.obsOverlay' src/components/app-chrome.tsx` → nenhum resultado (exit 1 esperado).

### 4. Verificar a aplicação e registrar a reversão

Rodar os gates abaixo uma vez, corrigindo somente regressões desta entrega. Validar a navegação e os overlays localmente com ambiente de teste. Não acionar mutações reais ou Streamer.bot de produção para testar layouts.

Verificação: todos os gates passam, smoke dos cenários abaixo documentado no resumo e `git diff --name-status` mostra apenas o escopo autorizado mais as alterações locais preexistentes identificadas no início. Atualizar status para DONE somente após implementação e validação.

## Testes

`src/app/product-layouts.test.ts`:

- Executar os layouts com `auth`, `cookies`, fontes e a função de estado da live controlados por mocks; inspecionar o elemento retornado e renderizar com dependências cliente mínimas quando necessário.
- Raiz não chama auth/live; comunidade recebe sessão, tema e estado da live corretos e consulta a função esperada.
- Builder com sessão autorizada renderiza com a função de live configurada para lançar se chamada. O teste passa porque a função não é usada.
- Não testar que builder consegue ignorar autenticação das páginas; preservar e verificar separadamente os guards existentes em smoke.
- OBS e creator-public não instanciam o chrome da comunidade ou seu `SessionProvider`.
- Metadados do builder e creator-public não contêm o título/descrição globais da Ludylops. Comunidade mantém os valores anteriores.

`src/components/builder-chrome.test.ts`:

- Renderizar com `react-dom/server` e `React.createElement`, controlando somente componentes que exigem contexto de navegação/autenticação.
- Todos veem o acesso à apresentação `/criar-area`; operadora vê `/owner`; usuário sem permissão não recebe o link administrativo.
- Não aparecem navegação de apostas/ranking, texto “Siga a Ludylops”, indicador de live ou alerta de vínculo. O link explícito de saída “Ludylops” é permitido.

`src/components/obs-shell.test.ts`:

- Usar `// @vitest-environment jsdom`, `createRoot` e `act` do React; sem instalar bibliotecas adicionais.
- Montagem coloca `body.dataset.obsOverlay = "true"`; desmontagem remove o atributo; filhos permanecem visíveis. Verificar sequência montar overlay → desmontar → comunidade sem atributo residual.

Smoke local de aceitação:

1. `/`, `/apostas`, `/me` e `/admin`: cabeçalho, footer, tema e comportamento existentes; usuários sem permissão continuam recebendo os redirects atuais.
2. `/owner`: operadora vê gestão; streamer comum não ganha acesso. Em `/criar-area`, visitante mantém CTA de login, não aprovado mantém a explicação de beta fechado e aprovado mantém formulário/lista.
3. `/c/[slug existente]`: exibe a apresentação e branding do criador, sem cabeçalho/rodapé Ludylops. Slug inexistente mantém 404.
4. Todos os cinco `/obs/*`: sem navegação, fundo transparente e query `?style=obscur` preservada. Ir para uma página comum restaura o fundo normal.
5. Navegação comunidade → builder → comunidade preserva tema e não duplica providers. Login/logout mantêm callbacks atuais para `/`.

Em modo demo alguns guards são permissivos por desenho; os testes de negação devem mockar flags/identidade no teste ou usar ambiente isolado equivalente a produção, sem credenciais reais. Não alegar autorização validada só com navegação no demo.

## Gates e critérios de conclusão

| Gate | Comando | Resultado esperado |
| --- | --- | --- |
| Contratos novos | `npm test -- src/app/route-map.test.ts src/app/product-layouts.test.ts src/components/builder-chrome.test.ts src/components/obs-shell.test.ts` | Exit 0 |
| Suite | `npm test` | Exit 0; regressões e testes novos passam |
| Tipos | `npm run typecheck` | Exit 0; em caso de tipos de rota antigos, regenerar tipos no worktree isolado conforme docs antes de repetir |
| Lint local | `npm run lint -- --ignore-pattern '.claude/**' --ignore-pattern '.worktrees/**'` | Exit 0 |
| Build | `npm run build` | Exit 0 em configuração de teste; nenhuma rota duplicada ou erro de Suspense |
| Raiz neutra | `rg -n 'auth\(|isStreamerbotLivestreamActive|AppChrome|<Providers|Ludylops' src/app/layout.tsx` | Nenhum match; exit 1 esperado |
| Revisão de escopo | `git diff --name-status` | Alterações desta entrega restritas ao escopo, movimentos preservam conteúdo |

Baseline histórica em `9291962`, antes da atualização remota: 40 arquivos/298 testes, tipos e lint com exclusões passaram. Build não foi executado no levantamento. O executor deve usar um banco de teste ou demo e `NEXTAUTH_SECRET` de teste para o build de produção; não apontar a build para banco real por conveniência. Não fazer `db:push` ou geração de migrations.

Done somente quando: mapa real corresponde ao inventário inicial; gates passam; smoke registrado; builder renderiza sem consulta global da live; OBS mantém transparência; permissões e URLs continuam iguais; nenhuma operação financeira, API ou schema mudou.

## Reversão

Entregar os movimentos e a troca de layouts no mesmo commit lógico, após testes, para permitir revert conjunto. Se falhar antes de commit, reverter somente edições do executor e fazer movimentos inversos da tabela, usando as cópias de partida que incluem trabalho local. Não usar `git reset --hard`, `git clean` ou sobrescrever o admin a partir de HEAD.

A reversão recoloca consultas/providers/metadados na raiz e o efeito OBS em `AppChrome`. Não há reversão de dados, credenciais ou DNS nesta etapa. Em produção, eventual reversão usa o artefato anterior; este plano não autoriza publicar nenhum deles.

## STOP

- Destino de movimento já existe com conteúdo ou surgiram páginas/handlers além do inventário: revisar o mapa antes de sobrescrever.
- O admin do worktree não corresponde a `6f527cc` e não contém o painel de contadores novo: conferir a base antes de mover, sem recuperar a versão antiga do checkout original.
- Remover providers quebra dependência transitiva de overlay: documentar a dependência e limitar o provider ao OBS; se exigir editar componente fora do escopo, reportar antes de ampliar a entrega.
- Separação exige mudar allowlists, guards, callbacks de auth, banco ou Streamer.bot: reduzir à separação de layout e registrar o trabalho como etapa posterior.
- Gate falha duas vezes por motivo fora do escopo, ou build só é viável com banco de produção: reportar a limitação, sem corrigir outro projeto ou conectar produção.

## Manutenção

Novas páginas devem escolher um grupo de produto explicitamente. Não recolocar sessões, live ou navegação de comunidade na raiz. A etapa posterior extrairá configuração da Ludylops e contexto de criador; não considerar esta separação visual como isolamento de dados. O controle do beta ainda em `/admin` e a dependência dos guards em identidade de viewer continuam limitações conhecidas e deliberadamente preservadas.
