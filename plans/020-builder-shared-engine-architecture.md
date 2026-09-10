# Plano 020: separar builder, motor compartilhado e instâncias

## Status

- Prioridade: P1 na frente de infraestrutura escolhida em 2026-09-08.
- Categoria: direction / architecture.
- Estado: proposta de arquitetura; implementação não iniciada.
- Esforço: M para detalhar os contratos e a primeira entrega; L para a migração completa.
- Risco: baixo para este documento; médio/alto para migrar dados e tráfego depois.
- Base: commit `9291962`, com alterações locais preexistentes em `src/app/admin/page.tsx`, `src/components/counter-board.tsx`, `src/lib/db/repository.ts`, seus testes e catálogo de scripts.
- Dependências para o desenho: nenhuma. Os planos 008–019 são referências a reconciliar, não autorização para execução.

## Decisão confirmada pela usuária

O repositório contempla dois produtos: um builder de plataformas de streamers e a plataforma pronta da Ludylops. A Ludylops deve ser a primeira instância do motor compartilhado, recebendo suas melhorias. A auditoria anterior de bugs fica fora do trabalho atual.

As demais escolhas abaixo são recomendações arquiteturais. A decisão confirmada não implica aprovação de novos serviços, despesas, migrações de banco ou mudanças de domínio.

## Por que mudar

Hoje o builder está dentro da aplicação da Ludylops. Criar outra área persiste domínio, branding e módulos, mas a operação continua ligada a dados e configurações globais. Precisamos conseguir desenvolver o builder e reutilizar os recursos da live, preservando a identidade e a operação de cada comunidade.

## Estado atual e evidências

- `src/app/layout.tsx:34` define metadados da Ludylops para a aplicação. Na linha 50 consulta o estado da live e na linha 71 envolve as rotas com `AppChrome`.
- `src/components/app-chrome.tsx:101` mistura acesso ao console da plataforma com a navegação da comunidade; a linha 327 fixa “Siga a Ludylops”.
- `src/app/owner/page.tsx:8` exige acesso de administradora da plataforma, lista instâncias e inclui criação de áreas. Ainda não é um espaço geral de edição para cada streamer.
- `src/lib/creators/defaults.ts:5` define o criador e domínio padrão como Ludylops. `src/lib/creators/service.ts:248` usa esse mesmo domínio como base dos novos criadores.
- `src/lib/creators/modules.ts:16` já descreve rotas, painéis, dependências e configuração dos módulos. É uma base útil para o contrato compartilhado.
- `src/lib/creators/service.ts:236` cria os quatro conjuntos de registros numa transação. O trecho existente abaixo é o padrão de composição a preservar:

```ts
await db.transaction(async (tx) => {
  await tx.insert(creators).values({
    id: creatorId,
    slug: parsed.slug,
    displayName: parsed.displayName,
    ownerUserId,
    status: "active",
  });
  // Domínio, branding e módulos são inseridos na mesma transação.
});
```

- `src/lib/creators/tenant.ts:292` oferece `requireCreator`, mas a busca por seus consumidores não encontra sua adoção nas rotas operacionais. `src/app/admin/page.tsx:71` chama `getCatalog()`, `getLeaderboard()` e outras consultas sem contexto de criador.
- `src/lib/db/schema.ts:32` separa metadados de criadores. As tabelas operacionais ainda não aplicam a separação correspondente, também documentada no README.
- `package.json` e `.github/workflows/ci.yml` descrevem uma aplicação Next.js com verificação conjunta. A topologia efetiva do deploy não foi consultada.

## Arquitetura recomendada

| Parte | Responsabilidade | Limite |
| --- | --- | --- |
| Builder | Criar e configurar comunidades; escolher módulos, identidade e integrações; preparar publicação | Não implementar novamente as regras de apostas, pontos ou resgates |
| Console da operadora | Administrar criadores, acesso ao beta e ciclo de vida das instâncias | Separado das permissões de streamer e de viewer, mesmo que pertença ao app do builder |
| Motor das comunidades | Executar módulos, servir a experiência do viewer, administração da live e overlays | Receber contexto explícito da comunidade; não presumir que ela é Ludylops |
| Configuração da instância | Nome, domínio, tema, textos próprios, moeda, módulos e integrações | Dados/configuração versionados; nenhuma cópia completa do código por streamer |
| Infraestrutura comum | Identidade, persistência, contratos, bibliotecas de UI e adaptadores de integração | Dependências explícitas; não importar páginas de um produto para o outro |

Um repositório pode conter as duas aplicações. A estrutura final sugerida é:

```text
apps/
  builder/          # Gestão e configuração das plataformas
  communities/      # Motor web: Ludylops e outros criadores
  bridge/           # Agente local das integrações
packages/
  contracts/        # Contexto de criador, configuração e manifestos
  domain/           # Regras dos módulos
  data/             # Persistência com escopo explícito
  ui/               # Primitivos visuais compartilhados
```

Essa árvore é um destino, não o primeiro commit. Inicialmente separar responsabilidades dentro da aplicação atual, mantendo um deploy. Extrair duas aplicações quando os contratos estiverem definidos e houver uma verificação de compatibilidade entre elas. Dois deploys permitem publicar mudanças só do builder sem publicar a aplicação que serve a live; banco e pacotes compartilhados ainda exigem compatibilidade de versões.

## Contratos que sustentam a separação

1. **Identidade e autorização:** uma pessoa pode ser viewer, dona de uma comunidade e operadora do builder. Identidade global não concede permissões globais. Explicitar associação pessoa/comunidade/papel.
2. **Contexto de execução:** resolver comunidade por domínio/rota verificados ou credencial da integração. Passar seu identificador aos serviços, consultas, caches, filas e logs. Domínio desconhecido não deve selecionar silenciosamente a Ludylops no motor final.
3. **Configuração:** distinguir padrões genéricos, configuração da plataforma e configuração de uma comunidade. “Pipetz”, links sociais e identidade da Ludylops pertencem à instância ou ao seu tema. Templates podem iniciar outra comunidade sem compartilhar os mesmos registros mutáveis.
4. **Módulos:** separar catálogo disponível de módulos habilitados em cada instância. Definir versão do contrato, configuração validada e dependências. O builder configura; o motor executa e verifica disponibilidade.
5. **Publicação:** definir uma configuração publicada por instância. Se o builder oferecer rascunho/preview, o motor deve continuar usando a versão publicada até a transição. Não criar um editor visual completo neste trabalho.
6. **Integrações:** credenciais e estado da live pertencem à comunidade. A bridge é instalada onde a integração local roda e recebe identidade própria. Segredos nunca fazem parte da configuração pública de tema.
7. **Dados:** recomendar banco compartilhado com escopo explícito por criador inicialmente, preservando a decisão anterior de saldo independente por comunidade. Identidade e catálogos externos podem permanecer globais. Separar apps não substitui isolamento de dados.

## Ordem de evolução

| Etapa | Entrega limitada | Evidência de conclusão antes de avançar |
| --- | --- | --- |
| A | Separar layouts e responsabilidades de builder, comunidade e OBS no app atual | Builder não consulta estado da live nem mostra navegação da Ludylops; URLs existentes continuam resolvendo |
| B | Definir contratos de configuração e contexto; representar Ludylops como instância explícita | Uma segunda instância de teste tem identidade própria sem alterar os padrões de Ludylops |
| C | Completar um módulo pequeno de ponta a ponta, preferencialmente quotes | Dois criadores acessam seus próprios dados, permissões, configuração e integração; nenhum cruzamento |
| D | Aplicar o padrão às demais operações e extrair aplicações/pacotes | Contratos têm testes; builder e communities possuem verificações e publicação próprias, com compatibilidade de banco |
| E | Implantar preparação/publicação de novas comunidades | Criar uma comunidade de teste não exige editar código ou copiar banco; falha na preparação deixa estado recuperável |

Na etapa A, separar o layout raiz neutro dos layouts específicos. Grupos de rotas do Next.js organizam layouts, mas não criam isolamento de dados nem deployments. Evitar grupos diferentes resolvendo para a mesma URL. Preservar `/`, `/admin`, `/me`, `/owner` e URLs do OBS na primeira entrega.

Não executar a etapa C copiando o `repository.ts` inteiro para cada produto. Extrair apenas as operações do módulo escolhido e comprovar o contrato antes de ampliar a migração.

## Relação com o planejamento existente

Os planos de migração, isolamento, domínios e credenciais já existentes contêm material pertinente às etapas B–E. Antes de transformá-las em implementação, reconciliar 008, 009 e 014–019 com esta arquitetura; evitar abrir planos ou issues duplicados. Nenhum deles precisa ser executado para desenhar ou delimitar a etapa A. Não retomar os doze achados da auditoria anterior nesta frente.

## Handoff: próximo trabalho delimitado

O próximo executor de planejamento deve detalhar somente a etapa A em um plano autocontido. Seu escopo de escrita continua restrito a `plans/`; não mover arquivos-fonte neste estágio.

1. Conferir o estado com `git status --short` e `git diff --stat 9291962..HEAD -- src/app src/components/app-chrome.tsx src/lib/creators proxy.ts`. Comparar os trechos atuais com as evidências acima, incluindo alterações não commitadas.
2. Inventariar rotas com `rg --files src/app`. Produzir no plano uma tabela origem/destino/URL/layout cobrindo todas as páginas, APIs e overlays afetados. Verificação: `rg -n 'Origem|Destino|URL|Layout' plans/021-*.md` deve localizar a tabela.
3. Ler `node_modules/next/dist/docs/01-app/03-api-reference/03-file-conventions/route-groups.md` e a documentação local de layouts. Definir quais consultas deixam o layout raiz e qual layout passa a executá-las, sem alterar contratos das APIs.
4. Escrever testes de aceitação planejados para builder, Ludylops e OBS; listar arquivos exatos a criar/alterar, gates, ordem de migração e reversão por código. Verificação: `rg -n 'Testes|Escopo|Reversão|STOP' plans/021-*.md` deve encontrar todas essas seções.
5. Atualizar o índice sem modificar status históricos ou declarar implementação concluída. `git diff --name-only` deve mostrar que as únicas alterações novas feitas pelo planejador estão em `plans/`; as alterações preexistentes devem permanecer intactas.

Os comandos de busca verificam presença e cobertura estrutural do documento; a revisão do mapa e dos contratos continua sendo necessária.

## Verificação de futuras implementações

Baseline observada em 2026-09-07 no mesmo HEAD: `npm run typecheck` passou; `npm test` passou com 40 arquivos e 298 testes. O lint passou com `npm run lint -- --ignore-pattern '.claude/**' --ignore-pattern '.worktrees/**'`. O comando simples percorreu artefatos de worktrees e foi interrompido. Build e produção não foram verificados nessa auditoria.

| Gate | Comando / cenário | Resultado esperado |
| --- | --- | --- |
| Tipos | `npm run typecheck` | Exit 0 |
| Lint local | `npm run lint -- --ignore-pattern '.claude/**' --ignore-pattern '.worktrees/**'` | Exit 0 |
| Regressões | `npm test` | Exit 0; incluir testes pertinentes à etapa |
| Build futuro | `npm run build` em ambiente isolado com configuração de teste | Exit 0; sem rotas conflitantes; não executar contra produção durante o desenho |
| Separação visual/operacional | Abrir builder, Ludylops e OBS | Cada superfície carrega apenas suas dependências de produto |
| Isolamento futuro | Duas comunidades, mesmos IDs locais/nomes de recursos quando permitidos | Leituras, escritas e eventos permanecem na comunidade correta |
| Publicação futura | Alterar rascunho e depois publicar | Rascunho não muda a live; publicação troca a versão explicitamente |

## Limites e STOP

- Não instalar dependências, criar serviços externos, trocar domínios, aplicar migrações ou alterar dados para produzir o próximo plano.
- Não pressupor que mudar a árvore de pastas isola usuários ou dados.
- Se preservar URLs exigir uma decisão de domínio ainda não tomada, registrar a alternativa e pedir somente essa decisão; não inventar um domínio do builder.
- Se a etapa A exigir alterar regras financeiras ou o schema, parar e reduzir a entrega até ela voltar a ser uma separação de superfícies.
- Se o código citado mudou, revisar as premissas antes de seguir. Não sobrescrever trabalho local de outro agente.
- Para uma implementação futura: seguir `AGENTS.md`, atualizar a base remota antes de criar branch `codex/`, e usar o workflow local de issues. Não publicar PR ou issue por inferência deste documento.

## Manutenção

Avaliar mudanças pela direção das dependências: produtos usam contratos e serviços compartilhados; o domínio não depende de páginas do builder ou do tema Ludylops. Cada novo módulo deve declarar configuração, dados, autorização e integrações que utiliza. Uma melhoria compartilhada deve poder chegar à Ludylops por atualização do motor, sem copiar implementação.
