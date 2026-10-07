# Apostas por comunidade

Último módulo levado da Ludylops para as comunidades, depois de [Vídeos para reagir](creator-videos.md), [Inspirações](creator-inspirations.md) e [Jogos](creator-games.md). O público aposta a moeda da comunidade pela página, sem Streamer.bot.

## Uso

- O dono ativa **Apostas** em Módulos. Escolher Apostas inclui a Moeda. As duas só são instaladas na hora quando `CREATOR_ECONOMY_ENABLED=true`; sem a economia ligada, ficam “Em breve” (`requested`).
- **Apostas, no Creator Hub** (`/comunidades/<slug>/apostas`):
  - **Abrir uma aposta:** pergunta (5 a 200 caracteres), de 2 a 6 opções diferentes (até 80 caracteres cada) e o prazo para aceitar apostas, de 30 minutos a 7 dias. A API aceita de 5 minutos a 7 dias. A aposta abre na hora.
  - **Encerrar apostas:** fecha a aposta antes do prazo. Passado o prazo, ela também deixa de aceitar apostas, mas continua em andamento até o resultado.
  - **Definir resultado:** vale para apostas abertas ou encerradas. Quem acertou divide o pote inteiro, na proporção do que apostou. O cálculo é o `calculateBetPayouts` da Ludylops: arredonda para baixo e distribui as sobras pelos maiores restos. Se ninguém acertou, todas as apostas são devolvidas.
  - **Cancelar e devolver:** devolve todas as apostas.
- `/c/<slug>/apostas`:
  - **Valendo agora:** apostas abertas ou aguardando resultado, com o pote de cada opção.
  - **Já decididas:** as últimas 20, com o resultado e o que cada pessoa ganhou ou recebeu de volta.
  - Quem está logado escolhe uma opção e um valor: no mínimo `config_json.minBet` do módulo (padrão 10), no máximo 100.000 por vez, limitado ao saldo. Apostar de novo só aumenta a aposta na mesma opção.
- Na moeda, a aposta é um débito com `kind = "bet"`; o prêmio, `bet_payout`; a devolução, `bet_refund`. Os três aparecem no extrato de `/c/<slug>/moeda` com a pergunta no motivo. A API genérica de ajustes só estorna `debit`, então não desfaz nenhum deles.
- A página e o link do início só aparecem com o módulo disponível e a economia ligada.

## Autorização e persistência

- `POST /api/c/<slug>/bets/<id>` com `{ placementId, optionId, amount }`.
  - A ordem é: origem confiável, comunidade e módulo disponíveis (404 antes de qualquer sessão ou banco), sessão (401).
  - Quem aposta vem da sessão, nunca do corpo.
  - O navegador gera um `placementId` por aposta e o reaproveita se a pessoa tentar de novo. A chave da operação é `bet:<aposta>:<placementId>`, então repetir o mesmo pedido nunca cobra duas vezes.
- `GET`/`POST`/`PATCH /api/me/creator-area/<id>/bets`: sessão do dono e origem confiável para escrita.
  - `POST` abre a aposta com `{ question, options, closesInMinutes }`.
  - `PATCH` recebe `{ betId, action: "lock" }`, `{ betId, action: "cancel" }` ou `{ betId, action: "resolve", winningOptionId }`.
- **Transações:** cada operação repete a checagem de comunidade ativa, dono e módulo (`canUseModules(…, "bets")`), com `FOR SHARE` no criador e nos módulos de Apostas e Moeda. Apostas, resultados e cancelamentos começam pelo lock compartilhado de identidade, como toda operação da moeda, e travam a linha da aposta (`FOR UPDATE`). Assim, apostas simultâneas na mesma pergunta e resultados repetidos acontecem um de cada vez.
- **Saldo:** o débito trava o saldo e nunca o deixa negativo. Se a pessoa já apostou em outra opção, a transação inteira é desfeita, inclusive o débito.
- **Prêmios e devoluções:** usam as chaves `bet-payout:<entrada>` e `bet-refund:<entrada>`, creditadas uma única vez.
- **Armazenamento:** reaproveita `bets`, `bet_options` e `bet_entries`, que já têm `creator_id`. A unicidade `(bet_id, viewer_id)` mantém uma entrada por pessoa em cada pergunta. Não há migração.
- **Legado da Ludylops:** `listBets`, `listAdminBets`, `createBet`, `placeBetForViewer`, `lockBet`, `resolveBet` e `cancelBet` ficaram presos a `creator_ludylops`. A Ludylops continua apostando pipetz, com `/obs/bets` e o comando de aposta do chat.
- Na [fusão de contas](creator-hub.md#fusão-de-contas), as apostas acompanham a identidade final, como as da Ludylops. A fusão continua recusada quando as duas identidades apostaram na mesma pergunta.

## Implantação

1. Implantar este código. Não há migração. Os filtros do legado precisam estar no ar antes de existir qualquer aposta de outra comunidade. Depois disso, um rollback precisa manter esses filtros.
2. Comunidades que escolheram Apostas enquanto o módulo estava “Em breve” têm a linha `requested`. Com a economia ligada, para ativá-las, rode no banco, após revisão:

   ```sql
   UPDATE creator_modules SET status = 'installed', updated_at = now()
   WHERE module_key = 'bets' AND status = 'requested'
     AND creator_id IN (SELECT creator_id FROM creator_modules WHERE module_key = 'points' AND status = 'installed');
   ```

   Apostas dependem da Moeda; onde ela não está instalada, a linha continua `requested`. Sem esse passo, o criador também ativa ao salvar de novo em Módulos.

## Fora desta entrega

- Overlay `/obs/bets` e comando de aposta no chat para as comunidades.
- Opções sugeridas pelo público (`option_mode = "open"`), que continuam só na Ludylops.
