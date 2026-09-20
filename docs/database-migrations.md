# Banco: schema e preparação de dados

## Política e evidência

O caminho de aplicação é **schema-first**, com `npm run db:push`: o Drizzle Kit compara `src/lib/db/schema.ts` com o banco e aplica a diferença. `npm run db:generate` gera SQL e snapshots para revisão; **push não executa esses arquivos nem seus seeds**. Não usamos `db:migrate` nem inventamos entradas no histórico.

Não reproduza nem edite `drizzle/0021_hard_riptide.sql`: seus upserts sobrescrevem slug, nome, estado, identidade visual e configurações. A preparação de dados agora é separada, versionada e verificável.

Referências oficiais: [Drizzle Kit push](https://orm.drizzle.team/docs/drizzle-kit-push) e [Drizzle Kit migrate](https://orm.drizzle.team/docs/drizzle-kit-migrate). Em 2026-09-15 o lockfile instala drizzle-kit **0.31.10** e drizzle-orm **0.45.2**. O help local (`node node_modules/drizzle-kit/bin.cjs push --help`) lista `--strict`, `--verbose` e `--force`, mas não `--explain`, presente na documentação online mais recente. Não use `push --explain` como inspeção. `--strict` pede confirmação e `--verbose` imprime SQL; nenhum torna push somente leitura. Não use `--force` para pular revisão de perda de dados.

| Ambiente | Schema observado? | Dados v1 verificados? | Histórico completo de DDL reconciliado? |
|---|---|---|---|
| Demo, sem banco | Não se aplica | Não; defaults em memória não comprovam persistência | Não se aplica |
| Testes locais desta entrega | Simulado por adaptador SQL transacional | Sim, pelo código real | Não se aplica |
| PostgreSQL descartável | Desconhecido; não executado nesta entrega | Desconhecido | Desconhecido |
| Compartilhado / produção | Desconhecido; não consultado nesta entrega | Desconhecido | Desconhecido |

A presença de `drizzle.__drizzle_migrations` (ou nome/schema configurado) não prova que todo DDL histórico foi aplicado: mudanças anteriores podem ter usado push ou SQL manual. Histórico desconhecido é um **STOP operacional para aplicação/adoção em produção**, até reconciliação pelo operador. Não impede desenvolver/testar ferramentas offline. Nenhum banco compartilhado foi alterado nesta entrega.

## Comandos e ambiente

Execute na raiz do checkout escolhido, depois de `npm ci`:

```bash
npm run db:baseline:check
npm run db:baseline:ensure -- --apply
npm run db:baseline:check
```

O segundo comando escreve: execute somente no alvo revisado e, em banco compartilhado, após aprovação explícita do operador. `ensure` sem `--apply` é recusado antes de carregar ambiente/conectar. A execução direta de `scripts/creator-baseline.ts` sem argumentos equivale a check. `check --apply` e argumentos desconhecidos são recusados; `--help` não conecta.

O transporte usa o driver Neon existente (`@neondatabase/serverless`, Client via WebSocket). Para verificação descartável, use uma branch Neon isolada: PostgreSQL local com TCP puro não é suportado diretamente por este CLI.

CLI e `drizzle.config.ts` usam `@next/env`, já instalado pelo Next, sem importar autenticação/cliente da aplicação. A prioridade é: variáveis do processo, `.env.<ambiente>.local`, `.env.local`, `.env.<ambiente>`, `.env`. O padrão é produção; `NODE_ENV=development` seleciona desenvolvimento e `NODE_ENV=test` ignora `.env.local`. Variáveis do processo, inclusive vazias, prevalecem. Expansão `$VAR` segue Next.js.

Não imprima `DATABASE_URL`, credenciais ou erros brutos nos relatórios, nem passe URLs na linha de comando. Configure o ambiente com segurança e confirme o alvo no gerenciador do banco. Para testes/build em demo, isole os arquivos `.env*` reais e use segredo fictício; limpar somente uma variável pode manter integrações reais carregadas.

| Saída | Significado |
|---|---|
| `0` | Baseline pronto, ensure concluído, ou ajuda solicitada |
| `1` | Registros faltando, conflito, schema ausente/incompleto, erro de conexão/permissão/transação ou fechamento |
| `2` | Argumentos inválidos, ensure sem apply, URL ausente/inválida; sem conexão |

O JSON contém apenas `version`, `ready`, `creatorExists`, `missing` e `inserted`. `missing` identifica `creator`, `branding`, `domain` e `module:<chave>`. Não expõe nomes personalizados, dono, configurações ou hostname do banco. `schema_missing` exige reconciliar a estrutura; nunca autoriza criar tabelas automaticamente. Outros erros SQL são sanitizados.

## Contrato do baseline v1

`creator-foundation-v1`, congelado em `src/lib/db/creator-baseline.ts`, captura os defaults e os dados iniciais de 0021: `creator_ludylops` (slug `ludylops`, nome `Ludylops`, ativo e sem dono), domínio `ludylops.live`, identidade visual e onze módulos: points, ranking, redemptions, bets, product_recommendations, game_suggestions, video_suggestions, creator_suggestions, quotes, obs_overlays e streamerbot.

Defaults futuros exigem nova versão deliberada. Não existe tabela de execução do seed: a versão está no código/relatório e o estado real é verificado a cada execução.

Check usa transação `REPEATABLE READ READ ONLY`, verificando quatro tabelas em `public`, colunas necessárias e identidades. Não escreve nem adquire locks de escrita. O estado pode mudar depois do check.

Ensure bloqueia escritas nas quatro tabelas em transação curta (`SHARE ROW EXCLUSIVE`), valida conflitos antes de inserir, insere somente registros faltantes com parâmetros SQL e verifica antes do commit. Limites: conexão 10 s, espera de lock 5 s, statement 15 s, query do cliente 20 s. Falhas provocam rollback e a conexão é fechada inclusive após erro. Planeje uma janela: os locks podem atrasar escritas da aplicação.

Registros existentes nunca recebem UPDATE: slug, nome, dono, status, branding, flags de domínio, configurações e timestamps permanecem intactos. Módulo desativado conta como existente. Chave natural existente sob outro ID é aceita. Se houver domínio primário personalizado, o padrão faltante é inserido como secundário. Uma segunda execução não altera nem timestamps.

Conflitos falham sem apropriação: slug padrão ocupado por outro criador, hostname padrão pertencente a outro, ID determinístico de domínio/módulo usado para outra identidade. Isso inclui `creator_domain_ludylops_live` com hostname personalizado, mesmo pertencendo ao criador padrão: o operador deve reconciliar a intenção; o CLI preserva os dados e não inventa outro ID. Primários múltiplos preexistentes não são corrigidos automaticamente.

`ready=true` comprova a fundação v1, **não certifica segurança de DDL, constraints, dados operacionais ou histórico de migrações**. `creatorExists=true` isoladamente não libera planos dependentes: exija saída 0 do check completo e revisão operacional.

## Sequência de aplicação em produção

1. **Inventário, backup e revisão.** Confirme alvo, revisão de código e mecanismo anterior; inspecione tabelas/colunas/constraints/índices e histórico disponível com acesso somente leitura. Registre conhecido/desconhecido. Reconcilie diferenças, valide backup/PITR e restauração isolada. Revise o schema numa cópia descartável representativa. Se o histórico continuar desconhecido, pare antes de aplicar em produção.
2. **Leitura:** `npm run db:baseline:check`. Se já pronto, dispense ensure. Schema ausente segue a preparação abaixo; conflitos exigem reconciliação, nunca contornar validação.
3. **Preparação aprovada, se necessária:** depois de revisar alvo, faltantes e backup, execute `npm run db:baseline:ensure -- --apply` na janela aprovada.
4. **Gate:** `npm run db:baseline:check` deve retornar 0. Salve relatório sem dados sensíveis junto da revisão. Planeje a etapa seguinte sem escritores concorrentes capazes de remover a fundação.
5. **Schema aprovado separadamente:** revise artefatos de `npm run db:generate` e a diferença proposta pelo push, então execute `npm run db:push` após aprovação dessa alteração. Cancele diante de DDL destrutivo/inesperado. Nunca embuta seeds no SQL gerado.
6. **Verificação:** repita check, confira constraints/índices, contagens e backfills específicos do plano e a operação da Ludylops. Check não substitui esses testes. Registre revisão, ambiente, aprovações, comandos e resultados.

### Banco vazio ou anterior à fundação

Não aplique primeiro o schema dependente da #172 a um banco sem o criador padrão. Crie checkout isolado da revisão **pré-008 `f353ce2`**, instale seu lockfile, configure explicitamente o alvo vazio/descartável revisado e aplique esse schema com `npm run db:push` após revisão/aprovação. Na revisão antiga exporte `DATABASE_URL` no processo: ela precede o carregador introduzido aqui. Não reproduza SQL 0021.

Depois, no checkout com estas ferramentas e o mesmo alvo, execute check, ensure aprovado e check novamente. Só então o checkout da #172 (ou outro dependente) pode gerar/revisar/aplicar seu schema pela sequência acima. Não use o schema mais recente para criar fundação se já exige backfill com foreign key. Produção também exige inventário reconciliado, backup quando houver dados e aprovação.

## Recuperação

Falha antes de commit reverte os inserts; repita check antes de tentar novamente. Falha de rede durante commit pode deixar resultado desconhecido: não assuma rollback, reconecte e execute check. Repetir ensure aprovado é idempotente.

Não há comando automático de desfazer seed: após commit, outros dados podem referenciá-lo. Não apague o criador para desfazer a entrega. Se schema falhar, interrompa a implantação e compare estado real com backup/DDL revisado. Use restauração/PITR para alvo isolado e recuperação aprovada; reverter Git não reverte banco.

## Validação offline

```bash
npm test -- creator-baseline
npm test
npm run typecheck
npm run lint -- --ignore-pattern '.claude/**' --ignore-pattern '.worktrees/**'
```

Os testes exercitam SQL parametrizado, transações/rollback, preservação, conflitos, gates, fechamento, CLI executável e ambiente em subprocessos. Não equivalem a PostgreSQL real: antes de implantar, repita o percurso em cópia descartável, verificando locks, constraints e resultados contra o servidor.
