# Vídeos para reagir por comunidade

Primeiro módulo da Ludylops levado para as comunidades, depois dos produtos. É também o padrão para jogos e inspirações: votos grátis, moderação pelo dono e isolamento por `creator_id`.

## Uso

- O dono ativa **Vídeos para reagir** em Módulos. O módulo é instalado na hora e não depende da moeda nem do Streamer.bot.
- `/c/<slug>/videos`: quem está logado cola um link do YouTube e, se quiser, explica por que o vídeo vale a reação. Título, canal e miniatura vêm do oEmbed do YouTube. A miniatura é montada pelo ID do vídeo em `i.ytimg.com`, sem usar a URL devolvida.
- Quem sugere já conta como o primeiro voto. Cada pessoa tem **um voto grátis** por vídeo e pode retirá-lo enquanto o vídeo está na fila.
- A fila mostra os mais votados primeiro e, abaixo, os vídeos que já ganharam reação. Recusados não aparecem para o público.
- Cada pessoa tem no máximo **3 vídeos na fila** ao mesmo tempo. O mesmo vídeo não entra duas vezes na fila de uma comunidade enquanto estiver na fila ou já tiver ganhado reação. Um vídeo recusado pode ser sugerido de novo. Comunidades diferentes têm filas independentes.
- **Vídeos para reagir**, no Creator Hub: o dono marca como reagido, recusa ou devolve à fila. Mudar o status mantém os votos.

## Autorização e persistência

- `POST /api/c/<slug>/videos` (sugerir) e `POST`/`DELETE /api/c/<slug>/videos/<id>/vote` (votar e retirar o voto). A ordem é: origem confiável, comunidade e módulo disponíveis (404 antes de qualquer sessão ou banco), sessão. Quem vota vem da sessão, nunca do corpo.
- `GET`/`PATCH /api/me/creator-area/<id>/videos`: sessão do dono e origem confiável para escrita.
- Cada operação repete, dentro da transação, a checagem de comunidade ativa, dono e módulo (`canUseModules(…, "videos")`), com `FOR SHARE` no criador e no módulo.
- Sugestões usam um advisory lock por comunidade, então duplicidade e limite valem também sob concorrência. Votos bloqueiam a linha do vídeo.
- **Sem migração.** Os dados ficam em `video_suggestions` e `video_suggestion_boosts`, que já tinham `creator_id`. O voto grátis é uma linha de boost com `amount = 1` e ID determinístico (`vote_` + SHA-256 de vídeo e pessoa), então a chave primária garante um voto por pessoa. Boosts pagos usam IDs aleatórios e nunca se confundem com votos.
- **O fluxo da Ludylops ficou preso a `creator_ludylops`** em todas as leituras e gravações: lista, criação, boost e status. Ele continua cobrando pipetz e agora exige Pontos explicitamente nas rotas `/api/me/video-suggestions` e na página `/videos`.

Na [fusão de contas](creator-hub.md#fusão-de-contas), as sugestões e os votos grátis acompanham a identidade final.

## Implantação

1. Implantar este código. Os filtros do legado precisam estar no ar antes de existir qualquer vídeo de outra comunidade. Depois disso, um rollback precisa manter esses filtros, porque versões anteriores leem a tabela inteira.
2. Comunidades que escolheram Vídeos enquanto ele estava “Em breve” têm a linha `requested`. Para ativá-las, rode no banco, após revisão:

   ```sql
   UPDATE creator_modules SET status = 'installed', updated_at = now()
   WHERE module_key = 'video_suggestions' AND status = 'requested';
   ```

   Vídeos não tem dependências, então a troca não deixa nenhum módulo indisponível. Sem esse passo, o criador também ativa ao salvar de novo em Módulos.

## Fora desta entrega

- Boost com a moeda da comunidade, para comunidades com Pontos ativo.
- Busca, paginação e edição de sugestões. A fila mostra até 100 vídeos e os 30 últimos reagidos.
