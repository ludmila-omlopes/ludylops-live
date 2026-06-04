# Integração HowLongToBeat

A página pública de jogos da comunidade exibe o tempo médio para zerar quando a sugestão tem uma correspondência confiável no HowLongToBeat.

## Fonte dos dados

A aplicação consulta o próprio site HowLongToBeat em modo best-effort:

1. Baixa a home do HowLongToBeat e lê os scripts referenciados no HTML.
2. Procura dinamicamente qual endpoint `/api/...` está sendo usado pela busca do site, com fallback para `/api/s`.
3. Chama `${searchPath}/init?t=...` para obter token e campos temporários.
4. Envia `POST` para o endpoint descoberto com `searchType: "games"`, `modifier: "hide_dlc"` e os termos do jogo.

Não há chave de API nem variável de ambiente obrigatória para essa integração.

Como a fonte é baseada em busca no site, a integração trata os dados como complementares:

- se houver uma correspondência confiável, o card mostra o tempo de história principal;
- se não houver correspondência confiável, o card mostra `Sem dado confiável`;
- DLCs são evitadas no payload e candidatos fracos são descartados pelo score;
- falhas da fonte externa não impedem a exibição das sugestões.

## Cache

Os dados são persistidos em `game_suggestions` pelas colunas `hltb_*`.

O cache é atualizado quando uma sugestão é criada ou quando o admin corrige o cadastro IGDB do jogo. A listagem pública também tenta atualizar, de forma limitada, até oito sugestões com cache vazio ou vencido por chamada. O cache vence depois de 30 dias.

Buscas sem correspondência confiável são marcadas por apenas 15 minutos. Assim, falhas temporárias do site ou do deploy anterior não prendem a sugestão em estado vazio por 30 dias, e a listagem consegue avançar para outros jogos no lote seguinte.

## Backfill

Para preencher jogos antigos sem depender da listagem pública, rode:

```bash
npm run backfill:hltb -- --limit=100
```

Use `--dry-run` para simular e `--all-statuses` para incluir sugestões fora de `open` e `accepted`.
