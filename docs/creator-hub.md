# Creator Hub e comunidades

Creator Hub é o nome provisório da plataforma. O mesmo projeto da Vercel atende a plataforma e as comunidades; não há um deploy por streamer.

| Endereço | Comportamento |
| --- | --- |
| `https://ludylops-youtube-dashboard.vercel.app/` | Entrada do Creator Hub, reescrita para `/criar-area` |
| `<plataforma>/criar-area` | Criação e configuração das comunidades do usuário |
| `<plataforma>/owner` | Administração das comunidades pelo proprietário da plataforma |
| `<plataforma>/c/<slug>` | Comunidade selecionada explicitamente |
| `https://ludylops.live/` | Comunidade Ludylops e suas rotas existentes |
| `<plataforma>/c/ludylops` | Redireciona ao domínio da Ludylops após validar sua disponibilidade |

O endereço provisório usa um alias de produção já existente. `NEXT_PUBLIC_PLATFORM_URL` permite trocar a origem canônica; configure antes do build. Localmente, use `http://localhost:3000` (ou a porta utilizada). `APP_URL` continua independente, para as integrações existentes.

Hosts locais, a origem canônica e os hosts exatos informados pelas variáveis da Vercel são reconhecidos como plataforma. Não há autorização genérica para `*.vercel.app`. Nesses hosts, `/`, `/me`, `/ranking` e outras rotas sem slug não selecionam Ludylops implicitamente. Os links antigos `/c/<slug>` em `ludylops.live` continuam válidos.

Novas comunidades recebem um endereço `/c/<slug>` e não criam registros fictícios de subdomínios `*.ludylops.live`. Registros de domínio existentes são preservados. O provisionamento e a verificação de domínios próprios continuam sendo uma etapa separada.

## Login e implantação

O login Google usa o hostname em que foi iniciado. Antes de disponibilizar a plataforma no alias da Vercel, acrescente este retorno ao cliente OAuth de produção, mantendo o retorno existente da Ludylops:

```text
https://ludylops-youtube-dashboard.vercel.app/api/auth/callback/google
```

Em 25/09/2026, a tentativa nesse alias retornou `redirect_uri_mismatch`; o cliente de produção tinha somente o retorno de `ludylops.live`. Essa configuração externa é requisito para validar o login completo. Não é necessário gerar outro segredo. As sessões são próprias de cada host: o usuário pode precisar entrar novamente ao trocar de domínio.

## Limite desta etapa

Esta mudança separa identidade, navegação, seleção de comunidade e endereços públicos. Não requer migração de banco. Os saldos históricos, resgates e contratos do Streamer.bot da Ludylops permanecem no fluxo legado. A remoção dessas exceções exige uma migração própria e validação da integração, antes de tratar também a operação interna da Ludylops exatamente como a dos novos streamers. A lista do beta ainda é administrada pelo fluxo existente de administração.

## Validação

- Raiz local/Vercel abre Creator Hub; domínio Ludylops mantém a comunidade.
- `/c/<slug>` exige criador ativo; seletores conflitantes e hosts desconhecidos não recorrem à Ludylops.
- Criação não insere domínio automático e gera link canônico da plataforma.
- Testes completos, TypeScript, lint e build devem passar.
- Confira separadamente a renderização local e o login Google no host real após configurar o retorno e implantar.
