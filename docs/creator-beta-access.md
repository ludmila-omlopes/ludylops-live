# Solicitações de acesso ao beta

Novos criadores entram com Google em `/criar-area` e usam **Solicitar acesso ao beta**. O email vem da sessão autenticada; não é possível indicar outro endereço no pedido. Um pedido pendente é reutilizado quando a pessoa solicita novamente.

O admin geral consulta **Beta áreas → Solicitações de acesso** em `/admin`. **Aprovar** acrescenta o email à lista existente e libera a criação. **Recusar** encerra o pedido sem liberar acesso; a pessoa pode solicitar novamente. Quem solicitou pode usar **Verificar aprovação** para consultar a decisão e, se aprovado, começar a criação. Os pedidos seguintes são carregados em grupos de 50.

No endereço da plataforma, o link **Beta áreas** abre `/admin/beta`, sem consultar dados de live. No endereço da Ludylops, `/admin` mantém os controles existentes e a mesma fila de pedidos. Ambos exigem a permissão de admin geral.

A lista manual continua disponível. Edições exigem a versão exibida pelo admin: se alguém aprovar um pedido enquanto a lista estiver sendo editada, o salvamento é recusado para evitar remover a aprovação. Use **Recarregar emails** e refaça a edição. A lista mantém o limite de 200 emails; admins gerais continuam liberados independentemente dela.

## Persistência e permissões

O fluxo reutiliza `streamerbot_counters`, sem alterar o esquema. A chave `creator_area_beta_access` mantém a lista de aprovados. Cada solicitação usa `creator_beta_request:<hash do email normalizado>` e registra email, situação, data do pedido, data da decisão e admin responsável. As linhas de solicitação são excluídas das listas de contadores. Aprovações e alterações manuais usam a mesma trava transacional; aprovação e liberação são gravadas atomicamente.

- `GET /api/me/creator-area-access`: consulta somente o acesso e o pedido da conta autenticada.
- `POST /api/me/creator-area-access`: solicita acesso para essa conta.
- `GET /api/admin/creator-area-access/requests`: lista pedidos pendentes, com cursor opcional.
- `PATCH /api/admin/creator-area-access/requests/[id]`: recebe `decision: "approved" | "rejected"`, restrito ao admin geral.
- `PATCH /api/admin/creator-area-access`: edita a lista manual com `emailsText` ou `allowedEmails` e `expectedUpdatedAt`.

Mutações exigem origem confiável. Falhas de armazenamento não concedem acesso e retornam um erro para nova tentativa. Repetir uma decisão já concluída não libera novamente um email removido manualmente. Nenhum email ou aviso externo é enviado automaticamente.
