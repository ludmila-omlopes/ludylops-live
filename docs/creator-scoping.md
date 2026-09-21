# Isolamento por criador: piloto de frases (#173)

## O que está disponível

Cada comunidade tem frases e numeração próprias. A leitura pública fica em
`/c/<slug>/quotes`. A integração permite `create` e `get` com a credencial do
streamer, exigindo criador ativo e módulos `streamerbot` e `quotes` instalados.
O contexto vem da credencial verificada, nunca de um `creatorId` enviado no corpo.

**Este é um piloto técnico.** Para outros streamers, mostrar frases no OBS,
cobrar/devolver pontos e controlar a fila continuam indisponíveis. Esses caminhos
retornam `operation_not_isolated` antes de acessar a economia, preço, estilo ou
estado de live da Ludylops. Não há preço fictício, exibição gratuita ou cópia de
saldo para simular uma funcionalidade pronta.

A Ludylops mantém `/quotes`, chamadas de chat, exibição paga, pausa, retomada,
cancelamento, expiração e OBS. A autenticação antiga continua restrita à Ludylops
enquanto habilitada. Esta entrega não exige mudar os scripts do Streamer.bot.

## Contrato de serviço e autoridade

```ts
type CreatorContext = { creatorId: string };
listQuotes(context);
runQuoteCommandFromChat(context, input);
showQuoteOverlayForViewer(context, input);
```

Todos os helpers de frases exigem contexto; não existe argumento opcional com
fallback para a Ludylops. `requireCreatorContext` valida a presença do ID, **não
autentica nem autoriza**. Os chamadores fazem essas verificações antes do serviço.
`defaultCreatorContext` aparece apenas nos adaptadores legados autorizados.

| Chamador | Autoridade/contexto | Serviços e efeitos | Outros criadores |
|---|---|---|---|
| `/c/[creatorSlug]/quotes` | Registro público ativo, domínio/caminho compatíveis, módulo instalado | `listQuotes` | Leitura própria; sem sessão/dashboard/preço globais |
| `/quotes` | Mesma resolução; layout legado restrito à Ludylops | Lista, dashboard do viewer e preço legado | 404; usar o caminho público isolado |
| `POST /api/internal/streamerbot/quotes` | HMAC/credencial #184; estado e módulos do criador | `runQuoteCommandFromChat` → criar/consultar/exibir | Somente criar e consultar; `show` negado |
| `POST /api/me/quotes/[quoteId]/show` | Origem confiável, sessão vinculada, contexto público validado | Viewer autenticado → solicitação paga | 403 antes do serviço |
| `/obs/quotes` | Criador validado antes de carregar estilo | Componente OBS e configuração legada | 404 antes do estilo |
| `GET /api/obs/quotes/current` | Contexto público validado | Processa fila e retorna overlay, sempre `no-store` | 403 antes de processar |
| `GET /api/obs/live-status` | Contexto público validado | Estado de live legado, `no-store` | 404 antes da consulta |
| `/admin` e `/api/admin/obs-overlays` | Sessão com papel global existente e contexto Ludylops | Estado, pausa/retomada, cancelamento, estilo | Dono de comunidade não ganha papel global; contexto de outro criador negado |
| `credentials/check` | Credencial verificada | Informa `quoteActions`; não executa comandos | `create/get` se disponíveis; `operationalAccess` completo continua falso |

`resolveQuoteRequest` usa a política pública estrita da #183: hostname registrado,
criador ativo, slug consistente e módulo `quotes` instalado. `creator` duplicado,
vazio, desconhecido ou diferente do caminho/domínio é recusado. Cabeçalhos são
entrada de roteamento; não provam propriedade administrativa. Selecionar o slug
de B não autoriza o dono de A a administrar B.

Os fetches do botão de exibição e do OBS carregam `?creator=<slug>`; o refresh
mantém a URL atual. O retorno da listagem aponta para `/c/<slug>`. O layout
`(creator-public)` não carrega o estado de live nem a navegação global. O layout
legado `(community)` recusa outros criadores antes de consultar sessão/live.

## Armazenamento e efeitos

| Tabela | Chave/índice do piloto |
|---|---|
| `quotes` | UNIQUE (`creator_id`, `quote_number`) |
| `quote_overlay_state` | PK (`creator_id`, `slot`) |
| `obs_overlay_control` | PK (`creator_id`, `key`) |
| `quote_overlay_queue` | ID global preservado; índice em `creator_id` |

As quatro tabelas recebem FK para `creators`, `NOT NULL` e default temporário
`creator_ludylops` para preservar os registros legados. Inserts do código novo
sempre informam o criador; o default é compatibilidade de migração.

Leituras, contagens, updates, claims e upserts filtram o criador. Builders e
ativação/reembolso também rejeitam quote ou entrada de fila de outro criador.
A numeração usa lock transacional `(42002, hashtext(creatorId))` antes de buscar
o próximo número; fila/ativação usam `(42001, hashtext(creatorId))`. Colisões de
hash podem serializar criadores sem misturar dados. A constraint continua sendo
a garantia final de unicidade. Não há cache novo: qualquer cache futuro precisa
incluir `creatorId` na chave; nunca cachear/deduplicar o GET que processa a fila.

Identidades (`users`, contas Google e vínculos) continuam globais. Criar uma frase
fora da Ludylops pode registrar a identidade, mas não inicializa saldo global.
Se essa pessoa depois receber pontos da Ludylops, a ingestão legada inicializa
o saldo ausente sem sobrescrever saldo existente. O ledger da exibição paga é
explicitamente carimbado com o criador padrão. Saldos ainda não têm chave composta;
por isso os caminhos pagos não são liberados para os demais criadores.

No demo, as quatro estruturas são separadas por criador, com seeds apenas na
Ludylops. Falha de banco/schema no caminho real propaga erro; nunca troca para
dados demo. Cancelamento/expiração/falha de ativação devolvem pontos no demo e
no banco, apenas na operação padrão autorizada.

## Migração e reprodução em PostgreSQL descartável

Artefatos: `drizzle/0025_dazzling_sabretooth.sql`, snapshot 0025 e journal.
O Drizzle Kit 0.31.10 gerou placeholders para remover as PKs antigas e tentou
adicionar PKs compostas antes das colunas. O SQL foi corrigido e revisado: colunas
primeiro, substituição das PKs, FKs e índices depois. Os nomes anteriores
`obs_overlay_control_pkey` e `quote_overlay_state_pkey` foram verificados na
estrutura descartável. Não há seeds no artefato.

`db:push` **não executa esse SQL corrigido**. A aplicação ao ambiente real exige
revisão própria da diferença e da ordem do DDL; não aprovar cegamente o push nem
usar `--force`. Siga [o procedimento do banco](database-migrations.md), com
inventário, backup, baseline pronto e validação em cópia representativa. A nova
aplicação precisa das colunas e chaves novas antes de receber tráfego. Para trocar
as PKs, interrompa escritores antigos: seus upserts usam as chaves antigas e não
são compatíveis com a chave composta. Não misture versões durante a troca.

Receita usada nesta entrega (sem dados de produção):

1. PostgreSQL 17.11 local vazio, banco `quote_isolation_173`, com transporte
   WebSocket local compatível com Neon. Exporte a estrutura pré-008 do checkout
   `f353ce2` ou use seu schema push conforme o procedimento de bootstrap; não
   reproduza os seeds históricos de 0021.
2. Configure explicitamente o banco descartável para o CLI de baseline. Execute
   `db:baseline:check`, `db:baseline:ensure -- --apply` se necessário, e repita
   check até saída 0. Na validação foram inseridos os 14 registros da fundação.
3. Revise/aplique a estrutura 0023 e 0024 nesse alvo. Isso reproduz o estado
   anterior ao piloto, com as quatro tabelas de frases ainda globais.
4. Configure `QUOTE_ISOLATION_DATABASE_URL` para esse banco e
   `QUOTE_ISOLATION_WS_PROXY` para `127.0.0.1:<porta>`. Execute
   `node --import tsx scripts/verify-quote-isolation.ts` na raiz do checkout.
   O script não carrega `.env`; exige hostname local e nome de banco começando
   com `quote_isolation_`. **Ele escreve fixtures e exige um banco descartável.**
5. Sem `creator_id` nas frases, o script insere registros legados nas quatro
   tabelas, aplica 0025 em transação e compara todos os valores anteriores. Com
   schema já migrado, repete somente os cenários de isolamento com IDs novos.
6. Confere frase nº 1 em A/B, oito criações concorrentes em A, consulta aleatória
   e por número, estado/controle separados, bloqueio de operações pagas,
   compatibilidade de crédito de um viewer novo, claim concorrente sem duplicar
   cobrança, cancelamento concorrente com um reembolso, filas estrangeiras
   intactas, FK/NOT NULL/UNIQUE e erro de schema sem fallback demo.

Resultados locais: preservação do backfill e todos os cenários PostgreSQL
passaram. Os testes Vitest cobrem ainda domínio/slug inválido, criador desativado,
módulo ausente, hints forjados, dono de A tentando administrar B, layout e
renderização sem dependências globais. Isso não substitui teste da instalação
real do Streamer.bot/OBS. **Nenhum banco compartilhado/produção foi alterado.**

## Antes de disponibilizar o produto para outros streamers

- Plano 019 / #185: política completa de autorização e dependências dos módulos.
- Ainda sem número: economia independente (`viewer_balances` com chave composta,
  ledger e todas as operações), preços, estado de live e configuração visual.
- Ainda sem número: administração pelo dono da comunidade, navegação/configuração
  completas e testes do fluxo real de Streamer.bot/OBS para outro streamer.
- Outras migrações por módulo ainda sem número: apostas, sugestões/produtos,
  catálogo/resgates, bridge com credenciais/filas próprias, contadores/settings.
- Cleanup posterior: remover defaults temporários quando todos os escritores
  passarem o criador explicitamente; rever leitores legados de ledger.

Os planos 010–013 são otimizações e pesquisa de entrega de overlays; **não são**
esses follow-ups funcionais. Não anunciar o produto multi-streamer completo com
base apenas neste piloto.
