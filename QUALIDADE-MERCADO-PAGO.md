# Melhorias para a avaliação de qualidade do Mercado Pago

O responsável informou nota 35/100 e encaminhou recomendações para data de cadastro do pagador, categoria do item, nome, sobrenome, identificação, descrição do item e SDK do backend. Esta atualização atende esses campos nos formatos dos dois fluxos existentes. Não promete nota final nem aprovação automática de pagamentos.

## Teste administrativo: Checkout Pro via Orders

Novas ordens de R$ 10,00 enviam:

- `payer.first_name`: APRO.
- `payer.last_name`: Teste.
- `payer.identification`: tipo CPF e número de teste documentado pelo Mercado Pago.
- `items[].category_id`: services, pois a cobrança corresponde ao serviço de divulgação.
- `items[].description`: descrição da simulação.
- `additional_info["payer.registration_date"]`: data fixa de simulação, exclusivamente neste fluxo de teste.

A referência atual de Orders documenta a chave literal `payer.registration_date` dentro de `additional_info`, com ponto no nome. Não é o mesmo schema do objeto `payer` de Preferences. O comprador, o documento e a data usados aqui são dados sintéticos de homologação, não dados do administrador. O código continua validando a conta de teste e usa apenas MP_TEST_ACCESS_TOKEN.

## Cobrança de anúncios: Checkout Pro via Preferences

O cadastro e a retomada de pagamento pedem nome, sobrenome e CPF do pagador. O backend valida os dígitos do CPF e envia esses dados no formato aceito por Preferences: `payer.name`, `payer.surname` e `payer.identification`. O e-mail e a data de cadastro são obtidos do usuário anunciante no banco, pelo servidor; a data vai em `payer.registration_date`.

Categoria e descrição referem-se ao serviço de divulgação por 30 dias e ao plano, não ao preço de compra/venda do imóvel. Os dados do pagador não são adicionados ao cadastro público do imóvel, não são gravados na auditoria e o CPF não é persistido pelo portal. O Mercado Pago recebe esses dados para o pagamento. Esta atualização não coleta número do cartão, CVV ou dados bancários.

As preferências já criadas continuam usando o link anterior. Melhorias de payload aparecem em novos checkouts, não reescrevem cobranças antigas. A correção não muda os preços dos planos ou as comissões e não ativa contratações comerciais.

## SDK oficial

Adota o pacote Node.js oficial `mercadopago`, com versão fixada no lockfile. Criação/consulta de Orders, consulta do vendedor, criação de Preferences e busca dos pagamentos usam os clientes oficiais. O timeout é de 20 segundos e as tentativas automáticas são desativadas; a chave de idempotência existente é preservada na criação de ordens de teste. Credenciais de teste e produção permanecem separadas.

## Aplicar e medir novamente

1. Aprove o PR e faça merge no GitHub.
2. No Render da API do portal, execute Manual Deploy → Deploy latest commit. O build precisa executar `npm ci --include=dev && npm run generate` para instalar o SDK e gerar o Prisma Client. Não há nova migration nesta atualização.
3. Aguarde a API ficar Live e a Vercel concluir o frontend. Atualize o site.
4. Em Meu painel → Teste Mercado Pago, crie uma **nova** ordem e conclua a compra de teste.
5. Consulte o pagamento e use o novo Order ID aprovado na medição do Developers, na aplicação correspondente às credenciais.
6. Compare as recomendações após a nova medição. As pontuações são calculadas pelo Mercado Pago; a lista recebida não garante alcançar 100/100.

O envio de campos adicionais altera o payload do teste que antes funcionou. É necessária nova compra de homologação para verificar a aceitação pelo provedor e a nova nota. Testes automatizados usam respostas simuladas, sem token real ou chamada financeira.

## Fontes oficiais

- https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-orders/create-order/post
- https://www.mercadopago.com.br/developers/en/docs/checkout-pro-preferences/how-tos/improve-payment-approval/industry-data
- https://github.com/mercadopago/sdk-nodejs
