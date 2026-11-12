# Negocieê como portal de classificados

## Mudanças

O novo cadastro tem cinco etapas: categoria, detalhes, fotos, localização/contato e revisão/pagamento. As categorias iniciais são imóveis, veículos, eletrônicos, casa/móveis, máquinas/equipamentos rurais e outros produtos. Imóveis incluem apartamento e comercial além de casa, lote e fazenda. Veículos exigem marca, modelo, ano e quilometragem; produtos não pedem área nem quartos. Valores de aluguel são mensais.

É possível enviar até 12 fotos, reordenar pelas setas e escolher a capa colocando a foto na primeira posição. O WhatsApp é preenchido inicialmente com o celular do perfil, pode ser alterado por anúncio e exige autorização explícita para contato público. Cidade, estado e bairro são públicos; endereço completo não é solicitado no novo anúncio. CPF, e-mail e endereço da conta não são publicados.

A cobrança é somente pelo anúncio. Novos registros recebem `commissionBps = 0` no servidor, independentemente de campos enviados pelo navegador ou variáveis antigas. Configurações não exigem comissões positivas. Planos, preço, prazo de publicação, cupom, crédito e saque manual dos parceiros continuam seguindo suas regras existentes. A aprovação administrativa e confirmação real do pagamento continuam obrigatórias.

A página inicial permite buscar por texto (título, descrição, marca/modelo), categoria, tipo, estado, cidade, finalidade e preço. A janela pública existente continua limitada aos 100 anúncios retornados pela API; paginação/busca de acervo completo são evolução futura para volumes maiores.

## Anúncios e registros antigos

A migração somente acrescenta campos e índice. Anúncios existentes recebem categoria Imóveis, estado TO, detalhes vazios e contato PRIVATE. Não são reescritos os aceites, dados privados, comissões antigas, pagamentos ou lançamentos dos parceiros.

**Números anteriormente privados não são publicados automaticamente.** O responsável abre Meu painel → Contato do anúncio, informa/confirma o WhatsApp e autoriza sua disponibilização. O aceite é auditado. Até essa autorização, o anúncio informa que o contato direto ainda precisa ser habilitado; não encaminha ao corretor. O endpoint público de contato exige anúncio pago, aprovado, publicado, vigente e sem estorno.

Os novos anúncios não oferecem o formulário de leads nem fechamento com comissão. Ferramentas de negociações antigas continuam no histórico. No painel do anunciante, “Já negociei / encerrar anúncio” retira a publicação sem criar comissão. O pagamento do produto é combinado fora do portal, diretamente com o anunciante.

## Publicação desta atualização

1. Mesclar o PR depois da revisão. Nenhuma variável nova é necessária.
2. No Render, publicar o commit mesclado: build `npm ci --include=dev && npm run generate`; start `npm start`. O início aplica a migração `202611121500_classifieds`. Conferir deploy e `/api/health` antes de liberar o novo frontend.
3. Na Vercel, conferir que o deploy do mesmo commit está ativo em `negociee.com`. Caso o domínio esteja apontado para um deploy anterior, promover o novo deploy para produção.
4. Conferir no administrador Configurações → contratação ativa. Credenciais de Mercado Pago, Resend, Neon, JWT e origem web são as mesmas; não substituir segredos para esta atualização.
5. Para anúncios antigos publicados, pedir aos respectivos responsáveis que autorizem o contato no painel. Não alterar termos históricos para simular um novo aceite.

Os arquivos de catálogo da API e do frontend são espelhados, com teste de compatibilidade, para que cada serviço possa ser construído em seu próprio Root Directory sem depender de arquivos fora dele.

## Verificação

- `npm test --prefix api` e `npm test --prefix web`.
- `npm run build --prefix web` e `npm run generate --prefix api`.
- Testes de integração exigem PostgreSQL local isolado `portal_partner_test` via `PORTAL_PARTNER_TEST_DATABASE_URL`; nunca apontar estes testes para Neon/produção.
- Testes verificam criação de veículo com cupom e valor calculado no servidor, comissão zero, crédito após pagamento, publicação, filtros, proteção dos campos privados, consentimento do contato e encerramento.
- Navegador: computador/celular, etapas, foto obrigatória, reordenação, revisão e preservação do anúncio quando o checkout simulado falha. Não foi feito pagamento real.
