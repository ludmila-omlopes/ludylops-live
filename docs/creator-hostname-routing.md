# Subdomínios de criadores

## Comportamento da aplicação

O ponto de entrada é `src/proxy.ts`, ao lado de `src/app`. O antigo arquivo na raiz não era carregado pelo build deste projeto; o build deve listar `Proxy (Middleware)`.

`https://mari.ludylops.live/?ref=live` é reescrito internamente para `/c/mari?ref=live`. O endereço visível permanece igual. Só a raiz `/` participa: módulos, APIs, callbacks de login, arquivos estáticos e URLs que já começam com `/c/` mantêm seu roteamento atual.

A função pura `getCreatorRootPath` aceita um único rótulo DNS válido sob `ludylops.live`. Exclui o domínio principal, `www`, palavras reservadas (incluindo `owner`), hosts locais, domínios externos, subdomínios com vários níveis e entradas malformadas. A normalização estrita é compartilhada com o resolvedor público.

A prioridade é o primeiro valor de `x-forwarded-host`, depois `host`, depois a autoridade da URL. Um valor inválido não permite tentar outro cabeçalho. O proxy de entrada precisa controlar `x-forwarded-host`; não exponha um servidor de origem que aceite cabeçalhos de encaminhamento arbitrários da internet. Essa convenção identifica o destino público, não autoriza ações administrativas nem chamadas do Streamer.bot.

O roteamento da raiz não consulta sessão nem banco. `/admin`, `/api/admin`, `/owner`, `/api/owner` e `/me` continuam passando pelo mesmo wrapper Auth.js e pelos guards existentes. Ao renderizar `/c/:slug`, o serviço consulta o domínio cadastrado e o estado do criador: domínio desconhecido, slug conflitante, criador desativado ou arquivado resultam em indisponibilidade, sem recorrer à comunidade padrão. Consulte [a política de disponibilidade](creator-lifecycle.md).

Esta entrega abre a página de reserva existente. Não habilita economia, módulos, administração ou login por streamer; esses fluxos dependem de isolamento e contexto próprios. Não requer migração de banco nem alteração de scripts do Streamer.bot.

## DNS, Vercel e TLS

O código não provisiona DNS nem certificados. Na Vercel, associe `*.ludylops.live` ao projeto `ludylops-live` em **Settings → Domains**, ao ambiente de produção. Confirme a propriedade quando solicitado. O domínio principal e `www` mantêm suas configurações próprias.

Para certificados wildcard, a Vercel precisa controlar os desafios DNS. Use os nameservers indicados pela Vercel; antes de transferi-los, preserve os registros existentes, inclusive MX e TXT. Se não puder trocar os nameservers, a documentação atual descreve a delegação de `_acme-challenge` à Vercel, mantendo o DNS restante no provedor atual. Essa delegação pode afetar certificados de outros provedores. Configure também o registro wildcard que encaminha o tráfego, seguindo os valores atuais mostrados para o projeto. [Configuração oficial de domínios](https://vercel.com/docs/domains/working-with-domains/add-a-domain).

Confirme separadamente a resolução DNS e a emissão/renovação de um certificado que cubra `*.ludylops.live`. Um certificado apenas para `ludylops.live` não cobre os subdomínios. Mantenha a configuração de validação para as renovações. [Certificados na Vercel](https://vercel.com/docs/domains/working-with-ssl).

## Verificação sem mudar o DNS

Use um criador ativo de teste que já tenha `<slug>.ludylops.live` cadastrado em `creator_domains`. Estes comandos enviam apenas leituras ao servidor local e não alteram o arquivo hosts nem o DNS:

```powershell
npm.cmd run dev -- --port 3182
```

Em outro terminal, substitua `mari` pelo slug cadastrado:

```powershell
curl.exe -i -H "Host: mari.ludylops.live" "http://localhost:3182/?ref=smoke"
curl.exe -i -H "Host: mari.ludylops.live" "http://localhost:3182/c/mari?ref=smoke"
curl.exe -i -H "Host: localhost:3182" -H "X-Forwarded-Host: mari.ludylops.live" "http://localhost:3182/"
curl.exe -i -H "Host: missing-smoke-182.ludylops.live" "http://localhost:3182/"
curl.exe -i -H "Host: ludylops.live" "http://localhost:3182/"
```

As três primeiras respostas devem renderizar a mesma identidade (nome no `h1`), sem redirect para `/c/mari`. A raiz desconhecida deve resultar na página não encontrada, nunca na comunidade padrão; a raiz do domínio principal mantém o comportamento anterior. Em respostas transmitidas por streaming, confira também o conteúdo de erro, não apenas o status HTTP. O modo demo guarda criadores somente na memória; um processo reiniciado não conserva reservas anteriores.

Em banco descartável, repita com criadores `disabled` e `archived` e confirme a indisponibilidade. Não mude o estado de um criador de produção para executar esse teste. Confira também `/admin`, `/owner`, `/me` e suas APIs sem sessão: as proteções existentes devem continuar valendo.

## Verificação após o deploy

```powershell
Resolve-DnsName mari.ludylops.live
curl.exe -i "https://mari.ludylops.live/?ref=smoke"
```

Não use `-k`: ele esconderia falhas de certificado. Compare a identidade do `h1` com `https://ludylops.live/c/mari`. Abrir a URL do preview com outro cabeçalho `Host` não comprova a configuração da borda da Vercel; a verificação pública exige o domínio associado ao deploy.

| Sintoma | Onde investigar |
| --- | --- |
| Host não resolve | DNS/nameservers e registro wildcard |
| Erro de certificado antes do HTTP | Cobertura TLS e validação DNS |
| Erro de domínio/deploy da Vercel | Associação do wildcard ao projeto e ambiente |
| Conteúdo da comunidade padrão na raiz do streamer | Versão implantada e cabeçalhos encaminhados |
| Página não encontrada | Registro do domínio, correspondência do slug e status do criador |
| Falha de banco | Conexão/schema; o resolvedor não substitui erros por outro criador |

Testes automatizados: `npm test -- creators proxy`. Eles verificam o parser, o matcher real do Next, a composição das respostas Auth.js e os estados do resolvedor público. DNS/TLS são verificações externas; passar os testes não comprova sua configuração.
