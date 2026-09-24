# Buscar imagem pelo link do produto

Entrega [#22](https://github.com/ludmila-omlopes/ludylops-live/issues/22).

## Como usar

No cadastro de produtos da Ludylops ou em **Gerenciar produtos** da própria
comunidade, preencha o link e use **Buscar imagem pelo link**. A imagem encontrada
preenche o campo; você pode alterá-la manualmente antes de salvar. Quando já existe
uma imagem, o botão passa a ser **Buscar outra imagem pelo link**.

A busca é explícita: colar ou modificar o link não substitui uma imagem já
preenchida. Enquanto a busca ocorre, os demais campos continuam disponíveis.
Trocar o link, editar a imagem, cancelar a edição, escolher outro produto ou
salvar descarta uma resposta ainda pendente. A busca não publica nem salva produtos.

O formulário mostra busca em andamento, sucesso ou erro. Em caso de falha, a
imagem já preenchida é preservada e a edição manual continua disponível.

## Compatibilidade e limites

Links HTTPS aceitos inicialmente:

- Amazon: `amazon.com.br`, `www.amazon.com.br`, `amazon.com`, `www.amazon.com`
  e links curtos `amzn.to` que redirecionem para um destino permitido.
- Mercado Livre: `mercadolivre.com.br`, `www.mercadolivre.com.br` e
  `produto.mercadolivre.com.br`.
- KaBuM!: `kabum.com.br` e `www.kabum.com.br`.
- Magalu: `magazineluiza.com.br` e `www.magazineluiza.com.br`.

A extração procura a imagem principal identificada no HTML da Amazon, depois
Open Graph e Twitter Image. Não executa JavaScript nem tenta contornar CAPTCHA,
login ou bloqueios das lojas. Considera apenas imagens HTTPS das lojas e dos
CDNs permitidos no código. Lojas podem mudar os metadados, usar outros domínios
ou exigir carregamento por JavaScript; nesses casos, use a imagem manualmente.

## Implementação e proteção

- `POST /api/admin/recommendations/image`: administrador, origem confiável e
  módulo de produtos disponível na comunidade padrão.
- `POST /api/me/creator-area/<id>/recommendations/image`: sessão do proprietário,
  origem confiável, comunidade ativa e módulo disponível. A autorização usa
  o mesmo serviço das recomendações; o dono vem da sessão.
- Corpo estrito `{ href }`, limitado a 4 KiB. Resposta de sucesso contém somente
  `imageUrl`. Todas as respostas próprias usam `Cache-Control: no-store`.
- Hosts exatos, HTTPS e porta padrão; nenhum usuário/senha na URL. Cada
  redirecionamento passa novamente pela política, com no máximo três saltos.
- Resolve IPv4 pelo sistema operacional, rejeita endereços privados/reservados
  e conecta ao IP validado. Mantém o hostname original em SNI/Host e a validação
  normal de certificado TLS, sem nova resolução entre validação e conexão.
- Orçamento total de oito segundos, incluindo DNS e redirecionamentos. Lê no
  máximo o primeiro MiB do HTML, interrompendo o restante. A resposta deve ser
  HTML não comprimido; o pedido solicita `Accept-Encoding: identity`.
- Não encaminha cookies, autorização ou cabeçalhos da sessão para lojas. Não
  baixa o arquivo de imagem, não armazena o HTML nem faz consultas recorrentes.
- Limites em memória por processo: dez tentativas por minuto e uma busca por
  vez por identidade; até oito buscas simultâneas e mil identidades no processo.
  São limites locais, não uma quota global entre instâncias da Vercel.

## Validação e implantação

972 testes gerais, tipagem, lint e build passaram; 41 testes PostgreSQL opcionais
ficam fora dessa execução. Os 25 testes específicos cobrem extração, URLs e IPs,
redirects, limite de bytes, timeout, orçamento de uso, sessão, propriedade,
lifecycle, módulo e respostas de erro. Não há alteração de esquema ou das
gravações de recomendações.

UI no Edge validada em desktop e a 390 px: os dois formulários, sucesso, falha,
edição manual, respostas atrasadas, cancelamento de edição e persistência da
imagem. Esses cenários usam respostas controladas para serem reproduzíveis.
Também houve consultas reais bem-sucedidas para um produto da Amazon e um da
KaBuM!, sem salvar esses produtos. Isso não garante disponibilidade para todos
os links ou a partir de todos os ambientes de deploy.

O botão quebra linha em telas pequenas. A verificação também encontrou e corrigiu
o excesso de largura dos ícones do rodapé legado, permitindo quebra de linha.

Não requer migração, chave de API, variável nova ou configuração do Streamer.bot.
Dados e configurações de produção não foram alterados.
