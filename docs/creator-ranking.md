# Ranking da moeda de cada comunidade

Entrega [#209](https://github.com/ludmila-omlopes/ludylops-live/issues/209), parte da
[#203](https://github.com/ludmila-omlopes/ludylops-live/issues/203).

## Comportamento

- `/c/<slug>/ranking` mostra até 100 participantes com saldo positivo naquela
  comunidade, do maior saldo para o menor. Empates usam o ID do canal do YouTube
  em ordem estável; as posições continuam sequenciais.
- A consulta é pública. Cada entrada contém apenas posição, nome, identificador
  público do YouTube quando válido e distinto do nome, e saldo atual. Não inclui
  e-mail, IDs internos, totais acumulados, motivos ou histórico de movimentações.
- A exclusão global existente (`users.excludeFromRanking`) continua valendo.
  Identidades sintéticas também ficam de fora. O fluxo existente exclui contas
  sem e-mail vinculado e e-mails administrativos; receber uma moeda no chat,
  sozinho, não torna o canal elegível para o ranking.
- O nome da moeda vem de `points.configJson.currencyLabel`. Renomear a moeda não
  altera valores. Um ranking vazio não usa os participantes demo ou os pipetz.
- Há links na comunidade e na consulta da própria moeda. Consultar o histórico
  individual continua exigindo autenticação.

## Contrato e autorização

`GET /api/c/<slug>/ranking` responde `{ ok: true, data: { currencyLabel, entries } }`.
Aceita somente `limit`, inteiro entre 1 e 100, uma única vez; o padrão é 100.
Parâmetros inválidos retornam 400. Comunidade desconhecida, inativa ou sem os
módulos necessários retorna 404; indisponibilidade de armazenamento retorna 503.
As respostas usam `Cache-Control: no-store`.

O creator deve estar ativo, com `ranking` e sua dependência `points` instalados.
Em produção, também é necessária a ativação existente `CREATOR_ECONOMY_ENABLED`.
Hostname, slug e contexto da requisição seguem o resolvedor público existente.
A leitura repete a autorização dentro da transação e aplica o limite no SQL,
sempre filtrando `creator_balances.creator_id`. O snapshot e o lock compartilhado
de identidade preservam a consistência com fusões e trocas de canal.

A operação específica `ranking.read` não libera consultas legadas nem outras
verticais. `/c/ludylops/ranking` encaminha ao ranking legado, se disponível; a API
nova recusa o creator padrão. `/ranking` e `/api/leaderboard` continuam usando pipetz.

## Implantação e verificação

Não há migração, backfill, nova variável ou configuração do Streamer.bot nesta
entrega. A migração 0026 e a ativação documentadas em
[economia por comunidade](creator-economy.md) continuam sendo os pré-requisitos.
Nenhuma ativação ou alteração de produção foi executada nesta implementação.

Validação: 894 testes gerais passaram (25 testes PostgreSQL opcionais não
executados nessa suíte); os 6 testes PostgreSQL específicos do ranking passaram
separadamente em schema descartável local. Tipagem, lint e build passaram.
Os testes cobrem isolamento, dados públicos mínimos, limites, identidade,
exclusão, status/módulos e conflitos de hostname. A UI foi verificada no Edge,
em desktop e a 390 px: vazio, leitura anônima, duas moedas, renomeação, links,
nome longo e saldo de 1.000.000, sem erro JavaScript ou rolagem horizontal.
A UI usa fixtures demo descartáveis; os testes de identidade usam PostgreSQL.

O [cache público da #176](public-creator-cache.md) agora atende somente a leitura
da página de ranking de cada nova comunidade, com revalidação de 15 segundos e
autorização antes de cada acesso. A API continua sem cache. Os leitores globais
de jogo atual/status da live e o conteúdo personalizado de apostas não mudam.
