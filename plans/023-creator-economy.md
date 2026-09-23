# Plan 023: Economia independente por comunidade

Issue: [#203](https://github.com/ludmila-omlopes/ludylops-live/issues/203).

Estado: TODO. Prioridade: P1. Depende do contexto/autorização já entregues em
#173/#185; preservar a configuração de moeda da #202. Não aplicar migração em
produção como parte da implementação sem autorização da usuária.

## Objetivo

O mesmo espectador pode ter 100 cristais em uma comunidade e 20 estrelas em
outra. Ganhos, débitos, reembolsos e histórico só afetam a comunidade autorizada.
Renomear uma moeda não recria saldos. O nome não precisa ser único entre streamers.
A Ludylops preserva seus saldos, histórico, preços e integração existente.

## Inventário obrigatório antes de alterar o esquema

Enumerar todos os acessos a `viewerBalances` e `pointLedger` em repositório,
scripts e integrações. Incluir criação de identidade, associação/fusão de contas,
limpeza de usuários, ranking, ajustes manuais, presença/chat/likes, apostas,
sugestões, resgates, quotes e todos os reembolsos. Uma query esquecida após a
troca da chave pode misturar moedas ou atualizar várias comunidades.

## Contratos e implementação

1. Exigir `CreatorContext` nos serviços econômicos novos; adaptadores legados
   passam explicitamente a comunidade padrão. Nenhum fallback silencioso de
   um creator desconhecido para a Ludylops. Autorização/lifecycle antes de leitura
   ou escrita; o nome da moeda vem da configuração verificada da comunidade.
2. Migrar `viewer_balances` para chave `(creator_id, viewer_id)`, fazendo backfill
   dos saldos existentes para a Ludylops. Revisar índices/FKs, todos os conflitos
   de INSERT, joins e leituras, inclusive ferramentas operacionais.
3. Restringir ledger e idempotência por creator. Um evento externo repetido na
   mesma comunidade não credita duas vezes; o mesmo identificador em outra
   comunidade não deve bloquear o evento legítimo dela.
4. Centralizar créditos, débitos e estornos com atualização de saldo e ledger
   na mesma transação. Manter guardas de saldo suficiente e concorrência;
   não introduzir read-then-write sem proteção.
5. Separar configuração econômica/preços por creator. Revisar o uso compartilhado
   de `streamerbot_counters`: permissões de beta e identidade são globais e não
   podem ser copiadas junto com a configuração da moeda.
6. Na fusão/vinculação de identidades, reconciliar os saldos separadamente para
   cada creator; jamais somar cristais e estrelas. Revisar deletions/ledger e
   a transação de transferência de identidade com todos os escritores concorrentes.
7. Expor saldo/histórico e configuração ao espectador/dono na comunidade correta.
   Usar o nome configurado em valores, formulários e respostas. A autenticação
   Streamer.bot determina o creator; nunca aceitar identidade econômica do corpo.
8. Liberar apenas as operações cujo armazenamento e dependências estejam
   efetivamente isolados. Apostas, catálogo/resgates, sugestões, status de live
   e overlays podem continuar bloqueados até suas entregas específicas. Não
   habilitar toda a integração com uma permissão genérica de `points`.

## Migração e rollout

Preparar SQL, backup, auditoria de contagens/somas, verificação em PostgreSQL
descartável e procedimento de rollback. A chave composta pode invalidar
`ON CONFLICT(viewer_id)` da versão antiga; versões antigas também não filtram
creator. Definir a compatibilidade de deploy antes de permitir o primeiro saldo
de outro creator. Não supor que apenas aplicar DDL antes do merge é seguro.
Migrar código e ferramentas em uma sequência que não permita escritos legados
atingirem moedas novas. O merge continua sendo feito pela usuária.

## Critérios de aceite

- Testes reais de PostgreSQL com dois creators, mesmo viewer e IDs externos
  coincidentes; crédito/débito/estorno e saldo insuficiente sem acesso cruzado.
- Concorrência não permite saldo negativo, crédito duplicado ou reembolso duplo.
- Fusão de contas preserva cada moeda e seu histórico, inclusive com operações
  concorrentes, sem misturar comunidades.
- Creator/módulo desativado, proprietário errado e credencial de outro streamer
  não acessam dados nem realizam efeitos.
- Ranking, saldo e ledger legados preservam os dados da Ludylops após backfill.
- Renomear a moeda altera a apresentação, sem alterar a identidade ou os valores.
- Todas as queries e scripts do inventário foram migrados ou explicitamente
  restringidos à comunidade padrão, com evidência de proteção.
- UI, integração, types, lint, testes e build passam com credenciais de teste.
  Documentar qualquer configuração necessária do Streamer.bot usando a
  documentação oficial vigente antes de orientar a usuária.
