# Jogos por comunidade

Terceiro módulo de sugestões levado da Ludylops para as comunidades, no padrão de [Vídeos para reagir](creator-videos.md) e [Inspirações](creator-inspirations.md): votos grátis, moderação pelo dono e isolamento por `creator_id`.

## Uso

- O dono ativa **Sugestões de jogos** em Módulos. O módulo é instalado na hora e não depende da moeda nem do Streamer.bot.
- `/c/<slug>/jogos`:
  - **Vai jogar:** os jogos que o dono escolheu.
  - **Em votação:** maior prioridade primeiro, considerando votos e o bônus para jogos que o criador já possui.
  - **Já jogados:** os jogos marcados como jogados.
- **Sugerir:** quem está logado busca o jogo pelo nome e escolhe um resultado do IGDB. Se o jogo não aparece, ou se a busca está fora do ar, dá para sugerir só pelo nome digitado. O motivo é opcional.
- **Dados do jogo:** nome, capa, ano, plataformas e gêneros vêm do IGDB, **lidos no servidor pelo ID escolhido**; o corpo da requisição nunca define nome nem capa. A duração da história vem do HowLongToBeat; se a consulta falhar, a sugestão entra sem ela.
- **Votos:** quem sugere já conta como o primeiro voto. Cada pessoa tem um voto grátis por jogo e pode retirá-lo enquanto o jogo está em votação.
- **Limites:**
  - cada pessoa tem no máximo **3 jogos em votação** ao mesmo tempo;
  - o mesmo jogo (mesmo ID do IGDB ou mesmo nome normalizado) não entra duas vezes numa comunidade enquanto estiver em votação, na lista para jogar ou já jogado;
  - um jogo recusado pode ser sugerido de novo;
  - comunidades diferentes têm listas independentes.
- **Jogos, no Creator Hub:** o dono escolhe o que vai jogar, marca como jogado, devolve à votação ou recusa. Mudar o status mantém os votos. Recusados não aparecem para o público.
- **Já possuo:** o dono marca ou desmarca qualquer jogo, independentemente do status. A marcação aparece para o público e pertence apenas àquela comunidade.
- **Bônus para jogos que já possuo:** cada dono define um multiplicador (0 a 10, padrão 1). A prioridade é o número de votos multiplicado por esse valor e arredondado; 1 mantém a prioridade original. O bônus não altera votos nem saldos. Ao desmarcar, o jogo volta à prioridade sem esse bônus. Na Ludylops, ele se combina por multiplicação com os bônus existentes de PS Plus, duração e indicação do admin.

## Autorização e persistência

- `GET /api/c/<slug>/games/search?q=`, `POST /api/c/<slug>/games` e `POST`/`DELETE /api/c/<slug>/games/<id>/vote`.
  - A ordem é: origem confiável nas escritas, comunidade e módulo disponíveis (404 antes de qualquer sessão, banco ou IGDB), sessão.
  - A busca também exige sessão, para não expor a cota do IGDB a visitantes anônimos.
  - Quem sugere e vota vem da sessão, nunca do corpo.
- `GET`/`PATCH /api/me/creator-area/<id>/games`: sessão do dono e origem confiável para escrita.
- No `PATCH`, `{ suggestionId, isOwned }` altera a posse; `{ ownedGameMultiplier }` configura o bônus e retorna a lista reordenada. O status pode ser alterado junto da posse. A configuração de bônus deve ser enviada separadamente.
- **Transações:** cada operação repete, dentro da transação, a checagem de comunidade ativa, dono e módulo (`canUseModules(…, "games")`), com `FOR SHARE` no criador e no módulo. Sugestões usam um advisory lock por comunidade; votos bloqueiam a linha do jogo.
- **Persistência:** `game_suggestions.is_owned` é um booleano com padrão `false`. O multiplicador das comunidades fica em `creator_modules.config_json.ownedGameMultiplier`, preservando as demais configurações, com bloqueio de escrita do módulo. Na Ludylops, fica no contador `game_boost_owned`, como os bônus existentes. O voto grátis usa o mesmo ID determinístico de Vídeos e Inspirações.
- **Legado da Ludylops:** o fluxo ficou preso a `creator_ludylops` em todas as leituras e gravações:
  - lista, criação, boost, status e edição do catálogo;
  - atualização do HowLongToBeat, do PS Plus e dos preços da Steam, inclusive as sincronizações em lote.

  Ele continua cobrando pipetz e agora exige Pontos explicitamente nas rotas `/api/me/game-suggestions` e na página `/jogos`. A busca `/api/games/search` continua só da Ludylops.
- O script `backfill:hltb` continua percorrendo todas as sugestões. Ele só preenche a duração vinda do HowLongToBeat, que é pública, então também completa os jogos das comunidades.

Na [fusão de contas](creator-hub.md#fusão-de-contas), as sugestões e os votos grátis acompanham a identidade final.

## Implantação

1. Revisar `drizzle/0030_game_owned.sql`: a única alteração é adicionar `game_suggestions.is_owned boolean DEFAULT false NOT NULL`. Aplicar essa alteração antes do código, seguindo [o fluxo de banco](database-migrations.md). A geração do arquivo não aplica a coluna ao banco. Jogos existentes começam desmarcados; nenhum voto muda.
2. Implantar este código. Os filtros do legado precisam estar no ar antes de existir qualquer jogo de outra comunidade. Depois disso, um rollback precisa manter esses filtros. A coluna nova é compatível com o código anterior e não precisa ser removida num rollback.
3. Comunidades que escolheram Jogos enquanto ele estava “Em breve” têm a linha `requested`. Para ativá-las, rode no banco, após revisão:

   ```sql
   UPDATE creator_modules SET status = 'installed', updated_at = now()
   WHERE module_key = 'game_suggestions' AND status = 'requested';
   ```

   Jogos não tem dependências, então a troca não deixa nenhum módulo indisponível. Sem esse passo, o criador também ativa ao salvar de novo em Módulos.

## Fora desta entrega

- Boost com a moeda da comunidade, para comunidades com Pontos ativo.
- Disponibilidade no PS Plus e preço na Steam, que continuam só na Ludylops.
