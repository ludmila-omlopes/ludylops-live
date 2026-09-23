# Moedas independentes por comunidade

## Entrega e limites

Entrega [#205](https://github.com/ludmila-omlopes/ludylops-live/issues/205), parte da
[#203](https://github.com/ludmila-omlopes/ludylops-live/issues/203).

Cada comunidade do beta pode receber créditos, fazer débitos, estornar um débito
e consultar saldo/histórico próprios. O mesmo espectador pode ter 100 cristais em
uma comunidade e 20 estrelas em outra. Renomear a moeda não altera os valores.

- `/c/<slug>/moeda`: saldo e últimas 50 movimentações do espectador autenticado.
  O dono também pode consultar e ajustar um canal do YouTube, com motivo visível
  ao espectador. Um espectador não consulta o histórico de outra pessoa.
- `GET/POST /api/me/creator-area/<id>/economy`: dono autenticado, origem confiável
  para escrita, creator ativo e módulo `points` instalado.
- `POST /api/internal/streamerbot/economy`: credencial exclusiva determina o
  creator. `points` e `streamerbot` devem estar instalados. Nenhum campo do corpo
  pode escolher o streamer ou o ID interno do espectador.
- `/api/internal/streamerbot/points`: o comando de saldo também funciona para
  comunidades do beta e responde com o nome da moeda correspondente.

O novo núcleo aceita quantidades inteiras de 1 a 1.000.000 por crédito/débito.
Cada ação do streamer define sua quantidade; não se reutilizam os preços globais
da Ludylops. Automatizar taxas de presença/chat/inscrições e oferecer regras de
preços configuráveis ainda faz parte da sequência da #203. Os endpoints antigos
de eventos, apostas, sugestões, catálogo/resgates, likes e OBS continuam limitados
à Ludylops. Este PR não libera essas dependências para outros streamers.

## Armazenamento e compatibilidade

A abordagem inicial de trocar a chave de `viewer_balances` foi substituída por
uma migração **aditiva**. Alterar aquela chave invalidaria escritores antigos
com `ON CONFLICT(viewer_id)`; consultas antigas poderiam atingir várias moedas
durante um deploy com versões sobrepostas.

As novas tabelas são:

- `creator_balances`: chave `(creator_id, viewer_id)`, saldo e totais não negativos.
- `creator_ledger`: operações e estornos, unicidade por `(creator_id, operation_key)`
  e `(creator_id, refund_of)`, índice de histórico por comunidade/espectador/data.
- `economy_viewer_redirects`: destino de identidades transferidas, sem FK no ID
  de origem para preservar retries depois de uma fusão com exclusão da origem.

As duas tabelas econômicas rejeitam `creator_ludylops` por CHECK. Os pipetz seguem
em `viewer_balances`/`point_ledger`. Nenhum saldo é copiado, convertido ou apagado.
As 30 funções legadas inventariadas abaixo permanecem fisicamente incapazes de
ler ou gastar moedas novas. A convergência futura da Ludylops para o núcleo novo
exigirá outra migração; não há escrita dupla nesta entrega.

## Transações, concorrência e identidade

Saldo e ledger são gravados na mesma transação. Uma chave repetida com os mesmos
dados devolve o resultado anterior; valores, motivo, tipo ou espectador diferentes
geram conflito. Um evento com a mesma chave em outra comunidade é independente.
O estorno referencia um débito daquela comunidade/espectador e devolve exatamente
seu valor, no máximo uma vez. Estornar reduz o total gasto, sem contar como ganho.

Cada operação protege o estado do creator/módulo, serializa a chave de evento e
bloqueia a linha de saldo. Consultas de saldo/histórico usam um snapshot consistente.
Todas as operações compartilham um advisory lock de identidade `(203, 1)`;
fusões/consolidações o adquirem de modo exclusivo. Isso permite créditos paralelos
normalmente e impede créditos perdidos no meio de uma troca de identidade.

O vínculo Google/YouTube continua global. Canais já vinculados antes desta migração
creditam a identidade ativa. Fusão, vínculo administrativo, bootstrap da sessão e
troca do canal ativo consolidam cada moeda separadamente. A troca de canal pode
ser revertida sem ciclos. Histórico e chaves de idempotência acompanham os saldos.
Limpeza de identidades sintéticas preserva atividade nova e revalida sob o lock.

Os scripts `merge-viewers.ts` e `merge-duplicate-youtube-users.ts` são ferramentas
legadas e recusam execução após detectar `creator_balances`, antes de qualquer
mutação. Use os fluxos de vínculo da aplicação. Reescrever esses scripts para o
novo protocolo de locks continua pendente; não contorne a verificação.

## Aplicação e ativação

O schema foi aplicado em produção em 2026-09-23, após autorização da usuária.
O registro abaixo documenta a execução. A ativação por variável continua sendo
uma etapa posterior ao deploy; nenhuma variável de produção foi alterada.

1. Seguir [o procedimento de migração](database-migrations.md): confirmar alvo,
   backup/PITR, baseline e diferença de schema. `0026_creator_economy.sql` e o
   snapshot são artefatos de revisão. O fluxo adotado pelo projeto é `db:push`,
   mediante aprovação; ele não executa o SQL gerado como uma migração histórica.
2. A diferença esperada cria somente as três tabelas acima, seus índices, FKs e
   CHECKs. Não deve alterar/remover `viewer_balances` ou `point_ledger`, nem
   reproduzir migrações/seeds antigos. Não é necessário backfill de saldos.
3. Aplicar o schema aprovado **antes do merge/deploy**: os fluxos globais de
   identidade passam a consultar as novas tabelas, mesmo com o acesso econômico
   desligado. Sem schema, a consulta da moeda mostra indisponibilidade; isso não
   substitui a ordem de implantação exigida para login/vínculos.
4. Implantar com `CREATOR_ECONOMY_ENABLED=false` (ausente também significa false).
   Confirmar que os escritores de identidade ativos usam a nova revisão e que
   processos/scripts antigos não estão operando vínculos.
5. Só então configurar `CREATOR_ECONOMY_ENABLED=true` no ambiente escolhido.
   Não usar prefixo `NEXT_PUBLIC_`. Preview e produção têm ativação independente;
   preferir banco isolado para qualquer teste de preview.
6. Conferir pipetz/ledger legados contra contagens e somas anteriores; validar
   duas comunidades, um espectador, crédito/débito/estorno, nome e vínculos.

Demo sem banco habilita o recurso apenas em memória para teste local. A aplicação
não aplica DDL automaticamente e falhas do banco não criam saldo demo.

### Registro da migração — 2026-09-23

- Revisão de schema: `c7692850c71a353211ace7b2a28fa4d7bfab2c3b` (PR #206).
- Backup completo em formato custom do PostgreSQL, restaurado com sucesso em
  banco local descartável antes do ensaio. Arquivo privado fora do repositório:
  `%LOCALAPPDATA%/Codex/DatabaseBackups/ludylops-live/20260923-economy-0026/before-0026.dump`.
  SHA-256: `e86e3fe3cb77cc141f6e41bb0b26633b488624707100a2c2955d6f3856343e74`.
- O push completo foi cancelado no ensaio: além das tabelas novas, propunha
  recriar a FK de `creator_suggestion_boosts` e as PKs de `obs_overlay_control`
  e `quote_overlay_state`. Essas alterações não foram executadas.
- Foi usado `drizzle-kit push --strict --verbose` com configuração temporária
  restrita: módulo de schema reexportando somente `creatorBalances`,
  `creatorLedger` e `economyViewerRedirects` do schema versionado, e
  `tablesFilter` contendo somente os nomes das três tabelas correspondentes.
  O SQL proposto foi revisado no ensaio e em produção: três CREATE TABLE, cinco
  FKs e quatro índices adicionais, com PKs e CHECKs nos CREATE TABLE.
- Aplicação concluída às 13:08 UTC. A introspecção confirmou 17 colunas,
  11 constraints e sete índices, idênticos ao ensaio. As três tabelas ficaram
  vazias. Uma segunda comparação com o mesmo escopo retornou `No changes detected`.
- `db:baseline:check` retornou `ready: true` antes e depois. Os 221 registros
  de `viewer_balances` e os 35.986 de `point_ledger` preservaram contagens, somas
  e checksums integrais (JSON ordenado com collation C e timestamps em UTC).
  Não houve backfill, alteração de seed nem escrita em histórico de migrações.
- Merge/deploy e ativação continuam pendentes. Nenhuma ação, credencial ou
  configuração do Streamer.bot foi modificada durante a migração.

Para interromper acesso, desativar a variável e manter as tabelas e o código de
identidade novo. Depois do primeiro saldo novo, **não voltar para código antigo**
de fusão/limpeza de contas. Não apagar tabelas nem copiar moedas para pipetz como
rollback. Reconciliar operações e restaurar em alvo isolado se houver incidente.

Auditoria somente leitura, antes/depois:

```sql
SELECT count(*), sum(current_balance), sum(lifetime_earned), sum(lifetime_spent)
FROM viewer_balances;
SELECT count(*), sum(amount) FROM point_ledger;
SELECT creator_id, count(*), sum(current_balance), sum(lifetime_earned), sum(lifetime_spent)
FROM creator_balances GROUP BY creator_id;
SELECT creator_id, count(*), sum(amount) FROM creator_ledger GROUP BY creator_id;
```

## Streamer.bot

Não é preciso mudar a instalação atual da Ludylops. O endpoint novo não aceita
a economia legada; as actions existentes continuam usando seus contratos atuais.

Para um streamer do beta, após a ativação:

1. Emitir e validar sua [credencial exclusiva](streamerbot-credentials.md).
   `lojaneon.appBaseUrl`, `lojaneon.streamerbotCredentialId` e
   `lojaneon.streamerbotCredentialSecret` continuam sendo variáveis persistidas.
2. Para consulta de saldo, usar `get-points-from-chat.cs`. O nome da moeda vem
   da resposta autenticada da aplicação, sem configuração de texto por streamer.
3. Criar uma action controlada pelo streamer com `community-currency.cs` em
   **Execute C# Code**. Não permitir ao chat escolher livremente quantidade ou
   tipo da operação. Configurar os argumentos antes da sub-action:

   | Argumento | Conteúdo |
   |---|---|
   | `currencyOperation` | `credit`, `debit` ou `refund` |
   | `currencyViewerChannelId` | ID real do canal do YouTube, começando com UC |
   | `currencyOperationKey` | Identificador estável do evento/execução, até 128 caracteres |
   | `currencyReason` | Motivo, até 160 caracteres, visível no histórico |
   | `currencyAmount` | Inteiro positivo para crédito/débito |
   | `currencyRefundOf` | `data.entry.id` do débito original, somente no estorno |

4. Em timeout ou repetição, reenviar **a mesma chave e o mesmo corpo**; um evento
   novo recebe outra chave. Não gerar uma chave nova a cada tentativa. A action
   devolve `currencyHttpStatus` e `currencyResponse`; a resposta inclui o ID da
   movimentação para posterior estorno. Um estorno tem sua própria chave.

O código assina método, caminho e bytes do JSON com o protocolo v2 existente.
Não envia creator ID no corpo, não registra segredos e não tem retry automático.
O fluxo usa `HttpRequestMessage`/`HttpClient` com cabeçalhos por requisição, conforme
[o exemplo oficial de HTTP POST do Streamer.bot](https://docs.streamer.bot/examples/http-post),
consultado em 2026-09-23. Os argumentos `currency*` são o contrato desta integração.

## Inventário dos acessos legados

Levantamento de `viewerBalances`, `pointLedger`, `viewer_balances` e `point_ledger`
em `src/` e `scripts/`, base `46662a3`:

| Grupo | Funções/arquivos | Tratamento |
|---|---|---|
| Identidade | `mergeViewerIntoTarget`, `transferViewerBalanceToUnifiedViewer`, `pruneSyntheticViewersForGoogleAccount` | Preservam pipetz e tratam as novas moedas em separado; locks e transações adicionados |
| Sessão/canais | `listViewerChannelsForGoogleAccount`, `ensureViewerFromSession`, `ensureViewerFromStreamerbotIdentity`, `serializeViewerBalance` | Projeções antigas continuam pipetz; novas rotas não reutilizam seu saldo. Bootstrap/seleção/vínculo consolidam moedas novas |
| Leituras | `getLeaderboard`, `getViewerByYoutubeChannelId`, `getViewerPoints`, `getViewerDashboard`, `listAdminViewerDirectory` | Continuam no armazenamento legado e sob os limites de módulos existentes |
| Quotes pagas | `refundQueuedQuoteOverlay`, `enqueueQuoteOverlay`, `activateQuoteOverlay` | Operações econômicas ainda exclusivas da Ludylops |
| Sugestões | `createGameSuggestion`, `boostGameSuggestion`, `createCreatorSuggestion`, `boostCreatorSuggestion`, `createVideoSuggestion`, `boostVideoSuggestion` | Continuam exclusivas da Ludylops |
| Apostas | `placeBetForViewer`, `lockBet`, `resolveBet`, `cancelBet` | Continuam exclusivas da Ludylops |
| Resgates | `redeemItem`, `bridgeFail` | Continuam exclusivos da Ludylops |
| Recompensas | `getDatabasePresentViewerIds`, `adjustViewerBalance`, `ingestStreamerbotEvent` | Contrato antigo preservado; novo endpoint econômico é separado |
| Scripts | `cleanup-offline-streamerbot-events.ts`, `verify-quote-isolation.ts` | Operam somente tabelas legadas; não acessam moeda nova |
| Fusão por CLI | `merge-viewers.ts`, `merge-duplicate-youtube-users.ts` | Bloqueados após a migração, antes de mutações |
| Testes antigos | `repository.test.ts`, `repository-bridge.test.ts`, `repository-redeem.test.ts`, `viewer-points.test.ts` | Continuam verificando o contrato legado |

## Validação

Testes de contrato/API e PostgreSQL real cobrem isolamento com o mesmo espectador
e chave de evento, retries concorrentes, saldo insuficiente, estorno único,
ownership/lifecycle, fusão com créditos concorrentes, rollback e troca de canal.
O teste de PostgreSQL executa o SQL 0026 em schema descartável e aceita somente
`MODULE_TEST_DATABASE_URL` em `127.0.0.1`, banco `modules_185_test`; nunca carrega
`.env` ou usa `DATABASE_URL`. O adaptador WebSocket local usa
`MODULE_TEST_WS_PORT` (padrão 55479).

Resultado local: 842 testes da suíte padrão passaram; os nove testes novos de
PostgreSQL passaram separadamente (a suíte padrão pula os testes opt-in).
TypeScript, lint e build passaram. O navegador validou desktop/celular com dois
streamers, um espectador e uma sessão anônima: crédito/débito/estorno, saldo
insuficiente, acesso cruzado bloqueado, vínculo preservando ambas as moedas e
renomeação sem alteração de valor. Sem erros de JavaScript ou overflow horizontal.
O script C# compilou com um stub da API CPH e passou no teste de escape de JSON;
não foi executado em uma instalação real do Streamer.bot.
