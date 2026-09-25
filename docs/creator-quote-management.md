# Cadastro e correção de frases por comunidade

Entrega [#211](https://github.com/ludmila-omlopes/ludylops-live/issues/211).

## Uso

O dono da comunidade pode acessar **Gerenciar frases** em `/criar-area` ou
em `/c/<slug>/quotes`. É possível registrar uma frase de até 500 caracteres e
corrigir o texto de uma frase existente. O texto salvo passa a aparecer na
consulta pública e nas próximas consultas do chat.

O servidor usa o dono autenticado como autor de novos registros. Correções
preservam o número, autor, origem e data de cadastro. Esta entrega não remove
frases, não renumera registros e não modifica snapshots já enviados ao OBS.
Não há histórico de revisões nesta etapa.

## Autorização e persistência

- `GET/POST/PATCH /api/me/creator-area/<id>/quotes` exige sessão do proprietário.
  Escritas também exigem origem confiável. Visitantes e outros streamers não
  recebem controles de edição nem acesso à API de gerenciamento.
- O creator precisa estar ativo e o módulo `quotes` deve estar disponível,
  incluindo suas dependências atuais: `points`, `streamerbot` e `obs_overlays`.
  Ter o módulo instalado não exige executar o Streamer.bot para editar pelo
  navegador. A flag da economia não participa desse fluxo gratuito.
- A operação específica `quotes.manage` só autoriza comunidades novas; o creator
  padrão da Ludylops continua com os fluxos existentes. A autorização é repetida
  dentro da transação, com locks de creator/módulos, antes de acessar as frases.
- Cada consulta filtra `creator_id`. A listagem administrativa devolve 50 itens
  por vez, com `nextBefore`; `before` é um número de frase exclusivo. O limite é
  aplicado no SQL e a paginação não depende de offsets que mudam com novas frases.
- O cadastro compartilha o advisory lock `(42002, hashtext(creatorId))` do chat,
  preservando números únicos por comunidade. Um UUID enviado pelo formulário
  identifica a tentativa: repetir o mesmo cadastro não cria outra frase.
- A correção altera somente `body` e compara `expectedBody` com o texto atual sob
  lock. Uma edição desatualizada retorna 409. A mesma correção repetida é aceita;
  uma correção diferente exige atualizar as frases antes de tentar novamente.

Respostas são `no-store`. A API retorna 401 sem sessão, 403 para origem inválida,
404 para recursos indisponíveis, 400 para dados inválidos e 503 para falhas de
armazenamento, sem expor mensagens internas. Dados adicionais no corpo são
rejeitados: o cliente não escolhe autor, numeração ou comunidade por um campo.

## Implantação

Não há migração, nova variável ou mudança de configuração do Streamer.bot.
As tabelas e a separação por creator da entrega de frases #173 já são utilizadas.
As chamadas de frases no OBS para comunidades novas continuam na etapa futura
de isolamento do overlay e integração com a moeda própria.

## Validação

Testes de serviço e API cobrem propriedade, dependências, lifecycle, limites,
entrada inválida, dados mínimos, repetição de cadastro e conflito de edição.
Os 5 testes PostgreSQL usam schema descartável local e cobrem cadastros
simultâneos entre chat/navegador, correções concorrentes, isolamento, preservação
de autoria e paginação com 105 registros. A suíte geral passou com 917 testes;
os 30 testes PostgreSQL opcionais ficam fora dessa execução geral.

Tipagem, lint e build passaram. A UI foi validada no Edge em desktop e a 390 px:
cadastro, correção, recuperação de conflito, paginação, texto público atualizado
e controles ocultos para visitante/outro dono, sem erro JavaScript ou rolagem
horizontal. A validação usou dados demo locais, sem alterações de produção.
