# Creator Hub e comunidades

Creator Hub é o nome provisório da plataforma. O mesmo projeto da Vercel atende a plataforma e as comunidades; não há um deploy por streamer.

| Endereço | Comportamento |
| --- | --- |
| `https://ludylops-youtube-dashboard.vercel.app/` | Entrada do Creator Hub, reescrita para `/inicio` |
| `<plataforma>/inicio` | Página inicial do Creator Hub, no grupo de rotas `(hub)`, com cabeçalho e rodapé próprios (fora do layout do builder); quem já tem comunidade vai para `/comunidades` |
| `<plataforma>/criar-area` | Login, pedido de acesso ao beta e criação da primeira comunidade |
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

A criação padrão instala apenas `product_recommendations`. O formulário pede nome, endereço, cores e template; não pede moeda nem configura integração. A página pública apresenta as indicações, sem prometer recursos de live.

### Templates das comunidades

Cada comunidade escolhe um de três templates para as páginas em `/c/<slug>`, sempre com as cores principal e de destaque do criador:

| Template | Origem | Arquivo |
| --- | --- | --- |
| `estudio` | Identidade do Creator Hub: superfícies planas, linhas finas, um único acento, Geist | `src/app/estudio-theme.css` |
| `palco` | Identidade anterior do Creator Hub: vidro translúcido, cantos arredondados, brilho suave | `src/app/palco-theme.css` |
| `neobrutalista` | Identidade da comunidade Ludylops: bordas grossas, sombras duras, títulos em caixa alta | `src/app/neobrutal-creator-theme.css` |

A escolha fica em `creator_branding.theme_json.template`, sem migração de banco. Comunidades novas começam em `estudio`; comunidades criadas antes dos templates, sem esse campo, continuam em `neobrutalista`. O proprietário troca o template e as cores em Identidade, com a mesma checagem de edição concorrente do nome e das cores.

O layout de `/c/[creatorSlug]` envolve as páginas em `[data-creator-template]` e define `--creator-primary`, `--creator-accent` e as tintas de contraste (`--creator-*-ink`). A Ludylops não recebe o wrapper e mantém a identidade original.

### Identidade do Creator Hub

A página inicial (`/inicio`) e as áreas internas (builder) usam o tema Estúdio, ativado pela classe `.hub-scope` via `:root:has(.hub-scope)`, o que cobre também menus e diálogos renderizados fora do layout. O acento é o esmeralda (`#2fd08f`). As cores de acento são variáveis `--estudio-*`: no Creator Hub ficam com o esmeralda e, nas comunidades com o template Estúdio, recebem a cor principal do criador. O tema Palco vale só dentro de comunidades.

Os botões de tema do Creator Hub usam `useThemeMode(…, { followSystem: true })`: sem uma escolha salva, a página segue o tema do sistema. A Ludylops continua com o comportamento anterior.

O roteiro inicial tem quatro etapas: nome e cores, módulos da página, primeiros produtos e divulgação do endereço. A etapa de produtos some quando o criador deixa Produtos indicados fora da escolha. A contagem considera todos os produtos ativos e aprovados da própria comunidade, sem depender da paginação, da moeda ou de credenciais. Rascunhos e itens pendentes de moderação não contam. A divulgação é uma ação manual, portanto não é marcada automaticamente como concluída.

Sem módulos de live instalados, a lista e a visão geral não mostram moeda ou Streamer.bot. Identidade só oferece a edição de moeda quando Pontos está disponível. Integração exige Streamer.bot instalado; acessos diretos sem esse módulo voltam à visão geral. Comunidades desativadas que ainda têm Streamer.bot instalado mantêm acesso à revogação de credenciais.

Não há migração nem alteração dos módulos das comunidades existentes, incluindo Teste 1, Teste 2 e Ludylops. A administração pode instalar os módulos posteriormente pelos controles existentes em `/owner`, respeitando suas dependências. O checklist de live passa a valer quando houver um módulo de live instalado. A economia continua dependendo de `CREATOR_ECONOMY_ENABLED`.

O serviço interno aceita `createCreatorArea(ownerId, input, { liveFeatures: true })` para instalar o pacote de live explicitamente. Essa opção não é aceita como autorização no corpo da requisição pública de criação. É um ponto de extensão para o futuro plano de streamer; esta entrega não implementa cobrança ou assinatura.

### Módulos escolhidos pelo criador

Em **Módulos** (`/comunidades/<slug>/modulos`), o criador escolhe o que entra na comunidade: produtos indicados, sugestões de jogos, vídeos para reagir, inspirações, apostas, moeda e ranking. OBS, Streamer.bot e os módulos que dependem deles (resgates e frases) continuam só no `/owner`.

| Módulo | Ao escolher |
| --- | --- |
| Produtos indicados, [Jogos](creator-games.md), [Vídeos para reagir](creator-videos.md) e [Inspirações](creator-inspirations.md) | Instalados na hora (`installed`); desmarcar remove a instalação, sem apagar os dados |
| Demais módulos | Registrados como `requested`, com o rótulo “Em breve”, até existir a versão por comunidade |

- Escolher um módulo inclui suas dependências: jogos, vídeos, inspirações, apostas e ranking levam junto a moeda.
- `requested` nunca conta como disponível: rotas, APIs e navegação continuam bloqueadas como para um módulo ausente.
- O criador não altera módulos instalados pela administração nem os que estão `disabled` ou `archived`. No `/owner`, os pedidos aparecem como “Escolhido pelo criador” e podem ser instalados pelos controles existentes.
- A etapa “Módulos da página” só conta como registrada depois que o criador salva uma escolha: cada linha escolhida recebe `config_json.chosenAt`. Os produtos instalados na criação não contam.
- Quando a versão por comunidade de um módulo existir, as linhas `requested` dele podem passar para `installed`. Salvar de novo a escolha também faz essa troca para os módulos que o criador ativa sozinho.

Sem migração de banco: `creator_modules.status` já é texto, e `requested` reaproveita a mesma linha e o mesmo bloqueio da linha do criador usados pelo `/owner`.

### Fusão de contas

Quando um espectador sem canal vinculado (sessão Google) vincula um canal do YouTube que já tem histórico, as duas identidades se fundem e a de origem é apagada.

A fusão transfere:

- a propriedade das comunidades (`creators.owner_user_id`);
- as sugestões de jogos, vídeos e inspirações, da Ludylops e de todas as comunidades, com seus boosts;
- os votos grátis, re-chaveados para a identidade final. Se as duas identidades votaram na mesma sugestão, fica um voto só e o total é corrigido.

Sem isso, a exclusão da identidade de origem esbarraria nas chaves estrangeiras e o vínculo do canal falharia. A lógica fica em `community-identity.server.ts`, chamada pela fusão real e pela do modo demo.

### Próximos trabalhos

- Boost com a moeda da comunidade nas sugestões de jogos, vídeos e inspirações, para comunidades com Pontos ativo.
- Apostas por comunidade, com a moeda, depois de decidir como o público ganha moeda sem live.
- Corrigir `npm run smoke:auth`: o script pode aceitar um redirecionamento de erro de configuração como sucesso. O comportamento também foi observado com a versão anterior do Auth.js; o conserto exige distinguir o redirecionamento ao provedor de um erro.

### Separação entre plataforma e operação legada

Esta mudança separa identidade, navegação, seleção de comunidade e endereços públicos. Não requer migração de banco. Os saldos históricos, resgates e contratos do Streamer.bot da Ludylops permanecem no fluxo legado. A remoção dessas exceções exige uma migração própria e validação da integração, antes de tratar também a operação interna da Ludylops exatamente como a dos novos streamers. O beta aceita [solicitações com aprovação do admin](creator-beta-access.md), além da lista manual de emails liberados.

## Validação

- Raiz local/Vercel abre Creator Hub; domínio Ludylops mantém a comunidade.
- `/c/<slug>` exige criador ativo; seletores conflitantes e hosts desconhecidos não recorrem à Ludylops.
- Criação não insere domínio automático e gera link canônico da plataforma.
- Os três templates aparecem em `/c/<slug>` com as cores do criador, em tema claro e escuro; trocar o template em Identidade muda a página pública.
- Sem escolha salva, o Creator Hub segue o tema claro ou escuro do sistema.
- Testes completos, TypeScript, lint e build devem passar.
- Confira separadamente a renderização local e o login Google no host real após configurar o retorno e implantar.
