# 034 — Credenciais do Streamer.bot gerenciadas pelo dono

Issue: [#224](https://github.com/ludmila-omlopes/ludylops-live/issues/224). Implementação concluída; aguardando merge.

## Entrega

- `/criar-area`: dono consulta, emite, substitui e revoga somente credenciais da própria comunidade. O segredo aparece uma vez, em memória, e é descartado ao ocultar, fechar ou atualizar.
- API autenticada usa o viewer da sessão, origem confiável e corpo estrito. Proprietário e disponibilidade são revalidados na transação, com bloqueio do criador antes dos módulos e das credenciais.
- Criação/substituição exige comunidade ativa e integração instalada. Consulta/revogação permanece disponível ao dono de uma comunidade desativada ou arquivada. A gestão da Ludylops continua em `/owner`.
- AES-GCM, assinatura v2, transição de 24 horas e recuperação administrativa existentes são preservadas. Nenhuma migração, ativação de produção ou mudança automática no Streamer.bot.
- Instruções apontam para os scripts existentes e distinguem autenticação recebida de conexão contínua/execução de resgate.

## Estimativa de preparação do beta

Escopo: streamers convidados, página própria, moeda, ganhos por chat e catálogo/resgates. Estimativa em 2026-09-24: **4–6 entregas incluindo esta**, não paridade com todos os recursos da Ludylops.

1. **Esta entrega:** credenciais gerenciadas pelo streamer.
2. [#225](https://github.com/ludmila-omlopes/ludylops-live/issues/225) — Orientação de preparação: o que falta configurar, disponibilidade real dos recursos e texto de entrada coerente com o beta (hoje há promessas de presença/bolões ainda indisponíveis para novas comunidades).
3. [#226](https://github.com/ludmila-omlopes/ludylops-live/issues/226) — Operação e recuperação: diagnóstico da integração/bridge e tratamento seguro de resgates pendentes ou com resultado incerto, preservando a execução única e estorno idempotente.
4. [#227](https://github.com/ludmila-omlopes/ludylops-live/issues/227) — Piloto com dois streamers: ativação controlada da economia, login/vínculo, ganho, compra, execução e falha/estorno com isolamento confirmado em produção.
5. Reservar uma ou duas entregas para problemas descobertos no piloto.

Presença, inscrições, apostas, sugestões e mais automações podem vir depois do primeiro beta. A #203 permanece aberta: já entrega fundação/economia/chat e resgates, mas ainda reúne essas expansões e a ativação controlada. Uma issue agregadora não representa uma única entrega pequena.

## Validação

Testes de API/sessão/origem/corpo estrito; componente/segredo/recuperação; PostgreSQL real com dois donos, IDs cruzados, legado, concorrência, criptografia, desativação e transferência de propriedade; tipos, lint, suíte geral, build e interface desktop/celular. A verificação visual usa dados controlados; não conecta um Streamer.bot real nem altera produção.

Resultado local: 1.013 testes gerais aprovados; 64 testes opcionais de PostgreSQL pulados nessa suíte, com os 7 desta entrega executados separadamente e aprovados no PostgreSQL real. Tipos, lint e build aprovados. Navegador: emissão, substituição, revogação, indisponibilidade, segredo descartado e ausência de overflow em 390 px, com respostas controladas. Não houve teste com um Streamer.bot real.
