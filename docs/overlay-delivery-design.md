# Entrega dos overlays: medição e decisão

## Decisão

**Manter o polling atual durante o piloto controlado.** A #175 já foi entregue
no [PR #199](https://github.com/ludmila-omlopes/ludylops-live/pull/199). Não há
medição de produção que justifique uma migração de transporte agora. O próximo
trabalho funcional continua sendo o isolamento de dados e configurações por
streamer; concluir este estudo não libera os overlays de outras comunidades.

Revisão em **2026-09-22**, código-base `12ef75c` após o merge do
[PR #200](https://github.com/ludmila-omlopes/ludylops-live/pull/200).
Este documento conclui o escopo reduzido da [#178](https://github.com/ludmila-omlopes/ludylops-live/issues/178).
Nenhum serviço, transporte, cache, configuração ou dado compartilhado foi alterado.

### Como ler os números

- **Observado:** requisições de um navegador local, com condições descritas abaixo.
- **Calculado:** aritmética dos intervalos ou contagem estática de instruções no código.
- **Desconhecido:** telemetria, latência, capacidade e custo reais de produção.

Uma requisição HTTP não equivale a uma consulta SQL, a uma linha processada ou
a uma unidade de cobrança. Nem o número de requisições nem o número de comandos
SQL determina, sozinho, CPU, memória, transferência, tempo de execução ou custo.

## 1. Inventário atual

São cinco componentes em `src/components/obs-*.tsx`. Todos consultam
`GET /api/obs/live-status`, além do endpoint de dados abaixo. Os intervalos são
esperas **depois da conclusão** da chamada anterior; há uma chamada imediata
na inicialização. Os relógios de animação não geram tráfego HTTP.

| Fonte | Endpoint de dados, sob `/api/obs` | Espera dos dados quando ao vivo | Espera do status, online ou offline | Operação dos dados |
| --- | --- | ---: | ---: | --- |
| Quotes: frases salvas da live | `/quotes/current` | 1 s | 5 s | GET com efeitos: expira, processa e atualiza a fila; pode devolver pipetz |
| Apostas | `/bets/current` | 1 s | 15 s | Leitura de apostas/opções, escolha da aposta aberta |
| Meta de likes | `/likes/current` | 1 s | 15 s | Leitura de metas e último evento de likes |
| Inscritos | `/subscribers/current` | 1 s | 15 s | Leitura de até 20 alertas dos últimos 2 minutos e perfis associados |
| Roleta | `/wheel/current` | 1 s | 15 s | Leitura da configuração e último giro; não inicia um giro |

Quando o status responde offline, os cinco suspendem consultas de dados e
continuam consultando status. Uma falha HTTP/rede no status também suspende os
dados; uma falha apenas no endpoint de dados não desliga o status. Os quatro
componentes alterados pela #175 abortam a consulta pendente ao desligar.
Os modos de demonstração explícitos não fazem essas consultas.

Todos os seis handlers usam `force-dynamic` e respostas `no-store`. Não existe
cache compartilhado dessas respostas. Cada browser source mantém seus próprios
timers, mesmo quando várias fontes pertencem ao mesmo streamer. Uma segunda
cópia da mesma fonte também multiplica o tráfego. Fonte realmente descarregada
não consulta; o comportamento das cenas escondidas no OBS real não foi medido.

### Limites de isolamento e de autorização

Os handlers resolvem a comunidade e verificam seu estado e módulos a cada
requisição. Status de live e operações de OBS continuam restritos à comunidade
padrão. O piloto de quotes permite leitura/criação em outras comunidades, mas
o processamento da fila ainda depende de saldo e status globais. O bridge também
usa `defaultCreatorContext` hoje.

Portanto, as projeções para 2 e 5 streamers são **cenários futuros após o
isolamento**, não testes de cinco comunidades já funcionando. Não remover as
restrições atuais para tentar atingir esses números.

Fontes: [handlers OBS](../src/app/api/obs),
[política de módulos](../src/lib/creators/module-access.ts),
[resolução de quotes](../src/lib/creators/quote-context.ts),
[isolamento de dados](creator-scoping.md).

## 2. Trabalho no banco por requisição

**Contagem estática, não medida no PostgreSQL.** Considera esquema válido,
comunidade ativa e caminho de sucesso. Exclui comandos de controle de transação
(`BEGIN`/`COMMIT`/`ROLLBACK`), conexão, retries e erros. As instruções de lock são
contadas. A quantidade de linhas retornadas ou examinadas pode variar muito.

Antes do loader, a resolução pública custa `C` instruções SELECT:

- `C = 4` em host da plataforma: creator por slug + branding + domínios + módulos.
- `C = 5` em domínio próprio registrado: domínio + creator + os três SELECTs acima.
- Input inválido, creator inexistente ou desativado encerra mais cedo; não usar
  esses casos para estimar o custo de uma resposta autorizada.

A verificação de módulos usa os registros já carregados. O proxy de autenticação
não cobre `/api/obs/*`. Não há memoização desses SELECTs entre os pollers.

| Endpoint | Instruções adicionais ao `C` | Condições e efeitos |
| --- | ---: | --- |
| `/live-status` | 1, ou 2 com descoberta de canais no banco | SELECT do override; sem override, pode buscar contas/canais vinculados se não há canais configurados |
| `/bets/current` | 2 | SELECT de todas as apostas e opções; não é limitado a uma aposta no SQL |
| `/likes/current` | 2 | Metas ativas e último evento |
| `/subscribers/current` | 1–2 | Alertas; mais um SELECT de usuários se há identificadores externos |
| `/wheel/current` | 1 | Configuração em `streamerbot_counters` |
| `/quotes/current`, controle pausado | 1 | SELECT do controle; retorna sem processar a fila |
| `/quotes/current`, overlay ativo, nenhuma expiração | 3 | Controle + UPDATE de expiração (mesmo sem linhas) + SELECT do overlay |
| `/quotes/current`, sem overlay ativo e fila vazia | 5 | As três anteriores + lock e SELECT da fila em transação |
| `/quotes/current`, um pedido ativado com sucesso, sem expirações | 12, ou 13 com descoberta de canais | Inclui claim, perfil, status de live, lock do overlay, gravação do overlay e conclusão do pedido |

Na ativação de um pedido já pago, a fila não faz outro débito. Para cada pedido
expirado, somam-se duas instruções no reembolso: UPDATE do saldo e INSERT no
ledger, além do controle de transação. Falha de ativação pode atualizar a fila e
reembolsar também. Esse GET é uma operação de negócio: **não cachear nem juntar
suas chamadas como se fosse uma leitura pura**. Uma mudança de transporte teria
de preservar claim, concorrência, expiração, exibição e reembolso.

Exemplo **calculado**, não observado: host da plataforma (`C=4`), cinco fontes,
override manual, fila de quotes vazia e sem novos inscritos. São 31 instruções/s
dos cinco endpoints de dados, mais `5 × 7/15 = 2,33` instruções/s de status,
antes da latência e do controle de transação. Offline, só esse segundo termo
permanece. Isso ilustra por que `5,47 requisições/s` não significa `5,47 SQL/s`.

### Status do YouTube

O [serviço de status](../src/lib/streamerbot/live-status.ts) mantém respostas
bem-sucedidas por 15 s **na memória de cada processo**, por canal. O override e
a eventual descoberta de canais continuam sendo lidos no banco. Cold starts,
processos diferentes, múltiplos canais e chamadas simultâneas podem gerar novas
consultas ao YouTube. Não há deduplicação de chamadas em andamento.

Em erro do YouTube, o serviço pode devolver o último estado conhecido; não é
garantido que uma falha externa resulte em offline no cliente. Não há SLA de
detecção de início/fim da live. A espera de 15 s no browser pode se somar à idade
do cache e à latência. Custo e consumo de quota externos não foram medidos.

Fontes da contagem: [tenant.ts](../src/lib/creators/tenant.ts),
[repository.ts](../src/lib/db/repository.ts), [wheel.ts](../src/lib/wheel.ts),
[proxy.ts](../src/proxy.ts). Recontar após mudanças nesses loaders.

## 3. Modelo de tráfego

### Hipóteses

Cada streamer mantém uma cópia de cada uma das cinco fontes carregada por
4 horas ao vivo e 8 horas offline por dia; elas ficam fechadas nas outras 12 horas.
Todos usam os mesmos intervalos. Os cenários de simultaneidade assumem lives
coincidentes. Latência é desprezada para o teto nominal de regime estável;
inicialização, reconexões e transições de status acrescentam chamadas e não
estão incluídas. Não são limites rígidos de tráfego por janela.

```text
status/s por streamer = 1/5 + 4/15 = 7/15
dados/s ao vivo       = 5 × 1/1 = 5
ao vivo/s            = 5 + 7/15 = 82/15
offline/s            = 7/15
requisições/dia       = N × 3600 × (4 × 82/15 + 8 × 7/15)
```

| Streamers hipotéticos | Ao vivo: req/s | Offline: req/s | Req/h ao vivo | Req/h offline | Req/dia, 4 h + 8 h |
| ---: | ---: | ---: | ---: | ---: | ---: |
| 1 | 5,47 | 0,47 | 19.680 | 1.680 | 92.160 |
| 2 | 10,93 | 0,93 | 39.360 | 3.360 | 184.320 |
| 5 | 27,33 | 2,33 | 98.400 | 8.400 | 460.800 |

Antes da #175, as taxas nominais eram 9,2 req/s ao vivo e 4,2 req/s offline.
Nas mesmas 4 h + 8 h, seriam 253.440 req/dia por streamer, contra 92.160 agora:
redução **calculada** de 63,6%. A comparação inclui os novos polls de status.
O cenário posterior à #175 já é o código atual; não é uma melhoria pendente.

Para reproduzir a tabela, sem instalar dependências:

```js
const live = 5 + 1 / 5 + 4 / 15;
const offline = 1 / 5 + 4 / 15;
for (const n of [1, 2, 5]) {
  console.log(n, n * live, n * offline,
    Math.round(n * live * 3600), Math.round(n * offline * 3600),
    Math.round(n * (4 * live + 8 * offline) * 3600));
}
```

### Bridge: tráfego separado

O [bridge](../bridge/src/service.ts) consulta `POST /api/internal/bridge/pull`
a cada 2 s por padrão, após processar o lote anterior, e envia
`POST /api/internal/bridge/heartbeat` a cada 30 s. Os valores são configuráveis
em [config.ts](../bridge/src/config.ts); a configuração da máquina real é desconhecida.
Não há pausa automática por offline. O healthcheck do Streamer.bot é tráfego
local, separado das chamadas à aplicação hospedada.

Sem pedidos e sem falhas: `1/2 + 1/30 = 0,5333 req/s`, ou 1.920 req/h por bridge.
Em 12 h são 23.040 requisições; para 1, 2 e 5 bridges, respectivamente,
23.040, 46.080 e 115.200. Em 24 h, dobram. Não somar isso às fontes OBS sem
confirmar quantos bridges estão executando e por quanto tempo.

Cada pedido executado com sucesso acrescenta claim + complete. Claim negado,
falha, retries e duração da execução alteram o total; há backoff nas falhas do
poll. Heartbeat e execução têm gravações próprias. SQL e custo do bridge não
foram medidos. Esses números não comprovam suporte a um bridge por creator.

## 4. Medição local

Evidência versionada: [requisições e tempos relativos](measurements/overlay-delivery-2026-09-22.json).
Windows, Edge headless via Playwright 1.58.2, Next 16.2.9 em build de produção
local. Reutilizado o build validado da #177, cujo código `src`/dependências/config
é idêntico ao merge `12ef75c`. Sem `DATABASE_URL`, chaves externas ou dados reais.

Foram abertas cinco páginas `/obs/{quotes,bets,likes,subscribers,wheel}` sem
`demo=1`, cada uma em sua própria aba. Contaram-se eventos de request para
`/api/obs/*`, respostas HTTP com erro e erros JavaScript. As abas foram abertas
em sequência; por isso suas janelas diferem um pouco e incluem a chamada inicial.

| Cenário observado | Quotes: status/dados | Apostas: status/dados | Likes: status/dados | Inscritos: status/dados | Roleta: status/dados |
| --- | ---: | ---: | ---: | ---: | ---: |
| Offline, handlers locais reais em demo; 16,06–16,46 s por aba | 4 / 0 | 2 / 0 | 2 / 0 | 2 / 0 | 2 / 0 |
| Ao vivo sintético, respostas interceptadas no navegador; 31,09–31,55 s por aba | 7 / 32 | 3 / 32 | 3 / 31 | 3 / 31 | 3 / 31 |

Nenhum erro JavaScript ou resposta HTTP de erro foi observado nessas amostras.
Na segunda, todas as respostas OBS foram substituídas por HTTP 200:
status `{ok:true,data:{isLive:true}}`; dados `null`, ou `[]` para inscritos.
Ela verifica **cadência do cliente**, não latência do backend, consultas SQL,
ativação de eventos, disponibilidade em produção ou capacidade simultânea.
Na primeira, os handlers locais executaram, mas em demo sem banco.

Para repetir: usar somente ambiente descartável, abrir as cinco URLs, observar
16 s após a última navegação offline; depois repetir em novo contexto por 31 s
com as respostas sintéticas acima. Registrar início de cada aba e os timestamps
de cada request, como no JSON. Não apontar a experiência de quotes para produção.

| Dado do piloto real | Situação |
| --- | --- |
| Req/s por creator e quantidade de fontes realmente carregadas no OBS | Desconhecidos |
| Latência entre evento aceito, ativação e primeiro frame visível | Desconhecida; a cadência de 1 s não mede essa latência |
| Erros, retries, duplicações ou eventos perdidos em produção | Desconhecidos |
| SQL por rota, duração, locks, CPU, conexões e linhas examinadas | Desconhecidos; contagem de código acima não é telemetria |
| Topologia efetiva, plano, franquia e faturas de hospedagem/banco | Desconhecidos |

O GitHub registra preview Vercel bem-sucedido no PR #200 e o projeto usa driver
Neon/PostgreSQL. Isso não comprova plano contratado, região, número de instâncias
ou custo do ambiente de produção. **Não há estimativa monetária neste estudo**:
nenhum preço ou limite externo foi presumido. Antes de converter tráfego em
dinheiro, confirmar fatura/topologia e registrar os preços oficiais vigentes,
com URLs e data de consulta. Cache de páginas da #176 não cobre operações OBS.

## 5. Quando revisar a decisão

No primeiro piloto após o isolamento, separar métricas por creator, endpoint e
quantidade de fontes carregadas. Registrar pelo menos uma live e um período
offline, incluindo duração do status no backend e idades da fila. Não registrar
segredos nem conteúdo das quotes para medir isso.

Gatilhos propostos para uma investigação, ainda não SLAs acordados:

1. Qualquer acesso cruzado entre creators, débito duplicado ou perda de pedido:
   interromper a expansão e corrigir autorização/fila antes de avaliar transporte.
2. Depois de confirmado offline, continuar recebendo consultas de dados após
   a transição e as chamadas em andamento: revisar gating/instâncias duplicadas.
3. Em live já detectada, p95 entre ativação e exibição acima de 2 s por pelo menos
   100 eventos: medir onde passa o tempo. É uma margem inicial sobre o timer de
   1 s, não uma conclusão de que polling é o causador. Medir espera na fila e
   detecção inicial de live separadamente.
4. Tráfego sustentado por 10 minutos mais de 20% acima do modelo ajustado ao
   número de fontes: investigar remontagens/reconexões antes de trocar transporte.
5. Atribuição de custo ou saturação mostrando OBS como causa relevante de um
   orçamento/limite realmente contratado: investigar primeiro o endpoint caro.
   O orçamento ainda precisa ser definido; não há valor monetário arbitrado aqui.

A menor próxima investigação é medir resolução de creator, status e fila de
quotes separadamente. Para apostas, medir também as leituras de todas as
apostas/opções. Otimizar queries ou configuração pode resolver o problema sem
alterar a entrega. Não cachear permissões de modo que uma comunidade desativada
continue atendida, nem servir estado de outro creator.

Somente se as medições mostrarem que os polls vazios dominam o custo ou a
latência relevante, abrir um estudo maior comparando as alternativas aplicáveis
(SSE, serviço de tempo real ou bridge local). Ele precisará tratar autenticação
por creator, revogação, reconexão, retomada, consumidores duplicados e confirmação
de exibição. Nenhuma alternativa foi prototipada ou escolhida nesta entrega.
