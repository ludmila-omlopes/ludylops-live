# Cache do ranking público por comunidade

Entrega da [#176](https://github.com/ludmila-omlopes/ludylops-live/issues/176).

## Leituras avaliadas

| Leitura | Isolamento e conteúdo | Decisão |
| --- | --- | --- |
| `/c/<slug>/ranking` | `readCreatorRanking` exige contexto, filtra `creator_balances.creator_id`, limita a 100 entradas e retorna apenas dados públicos | Cache com revalidação de 15 segundos |
| `/ranking` legado | `getLeaderboard()` ainda usa saldos globais | Sem cache novo |
| Apostas da comunidade | `listBets(activeViewerId)` inclui dados pessoais | Sem cache |
| Jogo atual e estado da live | Leitores ainda dependem de configuração/estado globais | Adiados até isolamento próprio |
| Saldo e histórico individuais, sessão, administração | Dados privados ou que exigem leitura direta | Sem cache |
| API pública de ranking | Mantém contrato de leitura direta e `Cache-Control: no-store` | Sem cache |
| Endpoints OBS | Incluem GET que consome fila | Fora do escopo |

O ranking novo já tinha testes de isolamento, limites e projeção pública na
entrega #209. Acrescentar o creator à chave não tornaria os leitores globais
aptos a compartilhar resultados.

## Mecanismo e autorização

`src/lib/cache.ts` usa `unstable_cache`, documentado na instalação atual em
`node_modules/next/dist/docs/01-app/03-api-reference/04-functions/unstable_cache.md`
e no guia `02-guides/caching-without-cache-components.md`. O modelo `use cache`
é recomendado para Cache Components, mas exigiria mudar o modo de renderização
global. Esta entrega mantém a configuração existente.

A identidade inclui versão do contrato, recurso, creator, intervalo e argumentos
públicos como `limit`. As tags incluem o creator; o loader recebe o mesmo ID.
Cada recurso deve identificar um único contrato de dados públicos. Ao mudar esse
contrato de forma incompatível, altere sua chave/versionamento. Não há invalidação
manual ligada às escritas nesta entrega.

`readPublicCreatorRanking` consulta status e módulos atuais antes de cada acesso
ao cache. Exige comunidade ativa, módulos `ranking` e `points` e, em produção,
`CREATOR_ECONOMY_ENABLED`. Falhas nessa consulta impedem servir o ranking. Slug e
hostname continuam passando pelo resolvedor público. Ao carregar dados, o loader
repete as verificações na transação. Nenhuma sessão integra o resultado armazenado.

O modo demo ignora completamente o cache. Repositórios, API pública e leitores
de dados individuais continuam sendo chamados diretamente.

## Atualização e limites

Os 15 segundos são um intervalo de revalidação. Depois desse período, o Next
pode responder com o resultado anterior enquanto atualiza os dados em segundo
plano. Uma falha nessa atualização pode conservar o resultado anterior por mais
tempo. Portanto, não há garantia de idade máxima de 15 segundos para posições,
saldos públicos ou nome da moeda. As verificações de acesso continuam ocorrendo
antes de servir qualquer resultado, inclusive o armazenado.

Um acerto de cache evita executar novamente a consulta do ranking. As consultas
de autorização e a renderização continuam acontecendo. Não foram medidos custo
em produção nem taxa de acertos entre instâncias; não há promessa de multiplicador
de capacidade ou redução das invocações da hospedagem.

## Verificação

```sh
npm test -- cache
npm run typecheck
npm run lint
npm test
npm run build
node scripts/verify-public-cache-runtime.mjs
```

Resultado local: 954 testes passaram, 41 testes PostgreSQL opcionais foram
ignorados; tipagem, lint e build passaram. Os 8 testes novos cobrem contrato,
separação entre creators/limites, recusa antes de cache preenchido, falhas de
autorização, demo e manutenção da API pública sem cache.

O script cria um app Next descartável, importa o helper real, faz build de
produção e atende apenas em `127.0.0.1:3391` (a porta precisa estar livre). Usa
fixtures em memória, remove variáveis dos arquivos `.env` do ambiente herdado
e não conecta a banco algum. O endereço fictício de banco apenas seleciona o
ramo de cache; nenhum cliente de banco é carregado. Remove o app ao terminar.

O teste confirmou acerto entre requisições, separação de comunidades e limites,
bloqueio antes de acessar cache preenchido, revalidação após 15 segundos e demo
sem cache. A primeira resposta após o intervalo ainda trouxe a versão 1; a
atualização em segundo plano disponibilizou a versão 2 nas seguintes.

Não há alteração visual, migração, nova variável ou configuração do Streamer.bot.
Os pré-requisitos existentes da [economia por comunidade](creator-economy.md)
continuam valendo. Nenhuma configuração de produção foi alterada.
