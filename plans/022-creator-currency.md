# Plan 022: Nome da moeda por streamer

- Issue: [#202](https://github.com/ludmila-omlopes/ludylops-live/issues/202).
- Base: `2020313`, após o merge do PR #201.
- Estado: implementado e validado; revisão e merge do PR pendentes.

## Decisão de produto

Cada comunidade tem sua própria moeda. O nome é configuração de apresentação
e não a chave da economia: duas comunidades podem usar o mesmo nome sem
compartilhar saldo. A identidade da economia será `creatorId`.

Esta primeira entrega permite escolher e alterar o nome. **Não entrega ainda
saldos, ganhos ou gastos independentes.** As operações globais continuam
bloqueadas para outros streamers pela política existente. Não há saldo fictício,
conversão, transferência entre moedas ou mudança nos pipetz da Ludylops.

## Implementação

- `currencyLabel` validado na criação, normalizado em Unicode NFC, entre 1 e
  32 caracteres. Aceita letras, números, espaços, hífens, apóstrofos e underscore.
- Novas comunidades usam `pontos` se o campo for omitido. Nomes existentes são
  mantidos até edição explícita. A comunidade padrão continua com `pipetz`.
- Persistência em `creator_modules.config_json`, módulo `points`, aproveitando
  o campo já existente. Não requer migração nem backfill.
- Em `/criar-area`, o dono pode editar a moeda de suas comunidades ativas.
  A lista das comunidades já existentes permanece acessível mesmo se o dono
  perder a permissão de criar novas comunidades no beta.
- `GET/PATCH /api/me/creator-area/[id]/currency`: sessão autenticada, ownership
  verificado no servidor, origem confiável no PATCH, respostas `no-store`.
  O usuário ativo da sessão é a autoridade; IDs no corpo não são aceitos.
- O PATCH trava a linha do creator e confere estado/ownership dentro da
  transação. Atualiza apenas a chave `currencyLabel` e `updatedAt`; preserva
  outros campos JSON, status e outros módulos. Não instala ou reativa módulos.
- Configuração de módulo desativado é permitida; creator desativado/arquivado,
  módulo arquivado/ausente e acesso de outro dono são rejeitados. A moeda da
  comunidade legada Ludylops não é renomeada por esse endpoint.
- A apresentação pública `/c/<slug>` e a navegação derivada de módulos usam
  o nome daquela comunidade. Não se substituem textos da economia legada por
  uma moeda de outro creator.

## Validação

- Testes de criação em demo e no adaptador de transação, normalização, nomes
  inválidos, duas comunidades, ownership, lifecycle, campos extras, origem e
  falha de infraestrutura sem exposição de detalhes internos.
- PostgreSQL descartável: persistência real do JSON, preservação de outros
  campos/status e bloqueio de leitura/escrita de outro dono.
- Navegador local com duas sessões de demo: criação, alteração, recarga,
  retry após erro temporário, apresentação pública e compatibilidade da Ludylops.
- Types, lint, suíte completa e build em ambiente sem credenciais reais.
- Resultado: 824 testes da suíte passaram, além de dois testes com PostgreSQL
  local. Build de produção, types, lint e fluxo de navegador passaram. A revisão
  visual cobriu desktop e celular; não houve erros de JavaScript no fluxo.

## Próxima entrega

[Plan 023](023-creator-economy.md) detalha o isolamento da economia. O nome próprio
deve acompanhar essa migração, mas configurar o nome não autoriza desbloquear
os módulos operacionais antes dela.
