# Negocieê

**Seu lugar para comprar, vender e alugar.**

Portal independente de classificados: imóveis, veículos, eletrônicos, móveis, eletrodomésticos, equipamentos rurais e outros produtos, com contato direto pelo WhatsApp do anunciante. **Não compartilha tabelas, credenciais nem implantação com o sistema ALP.**

- Frontend React/Vite em `web/` para Vercel.
- API Express/Prisma em `api/` para Render.
- PostgreSQL em projeto Neon exclusivo para este portal.
- GitHub para código e verificação automática.

## Configuração comercial

O Negocieê cobra somente pela divulgação dos novos anúncios, sem comissão de intermediação. Planos, cupons e créditos dos parceiros continuam ativos. Veja [CLASSIFICADOS.md](CLASSIFICADOS.md) para implantação e tratamento dos anúncios antigos.

| Plano      | Preço    | Prazo   |
| ---------- | -------- | ------- |
| Divulgação | R$ 29,90 | 30 dias |
| Destaque   | R$ 59,90 | 30 dias |

Destaque aparece antes dos anúncios básicos. O prazo começa na primeira aprovação após confirmação do pagamento. Reaprovar não reinicia o prazo. Não há renovação automática. O aceite guarda texto integral, versão, condições, data e vínculo ao usuário. Registros e condições antigas são preservados.

A contratação exige ativação, credenciais de produção do Mercado Pago e preços válidos. Percentuais de comissão não são mais usados para novos anúncios.

## O que está implementado

- Catálogo com pesquisa por texto, categoria, tipo, finalidade, cidade, estado e preço.
- Cadastro/login, perfil, recuperação de senha por e-mail e painel com nome do usuário e botão Sair.
- Novo anúncio em cinco etapas, campos por categoria, até 12 fotos com reordenação e escolha de capa.
- Checkout Pro por Preferences, confirmação autenticada do pagamento e revisão administrativa antes da publicação.
- Contato direto pelo WhatsApp autorizado no anúncio. Anúncios antigos exigem autorização do responsável antes de disponibilizar o número antes privado.
- Encerramento de anúncio pelo anunciante, sem registro de comissão para novos anúncios.
- Parceiros, cupons, créditos, solicitações de saque e baixa manual do Pix. O sistema não transfere dinheiro automaticamente.
- Gerenciamento de clientes e histórico de ações administrativas. Negociações antigas mantêm seus registros e ferramentas históricas.

## Rodar localmente

Requisito: Node 22+ e PostgreSQL. Copie `api/.env.example` para `api/.env` e `web/.env.example` para `web/.env`. Configure uma conexão de banco exclusivo e `JWT_SECRET` aleatório com 32+ caracteres. Não envie senhas pelo chat nem ao GitHub.

```sh
cd api
npm ci
npm run generate
npm run db:deploy
# Configure ADMIN_EMAIL, ADMIN_PASSWORD (12+ caracteres), ADMIN_NAME no .env:
npm run seed
npm run dev
```

Em outro terminal:

```sh
cd web
npm ci
npm run dev
```

Acesse http://localhost:5173. Sem API, o site mostra imóveis ilustrativos identificados como exemplos e desabilita contatos desses imóveis. Com API e banco vazios, mostra catálogo vazio, sem anúncios fictícios.

## Implantar: Neon → Render → Vercel

### 1. GitHub

Envie este projeto ao repositório **novo** `alexifto-afk/portal-vendasImobiliarias`. Não coloque dentro do ALP. Nunca envie `.env`, senhas, tokens ou URLs privadas de banco.

### 2. Neon

Crie um **novo projeto/banco** para este portal. Não reaproveite o banco ALP. Copie a conexão PostgreSQL com `sslmode=require` para `DATABASE_URL` apenas nos ambientes seguros. Para migration use a URL direta do Neon; para runtime pode usar a URL com pool do Neon. Aplique o esquema no novo banco:

```sh
cd api
npm ci
npm run generate
npm run db:deploy
```

Não utilize `prisma db push` em produção. As migrações versionadas estão em `api/prisma/migrations/`. Faça backup antes de mudanças futuras.

### 3. Render

Use **New → Blueprint** com o novo repositório e `render.yaml`, ou **New → Web Service**, Root Directory `api`, Build `npm ci --include=dev && npm run generate`, Start `npm start`, Health Check `/api/health`.

Configure:

- `DATABASE_URL`: conexão Neon deste portal.
- `JWT_SECRET`: segredo aleatório de 32+ caracteres (Blueprint pode gerar).
- `WEB_ORIGIN`: URL HTTPS exata do frontend Vercel, sem barra no fim. Pode configurar a URL após criar o frontend e redeployar a API.
- `NODE_ENV=production`.
- Dados do corretor e valores: defaults estão em `render.yaml` e `.env.example`.

As migrações pendentes são aplicadas pelo `npm start` antes de iniciar a API. O seed deve ser executado uma vez de forma controlada, localmente contra o Neon ou por shell com acesso ao banco. **Não rode o seed a cada deploy.** Configure nome, e-mail e senha do administrador, execute `npm run seed` e remova `ADMIN_PASSWORD` do ambiente quando concluir. O seed não substitui credenciais existentes.

O serviço gratuito pode suspender por inatividade; o primeiro acesso pode demorar. Para disponibilidade comercial constante, avalie um serviço adequado. As novas fotos são armazenadas no PostgreSQL Neon, sem depender do disco do Render. O armazenamento consome a cota do banco. Anúncios antigos com URLs externas continuam funcionando.

### 4. Vercel

Importe o novo repositório. Root Directory `web`, Framework Vite, Build `npm run build`, Output `dist`.

Configure `VITE_API_URL=https://SUA-API.onrender.com/api` e faça deploy. Coloque a URL final da Vercel em `WEB_ORIGIN` no Render e redeploye a API. Variáveis `VITE_*` são públicas: nunca coloque segredos nelas.

### 5. Habilitar contratação

1. Configure `MP_ACCESS_TOKEN`, `MP_COLLECTOR_ID` e a assinatura do webhook de produção no Render, preservando as credenciais já utilizadas pelo portal.
2. No administrador, em Configurações, ative a contratação e pagamento de novos anúncios. As variáveis antigas `SALE_COMMISSION_BPS` e `RENT_COMMISSION_BPS` não definem comissão para novos anúncios.
3. Valide em homologação o anúncio, cupom, pagamento, revisão, contato e encerramento. Não faça testes de cobrança real sem autorização.

## Pagamento, publicação e contato direto

1. O anunciante cria a conta e preenche as etapas de categoria, detalhes, fotos, localização e revisão/pagamento.
2. Confirma o WhatsApp que poderá ser acessado pelos interessados, escolhe o plano, aplica eventual cupom e aceita as condições.
3. Conclui o Checkout Pro. Se o checkout falhar depois do cadastro, o anúncio fica salvo para retomar o pagamento sem duplicação.
4. O backend confirma o pagamento via webhook assinado ou consulta autenticada, validando valor, moeda, modo real, conta recebedora e referência.
5. O administrador revisa e aprova a publicação. O interessado usa o botão de contato direto, sem formulário de interesse no portal.
6. Negociação, pagamento do produto, entrega ou visita são combinados entre as partes. Clicar no WhatsApp não envia mensagem automaticamente.
7. O anunciante pode encerrar a divulgação no painel quando concluir o negócio. Não há comissão nos novos anúncios.

## Limites e próximos passos antes de operação real

- O portal não intermedeia nem recebe o pagamento do produto negociado. O Mercado Pago continua recebendo apenas a contratação do anúncio.
- Saques de parceiros continuam por Pix manual fora do portal, com registro administrativo posterior.
- Registros de negociações e comissões antigas são históricos, sem recálculo automático ou alteração de contratos aceitos.
- Reembolsos e chargebacks devem ser acompanhados no Mercado Pago. O webhook de produção processa estornos recebidos e retira o anúncio; não há varredura periódica de reconciliação. Confira entregas e retire o anúncio manualmente se necessário. Uma tentativa paga duplicada não gera novo prazo; confira e devolva duplicidades pelo PSP.
- Há recuperação de senha por código de e-mail após configurar o remetente. O anunciante pode atualizar o contato e encerrar o anúncio; não há edição dos demais campos/renovação, notificações comerciais automáticas nem assinatura digital. As fotos enviadas são validadas, reduzidas e convertidas para WebP, sem os metadados originais.
- O catálogo retorna até 100 anúncios, o painel até 500 registros e o histórico até 200 eventos recentes. Totais no painel correspondem a essa janela. Paginação e relatórios completos são evolução necessária com aumento de volume.
- Rate limit é em memória, adequado a instância única; para múltiplas instâncias use armazenamento compartilhado. JWT fica em sessionStorage e expira em 8h; logout remove a sessão do navegador.
- Imagens de exemplo são externas do Unsplash; fontes do Google Fonts. O catálogo de exemplo só aparece quando a API está indisponível e é identificado. APIs funcionais exigem Neon configurado.
- Política de privacidade e condições são texto inicial a completar; solicitações de dados, cancelamento e reembolso são tratadas pelo responsável, com observância dos direitos legais aplicáveis.

## Verificação

```sh
cd api
npm test
cd ../web
npm run build
```

Há testes de categorias, confirmação financeira, projeção pública, contato autorizado, parceiros, autenticação e configuração. A mudança para classificados também foi validada em PostgreSQL local e no navegador em computador e celular, com checkout simulado; isso não substitui homologação do provedor.

## Upload de fotos e configuração pelo administrador

Veja [ATUALIZAR-FOTOS.md](ATUALIZAR-FOTOS.md) para o histórico da implantação de fotos. A configuração comercial atual está em [CLASSIFICADOS.md](CLASSIFICADOS.md). O comando `npm start` da API aplica as migrações pendentes antes de iniciar o servidor. Use `npm ci --include=dev && npm run generate` no build do Render para manter o CLI Prisma disponível.

## Compra de teste para obter Order ID no Developers

O painel administrativo tem uma aba **Teste Mercado Pago**, com credencial exclusiva `MP_TEST_ACCESS_TOKEN` no Render. Não é necessário ativar cobranças comerciais para testar. Veja o passo a passo em [TESTAR-MERCADO-PAGO.md](TESTAR-MERCADO-PAGO.md). A criação usa Checkout Pro via Orders e não modifica o fluxo comercial por Preferences nem o sistema ALP.

## Qualidade da integração de pagamentos

Veja [QUALIDADE-MERCADO-PAGO.md](QUALIDADE-MERCADO-PAGO.md) para os campos adicionais, o uso do SDK oficial e o procedimento de nova medição após homologação. Dados sintéticos ficam restritos ao teste; a cobrança comercial solicita dados reais do pagador.

## Retornos, webhooks e política 3DS

Veja [RETORNOS-WEBHOOKS-3DS.md](RETORNOS-WEBHOOKS-3DS.md) para implantar os endpoints de notificação, configurar as assinaturas secretas por ambiente e realizar nova medição. O fluxo Orders de teste recebe Back URLs HTTPS e liability shift obrigatório; a cobrança comercial por Preferences continua compatível com seu próprio schema. Deep links de aplicativo mobile exigem um aplicativo que este projeto ainda não possui.

## Boas práticas de dados do pagador

Veja [BOAS-PRATICAS-PAGADOR.md](BOAS-PRATICAS-PAGADOR.md) para código externo do item, telefone, autenticação, histórico confirmado do portal e mensagens de retorno, com separação dos dados reais e de homologação.

## Parceiros e cupons

Veja [PARCEIROS-E-CUPONS.md](PARCEIROS-E-CUPONS.md) para implantação, cadastro dos blogueiros, descontos, extrato, saques manuais por Pix, compensação de estornos e testes de concorrência com PostgreSQL isolado.

## Navegação e perfil do usuário

Veja [NAVEGACAO-E-PERFIL.md](NAVEGACAO-E-PERFIL.md) para as abas e tabelas de parceiros/cupons, pesquisa, edição/exclusão protegida, cadastro com CPF/celular/endereço, Meu perfil e os botões de sessão no topo.

## Login e senha do parceiro

Em Novo parceiro, o administrador pode criar a conta e a parceria com nível Parceiro no mesmo formulário. Veja [ACESSO-DO-PARCEIRO.md](ACESSO-DO-PARCEIRO.md) para os dados de acesso, as permissões e a alternativa de vincular uma conta existente.

## Clientes cadastrados

Veja [CLIENTES-CADASTRADOS.md](CLIENTES-CADASTRADOS.md) para pesquisar usuários no painel administrativo, editar e detalhar cadastros, excluir contas sem vínculos e transformar clientes em parceiros preservando suas credenciais e seus anúncios existentes.

## Esqueci minha senha

Veja [RECUPERAR-SENHA.md](RECUPERAR-SENHA.md) para ativar o código de recuperação por e-mail, configurar `RESEND_API_KEY` e `RESET_EMAIL_FROM` no Render e validar a troca de senha e a revogação de sessões anteriores.

## Identidade Negocieê

Veja [IDENTIDADE-NEGOCIEE.md](IDENTIDADE-NEGOCIEE.md) para a marca aprovada, cores, arquivos de logomarca/ícone, aplicação nas telas e atualização dos nomes de e-mail e checkout.
