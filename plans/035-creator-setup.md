# 035 — Preparação da primeira live

Issue #225. Implementação concluída; aguardando merge.

Consulta autenticada e sem cache em /api/me/creator-area/[id]/setup, com autorização do dono dentro da transação. A verificação em /criar-area separa configurações salvas, autenticação recebida e teste operacional. Usa somente metadados, contagens e estado de módulos/economia; não devolve segredos ou dados de espectadores. Credenciais revogadas/expiradas não comprovam autenticação atual.

A ausência de banco é explícita em demo. Falhas retornam indisponibilidade e removem resultados antigos. Não há migração nem ativação automática. A UI não declara bridge conectado: a persistência de heartbeat e recuperação será tratada na #226. Textos deixam de prometer presença/bolões para novos streamers.

Validação: 1018 testes gerais; dois testes PostgreSQL reais de isolamento, dependências e lifecycle. Tipos, lint e build aprovados. Navegador desktop e 390 px: dois donos, sessão ausente, atualização após salvar regra, link de resgates e erro sem dados obsoletos; sem overflow ou erro JavaScript.
