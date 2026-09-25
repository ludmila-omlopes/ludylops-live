# Piloto com duas comunidades

Preparação da #227, entregue pela #231. O aceite depende de duas contas donas distintas, um espectador em ambas e duas integrações reais. Um teste automatizado, uma migração aplicada ou um heartbeat recente não concluem o piloto.

## Conferência antes do teste

Na revisão que será testada, com o ambiente escolhido carregado:

```sh
npm run db:baseline:check
npm run pilot:check -- teste-1 teste-2
```

`pilot:check` exige dois slugs diferentes. Faz consultas em uma transação PostgreSQL `REPEATABLE READ READ ONLY`, com limites de tempo, e não cria tabelas, comunidades, credenciais, eventos ou movimentações. Não chama Streamer.bot nem altera a última autenticação das credenciais.

O relatório verifica:

- Presença das colunas necessárias ao piloto. Não substitui a auditoria de tipos, índices e restrições do [procedimento de migração](database-migrations.md).
- `CREATOR_ECONOMY_ENABLED=true` e chave mestra válida **no processo que executa o comando**. Uma execução local não comprova as variáveis do deployment na Vercel.
- Comunidades ativas e diferentes da Ludylops, com donos vinculados a contas Google distintas. Dois canais da mesma conta não contam como dois donos.
- Disponibilidade de `points`, `streamerbot`, `ranking` e `redemptions`, incluindo dependências; regra de chat habilitada.
- Exatamente uma credencial ativa por comunidade e possibilidade de decifrá-la com a chave carregada, sem expor ID, segredo ou conteúdo cifrado. Credenciais em transição não substituem a ativa nesta preparação.
- Pelo menos um item ativo, com estoque e referência de action preenchida. A existência e o efeito da action no PC exigem observação.

`recentHeartbeat` é apenas uma observação dos últimos 90 segundos; não bloqueia a preparação nem comprova conexão atual. `configurationReady` resume os requisitos acima; `pilotApproved` permanece sempre `false`. Saídas: **0** configuração verificada, **1** pendências ou falha de consulta, **2** argumentos/URL inválidos. Erros não imprimem URL, parâmetros SQL ou segredos.

## Preparar os participantes

1. Registrar o commit e o deployment efetivamente ativo, horário UTC e origem HTTPS. Confirmar schema e baseline. Revisar a configuração do deployment separadamente da cópia local.
2. A operadora configura a chave mestra pelo gerenciador de segredos, caso esteja ausente, e libera a economia conforme [a sequência de ativação](creator-economy.md#aplicação-e-ativação). Se já existir uma chave, preservá-la: substituição sem recriptografia invalida credenciais existentes. Migração aplicada não autoriza ativação automática.
3. Cada dono entra com sua conta, configura nome/moeda e emite sua credencial. Seguir [credenciais](streamerbot-credentials.md) para variáveis persistidas e a action manual `check-credential.cs`; observar status 200 e a comunidade correspondente. Não compartilhar chaves entre participantes.
4. Configurar o ganho por [mensagem real do YouTube](creator-chat-rewards.md), com quantidades distintas para facilitar a comparação. Salvar a regra não instala o trigger.
5. Cada participante prepara uma action de efeito simples e observável e o [bridge da própria comunidade](creator-redemptions.md#configuração-de-cada-streamer). Em uma única máquina, testes sequenciais exigem parar o bridge anterior e conferir a credencial e a action antes de trocar; não deixar dois bridges apontando por engano para a mesma action.
6. Criar o item pausado, executar a action localmente, depois ativar o item. Registrar preços e saldo inicial do espectador em cada moeda. Rodar novamente a conferência.

Documentação oficial conferida em 2026-09-24: [variáveis persistidas](https://docs.streamer.bot/api/csharp/methods/core/globals/get-global-var), [Execute C# Code](https://docs.streamer.bot/api/sub-actions/core/csharp/execute-csharp-code/), [servidor HTTP](https://docs.streamer.bot/api/http/guide/configuration), [DoAction](https://docs.streamer.bot/api/http/requests/do-action) e [mensagem do YouTube](https://docs.streamer.bot/api/triggers/youtube/chat/message). A resposta HTTP da action e o resultado observado na live devem ser registrados separadamente.

## Roteiro de aceite

Executar com janelas de navegador separadas para dono A, dono B e espectador. Usar moedas e efeitos pequenos de teste; guardar os resultados em local privado. Não colocar e-mails, tokens, headers assinados ou dumps em issues.

| Caso | Execução e resultado exigido |
|---|---|
| Identidade | Mesmo espectador vincula o YouTube e entra nas duas comunidades. Saldo, extrato e ranking apresentam a moeda e os valores próprios. |
| Ganhos | Uma mensagem real no chat A credita somente A; repetir durante o intervalo não credita novamente. Repetir em B, com sua quantidade, sem alterar A. Conferir novamente depois do intervalo. |
| Compra | Comprar um item de A: débito e fila somente em A, efeito somente no Streamer.bot A e conclusão no histórico. Repetir em B. |
| Falha conhecida | Usar uma referência de action inexistente em um item de teste e conferir a resposta real. Se houver rejeição HTTP explícita, verificar uma única devolução e registrar o ID. Se houver aceitação ou timeout, tratar como resultado incerto; não presumir falha apenas porque nenhum efeito apareceu. Não usar uma action com efeito perigoso ou execução parcial para simular falha. |
| Confirmação repetida | Com o mesmo ID terminal e bridge de teste, repetir a confirmação correspondente pelo reconciliador documentado; saldo e efeito não se repetem. Resultado oposto deve ser recusado. |
| Desconexão | Parar o bridge antes da compra, verificar que fica na fila, reiniciar e observar execução única. |
| Resultado incerto | Em teste supervisionado, interromper a confirmação de um resgate já assumido. Parar todos os bridges, conferir o resultado local e seguir a [resolução manual](creator-integration-operations.md#resolver-resultado-incerto). Não reenviar a action. Reiniciar e confirmar que não executa nem estorna duas vezes. |
| Donos | Dono A não consulta nem modifica configurações, catálogo, credenciais ou resoluções de B; repetir com B contra A. Links públicos continuam públicos. |
| Filas | Credencial/bridge A não assume nem conclui o ID de um resgate B. B e seu saldo permanecem intactos. |
| Rotação | Substituir a credencial de teste, configurar a nova e usar o teste de autenticação. Revogar a antiga: a antiga falha e a nova funciona. Não usar compras como teste de autenticação. |
| Módulos | Pausar `redemptions` em A com as filas drenadas: novas operações são recusadas; B segue disponível. Reativar e conferir recuperação. |
| Legado | Conferir comando de saldo, ganho e um resgate da Ludylops com sua configuração existente. Movimentações de teste em A/B não aparecem em pipetz. Comparações de saldo precisam considerar eventos legítimos ocorridos durante a live. |

Não marcar como realizado um caso coberto somente por teste automatizado. Para cada linha, anotar horário UTC, comunidade, ID da operação quando houver, valores antes/depois, resposta recebida, resultado observado, executor e evidência privada. Falha gera uma issue específica e novo teste após a correção.

## Interromper e retomar

Pausar os itens impede novas compras; parar todos os bridges impede novas tentativas locais. Se necessário, desativar o criador/módulo para conter operações, lembrando que isso também bloqueia callbacks e resolução. Registrar pendências antes de retomar, reativar sob supervisão e resolver cada resultado observado sem reexecutar actions. Manter tabelas e histórico; não restaurar backup sobre movimentações posteriores para desfazer o deploy. Não revogar credenciais ou alterar módulos da Ludylops para interromper um teste de outra comunidade.

A decisão de ampliar convites exige todos os casos aceitos, nenhuma falha de isolamento/duplicação pendente e os dois participantes confirmando os efeitos reais. A #227 permanece aberta até esse registro.

## Preparação registrada em 2026-09-24

PRs #229 e #230 integrados na `master` (`fc89549002a96941c19c221cf139c521a7af71fd`); CI da base passou. A pedido da usuária, **Teste 1** (`teste-1`, cristais) e **Teste 2** (`teste-2`, estrelas) foram criadas pelo serviço existente, sob a conta já vinculada da operadora, com identidade visual e módulos padrão. Não foram criadas identidades de login fictícias.

Consulta somente leitura confirmou ambas ativas e as colunas necessárias presentes. Ainda não há credenciais, regra de chat ligada, catálogo ou heartbeat para essas comunidades. As duas têm a mesma conta dona, portanto não satisfazem o teste entre donos. No processo local, economia desligada e chave mestra ausente; **isso não é uma auditoria das variáveis remotas**. Nenhum saldo, credencial, variável de produção ou configuração do Streamer.bot foi alterado nessa preparação. O aceite operacional continua pendente.

As duas URLs públicas responderam HTTP 200 com seus nomes. A entrega de preparação passou em 38 testes focados; suíte geral com 1.060 testes aprovados e 72 testes PostgreSQL opt-in não executados nessa rodada. Tipos, lint e build passaram sem credenciais de produção. O comando foi executado em modo somente leitura no banco configurado, retornando as pendências descritas acima. Não houve teste de execução no Streamer.bot real.
