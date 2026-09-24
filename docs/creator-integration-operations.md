# Integração e resolução de resgates

Entrega #226. **A migração 0029 ainda não foi aplicada em produção. Aplicar antes de integrar/implantar esta entrega.**

## Conferir a integração

O dono encontra **Integração e resgates pendentes** em `/c/<slug>/resgates`. Use **Consultar integração e pendências** depois de iniciar o bridge ou investigar um resgate. A consulta é manual, sem cache. Mostra os 20 bridges com atividade mais recente, até 100 resgates pendentes (mais antigos primeiro) e as últimas 50 resoluções manuais.

- **Última autenticação**, nas credenciais: uma requisição com aquela chave foi autenticada. Pode ser um teste ou qualquer outra operação; não equivale a heartbeat.
- **Atividade recente**: o servidor recebeu um heartbeat do bridge nos 90 segundos anteriores à consulta. O bridge já envia esse pedido, por padrão a cada 30 segundos. Não comprova conexão atual, disponibilidade do Streamer.bot ou execução de uma action. Intervalos personalizados maiores que 90 segundos podem aparecer sem atividade recente entre pedidos.
- **Na fila**: ainda não foi assumido por um bridge. Confira o processo, a credencial da comunidade e os logs. Este fluxo não cancela itens na fila nem os executa manualmente.
- **Em execução**: um bridge já assumiu o resgate, mas não confirmou o resultado. Uma queda depois de tocar o efeito pode deixar esse estado; não reenvie a action sem conferir.
- **Concluído**: existe uma confirmação do bridge ou resolução do dono. A confirmação HTTP do bridge indica aceitação da action, não prova o resultado visual de todas as subações.

Nenhum ajuste de credencial ou action existente da Ludylops é necessário. O heartbeat da nova integração mantém o mesmo protocolo, agora persistido por comunidade e ID do bridge; o heartbeat legado permanece separado.

## Resolver resultado incerto

1. Pare **todas** as instâncias do bridge daquela comunidade. Aguarde o encerramento do processo e de qualquer action em andamento no Streamer.bot. Confira logs e resultado na transmissão. A aplicação depende dessa observação; não consegue verificar o resultado local sozinha.
2. Selecione **Resolver** no resgate em execução, conferindo seu ID. Confirme que parou os bridges e verificou o resultado.
3. Se executou, escolha **Executou: registrar conclusão**. Se falhou e você decidiu devolver a moeda, escolha **Falhou: devolver a moeda**. Registre o que foi observado; essa nota acompanha o resultado, portanto não inclua segredos.
4. Use **Registrar resolução**. Isso nunca executa nem recoloca a action na fila. A falha devolve exatamente o custo ao espectador daquela comunidade, uma única vez. O estoque continua consumido para que você revise possíveis efeitos parciais antes de repor unidades.
5. Confira a resolução e o histórico/saldo. Reinicie o bridge. Se a resposta da gravação se perder, reenviar o mesmo resultado e nota devolve o registro existente, sem novo estorno. Um resultado/nota diferente gera conflito; uma confirmação concorrente já finalizada também exige atualização.

O dono, a comunidade e todos os módulos necessários precisam continuar ativos, com a economia liberada. Desativação bloqueia leitura operacional e resolução; nesses casos a administração precisa avaliar a reativação antes de retomar. A recuperação administrativa de credenciais continua separada.

## Autorização e atomicidade

`GET/POST /api/me/creator-area/<id>/integration-operations` usa o viewer ativo da sessão e exige origem confiável nas mutações. O corpo é estrito, sem identidade/creator/bridge escolhidos pelo cliente. Requer resultado observado, nota e as duas confirmações. Proprietário, comunidade e dependências são revalidados dentro da transação.

Recuperação e callback do bridge compartilham o bloqueio do resgate e a mesma finalização financeira. Histórico manual, status, saldo e estorno são atômicos; erro em qualquer gravação reverte todos. A identificação histórica do dono é texto imutável, sem FK para `users`, para não impedir nem reescrever uma fusão posterior de contas. Consultas são exclusivas do dono; espectadores não veem esses controles nem resoluções de outras comunidades.

## Migração e implantação

`0029_creator_integration_operations.sql` acrescenta somente:

- `creator_bridge_status`: três colunas, chave composta `(creator_id, bridge_id)`, FK para criadores e bloqueio do criador legado.
- `creator_redemption_resolutions`: seis colunas, uma resolução por resgate, FKs para criador e resgate, resultado restrito a conclusão/falha e índice de histórico por criador/data.

Não altera tabelas existentes, não transfere saldos e não faz backfill. O schema Drizzle e o snapshot acompanham o SQL. Aplicar conforme [o procedimento do banco](database-migrations.md), com inventário atual, backup novo e revisão do escopo. Não reproduzir migrações antigas nem executar push amplo com diferenças inesperadas. A comparação/aplicação deve limitar-se às duas tabelas novas.

**Ordem:** migração aprovada → verificação do schema e preservação dos dados → merge/deploy → teste de heartbeat e recuperação com duas comunidades. Sem as tabelas, as operações novas retornam indisponibilidade; não criam armazenamento demo nem aplicam DDL automaticamente. Não publicar antes da migração: os novos heartbeats precisariam da tabela.

Rollback de código não exige apagar as tabelas aditivas. Não remova histórico/resoluções ou reverta saldos para desfazer o deploy; resultados já registrados permanecem terminais.

### Ensaio local em 2026-09-24

Backup completo `before-0027-0028.dump` restaurado em **novo banco local** `operations_restore_20260924`, em loopback. SHA-256 da origem: `0f21de2e01877d929ea7568aa99a3ce715d4ce212b8dbef809f937c5ec03b8b6`. As mudanças 0027/0028, já aplicadas em produção, prepararam a cópia; em seguida a 0029 foi aplicada e verificada numa transação local.

Contagens e fingerprints integrais de **todas as tabelas públicas preexistentes** permaneceram iguais. As tabelas novas ficaram vazias. SQL 0029 ensaiado: SHA-256 `3dae9ec1ebae942880f5c6e8ce162614da2785290b95d6ead67d205581634937`. Evidência privada em `%LOCALAPPDATA%/Codex/DatabaseBackups/ludylops-live/20260924-operations-0029/`. O cluster foi encerrado depois do ensaio. **Nenhuma conexão ou alteração de produção nesta etapa.** O backup antigo serve ao ensaio, não substitui um backup atual antes da aplicação real.
