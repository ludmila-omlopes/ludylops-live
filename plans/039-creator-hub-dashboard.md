# Plano 039: separar a vitrine do Creator Hub da gestão das comunidades

> **Executor**: Next.js 16 — leia `node_modules/next/dist/docs/` antes de criar rotas, layouts, redirecionamentos ou mexer em `src/proxy.ts`. Siga o `AGENTS.md`: português do Brasil com acentos, sem eyebrow/kicker acima de títulos e sem textos em que o site fale de si mesmo (“este painel”, “a página mostra…”). Rótulos de navegação e de ações são permitidos. Preserve autorização do dono no servidor, módulos (`canUseModules`) e lifecycle (017). Não crie migração de banco.
>
> **Drift check (rode primeiro)**: `git diff --stat 70bef48..HEAD -- "src/app/(builder)" src/components/builder-chrome.tsx src/components/creator-*.tsx src/components/periodic-messages-manager.tsx src/components/streamerbot-credentials.tsx src/lib/creators/setup.ts src/lib/creators/service.ts "src/app/(creator-public)/c/[creatorSlug]" src/proxy.ts src/app/route-map.test.ts`. Se algum trecho citado em “Estado atual” mudou, confronte antes de executar.

## Status

- **Estado**: IN PROGRESS (2026-09-25): 039a (#236) e 039b (#237) no master. 039c implementado na branch `codex/039c-hub-polish` — gestores removidos de `/c/{slug}/quotes`, `/produtinhos`, `/resgates` e `/moeda` (o dono vê um link para a seção correspondente; o público mantém catálogo, saldo e histórico próprio); painéis, títulos e campos dos gestores no estilo do builder; `ConfirmButton` em revogar credencial e remover mensagem; intervalos de ganhos no chat e mensagens em segundos/minutos/horas, gravados em segundos; detalhes técnicos da integração agrupados com botões de copiar. Validação: testes completos, tipos, lint e build (demo); navegador em 1280 px e 390 px sem overflow nem erro de página. Após o merge, marcar DONE.
- **Prioridade**: P1 — bloqueia o piloto com dois streamers (037): hoje o dono de duas comunidades gerencia tudo numa página única e empilhada.
- **Esforço**: L, dividido em três PRs (039a, 039b, 039c).
- **Risco**: MÉDIO — muda rotas do builder e move gestores que hoje vivem nas páginas públicas; não muda dados, APIs nem autorização.
- **Depende de**: 038 (separação da plataforma e da comunidade Ludylops), já integrado ao master no PR #234 (`70bef48`). Coordena com 035 (setup) e 036 (operações de integração).
- **Origem**: diagnóstico de 25/09/2026 da página inicial do Creator Hub, feito sobre `0435bd7` (os arquivos citados são idênticos no master `70bef48`; entre os dois só entrou o 037).
- **Issue**: — (abrir antes de executar e registrar aqui).

## Por que importa

A rota `/criar-area` é ao mesmo tempo vitrine de marketing, formulário de criação e painel de gestão de todas as comunidades da conta. Para quem já tem comunidade:

- O conteúdo útil aparece depois do título de venda e dos quatro cards de benefícios.
- A gestão ocupa a coluna esquerda (`lg:grid-cols-[0.95fr_1.05fr]`), enquanto a direita, de maior destaque, mostra sempre o formulário “Criar área”.
- Cada comunidade renderiza em sequência link, checklist, nome e cores, moeda, ganhos no chat, mensagens periódicas, dois links soltos e credenciais. Com Teste 1 e Teste 2 (037), a tela vira uma pilha sem limites claros entre uma comunidade e outra.
- Frases, produtos, resgates, operações de integração e ajustes de moeda são gerenciados nas páginas públicas `/c/{slug}/...`, com outro layout e outra navegação.
- Depois de criar a comunidade, o formulário leva para a página pública (`window.location.assign('/c/{slug}')`), e não para a configuração.

O marco do produto (plans/README.md) é um segundo streamer conseguir criar, configurar e operar a comunidade sem ajuda. Esta tela é o caminho principal desse streamer.

## Estado atual (em `70bef48`)

- `src/app/(builder)/criar-area/page.tsx`: carrega `listCreatorAreasForOwner(viewerId, { includeArchived: true })` e, para cada comunidade diferente de `DEFAULT_CREATOR_ID`, renderiza `CreatorSetup`, `CreatorProfileForm`, `CreatorCurrencyForm`, `CreatorChatRewardsForm`, `PeriodicMessagesManager`, links “Gerenciar frases” e “Gerenciar produtos”, e `StreamerbotCredentials mode="creator"`. Status aparece só como frase quando não está ativa.
- `src/proxy.ts:12`: no host da plataforma, `/` é reescrito para `/criar-area`.
- `src/components/builder-chrome.tsx`: navegação com “Criar área” e, para a operadora, “Administrar comunidades”. Não existe “Minhas comunidades”.
- `src/components/creator-area-create-form.tsx:89`: redireciona para `/c/{slug}` após criar.
- `src/components/creator-setup.tsx`: os passos só aparecem depois de clicar em “Verificar configuração”. As instruções levam ao GitHub (`guides`).
- `src/lib/creators/setup.ts:25-30`: `href` dos passos usa âncoras (`#perfil-{id}`, `#integracao-{id}`, `#ganhos-{id}`) de seções que começam fechadas, além de `${path}/moeda` e `${path}/resgates` nas páginas públicas. O passo `profile` fica `configured` sempre que a comunidade está ativa. `setup.test.ts` cobre os `href`.
- `src/lib/creators/setup.server.ts`: `getOwnedCreatorSetup(viewerId, creatorId)` já autoriza o dono e pode ser chamado no servidor.
- Formulários de gestão (`creator-profile-form`, `creator-currency-form`, `creator-chat-rewards-form`, `periodic-messages-manager`, `streamerbot-credentials`) começam fechados, fazem o próprio `fetch` ao abrir e usam `border-2`/`font-bold`/`<input>` cru, fora do estilo do builder. A hierarquia de títulos mistura `h2`, `h3` e `h4` dentro do `h2` “Suas áreas”.
- Gestores nas páginas públicas: `quotes/page.tsx` (`CreatorQuoteManager`), `produtinhos/page.tsx` (`CreatorRecommendationManager`), `resgates/page.tsx` (`CreatorCatalogManager`, `CreatorIntegrationOperations`, `AdminRedemptionsPanel` do dono), `moeda/page.tsx` (`CreatorChatRewardsForm` duplicado e `CreatorEconomyManager`).
- APIs do dono já existem por id em `src/app/api/me/creator-area/[id]/*` (catalog, chat-rewards, currency, economy, integration-operations, periodic-messages, profile, quotes, recommendations, setup, streamerbot-credentials).
- Nenhum componente pede confirmação antes de “Revogar credencial” ou “Remover” mensagem periódica.
- `src/components/ui/` tem apenas `button`, `card`, `input`, `select` e `textarea`.

## Decisões (padrões; confirme com a usuária se discordar)

1. **Rotas novas no builder**:
   - `/comunidades` — lista das comunidades da conta.
   - `/comunidades/nova` — criação.
   - `/comunidades/[slug]` — visão geral de uma comunidade.
   - `/comunidades/[slug]/{identidade,economia,resgates,frases,produtos,mensagens,integracao}` — seções de gestão.
2. **`/criar-area` continua sendo a vitrine** para visitante, beta fechado e aprovado sem comunidade. Usuário com ao menos uma comunidade é redirecionado no servidor para `/comunidades`, inclusive quando chega pela raiz do host da plataforma.
3. **Páginas públicas ficam só com a experiência do público**. Os gestores saem de `/c/{slug}/...`. O dono passa a ver um link de ação (“Gerenciar frases”, “Gerenciar itens”) para a seção correspondente em `/comunidades/{slug}/...`.
4. **Ludylops** (`DEFAULT_CREATOR_ID`), se aparecer na lista, mostra um card sem gestão, com link para `/admin` no domínio da Ludylops.
5. **Intervalos**: a interface mostra minutos (e horas quando fizer sentido); as APIs continuam em segundos.
6. **Confirmação**: botão em duas etapas (“Revogar” → “Confirmar revogação” / “Cancelar”), sem `window.confirm`.

## Fora do escopo

- Console da operadora (`/owner`): busca, filtros e colapso ficam para outro plano.
- Co-gestão ou convites (a posse continua em `creators.owner_user_id`).
- Passo a passo completo do Streamer.bot dentro do produto. Aqui só se ocultam detalhes técnicos e se adicionam botões de copiar.
- Mudanças em APIs, esquema, módulos, lifecycle ou Streamer.bot.

## Comandos

| Objetivo | Comando | Esperado |
|---|---|---|
| Testes focados | `npm test -- src/lib/creators src/components src/app` | todos passam |
| Suíte completa | `npm test` | todos passam |
| Tipos | `npm run typecheck` | sem erros |
| Lint | `npm run lint` | sem erros |
| Build | `npm run build` | conclui (demo, sem `DATABASE_URL`) |
| Local | `npm run dev` | `/criar-area`, `/comunidades` e `/comunidades/{slug}` renderizam |

## Etapas

### 039a — Lista “Minhas comunidades” e roteamento

1. Criar um loader do dono em `src/lib/creators/owner-dashboard.server.ts`. Ele deve (a) listar as comunidades com `listCreatorAreasForOwner(viewerId, { includeArchived: true })` e (b) resolver uma comunidade por slug **somente entre as do próprio dono**, incluindo desativadas e arquivadas. Não usar `getCreatorAreaBySlug`, que só serve comunidades ativas ao público. Slug de outro dono ou inexistente retorna `notFound()`.
2. Para cada card, reunir no servidor um resumo: nome, cores, status, moeda (`getCurrencyLabel`), progresso do setup (passos `configured` / total, via `getOwnedCreatorSetup`) e última autenticação do Streamer.bot. Falha de um resumo mostra “indisponível” no card, sem derrubar a lista.
3. Criar `src/app/(builder)/comunidades/page.tsx`, protegida por sessão. Mostrar uma grade de cards compactos com faixa na cor da comunidade, nome, selo de status, moeda, progresso (“3 de 8”), link público e ação principal “Gerenciar”. Incluir também o botão “Nova comunidade”, quando `canCreateCreatorArea`, e um estado vazio que leva a `/comunidades/nova`.
4. Criar `src/app/(builder)/comunidades/nova/page.tsx` com `CreatorAreaCreateForm`. Após criar, redirecionar para `/comunidades/{slug}` e não mais para `/c/{slug}`. Acrescentar ao formulário uma prévia do endereço final (`creatorPlatformUrl`) e das cores.
5. Em `/criar-area`: redirecionar para `/comunidades` quem tem ao menos uma comunidade. Remover dela a listagem “Suas áreas” e todos os gestores. Manter a vitrine para os demais estados.
6. Navegação (`builder-chrome.tsx`, desktop e mobile): “Minhas comunidades” (ativo em `/comunidades*`), “Nova comunidade” para aprovados e “Administrar comunidades” só para a operadora. Visitante continua com o CTA de entrada.
7. Atualizar `route-map.test.ts` e `builder-chrome.test.ts`. Adicionar testes para o redirecionamento de `/criar-area`, para o `notFound` com slug de outro dono e para o redirecionamento pós-criação.

### 039b — Área de cada comunidade

1. Criar `src/app/(builder)/comunidades/[slug]/layout.tsx`. Ele faz a autorização uma vez pelo loader do dono e mostra um cabeçalho com nome, cor, status e link público. A navegação entre seções é uma barra lateral no desktop e abas roláveis no mobile. Exibir só as seções cujos módulos estão disponíveis (`canUseModules`). Com a comunidade desativada ou arquivada, mostrar o aviso e deixar só “Integração” (revogar credenciais), como hoje.
2. **Visão geral** (`[slug]/page.tsx`): checklist do setup renderizado no servidor e visível ao abrir, com barra de progresso e “Verificar novamente”. Abaixo, resumos lidos das mesmas fontes: moeda, regra de ganhos (ativa/pausada, quantidade, intervalo), mensagens ativas, itens de resgate ativos e última autenticação.
3. Atualizar `setup.ts` para que os `href` apontem para as seções (`/comunidades/{slug}/identidade`, `.../economia`, `.../integracao`, `.../resgates`) em vez de âncoras e páginas públicas. Corrigir o passo `profile` para refletir a configuração real (nome e cores salvos) e não apenas `active`. Ajustar `setup.test.ts`.
4. Uma seção por rota, cada uma com um `h1` e subtítulos `h2` coerentes:
   - `identidade`: `CreatorProfileForm` e `CreatorCurrencyForm`, abertos por padrão.
   - `economia`: `CreatorChatRewardsForm` e `CreatorEconomyManager`.
   - `mensagens`: `PeriodicMessagesManager`.
   - `integracao`: `StreamerbotCredentials mode="creator"`, `CreatorIntegrationOperations` e as instruções do `CreatorSetup`.
   - `resgates`: `CreatorCatalogManager` e o histórico do dono.
   - `frases`: `CreatorQuoteManager`.
   - `produtos`: `CreatorRecommendationManager`.
5. Passar os valores iniciais do servidor como props, para que os formulários abram preenchidos. Onde a API exigir, manter o `expected`/`revision` de concorrência que já existe. Remover os botões “Editar…/Fechar…” que só existem por causa da pilha.

### 039c — Páginas públicas, consistência e segurança de ação

1. Remover os gestores de `/c/{slug}/quotes`, `/produtinhos`, `/resgates` e `/moeda`. Para o dono, trocar por um link de ação para a seção correspondente em `/comunidades/{slug}/...`. Manter nessas páginas tudo o que o público vê (catálogo, saldo, histórico do espectador). Atualizar os testes dessas páginas.
2. Uniformizar os formulários com os componentes de `src/components/ui` (`Input`, `Button`, `Card`) e o estilo do builder (bordas de 3px, sombra, fonte display nos títulos). `periodic-messages-manager.tsx` deve trocar `<input>` cru por `Input`.
3. Criar `src/components/ui/confirm-button.tsx` (duas etapas, acessível por teclado, com `aria-live` no estado de confirmação) e usá-lo em “Revogar credencial”, “Remover” mensagem e demais ações destrutivas dos gestores movidos.
4. Mostrar intervalos em minutos e horas (ganhos no chat e mensagens periódicas), convertendo para segundos no envio e mantendo a validação atual. Cobrir a conversão com testes.
5. Na integração, colocar ID da comunidade, nomes de variáveis `lojaneon.*` e nome do script em um bloco “Detalhes técnicos”, com botão de copiar para cada valor. Manter os links do GitHub como documentação complementar.
6. Revisar todo o texto novo ou editado: acentos, nenhum eyebrow e nenhuma autorreferência do site.

## Critérios de aceite

- Visitante na raiz do host da plataforma vê a vitrine. Aprovado sem comunidade vê a vitrine com “Criar a minha área”. Usuário com comunidade cai em `/comunidades`.
- Com duas comunidades (Teste 1 e Teste 2), a primeira tela mostra as duas lado a lado com status, moeda e progresso, sem rolagem no desktop de 1280 px.
- Criar uma comunidade leva à visão geral dela, com o checklist visível sem clique.
- Todo link do checklist abre a seção certa já preenchida.
- Nenhum gestor do dono aparece nas páginas públicas `/c/{slug}/...`. O dono vê links de ação.
- Slug de outro dono em `/comunidades/{slug}` retorna 404, sem revelar que a comunidade existe.
- Ações destrutivas exigem confirmação.
- Sem overflow horizontal em 390 px. Títulos em ordem (`h1` → `h2` → `h3`).

## Validação manual

Em `npm run dev` (demo) e, se disponível, em banco de teste com duas contas donas, conferir no desktop e em 390 px:

- Os quatro estados de acesso: visitante, beta fechado, aprovado sem comunidade e com comunidades.
- Criação.
- Navegação por todas as seções.
- Salvar em cada seção.
- Comunidade desativada.
- Slug de outro dono.
- Páginas públicas como dono e como espectador.

Registrar o resultado no Status. Não usar o banco compartilhado para escrita.

## STOP — pare e pergunte à usuária se

- `src/proxy.ts` ou `listCreatorAreasForOwner` tiverem mudado de contrato desde `70bef48`.
- Algum gestor depender de dados que só a página pública carrega e movê-lo exigir nova API ou mudança de autorização.
- For necessário mudar esquema, módulos ou comportamento do Streamer.bot.
- As sessões por host (docs/creator-hub.md) fizerem o link público → `/comunidades` exigir novo login no mesmo host. Isso não deve acontecer para `/c/{slug}` na plataforma. Se acontecer em `ludylops.live`, pergunte antes de adicionar o link.
- A usuária preferir outros nomes de rota ou manter os gestores também nas páginas públicas.

## Riscos

- Links e favoritos para `/criar-area` continuam funcionando (redirecionamento). Os links diretos para gestores nas páginas públicas passam a levar à seção equivalente.
- Mover gestores pode perder props calculadas na página pública (por exemplo `currencyLabel` e `catalog.items` do dono). Carregue os mesmos dados no layout ou na seção nova.
