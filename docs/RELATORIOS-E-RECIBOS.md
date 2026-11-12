# Relatórios, recibos e fotos

## Uso

- Administrador: **Meu painel → Relatórios PDF**. Escolha pagamentos de anúncios, repasses confirmados ou créditos/reversões dos parceiros. Selecione as datas e baixe o PDF.
- Anunciante: **Meus anúncios → Baixar recibo PDF**. Os períodos antigos também têm recibo em **Divulgações anteriores**.
- Administrador: os anúncios pagos também exibem o botão de recibo; em **Parceiros e cupons → Solicitações de saque → Detalhar**, repasses pagos têm recibo.
- Parceiro: **Solicitações e comprovantes → Baixar recibo PDF**, após confirmação do repasse pelo administrador.
- Fotos: use as setas sobre a imagem, no catálogo ou no detalhe do anúncio. O contador mostra a posição. Também é possível focar a galeria e usar as setas do teclado. Não há rotação automática. Anúncios com uma foto não exibem controles. O botão Mapa permanece no detalhe dos imóveis.

## Critérios financeiros

Os documentos são gerenciais e não são notas fiscais ou comprovantes bancários. O pagamento do parceiro continua sendo feito por Pix fora do portal. O recibo registra a confirmação administrativa e a referência informada.

Recibos de anúncio exigem pagamento confirmado sem estorno registrado; exibem o valor da divulgação, não o preço do bem. Cada renovação tem seu próprio recibo. Usuários só podem acessar seus documentos; administradores podem acessar todos. Documentos são gerados sob demanda com os dados atuais e não armazenados publicamente.

Os relatórios usam diretamente o banco, não a lista limitada do painel. O intervalo inclui o último dia, no horário de Brasília (UTC−03:00), e aceita até 366 dias. Acima de 10.000 registros, a geração é recusada com orientação para reduzir o período: nunca é entregue um relatório truncado.

- Pagamentos: selecionados por `paidAt`; incluem anúncios excluídos e renovações. Total bruto confirmado e valor com estorno registrado aparecem separados. A classificação de estorno é a situação atual, não um extrato por data do estorno. Não desconta tarifas do Mercado Pago nem calcula saldo bancário.
- Repasses: somente `PAID`, por `resolvedAt`. Saques solicitados/rejeitados não são apresentados como pagamentos.
- Créditos: lançamentos por `createdAt`, incluindo reversões negativas. O total é movimentação líquida, não saldo disponível para saque.

## Publicação e validação

Não requer novas variáveis ou migração do banco. Após revisar e mesclar o PR, atualize primeiro a API no Render (a dependência PDFKit precisa ser instalada pelo build), depois confirme a publicação do frontend na Vercel. Teste com um anúncio realmente pago e um repasse confirmado, sem criar pagamentos fictícios em produção.

Testes: `npm run generate --prefix api`, `npm test --prefix api`, `npm test --prefix web`, `npm run build --prefix web`. O teste `api/tests/reporting.test.js` cobre datas, PDF multipágina, acesso, pagamentos pendentes/estornados, saques não pagos, três relatórios e recusa de truncamento.
