# Creator Hub e comunidades

Creator Hub é o nome provisório da plataforma. O mesmo projeto da Vercel atende a plataforma e as comunidades; não há um deploy por streamer.

| Endereço | Comportamento |
| --- | --- |
| `https://ludylops-youtube-dashboard.vercel.app/` | Entrada do Creator Hub, reescrita para `/criar-area` |
| `<plataforma>/criar-area` | Criação e configuração das comunidades do usuário |
| `<plataforma>/owner` | Administração das comunidades pelo proprietário da plataforma |
| `<plataforma>/c/<slug>` | Comunidade selecionada explicitamente |
| `https://ludylops.live/` | Comunidade Ludylops e suas rotas existentes |
| `<plataforma>/c/ludylops` | Redireciona ao domínio da Ludylops após validar sua disponibilidade |

O endereço provisório usa um alias de produção já existente. `NEXT_PUBLIC_PLATFORM_URL` permite trocar a origem canônica; configure antes do build. Localmente, use `http://localhost:3000` (ou a porta utilizada). `APP_URL` continua independente, para as integrações existentes.

Hosts locais, a origem canônica e os hosts exatos informados pelas variáveis da Vercel são reconhecidos como plataforma. Não há autorização genérica para `*.vercel.app`. Nesses hosts, `/`, `/me`, `/ranking` e outras rotas sem slug não selecionam Ludylops implicitamente. Os links antigos `/c/<slug>` em `ludylops.live` continuam válidos.

Novas comunidades recebem um endereço `/c/<slug>` e não criam registros fictícios de subdomínios `*.ludylops.live`. Registros de domínio existentes são preservados. O provisionamento e a verificação de domínios próprios continuam sendo uma etapa separada.

## Login e implantação

O login Google usa o hostname em que foi iniciado. Antes de disponibilizar a plataforma no alias da Vercel, acrescente este retorno ao cliente OAuth de produção, mantendo o retorno existente da Ludylops:

```text
https://ludylops-youtube-dashboard.vercel.app/api/auth/callback/google
```

Em 25/09/2026, o retorno adicional foi salvo no cliente de produção, preservando o retorno de `ludylops.live`. A verificação posterior chegou à tela de login do Google (HTTP 200), sem `redirect_uri_mismatch`. Isso valida a aceitação do endereço de retorno; o login completo e a criação de sessão com uma conta ainda precisam ser conferidos após a implantação. A tela do Google ainda identifica o aplicativo como “Pipetz by Ludylops”. Não foi necessário gerar outro segredo. As sessões são próprias de cada host: o usuário pode precisar entrar novamente ao trocar de domínio.

## Limite desta etapa

### Comunidades novas começam com indicações de produtos

A criação padrão instala apenas `product_recommendations`. O formulário pede nome, endereço e cores; não pede moeda nem configura integração. A página pública apresenta as indicações, sem prometer recursos de live.

O roteiro inicial tem três etapas: nome e cores, primeiros produtos e divulgação do endereço. A contagem considera todos os produtos ativos e aprovados da própria comunidade, sem depender da paginação, da moeda ou de credenciais. Rascunhos e itens pendentes de moderação não contam. A divulgação é uma ação manual, portanto não é marcada automaticamente como concluída.

Sem módulos de live instalados, a lista e a visão geral não mostram moeda ou Streamer.bot. Identidade só oferece a edição de moeda quando Pontos está disponível. Integração exige Streamer.bot instalado; acessos diretos sem esse módulo voltam à visão geral. Comunidades desativadas que ainda têm Streamer.bot instalado mantêm acesso à revogação de credenciais.

Não há migração nem alteração dos módulos das comunidades existentes, incluindo Teste 1, Teste 2 e Ludylops. A administração pode instalar os módulos posteriormente pelos controles existentes em `/owner`, respeitando suas dependências. O checklist de live passa a valer quando houver um módulo de live instalado. A economia continua dependendo de `CREATOR_ECONOMY_ENABLED`.

O serviço interno aceita `createCreatorArea(ownerId, input, { liveFeatures: true })` para instalar o pacote de live explicitamente. Essa opção não é aceita como autorização no corpo da requisição pública de criação. É um ponto de extensão para o futuro plano de streamer; esta entrega não implementa cobrança ou assinatura.

### Próximos trabalhos

- Sugestões de jogos por comunidade: hoje o fluxo é global da Ludylops e depende da moeda. Antes de implementar, decidir como funcionarão nas contas sem live, incluindo a possibilidade de sugestões sem boost.
- Corrigir `npm run smoke:auth`: o script pode aceitar um redirecionamento de erro de configuração como sucesso. O comportamento também foi observado com a versão anterior do Auth.js; o conserto exige distinguir o redirecionamento ao provedor de um erro.

### Separação entre plataforma e operação legada

Esta mudança separa identidade, navegação, seleção de comunidade e endereços públicos. Não requer migração de banco. Os saldos históricos, resgates e contratos do Streamer.bot da Ludylops permanecem no fluxo legado. A remoção dessas exceções exige uma migração própria e validação da integração, antes de tratar também a operação interna da Ludylops exatamente como a dos novos streamers. A lista do beta ainda é administrada pelo fluxo existente de administração.

## Validação

- Raiz local/Vercel abre Creator Hub; domínio Ludylops mantém a comunidade.
- `/c/<slug>` exige criador ativo; seletores conflitantes e hosts desconhecidos não recorrem à Ludylops.
- Criação não insere domínio automático e gera link canônico da plataforma.
- Testes completos, TypeScript, lint e build devem passar.
- Confira separadamente a renderização local e o login Google no host real após configurar o retorno e implantar.
