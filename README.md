# Negocieê

**Seu lugar para comprar, vender e alugar.**

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
- Cadastro de anúncio com dados privados, upload de fotos JPG, PNG ou WebP, plano e aceite das condições.
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

O serviço gratuito pode suspender por inatividade; o primeiro acesso pode demorar. Para disponibilidade comercial constante, avalie um serviço adequado. As novas fotos são armazenadas no PostgreSQL Neon, sem depender do disco do Render. O armazenamento consome a cota do banco. Anúncios antigos com URLs externas continuam funcionando.

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
3. Volta ao painel e clica **Já paguei: verificar**. O corretor também pode consultar o pagamento pelo painel. O webhook assinado também confirma pagamentos; não há conciliação agendada.
4. O backend consulta o PSP e confirma somente pagamentos aprovados correspondentes ao anúncio e à conta recebedora.
5. Corretor revisa fotos e texto, remove ofertas com dados privados/contatos no conteúdo reprovando o cadastro, e aprova a publicação.
6. Interessado registra contato e continua no WhatsApp de Lourival. Clicar no link não envia mensagem automaticamente.
7. Lourival organiza a visita, registra proposta e fecha com o proprietário e o comprador/locatário.
8. Registra o fechamento, imprime o resumo para apoiar o contrato e marca a comissão recebida somente após conferir o crédito.

## Limites e próximos passos antes de operação real

- Não existe garantia técnica de impedir fechamento por fora. Contrato de intermediação e registros ajudam a comprovar o atendimento, sem garantir cobrança judicial.
- O resumo de negociação **não é um contrato de compra e venda/locação completo**, não assina documentos e não substitui análise da matrícula, titularidade, escritura ou registro quando aplicáveis.
- O recebimento de comissão é manual. Não há repasse/split automático para o corretor.
- Reembolsos e chargebacks devem ser acompanhados no Mercado Pago. O webhook de produção processa estornos recebidos e retira o anúncio; não há varredura periódica de reconciliação. Confira entregas e retire o anúncio manualmente se necessário. Uma tentativa paga duplicada não gera novo prazo; confira e devolva duplicidades pelo PSP.
- Há recuperação de senha por código de e-mail após configurar o remetente. Não há edição/renovação do anúncio pelo anunciante, notificações comerciais automáticas nem assinatura digital. As fotos enviadas são validadas, reduzidas e convertidas para WebP, sem os metadados originais.
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

## Upload de fotos e configuração pelo administrador

Veja [ATUALIZAR-FOTOS.md](ATUALIZAR-FOTOS.md) para aplicar esta atualização e configurar comissões e credenciais de pagamento. O comando `npm start` da API aplica as migrações pendentes antes de iniciar o servidor. Use `npm ci --include=dev && npm run generate` no build do Render para manter o CLI Prisma disponível.

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
