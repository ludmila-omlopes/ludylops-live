# 037 — Preparação do piloto com duas comunidades

Issue #231; prepara a #227 sem encerrar seu aceite operacional.

- Comando `pilot:check` somente leitura: colunas necessárias, variáveis do processo, donos Google distintos, módulos/dependências, regra de chat, credencial ativa decifrável e item disponível.
- Saída limitada a verificações e slugs, sem identidades de contas ou segredos. Erros sanitizados; nenhuma chamada ao Streamer.bot, escrita no banco ou alteração de configuração.
- `configurationReady` não significa piloto aprovado; heartbeat é somente uma observação. Sem migração.
- [Roteiro e registro da preparação](../docs/creator-pilot.md) cobrem casos reais, evidências e interrupção/retomada.

Teste 1 e Teste 2 foram criadas a pedido da usuária sob sua conta existente. A segunda conta dona, configuração real das integrações e ativação do ambiente escolhido ainda são necessárias para o piloto completo.

Validação: 38 testes focados; 1.060 testes gerais aprovados (72 PostgreSQL opt-in não executados), tipos, lint, build e consultas somente leitura no banco configurado. As duas comunidades responderam HTTP 200 com os nomes esperados. Nenhuma execução no Streamer.bot real.
