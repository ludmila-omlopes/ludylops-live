# Autorização e dependências dos módulos (#185)

Um módulo fica disponível somente quando o criador está ativo, existe exatamente
uma instalação com status `installed` e todas as dependências, inclusive
transitivas, também estão instaladas. Ausência, duplicidade, status desconhecido,
`disabled` e `archived` impedem o acesso. Ciclos e dependências desconhecidas
invalidam o catálogo.

## Autoridade, disponibilidade e isolamento

- `module-policy.ts` calcula disponibilidade e transições sem banco ou React.
- `module-access.ts` combina essa política com o ciclo de vida e a autorização
  para operar os dados. Identidade pública vem do registro de criadores/domínios;
  integrações usam o ID derivado da credencial verificada.
- O modo legado do Streamer.bot e a bridge continuam vinculados à Ludylops.
  Host, query e corpo não escolhem outro criador para uma credencial.
- A política nunca tenta a comunidade padrão depois de uma negativa. Falhas de
  consulta geram indisponibilidade, sem recuperar uma instalação fictícia.
- Sessão, perfil de administrador/owner, origem e assinatura continuam sendo
  verificações obrigatórias nos respectivos adaptadores.
- **Instalação não comprova isolamento.** Somente leitura e criação de frases
  (`quotes.read`, `quotes.create`) estão liberadas para outros criadores. Exibição,
  cobrança, fila, controle de OBS e demais módulos continuam bloqueados fora da
  Ludylops, mesmo quando instalados.

A política é verificada na entrada de cada requisição. Desativar um módulo impede
novas requisições; não cancela uma operação que já passou pela autorização.

## Matriz de cobertura

O inventário executável em
[`module-entry-points.ts`](../src/lib/creators/module-entry-points.ts) relaciona os
prefixos completos, páginas, integrações e exceções. Testes percorrem os arquivos
reais: uma nova rota sem classificação ou um caminho inexistente no catálogo
interrompe a validação.

| Recurso | Páginas e admin | APIs públicas/admin | OBS e integrações | Isolamento operacional |
|---|---|---|---|---|
| Pontos | `/me`, preços, airdrop, vínculos | saldo, viewer individual, ajustes | eventos, link, pontos; likes/inscritos com OBS | Ludylops |
| Ranking | `/ranking`, ranking no admin | `/api/leaderboard`, `/api/viewers` | — | Ludylops |
| Resgates | `/me`, catálogo, fila e status da bridge | catálogo, resgates, dashboard completo | todos os handlers assinados da bridge | Ludylops |
| Apostas | `/apostas`, resumo inicial, admin | apostas e operações por aposta | `/obs/bets`, comando de aposta | Ludylops |
| Produtos | `/produtinhos`, admin | recomendações | — | Ludylops |
| Jogos | `/jogos`, admin | sugestões, boosts, busca | sincronização Steam autenticada | Ludylops |
| Vídeos | `/videos`, admin | sugestões e boosts | — | Ludylops |
| Criadores indicados | `/indicacoes`, admin | sugestões e boosts | — | Ludylops |
| Frases | `/quotes`, `/c/[creatorSlug]/quotes`, controle no admin | solicitação de exibição | `/obs/quotes`, comandos de frases | Ler/criar por criador; caminhos pagos/OBS só Ludylops |
| OBS | overlays, roleta e metas no admin | controle e consultas `/api/obs/*` | bets, likes, quotes, subscribers e wheel | Ludylops |
| Streamer.bot | `/contadores`, jogo atual, estado da live, scripts e contadores no admin | configurações e contadores | todos os handlers, verificação de credencial | Autenticação por criador; operações conforme as linhas acima |

Dependências adicionais dos adaptadores:

- `/me` e `/api/me` apresentam histórico/catálogo e exigem pontos e resgates.
- A leitura de saldo usa `getViewerPoints`, que não consulta resgates nem histórico
  do ledger. Apostas, sugestões e o comando de pontos usam essa projeção.
- Likes e alertas de inscritos exigem pontos e OBS. O evento
  `like_count_update` verifica OBS antes de processar recompensas; eventos de
  presença continuam vinculados a pontos e Streamer.bot.
- Vínculos administrados exigem pontos e Streamer.bot. Manutenção de identidade
  pode reconciliar históricos já existentes; isso não habilita operações de
  consumo nos módulos desativados.
- O catálogo mantém as dependências de frases em pontos, Streamer.bot e OBS.
  Elas não foram removidas para ampliar artificialmente o piloto.

Exceções explícitas: autenticação e proteção Google, saúde pública, catálogo de
referência PS Plus, criação de comunidades, configuração do beta, administração
global do owner, termos, privacidade e apresentação de identidade/branding.
Essas exceções não concedem acesso aos dados operacionais dos módulos.

## Alterações de configuração

Ativar exige dependências válidas. Desativar ou arquivar exige que todos os
dependentes instalados, inclusive transitivos, já tenham sido desativados.
Nenhuma dependência é ativada ou desativada automaticamente.

Por exemplo, para desativar OBS, desative primeiro frases. Para ativar frases em
uma comunidade sem instalações, ative pontos, Streamer.bot e OBS antes de frases.
O owner recebe HTTP 409 com a explicação e a lista de bloqueadores quando a ordem
é inválida. Instalações antigas inválidas aparecem com suas dependências ausentes
e permanecem indisponíveis até serem corrigidas.

As alterações reais usam uma transação com `SELECT ... FOR UPDATE` na linha do
criador, seguida da leitura de todas as instalações e da validação. O bloqueio
serializa mudanças simultâneas do mesmo criador e também a emissão/rotação de
credenciais. Rejeições preservam configuração, IDs, datas de instalação e outros
criadores. O modo demonstrativo aplica a mesma política aos objetos registrados.

## Validação e operação

- Testes de política: dependências transitivas, ciclos, estados inválidos,
  duplicidades, navegação e reparação ordenada.
- Testes de fronteira executam todos os handlers HTTP classificados e todas as
  páginas de módulos com recursos indisponíveis. Página inicial e admin não
  consultam os recursos desativados.
- Integrações verificam credenciais válidas, modo legado, hints falsificados e
  ausência de efeitos após uma negativa. O owner mantém proteção de perfil e
  origem e retorna conflitos estruturados.
- `module-transitions.postgres.test.ts` usa somente um banco local dedicado
  `modules_185_test`, ativado por `MODULE_TEST_DATABASE_URL`; nunca lê `.env` nem
  `DATABASE_URL`. Cria/remove um schema próprio, testa dez disputas simultâneas,
  rollback e preservação de configurações e de outro criador. O transporte local
  compatível com Neon usa `MODULE_TEST_WS_PORT` (padrão 55479).
- Rodar `npm test`, `npm run typecheck`, `npm run lint` e `npm run build` antes de
  publicar. Para validar sem integrações reais, usar ambiente demonstrativo
  isolado, sem carregar o `.env` de produção.

**Sem nova migração ou alteração dos scripts do Streamer.bot.** Configurações
válidas já instaladas mantêm seu funcionamento. O merge deste PR não conclui
as migrações de economia, live, OBS e administração por dono necessárias para
abrir o produto a outros streamers.

Validação em 2026-09-22: 726 testes passaram, incluindo os dois testes reais de
PostgreSQL (dez disputas concorrentes), além de lint, typecheck e build em modo
demonstrativo isolado. A auditoria somente de leitura do banco de produção
encontrou dois criadores sem dependências ausentes; a Ludylops estava ativa com
todos os módulos disponíveis.
O smoke HTTP local passou em 18 páginas/APIs, incluindo OBS, e confirmou três
negativas para seletores de criador inexistente (21 verificações no total).
