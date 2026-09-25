# Nome, cores e navegação da comunidade

Entrega [#213](https://github.com/ludmila-omlopes/ludylops-live/issues/213).

## Edição pelo dono

Em `/criar-area`, cada comunidade ativa oferece **Editar nome e cores**.
O dono pode alterar o nome (2 a 80 caracteres), a cor principal e a cor de
destaque (hexadecimal de seis dígitos). A amostra mostra as cores antes de salvar.
Renomear preserva o slug e os domínios: links existentes continuam válidos.

`GET/PATCH /api/me/creator-area/<id>/profile` exige sessão do proprietário; a
escrita também exige origem confiável. O ID do dono vem da sessão, e o corpo
aceita somente os três campos de apresentação e seus valores anteriores.
Não permite trocar proprietário, status, endereço ou configuração econômica.

O creator deve estar ativo. A edição de apresentação não depende de módulos ou
da ativação da economia. O creator padrão da Ludylops mantém o fluxo existente
e não aceita alterações por esse endpoint.

Nome e cores são salvos na mesma transação, com autorização e locks sobre
creator/branding. Uma falha desfaz ambas as alterações. Se os valores mudaram
desde a consulta, a API retorna 409 e o dono pode **Recarregar dados** antes de
editar novamente. Repetir o mesmo salvamento é aceito.

Campos de branding não editados (logo, avatar, fontes, tema e outras cores),
configuração da moeda, saldos e vínculos permanecem preservados. Uma linha de
branding ausente é criada com os padrões existentes durante o salvamento.
Falhas de armazenamento retornam 503 sem substituir dados por demo; todas as
respostas usam `Cache-Control: no-store`.

## Comunidade pública

`/c/<slug>` mostra o nome e as cores salvos e os acessos realmente disponíveis:

- Moeda: `points` disponível e economia nova ativada.
- Ranking: `ranking` e dependências disponíveis, com economia nova ativada.
- Frases: `quotes` e suas dependências disponíveis.
- Produtos indicados: `product_recommendations` disponível (entrega #215).

Nas comunidades novas, todos os links usam `/c/<slug>/...`. A Ludylops continua
usando `/me`, `/ranking`, `/quotes` e `/produtinhos`, independentemente da flag da economia nova.
O resolvedor existente continua verificando hostname, slug e lifecycle.

Os antigos cartões de módulos preparados, rotas globais sem navegação e link
redundante para o subdomínio foram substituídos por esses acessos. Quando nenhum
recurso está disponível, há um estado vazio sem links para operações bloqueadas.
Nenhuma funcionalidade ainda não isolada é anunciada como disponível.

O cabeçalho usa a cor principal sólida e escolhe texto preto ou branco conforme
a luminância, mantendo a cor de destaque em uma faixa decorativa. Valores antigos
que não sejam cores hexadecimais válidas usam uma cor padrão na renderização.

## Validação e implantação

935 testes gerais passaram; 35 testes PostgreSQL opcionais ficam fora dessa
suíte. Os 5 testes específicos com PostgreSQL passaram separadamente em schema
descartável local: persistência, preservação de dados, rollback, concorrência,
propriedade/lifecycle e criação de branding ausente. Tipagem, lint e build passaram.

UI validada no Edge em desktop e a 390 px: salvamento, conflito e recuperação,
cores inválidas, links, outro proprietário, nome longo de 80 caracteres, cores
claras/escuras, modo escuro e estado vazio. Sem rolagem horizontal ou erro
JavaScript. Os testes visuais usaram demo local, sem alterações em produção.

Não há migração, nova variável ou configuração do Streamer.bot. A ativação da
economia em produção continua sendo uma etapa separada; nenhuma flag foi alterada.
