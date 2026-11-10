# portal-vendasImobiliarias

Sistema independente de divulgação e intermediação de casas, lotes e fazendas no Tocantins. **Não compartilha tabelas, credenciais nem implantação com o sistema ALP.**

- Frontend React/Vite em `web/` para Vercel.
- API Express/Prisma em `api/` para Render.
- PostgreSQL em projeto Neon exclusivo para este portal.
- GitHub para código e verificação automática.

## Configuração comercial

Lourival Missias Pereira · WhatsApp 55 63 99991-5770 · CRECI informado pelo responsável: 778D-22. A aplicação não consultou nem verificou esse registro.

| Plano      | Preço    | Prazo   |
| ---------- | -------- | ------- |
| Divulgação | R$ 29,90 | 30 dias |
| Destaque   | R$ 59,90 | 30 dias |

Destaque aparece antes dos anúncios básicos. O prazo começa na primeira aprovação, após confirmação do pagamento. Reaprovar não reinicia o prazo. Não há renovação automática. Comissão é separada do anúncio e de responsabilidade do proprietário, sobre venda final ou um aluguel mensal, conforme configuração e contrato. O aceite guarda texto integral, versão, condições, data e vínculo ao usuário. Alterar a configuração não muda anúncios anteriores.

**Comissões começam em zero e contratações ficam desativadas. Não foi presumida nenhuma “taxa obrigatória do CRECI-TO”.** Confirme as condições aplicáveis e o contrato de intermediação antes de configurar os percentuais. O aceite eletrônico implementado não é assinatura digital de contrato completo.

## O que está implementado

- Catálogo público, filtros por finalidade, tipo e cidade, detalhes e galeria.
- Cadastro/login com senha protegida por bcrypt; administradores criados exclusivamente por seed.
- Cadastro de anúncio com dados privados, fotos via URL HTTPS, plano e aceite das condições.
- Checkout Pro do Mercado Pago; o backend consulta pagamentos aprovados, validando modo real, valor, moeda, destinatário e referência. Retorno de navegador não confirma pagamento.
- Aprovação pelo corretor somente após confirmação do pagamento. Anúncios vencidos deixam de aparecer.
- Contato público exclusivamente de Lourival; nome e telefone do proprietário e endereço completo são omitidos da resposta pública.
- Registro de interesse antes de continuar no WhatsApp; etapas de atendimento, data de visita e notas de propostas.
- Registro de fechamento, comissão calculada em centavos e baixa manual após conferência do crédito.
- Resumo da negociação para imprimir/salvar em PDF e completar com profissional habilitado.
- Histórico de ações administrativas.

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

Migrations e seed são executados uma vez de forma controlada, localmente contra o Neon ou por shell com acesso ao banco. **Não rode o seed a cada deploy.** Configure nome, e-mail e senha do administrador, execute `npm run seed` e remova `ADMIN_PASSWORD` do ambiente quando concluir. O seed não substitui credenciais existentes.

O serviço gratuito pode suspender por inatividade; o primeiro acesso pode demorar. Para disponibilidade comercial constante, avalie um serviço adequado. Não há arquivos armazenados no disco do Render: imagens são URLs externas.

### 4. Vercel

Importe o novo repositório. Root Directory `web`, Framework Vite, Build `npm run build`, Output `dist`.

Configure `VITE_API_URL=https://SUA-API.onrender.com/api` e faça deploy. Coloque a URL final da Vercel em `WEB_ORIGIN` no Render e redeploye a API. Variáveis `VITE_*` são públicas: nunca coloque segredos nelas.

### 5. Habilitar contratação

1. Valide os dados e a regularidade profissional, regras de comissão e contrato de intermediação com profissional habilitado. Complete condições de cancelamento/reembolso, identificação do controlador e política de dados.
2. Crie/habilite conta Mercado Pago de quem efetivamente receberá pelo anúncio. Guarde `MP_ACCESS_TOKEN` de produção e `MP_COLLECTOR_ID` da conta no Render. Não coloque no frontend.
3. Configure `SALE_COMMISSION_BPS` e `RENT_COMMISSION_BPS`. São pontos-base: **600 significa 6%**; **10000 significa 100% de um aluguel mensal**. Esses são exemplos matemáticos, não recomendação de taxa.
4. Após validação, configure `COMMERCIAL_ENABLED=true` e redeploye. O sistema também exige token, destinatário, percentuais positivos e preços válidos.
5. Teste o fluxo de ponta a ponta em homologação antes de receber anunciantes reais.

## Pagamento, publicação e intermediação

1. Proprietário cria conta, cadastra imóvel e aceita as condições vigentes.
2. Clica em pagar e conclui o checkout do Mercado Pago.
3. Volta ao painel e clica **Já paguei: verificar**. O corretor também pode consultar o pagamento pelo painel. **Não há webhook nem conciliação agendada nesta versão.**
4. O backend consulta o PSP e confirma somente pagamentos aprovados correspondentes ao anúncio e à conta recebedora.
5. Corretor revisa fotos e texto, remove ofertas com dados privados/contatos no conteúdo reprovando o cadastro, e aprova a publicação.
6. Interessado registra contato e continua no WhatsApp de Lourival. Clicar no link não envia mensagem automaticamente.
7. Lourival organiza a visita, registra proposta e fecha com o proprietário e o comprador/locatário.
8. Registra o fechamento, imprime o resumo para apoiar o contrato e marca a comissão recebida somente após conferir o crédito.

## Limites e próximos passos antes de operação real

- Não existe garantia técnica de impedir fechamento por fora. Contrato de intermediação e registros ajudam a comprovar o atendimento, sem garantir cobrança judicial.
- O resumo de negociação **não é um contrato de compra e venda/locação completo**, não assina documentos e não substitui análise da matrícula, titularidade, escritura ou registro quando aplicáveis.
- O recebimento de comissão é manual. Não há repasse/split automático para o corretor.
- Reembolsos e chargebacks devem ser acompanhados no Mercado Pago; não há reconciliação automática após o pagamento inicial. Retire o anúncio manualmente quando necessário. Uma tentativa paga duplicada não gera novo prazo; confira e devolva duplicidades pelo PSP.
- Não há upload de fotos, recuperação de senha, edição/renovação pelo anunciante, notificações automáticas nem assinatura digital. Fotos devem estar hospedadas em serviço autorizado e podem expor metadados: revise antes de publicar.
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

Há testes de cálculo, critérios de confirmação financeira, expiração/publicação, projeção pública, autenticação e configuração HTTP. Eles não substituem homologação de checkout, migrations e fluxos com um banco Neon real. Não incluem teste de navegador.
