# 036 — Diagnóstico e recuperação por streamer

Issue #226. Implementado; **migração 0029 aplicada e verificada em produção em 2026-09-24, liberando merge/deploy**.

- Heartbeat persistido por comunidade/bridge, com atividade recente de até 90 segundos, sem afirmar presença contínua ou execução da action.
- Dono consulta pendências e registra resultado observado de um resgate em execução. Exige parar os bridges e conferir o resultado local; não reenvia/recoloca actions na fila nem cancela pedidos ainda não assumidos.
- Histórico imutável de resolução; mesma transação de finalização, saldo e estorno. Cliques repetidos não duplicam estorno, e disputas com callbacks conservam um único resultado terminal.
- Schema aditivo, duas tabelas, nenhum backfill/alteração de saldo. Compatibilidade com integração e banco legado preservada.

Ver [operação, migração e ensaio](../docs/creator-integration-operations.md). Testes PostgreSQL cobrem isolamento, heartbeat, expiração, corrida de callbacks, estorno único, rollback, módulos/lifecycle e preservação do legado. A verificação visual usa respostas controladas; o fluxo com Streamer.bot real em produção depende do piloto.

A #225 está em PR independente, sem migração. A barreira de migração foi resolvida: backup novo restaurado e ensaiado, plano restrito aplicado em transação, dados das 40 tabelas existentes preservados e schema de produção igual ao ensaio. A #227 depende da integração destas entregas e de configurar/testar Streamer.bot real com os convidados.

Validação concluída: 1.017 testes gerais aprovados (70 testes PostgreSQL opt-in fora dessa suíte); 14 testes de resgates em PostgreSQL real aprovados separadamente, incluindo seis novos casos desta entrega. Tipos, lint e build aprovados. Navegador desktop/390 px: controles exclusivos do dono, confirmações obrigatórias, resolução/histórico e erro sem dados antigos, com respostas controladas; nenhuma conexão com Streamer.bot real. Migração ensaiada numa cópia completa local, preservando todas as tabelas públicas existentes.
