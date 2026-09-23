# Plan 027: Nome, cores e acessos da comunidade

Issue: [#213](https://github.com/ludmila-omlopes/ludylops-live/issues/213).
Estado: DONE, PR #214 integrado. Base: `094d1bd`, após o PR #212.

## Entrega

- Edição de nome e duas cores pelo dono em `/criar-area`, sem trocar slug/domínios.
- Persistência atômica, autorização dentro da transação e conflito para edição
  desatualizada. Preservação de branding não editado, moeda e demais dados.
- Início público com links para moeda, ranking e frases da própria comunidade,
  respeitando módulos, dependências e ativação da economia.
- Remoção dos placeholders de módulos ainda indisponíveis. Cores com texto
  legível, nomes longos e apresentação quando não há recurso disponível.

## Verificação

935 testes gerais, 5 testes PostgreSQL locais, tipagem, lint, build e UI
desktop/mobile passaram. Detalhes em [docs/creator-profile.md](../docs/creator-profile.md).

Sem migração ou configuração nova do Streamer.bot. O merge continua com a
usuária. Preços, ganhos por presença/inscrições e demais verticais continuam na #203.
