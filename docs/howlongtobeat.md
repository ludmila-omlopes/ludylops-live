# Integração HowLongToBeat

A página pública de jogos da comunidade exibe o tempo médio para zerar quando a sugestão tem uma correspondência confiável no HowLongToBeat.

## Fonte dos dados

A aplicação usa o pacote `howlongtobeat`, um wrapper não oficial do site HowLongToBeat. Não há chave de API nem variável de ambiente obrigatória para essa integração.

Como a fonte é baseada em busca no site, a integração trata os dados como complementares:

- se houver uma correspondência confiável, o card mostra o tempo de história principal;
- se não houver correspondência confiável, o card mostra `Sem dado confiável`;
- falhas da fonte externa não impedem a exibição das sugestões.

## Cache

Os dados são persistidos em `game_suggestions` pelas colunas `hltb_*`.

O cache é atualizado quando uma sugestão é criada ou quando o admin corrige o cadastro IGDB do jogo. A listagem pública também tenta atualizar, de forma limitada, até três sugestões com cache vazio ou vencido por chamada. O cache vence depois de 30 dias.

O cache também registra buscas sem correspondência confiável, evitando consultas repetidas a cada renderização.
