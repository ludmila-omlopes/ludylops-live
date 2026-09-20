# Disponibilidade pública de criadores

`resolvePublicCreatorFromRequest` é a fronteira de consulta para tráfego público e futuras integrações. Ela consulta o status a cada chamada e retorna um criador somente quando está `active`. `requireCreator` aplica a mesma política e lança `creator_unavailable` quando não há resultado.

| Status | Disponibilidade pública | Administração |
| --- | --- | --- |
| `active` | Disponível | Visível e editável |
| `disabled` | Indisponível; pode ser reativado | Visível para recuperação |
| `archived` | Indisponível | Visível no console do proprietário da plataforma; omitido do resumo de áreas do streamer |

A rota `/c/[creatorSlug]` retorna a mesma resposta de página não encontrada para criadores desconhecidos, desativados ou arquivados. Não revela o status nem dados da comunidade. Usa `headers()` para renderização por requisição e transmite o hostname ao serviço; não há cache persistente do status. Reativar permite que a próxima consulta pública encontre o criador novamente. Respostas já enviadas e abas abertas não são removidas retroativamente.

## Como o contexto é resolvido

- Slugs explícitos em opções, `x-creator-slug` e `/c/:slug` precisam ser válidos e concordar entre si. Um valor vazio, inválido, desconhecido ou conflitante falha sem recorrer a Ludylops. Uma chamada interna com somente um slug válido é permitida; fronteiras HTTP devem fornecer também o contexto da requisição.
- Hosts centrais permitidos: `ludylops.live`, `www.ludylops.live`, `localhost`, `127.0.0.1` e `::1`. Também são permitidos os hostnames exatos configurados em `APP_URL`, `NEXT_PUBLIC_APP_URL` e `VERCEL_URL`. Esses valores de implantação identificam hosts centrais da plataforma; não devem ser configurados como o domínio privado de outro criador. Não existe permissão genérica para `*.vercel.app`.
- Nos hosts centrais, `/c/:slug` e slugs explícitos selecionam a comunidade. Sem um slug explícito, Ludylops só é selecionada nos caminhos exatos `/`, `/apostas`, `/contadores`, `/indicacoes`, `/jogos`, `/me`, `/privacy`, `/produtinhos`, `/quotes`, `/ranking`, `/terms` e `/videos`. A ausência de caminho ou um caminho diferente não permite fallback, mesmo que o host central tenha um registro em `creator_domains`.
- Outros hosts, incluindo subdomínios de `ludylops.live`, precisam de um registro em `creator_domains`. Se também houver slug explícito, ele deve pertencer ao mesmo criador. Hosts desconhecidos nunca usam o slug como alternativa. O modo demo exige igualmente um domínio registrado no seu armazenamento em memória.
- O hostname de uma requisição segue a convenção existente: primeiro valor de `x-forwarded-host`, depois `host`, depois a autoridade da URL. O proxy da implantação deve controlar `x-forwarded-host`. Depois que um valor foi escolhido, uma falha não tenta outro cabeçalho. Maiúsculas, espaços externos e portas válidas são normalizados; protocolo, caminho, credenciais e portas inválidas são recusados no argumento de hostname.
- Sem contexto, o resolvedor público retorna `null`. Banco configurado sem registro também retorna `null`; falhas de consulta ou schema são propagadas e nunca substituídas por um criador ativo sintético. Sem banco configurado, o comportamento demo continua disponível, sujeito às mesmas regras de contexto e status.

## Administração e limites desta entrega

`resolveCreatorFromRequest` é um carregador legado de compatibilidade interna/administrativa, sem garantia de disponibilidade pública. `listPlatformCreatorInstances` continua mostrando todos os status e `updatePlatformCreatorStatus` continua permitindo recuperação. Não usar esses carregadores irrestritos para decidir se uma operação pública é permitida.

Esta entrega aplica a política à rota pública `/c/[creatorSlug]` e fornece a fronteira reutilizável. As rotas legadas da comunidade padrão ainda usam seus carregadores atuais. APIs, credenciais e guards de módulos adotarão essa política nos planos 009, 018 e 019; o roteamento de raiz por subdomínio pertence ao plano 016. Não há alteração de schema, exclusão de dados, interrupção de integrações externas nem fluxo de publicação de rascunho.

O console administrativo em modo demo ainda simula a resposta de alteração de status sem persistir a mudança e lista apenas a comunidade padrão. Por isso, validar o fluxo administrativo completo requer banco descartável configurado. Os testes automatizados exercitam as funções reais de listagem, mutação e resolução com um adaptador de banco simulado; não comprovam conectividade ou permissões de um banco real.

## Conferência manual em banco descartável

1. Entre como proprietário da plataforma e escolha um criador de teste ativo. Confirme que `/c/slug-do-teste` abre em um host central permitido.
2. Desative o criador. Atualize a URL pública: ela deve mostrar a mesma página não encontrada de um slug inexistente. A instância deve permanecer visível no console.
3. Reative a instância e confirme que a URL pública volta a abrir.
4. Arquive a instância: a URL volta a ficar indisponível, a instância permanece no console da plataforma e desaparece do resumo de áreas do streamer.
5. Reative a instância de teste. Nenhuma dessas transições deve apagar branding, domínios ou módulos.

Não use uma comunidade de produção para esse teste: desativar ou arquivar altera sua disponibilidade pública real.
