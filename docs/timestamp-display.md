# Horários dos eventos

Correção da [#28](https://github.com/ludmila-omlopes/ludylops-live/issues/28).

## Causa e correção

`formatDateTime()` escolhia apenas o idioma `pt-BR`; isso não define o fuso.
O servidor podia formatar o mesmo instante em UTC e o navegador em outro fuso.
Credenciais do Streamer.bot e validade do código de vínculo tinham formatadores
locais com o mesmo problema.

Essas leituras agora usam explicitamente `America/Sao_Paulo`, seguindo a convenção
já usada no fechamento de apostas, histórico da moeda e contadores diários.
Não se subtraem horas do valor armazenado. O banco continua usando `timestamptz`,
os serviços recebem `new Date(occurredAt)` e a serialização continua em ISO UTC.
O schema de eventos exige uma data UTC com `Z`; não aceita uma hora local ambígua.

Exemplo reproduzível: `2026-09-24T01:15:00.000Z` continua sendo esse mesmo instante
no armazenamento e aparece como **23/09/2026, 22:15**. O fuso IANA também aplica
corretamente o horário de verão a eventos históricos. Datas de novas comunidades
seguem a convenção atual do app; preferências de fuso por streamer ficam para
uma entrega própria.

## Verificação

`src/lib/utils.test.ts` cobre um evento aceito pelo schema, a virada de dia,
equivalência de offsets, histórico de horário de verão e valores ausentes.
Execute o teste também com `TZ=UTC` e `TZ=Asia/Tokyo`: o texto deve ser igual.
Os resgates, timestamps e regras de expiração permanecem com o mesmo instante.

Não há migração ou alteração necessária no Streamer.bot. A correção é apenas
na apresentação; não reescreva timestamps antigos para compensar o fuso.
