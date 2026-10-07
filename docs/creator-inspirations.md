# Inspirações por comunidade

Segundo módulo de sugestões levado da Ludylops para as comunidades, no padrão de [Vídeos para reagir](creator-videos.md): votos grátis, moderação pelo dono e isolamento por `creator_id`. A diferença é a vitrine: o dono recomenda criadores diretamente.

## Uso

- O dono ativa **Inspirações** em Módulos. O módulo é instalado na hora e não depende da moeda nem do Streamer.bot.
- `/c/<slug>/inspiracoes`:
  - **Em destaque:** criadores recomendados pelo dono.
  - **Indicados pela comunidade:** quem está logado indica um criador com nome, link do canal e, se quiser, o motivo. As indicações aparecem das mais votadas para as menos votadas.
- **Votos:** quem indica já conta como o primeiro voto. Cada pessoa tem um voto grátis por indicação e pode retirá-lo enquanto ela está em votação.
- **Links:** só `http` e `https`, sem usuário e senha. Os links são guardados como `https://host/caminho`, sem `www`, query nem fragmento. A plataforma (YouTube, Twitch, Kick ou outro site) é detectada pelo endereço.
  - Indicações do público usam `rel="noopener noreferrer nofollow ugc"`.
  - Recomendações do dono usam `rel="noopener noreferrer"`.
- **Limites:**
  - cada pessoa tem no máximo **3 indicações em votação** ao mesmo tempo;
  - o mesmo link, comparado sem diferenciar maiúsculas, não entra duas vezes numa comunidade enquanto estiver em votação ou em destaque;
  - um criador recusado pode ser indicado de novo;
  - comunidades diferentes têm listas independentes.
- **Inspirações, no Creator Hub:**
  - o dono recomenda um criador, que entra direto no destaque;
  - destaca indicações do público, as tira do destaque ou as recusa;
  - devolve recusadas à votação.
  - Mudar o status mantém os votos. Recusados não aparecem para o público.

## Autorização e persistência

- `POST /api/c/<slug>/inspirations` (indicar) e `POST`/`DELETE /api/c/<slug>/inspirations/<id>/vote` (votar e retirar o voto). A ordem é: origem confiável, comunidade e módulo disponíveis (404 antes de qualquer sessão ou banco), sessão. Quem indica e vota vem da sessão, nunca do corpo.
- `GET`/`POST`/`PATCH /api/me/creator-area/<id>/inspirations`: sessão do dono e origem confiável para escrita. `POST` recomenda um criador; `PATCH` muda o status.
- Cada operação repete, dentro da transação, a checagem de comunidade ativa, dono e módulo (`canUseModules(…, "inspirations")`), com `FOR SHARE` no criador e no módulo. Novas indicações usam um advisory lock por comunidade; votos bloqueiam a linha da indicação.
- **Sem migração.** Os dados ficam em `creator_suggestions` e `creator_suggestion_boosts`, que já tinham `creator_id`. O voto grátis usa o mesmo ID determinístico de Vídeos (`community-votes.ts`).
- **O fluxo da Ludylops ficou preso a `creator_ludylops`** em todas as leituras e gravações: listas, destaques, criação, cadastro e edição pelo admin, boost e exclusão. Ele continua cobrando pipetz e agora exige Pontos explicitamente nas rotas `/api/me/creator-suggestions` e na página `/indicacoes`. O cadastro pelo admin (`/api/admin/creator-suggestions`) continua exigindo só o módulo.

Na [fusão de contas](creator-hub.md#fusão-de-contas), as sugestões e os votos grátis acompanham a identidade final.

## Implantação

1. Implantar este código. Os filtros do legado precisam estar no ar antes de existir qualquer inspiração de outra comunidade. Depois disso, um rollback precisa manter esses filtros.
2. Comunidades que escolheram Inspirações enquanto ele estava “Em breve” têm a linha `requested`. Para ativá-las, rode no banco, após revisão:

   ```sql
   UPDATE creator_modules SET status = 'installed', updated_at = now()
   WHERE module_key = 'creator_suggestions' AND status = 'requested';
   ```

   Inspirações não tem dependências, então a troca não deixa nenhum módulo indisponível. Sem esse passo, o criador também ativa ao salvar de novo em Módulos.

## Fora desta entrega

- Boost com a moeda da comunidade, para comunidades com Pontos ativo.
- Edição de indicações e busca automática de nome pelo link do canal (a Ludylops usa a YouTube Data API só no cadastro pelo admin).
