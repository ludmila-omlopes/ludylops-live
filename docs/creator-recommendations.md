# Produtos indicados por comunidade

Entrega [#215](https://github.com/ludmila-omlopes/ludylops-live/issues/215).

## Uso

O dono acessa **Gerenciar produtos** em `/criar-area` ou nos produtos da própria
comunidade, em `/c/<slug>/produtinhos`. Pode cadastrar nome, categoria, loja,
motivo da indicação, link externo ou afiliado e uma imagem opcional. A imagem
aceita uma URL ou caminho local. A entrega #22 acrescenta a opção
[Buscar imagem pelo link](recommendation-image-lookup.md); não há upload.

**Publicar para a comunidade** começa desmarcado. Produtos ocultos ficam
disponíveis apenas para o proprietário. O dono pode editar os campos e marcar
ou desmarcar essa opção depois, sem excluir o cadastro. Visitantes veem somente
os produtos publicados e aprovados. Links afiliados são identificados e usam
`rel="noopener noreferrer sponsored"`.

As listagens carregam até 50 produtos por vez, dos mais recentes para os mais
antigos. **Mais produtos** continua a lista pública; **Carregar produtos
anteriores** amplia a lista do dono. O início da comunidade oferece o acesso
quando o módulo `product_recommendations` está disponível.

## Autorização e persistência

- `GET/POST/PATCH /api/me/creator-area/<id>/recommendations` exige a sessão do
  proprietário. POST/PATCH também exigem origem confiável. Respostas usam
  `Cache-Control: no-store`.
- A autorização de creator ativo, propriedade e módulo é repetida dentro da
  transação. Não depende da ativação da economia ou do Streamer.bot.
- O serviço público omite a identidade do proprietário na chamada e aplica os
  filtros de publicação e aprovação antes do limite. Cada consulta filtra o
  `creator_id` e não devolve proprietário, slug interno ou metadados de moderação.
- Criação aceita um UUID estável para que tentativas repetidas não dupliquem o
  produto. O slug interno é derivado desse UUID pelo servidor, preservando a
  restrição global existente. Reusar o ID em outra comunidade é negado.
- Edição compara os campos originais. Mudanças concorrentes incompatíveis
  retornam 409; **Atualizar produtos** recupera os valores atuais e descarta a
  edição local. Repetir um salvamento já aplicado é aceito.
- Locks no creator, módulo e produto, além de um advisory lock pelo ID, mantêm
  autorização e gravação consistentes. Campos de moderação e data de criação
  não podem ser alterados pelo corpo da requisição.
- URLs de produto aceitam apenas HTTP/HTTPS sem credenciais. Imagens opcionais
  carregam pelo navegador com `referrerPolicy="no-referrer"`. A busca opcional
  de metadados da #22 usa uma política mais restrita de lojas e HTTPS.
- Falha de armazenamento retorna indisponibilidade, sem substituir os dados
  por exemplos. O demo tem armazenamento próprio, separado do legado.

## Compatibilidade e implantação

Não há migração nova: usa `product_recommendations.creator_id`, já introduzido
na preparação das tabelas operacionais. Não altera configuração do Streamer.bot,
saldos, moeda ou flags de produção.

Todas as leituras e gravações antigas de recomendações passam a exigir
`creator_ludylops`, incluindo consultas administrativas, fallback de moderação,
upsert, atualização e exclusão. O fluxo existente da Ludylops permanece nas
rotas globais. Sugestões de espectadores para novas comunidades ficam para
entregas futuras; a busca opcional de imagem é tratada na #22.

Implante os filtros do legado junto com o novo fluxo. Depois que houver produtos
de outros streamers, um rollback deve preservar esses filtros: versões anteriores
consultam a tabela inteira e poderiam expor produtos de outras comunidades.

## Validação

946 testes gerais, tipagem, lint e build passaram. Os 41 testes PostgreSQL
opcionais não integram essa execução; os 6 específicos desta entrega passaram
separadamente em um schema descartável do PostgreSQL local: isolamento público,
privado e legado; bloqueio das gravações antigas; concorrência e repetição;
propriedade/módulo/status; paginação; preservação de metadados.

UI validada no Edge em desktop e a 390 px: cadastro oculto, publicação, edição,
ocultação, conflito e recuperação, acesso de outro dono e anônimo, navegação,
paginação pública e privada, link afiliado e nome longo. Sem rolagem horizontal
ou erros JavaScript. Banco e dados de produção não foram alterados.
