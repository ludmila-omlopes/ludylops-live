# Resgates por streamer

Entrega da #222, parte da #203. Cada nova comunidade usa `creator_catalog_items` e `creator_redemptions`, com débito/estorno em `creator_balances` e `creator_ledger`. O catálogo e a fila antigos continuam nas tabelas `catalog_items` e `redemptions`, atendidos pela bridge da Ludylops.

## Comportamento

- `/c/<slug>/resgates`: catálogo público, saldo e últimos 100 resgates do espectador autenticado. O dono também cria/edita até 100 itens e consulta os últimos 100 resgates da comunidade.
- O preço é um inteiro da moeda configurada. Renomear a moeda não converte preços nem saldos. Itens novos começam pausados; o dono informa nome/ID da ação, estoque opcional e intervalos global/por pessoa.
- IDs de itens são locais à comunidade. A compra usa a identidade da sessão e o streamer resolvido pelo endereço, nunca campos de identidade fornecidos no corpo.
- Compra, débito, estoque, registro contábil e fila são uma transação. A chave de solicitação evita cobrança duplicada em uma repetição. O item é bloqueado durante compra/edição; edições antigas são recusadas para não repor estoque já vendido.
- Nome, preço e ação são copiados na compra. Uma edição posterior não muda o que já foi comprado. Cada resgate só pode ser assumido uma vez.
- `claimedAt` significa que a bridge assumiu o resgate. `completed` registra a aceitação de `/DoAction`; não comprova a conclusão de todas as subações. A observação deixa essa distinção explícita.
- Falha informada pela bridge estorna uma única vez a compra original, na mesma moeda. O estoque permanece consumido: a ação pode ter executado parcialmente. O dono repõe unidades depois de conferir o ocorrido.
- Compras com falha também contam para os intervalos, evitando repetição abusiva de uma ação quebrada.
- Transferências de identidade levam também os resgates, sob o mesmo bloqueio que protege as moedas. O estorno continua chegando ao titular atual.
- A operação estreita `redemptions` exige criador ativo e os módulos `redemptions`, `points` e `streamerbot` instalados, conferidos novamente dentro da transação. Ela não libera os endpoints legados para outros streamers.

## Migração e ativação

**0027 e 0028 aplicadas no banco configurado em 24/09/2026, após autorização da usuária.** Não reaplicar os arquivos nesse banco. Os passos abaixo documentam o procedimento para ambientes onde estejam pendentes.

Na consulta anterior à aplicação, as colunas `claimed_at` e `execution_note` ainda não existiam na tabela legada. O merge do PR #220 não havia aplicado essa migração automaticamente.

1. Confirmar o banco de destino, a existência de `creator_balances`/`creator_ledger` (0026) e o estado de 0027. Registrar contagens das tabelas legadas de catálogo, resgates, saldos e extrato.
2. Antes de qualquer alteração real, produzir um backup `pg_dump --format=custom` em local privado fora do Git e conferir com `pg_restore --list`. Guardar também o estado de `drizzle.__drizzle_migrations`, se esse mecanismo já estiver sendo usado. Ensaiar a restauração em banco descartável.
3. Este rollout usa SQL aditivo revisado, após aprovação para o banco real. Executar somente os arquivos pendentes, em transação com `ON_ERROR_STOP`. O projeto usa schema-first e não tem `db:migrate`: não inventar entradas em `drizzle.__drizzle_migrations`. O `_journal.json` versionado descreve a geração dos arquivos, não comprova sua aplicação. Não reaplicar o `ALTER TABLE` de 0027 se as colunas já existirem.
4. 0028 cria somente duas tabelas e seus índices/constraints. Não copia, renomeia ou altera dados da Ludylops. Conferir tabelas vazias e contagens legadas iguais após a aplicação.
5. Fazer deploy deste PR. `CREATOR_ECONOMY_ENABLED=true` continua sendo necessário para produção; esta entrega não altera o valor desse sinalizador. Se as tabelas estiverem ausentes, a nova interface informa indisponibilidade e as APIs devolvem 503.
6. Configurar uma comunidade piloto, sua credencial e sua bridge. Criar um item pausado e testar a ação localmente. Ativar o item, comprar, conferir débito e histórico, e ensaiar uma falha controlada para validar o estorno.
7. Para interromper compras/execuções, pausar o módulo ou o criador; para só suspender novas compras, pausar os itens. Para voltar o código, manter as tabelas e dados novos. Não apagar dados nem reaplicar backups sobre compras posteriores. Reativar antes de concluir/estornar operações pendentes, pois a política de lifecycle também protege callbacks.

Nenhuma migração, sinalizador de produção ou configuração do Streamer.bot é alterada automaticamente pelo PR. A suite `redemptions.postgres.test.ts` aplica os SQLs 0026–0028 em schema descartável de PostgreSQL real.

### Registro da aplicação — 24/09/2026

- Autorização da usuária: “Execute as migrações”. SQL da revisão `cdef9120b800497bef5c27d0c343fa0cf6334335`.
- Backup completo PostgreSQL custom, com índice conferido e restauração integral bem-sucedida em banco local isolado. Arquivo privado fora do Git: `%LOCALAPPDATA%/Codex/DatabaseBackups/ludylops-live/20260924-redemptions-0027-0028/before-0027-0028.dump`.
- Backup: 3.564.002 bytes; SHA-256 `0f21de2e01877d929ea7568aa99a3ce715d4ce212b8dbef809f937c5ec03b8b6`.
- Os dois arquivos SQL foram ensaiados na cópia restaurada e aplicados juntos em transação, com limite de espera por lock de 5 segundos e por comando de 30 segundos. Commit confirmado às **18:32:15 UTC**.
- Uma conexão nova verificou as estruturas persistidas; o dump de schema das três tabelas afetadas coincidiu integralmente com o ensaio, desconsiderando apenas cabeçalhos gerados pelo `pg_dump`.
- As duas colunas de auditoria foram adicionadas e as duas tabelas novas ficaram vazias. Não houve backfill nem escrita no histórico de migrações.
- Contagens e checksums integrais preservados na transação para catálogo, resgates, saldos/extrato legados e novos, redirecionamentos de identidade, criadores, módulos e credenciais. Pipetz: **221 saldos e 35.986 lançamentos** preservados.
- `creator-baseline.ts check`: `ready: true`, sem registros faltantes, antes e depois. Evidências e logs privados estão junto do backup.
- Banco pronto para o merge/deploy do PR #223. Ativação da economia, credenciais e configuração do Streamer.bot continuam sendo etapas separadas.

## Configuração de cada streamer

1. Entrar com a conta dona da comunidade em `/criar-area`, usar **Gerenciar credenciais → Criar credencial** e guardar ID e segredo no PC do streamer. A administradora mantém a recuperação em `/owner`. Veja [credenciais e configuração](streamerbot-credentials.md). Uma credencial de outra comunidade não acessa sua fila. A credencial global antiga continua restrita à Ludylops.
2. No Streamer.bot do PC da live, abrir **Servers/Clients → HTTP Server**, manter host `127.0.0.1`, porta `7474` (ou a escolhida), iniciar o servidor e habilitar Auto Start se desejado. [Configuração oficial](https://docs.streamer.bot/api/http/guide/configuration).
3. Criar/testar a ação no Streamer.bot. Usar preferencialmente o GUID da ação ao cadastrar o item, evitando nomes duplicados. Esta versão executa a ação sem argumentos personalizados de catálogo. [Contrato oficial de DoAction](https://docs.streamer.bot/api/http/requests/do-action): POST com `action.id` ou `action.name`; resposta 204.
4. Em arquivo privado `bridge/.env` no PC do streamer, configurar:

```dotenv
BRIDGE_API_BASE_URL=https://seu-dominio
BRIDGE_MACHINE_KEY=pc-da-live
STREAMERBOT_CREDENTIAL_ID=sbc_ID_DA_CREDENCIAL
STREAMERBOT_CREDENTIAL_SECRET=SEGREDO_DA_CREDENCIAL
BRIDGE_STREAMERBOT_BASE_URL=http://127.0.0.1:7474
```

Não preencher `BRIDGE_SHARED_SECRET` para uma nova comunidade. ID e segredo da credencial devem estar presentes juntos; uma configuração incompleta falha sem voltar para o segredo global.

Com Node.js 20.8+ e dependências instaladas, executar na raiz do checkout:

```sh
node --env-file=bridge/.env --import tsx bridge/src/index.ts
```

Cada instância usa uma credencial e o Streamer.bot local correspondente. O protocolo usa `POST /api/internal/streamerbot/redemptions`, com as operações `heartbeat`, `pull`, `claim`, `complete` e `fail`. A assinatura v2 inclui método, caminho, corpo e ID da credencial. Após a migração 0029 e a implantação da #226, o heartbeat também registra a última atividade por comunidade/bridge. Ele não comprova conexão contínua nem execução de actions. Veja [diagnóstico e resolução manual](creator-integration-operations.md).

### Recuperação sem executar de novo

A bridge tenta novamente confirmações que falharam na rede enquanto o processo estiver vivo. Reiniciar o processo perde essas confirmações locais, mas não libera outro claim: o resgate permanece em execução. Um timeout ao chamar Streamer.bot também permanece em execução, pois a ação pode ter sido aceita.

Após a #226, o dono também pode registrar a resolução observada em **Integração e resgates pendentes**, seguindo [o procedimento de parada e verificação](creator-integration-operations.md#resolver-resultado-incerto). O CLI abaixo continua disponível.

Depois de conferir o resultado no Streamer.bot, usar o mesmo `BRIDGE_MACHINE_KEY` que aparece no histórico e uma credencial válida da mesma comunidade:

```sh
node --env-file=bridge/.env --import tsx bridge/src/reconcile.ts complete UUID_DO_RESGATE "Ação aceita; resultado conferido no Streamer.bot"
node --env-file=bridge/.env --import tsx bridge/src/reconcile.ts fail UUID_DO_RESGATE "Ação não executada; estorno conferido"
```

Escolher somente o comando correspondente ao resultado. `fail` devolve a moeda; `complete` registra conclusão. O utilitário apenas registra o resultado, nunca chama a ação. Repetir o mesmo resultado não cobra/estorna de novo nem substitui a primeira observação. Um resultado terminal contrário é recusado.

## Inventário de compatibilidade

- `getCatalog`, `redeemItem`, `getViewerDashboard`, `listAdminRedemptions`, `bridgePull/Claim/Complete/Fail` permanecem exclusivamente nas tabelas legadas. Os testes exercitam esses métodos com compras novas presentes e confirmam que eles não retornam nem modificam tais compras.
- Consultas e mutations novas sempre filtram `creatorId`; histórico pessoal também filtra a identidade canônica. O extrato genérico não permite estornar o tipo `redemption`, evitando estorno enquanto a ação segue na fila.
- `scripts/merge-viewers.ts` e `scripts/merge-duplicate-youtube-users.ts` já se recusam a executar depois de 0026. Usar o vínculo de contas da aplicação, que transfere as moedas/resgates na mesma transação.
- `cleanup-offline-streamerbot-events.ts` passa a bloquear `--apply` após 0026, pois a limpeza de identidades legadas não considera as novas moedas e resgates. A análise sem aplicação continua disponível.
- A bridge atual, sem credencial por creator, mantém os endpoints legados. Atualizar o código adiciona repetição segura da confirmação; não requer alterar ações existentes da Ludylops.
