# Histórico de resgates e execução

Entrega da [#6](https://github.com/ludmila-omlopes/ludylops-live/issues/6).

## Operação

Em **Admin → Pipetz → Fila de resgates**, os 100 resgates mais recentes podem ser
filtrados por status e por pessoa, item ou ID. Abra um resgate para consultar:

- Entrada na fila e origem da solicitação.
- Bridge que assumiu a execução, horário e quantidade de execuções assumidas.
- Confirmação de conclusão e observação enviada pela bridge.
- Falha e motivo informado.

O botão **Atualizar resgates** busca o estado atual. A consulta exige administrador
e o módulo de resgates disponível. Ela continua restrita à comunidade legada;
isso não libera catálogo ou resgates para moedas de outros streamers.

## Precisão do histórico

`claimed_at` é registrado na mesma atualização condicional que assume a execução.
`execution_note` é gravado com a primeira conclusão. Repetições não trocam a nota,
o horário ou o status terminal. Falha, horário, estorno e ledger mantêm a transação
existente: uma falha na gravação desfaz todas essas alterações.

Resgates anteriores não ganham horários inventados. Uma bridge conhecida sem
`claimed_at` aparece com **Horário não registrado**. O cancelamento legado também
não tem timestamp/motivo próprios. A máquina de estados atual aceita uma tomada
de execução e um resultado terminal; não existe reabertura/reexecução. Ao adicionar
tentativas futuras, será necessário um registro de eventos por tentativa, em vez
de sobrescrever esses campos.

A conclusão significa que a bridge confirmou a chamada ao Streamer.bot. Ela não
comprova que todas as subações terminaram ou que um efeito apareceu no OBS. Não
se registra cada requisição de polling ou repetição de callback. Não se infere
um estorno de registros históricos apenas pelo status de falha.

## Migração antes do deploy

Aplicar **somente** `drizzle/0027_redemption_execution_audit.sql`, depois de conferir
o banco alvo e obter autorização. A migração acrescenta duas colunas nullable;
não altera valores existentes, saldos, preços ou timestamps anteriores.
Foi aplicada apenas em PostgreSQL local descartável nesta implementação.

Sequência: backup/verificação → migração 0027 → conferência das duas colunas e
contagem de resgates → merge/deploy → teste de um resgate controlado. O código
novo seleciona as colunas, portanto a migração deve preceder o deploy. Não use
`db:push` para aplicar outras alterações incidentais.

O código antigo continua funcionando com as colunas adicionais; em um rollback,
reverta o código e preserve as colunas e os dados de auditoria. Não remova colunas
enquanto houver instâncias novas atendendo requisições.

A bridge já envia `executionNote` no callback de conclusão; não é necessário
trocar ações ou configurar o Streamer.bot para esta entrega.

## Verificação

- 983 testes gerais passaram; 45 testes PostgreSQL opcionais foram ignorados
  nessa suíte. Os 4 específicos acima passaram separadamente no banco local.
  Tipagem, lint e build passaram.
- Interface verificada em Edge, desktop e 390 px: filtros, busca por ID, horário
  legado desconhecido, atualização após claim/falha, acesso restrito a admin,
  sem erro JavaScript ou rolagem horizontal. Os envios foram simulados no demo.
- Testes de projeção cobrem estados sem inventar horários históricos.
- O handler assinado de conclusão é testado para encaminhar a nota de execução.
- Quatro testes PostgreSQL aplicam o SQL real em schema descartável, preservam
  registros antigos e verificam concorrência, repetição, rollback, limite e
  isolamento da comunidade legada. Executar `src/lib/redemptions/audit.postgres.test.ts`
  com `MODULE_TEST_DATABASE_URL` apontando exclusivamente para o banco local
  `modules_185_test` em `127.0.0.1` e o proxy WebSocket de testes existente.
