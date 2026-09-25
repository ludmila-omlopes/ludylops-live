# Plan 026: Cadastro e correção de frases pelo streamer

Issue: [#211](https://github.com/ludmila-omlopes/ludylops-live/issues/211).
Estado: DONE, integrado no PR #212. Base: `e379936`, após o PR #210.

## Objetivo e entrega

Dar autonomia ao dono para registrar e corrigir as frases de sua comunidade
pelo navegador. A criação pelo chat continua disponível e compartilha a mesma
numeração. A correção mantém autoria, origem, data e número.

- Formulário exclusivo do dono em `/c/<slug>/quotes`, com link em `/criar-area`.
- API autenticada por proprietário, com origem confiável nas escritas e
  autorização de lifecycle/dependências dentro da transação.
- Listagem de 50 itens por consulta, cadastro resistente a reenvio e correção
  que rejeita texto antigo quando outra edição já foi salva.
- Sem remoção, migração ou mudança de configuração do Streamer.bot.

## Validação e limites

917 testes gerais e 5 testes PostgreSQL específicos passaram, incluindo
concorrência com cadastro pelo chat e isolamento entre comunidades.
Tipagem, lint, build e UI desktop/mobile passaram. Contratos e limites estão em
[docs/creator-quote-management.md](../docs/creator-quote-management.md).

A #203 continua aberta para ganhos por presença/inscrições, preços e integração
das demais verticais com a moeda de cada streamer. A edição de frases é gratuita;
esta entrega não libera chamadas de OBS nem altera a economia da Ludylops.
