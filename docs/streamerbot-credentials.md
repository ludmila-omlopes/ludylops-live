# Credenciais do Streamer.bot por streamer

Cada credencial identifica exatamente um streamer. Só a operadora da plataforma pode emitir, substituir ou revogar credenciais em `/owner`, usando a autorização existente de `PLATFORM_OWNER_EMAILS`. Ser dono de uma comunidade não concede acesso global. O segredo aparece apenas na resposta da emissão; listagem e revogação nunca o devolvem.

## Preparar a aplicação

1. Integre o schema operacional da #172 (PR #194 leva à `master` a entrega do #193) antes desta migração. Revise `drizzle/0024_lonely_lady_deathstrike.sql`: uma tabela nova, sua FK para `creators` e um índice. Não há seeds, DROP ou alteração de tabelas existentes.
2. Siga [o procedimento do banco](database-migrations.md): inventário, backup, revisão em cópia descartável, `db:baseline:check`, ensure aprovado se necessário, novo check e schema push aprovado. Aplique o schema antes de disponibilizar emissão de credenciais. Esta implementação não aplica mudanças a bancos compartilhados.
3. Configure `STREAMERBOT_CREDENTIAL_ENCRYPTION_KEY` no gerenciador de segredos da aplicação: **32 bytes aleatórios em Base64 padrão** (44 caracteres, terminando em `=`). Use uma chave exclusiva deste ambiente. Não reutilize `NEXTAUTH_SECRET`, a chave global ou qualquer credencial de streamer. Não use prefixo `NEXT_PUBLIC_`; não coloque essa chave no Streamer.bot, no banco ou no Git. Guarde backup no gerenciador de segredos.
4. Inicialmente, mantenha `STREAMERBOT_LEGACY_AUTH_ENABLED=true` e a chave global existente apenas na instalação da Ludylops. Não distribua a chave global a outro streamer.

Sem chave de criptografia válida, a emissão falha antes de escrever e a autenticação por credencial não aceita pedidos. A compatibilidade antiga funciona sem essa chave, mas exige o registro real da Ludylops ativo e o módulo `streamerbot` instalado quando há banco configurado. Falta de schema, de registros ou indisponibilidade do banco nunca cria uma autorização sintética em produção. A interface informa indisponibilidade; não migra o banco automaticamente.

## Emitir e configurar

1. Em `/owner`, localize o streamer ativo com Streamer.bot habilitado. Abra **Gerenciar credenciais** e use **Criar credencial**. Há uma credencial ativa por streamer; use substituição para trocar uma já emitida.
2. Guarde o ID público e o segredo exibidos. Ao ocultar ou fechar, o segredo não pode ser recuperado. Se perder a resposta da emissão, substitua a credencial ativa; não existe endpoint de recuperação do segredo.
3. No Streamer.bot, configure três variáveis globais **persistidas**, do tipo texto: `lojaneon.appBaseUrl` (origem HTTPS sem caminho, query ou barra final), `lojaneon.streamerbotCredentialId` e `lojaneon.streamerbotCredentialSecret`.
4. Atualize o código das actions a partir de `streamerbot/` ou do catálogo de scripts. Todos os dez scripts que enviam comandos agora exigem o ID e o segredo novos. O script local de lista de comandos não usa autenticação HTTP.
5. Adicione uma action manual com `check-credential.cs` em **Core > C# > Execute C# Code** e execute. O log deve mostrar status 200 e o `creatorId` esperado. Esse teste não altera saldo, apostas, quotes, contadores ou fila; registra somente a autenticação e a data de último uso da credencial.
6. Na Ludylops, teste um comando sem alteração de saldo, como a consulta de pontos, antes dos eventos automáticos. A instalação real do Streamer.bot e a comunicação com serviços externos exigem esse teste operacional; o teste local de assinatura não os substitui.

Não exporte variáveis com segredos nem as mostre em capturas ou chat. Os scripts não embutem credenciais e enviam cabeçalhos por requisição usando `HttpRequestMessage`/`HttpClient`, sem modificar cabeçalhos compartilhados do cliente.

As instruções foram conferidas em 2026-09-20 na documentação oficial: [GetGlobalVar](https://docs.streamer.bot/api/csharp/methods/core/globals/get-global-var), [SetGlobalVar](https://docs.streamer.bot/api/csharp/methods/core/globals/set-global-var), [Execute C# Code](https://docs.streamer.bot/api/sub-actions/core/csharp/execute-csharp-code/) e [requisições HTTP em C#](https://docs.streamer.bot/examples/http-post). `GetGlobalVar<string>(nome, true)` lê variáveis persistidas; o exemplo oficial de HTTP usa conteúdo UTF-8 e cabeçalhos por requisição.

## Substituir, testar e revogar

1. Selecione **Substituir credencial** na credencial ativa. A nova fica ativa; a anterior passa a `retiring` com validade de 24 horas. Ambas funcionam nesse intervalo. Emissões e substituições concorrentes são serializadas por streamer dentro de uma transação.
2. Atualize ID e segredo nas variáveis persistidas. Execute a action de teste e confirme o novo ID no resultado. Depois confira **Última autenticação** e os comandos/eventos configurados.
3. Revogue a credencial antiga ao terminar a troca. Ela deixa de aceitar novas autenticações imediatamente; uma requisição já autorizada pode terminar. Ao fim das 24 horas, a antiga também é recusada mesmo sem revogação manual.
4. Se a troca falhar durante a janela, volte às variáveis anteriores enquanto essa credencial não estiver revogada/expirada. Para abandonar a nova, revogue-a; uma nova emissão ativa continua possível. Nunca reative uma credencial revogada. Para a Ludylops, os scripts antigos e a variável antiga também podem ser restaurados enquanto a compatibilidade global estiver explicitamente habilitada.
5. Se revogar a única credencial ativa, emita outra e atualize as variáveis. Não reexecute os comandos da live apenas para testar autenticação: use a action de teste.

A substituição acima troca a chave de um streamer, não a chave mestra de criptografia. Alterar a chave mestra sem recriptografar os registros torna as credenciais indecifráveis. Sua troca exige um procedimento separado de recriptografia/backup e implantação coordenada; esta entrega não a automatiza.

## Encerrar a chave global

Logs `[streamerbot/auth] authenticated` registram apenas `mode`, `creatorId` e ID público da credencial. `mode: legacy` identifica uso da chave global. Não há corpo, assinatura ou segredo nesses logs. As credenciais novas também registram `lastUsedAt`, inclusive no teste de conexão; isso comprova autenticação, não a execução de um comando.

Primeira revisão de remoção: **2026-10-04 ou 14 dias completos após a troca de todas as actions, o que ocorrer depois**. Exija zero autenticações `legacy` nesse período, cobertura de todos os triggers/actions da Ludylops (incluindo eventos raros testados de forma controlada), novos IDs observados e janela de rollback encerrada. Depois defina `STREAMERBOT_LEGACY_AUTH_ENABLED=false`, verifique que pedidos antigos retornam 401 e que a action nova continua válida. Remova `STREAMERBOT_SHARED_SECRET` do servidor e a variável antiga do Streamer.bot. Remover o código de compatibilidade é um follow-up após essa evidência; a data sozinha não autoriza desligamento automático.

## Limites de autorização

Eventos, vínculo, pontos, apostas, contadores, mortes e roleta continuam indisponíveis para streamers diferentes da Ludylops. Em quotes, o piloto #173 permite apenas `create` e `get` com credencial própria, criador ativo e módulos `streamerbot` e `quotes` instalados. A numeração pertence à comunidade autenticada. `show` continua respondendo 403 `operation_not_isolated` antes de consultar saldo, preço ou live globais.

O teste de conexão mantém `operationalAccess: false` para outros streamers (acesso operacional completo indisponível), mas agora informa `quoteActions: ["create", "get"]` quando essas ações estão habilitadas. Isso não libera OBS nem a economia. O protocolo e os scripts existentes não mudam nesta entrega. Veja o [contrato de isolamento e as dependências restantes](creator-scoping.md). O plano 019 adicionará a política completa de dependências dos módulos. Bridge e seus segredos/filas continuam em entrega separada.

## Protocolo e armazenamento

HMAC SHA-256, hexadecimal minúsculo, calculado com o segredo textual em UTF-8 sobre os seguintes campos separados por LF (`\n`), sem LF extra após o corpo:

```text
v2
<timestamp decimal de 13 dígitos, UTC em milissegundos>
<ID sbc_ seguido de 32 caracteres hexadecimais>
POST
<pathname exato, por exemplo /api/internal/streamerbot/quotes>
<corpo bruto UTF-8>
```

Os cabeçalhos são `x-streamerbot-credential-id`, `x-timestamp` e `x-signature`. O método e o caminho fazem parte da assinatura para impedir reaproveitamento em outro endpoint. Não há query string nos endpoints dos scripts. Não reserialize o JSON após assinar. A tolerância de relógio continua em ±5 minutos; não é uma garantia de execução única dentro da janela. Preserve a idempotência dos eventos e evite retries automáticos de comandos não idempotentes.

`streamerbot_credentials` guarda ID público, `creator_id`, segredo cifrado, status, criação, fim da transição, revogação e último uso. AES-256-GCM usa IV aleatório de 12 bytes e tag de 16 bytes; os IDs de credencial e streamer entram como dados autenticados para impedir troca de ciphertext entre registros. O formato é `v1.iv.tag.ciphertext` em Base64url. A chave mestra fica fora do banco. Veja a [API de criptografia do Node.js](https://nodejs.org/api/crypto.html).

O modelo protege segredos em dumps e acesso de leitura ao banco. Não protege contra comprometimento do processo/gerenciador de segredos ou do computador do Streamer.bot. Acesso de escrita ao banco já pode alterar políticas e estados de revogação; essa ameaça requer os controles operacionais do banco. A interface guarda a resposta de emissão só em memória, com `Cache-Control: no-store`, sem localStorage. Erros de autenticação/gestão são sanitizados e não imprimem exceções do banco.

## Diagnóstico

- **401:** ID/segredo incorretos, assinatura/caminho/corpo alterados, relógio fora da janela, credencial revogada/expirada ou compatibilidade antiga desligada.
- **403 `creator_unavailable`:** streamer inativo, módulo desabilitado/ausente ou fundação sem os registros necessários.
- **403 `operation_not_isolated`:** autenticação válida, mas o comando ainda usa dados globais; não contorne com o ID da Ludylops.
- **503:** banco/schema, chave mestra ou serviço de autenticação indisponível. Revise o deployment; não retorne à chave global automaticamente.
