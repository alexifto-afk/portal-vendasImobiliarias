# Gerar a compra de teste e obter o Order ID

A tela do Mercado Pago enviada pelo responsável solicita o **Order ID de um pagamento de teste dos últimos 7 dias**. Esta atualização adiciona ao administrador um fluxo de teste do Checkout Pro via Orders (`POST /v1/orders`), separado das cobranças de anúncios por Preferences API. O teste não cria anúncio, parcela ou receita, nem altera o ALP.

## 1. Aplicar o PR

1. Faça merge do PR no GitHub quando aprovar as alterações.
2. No Render, abra **portal-vendas-imobiliarias-api** e execute **Manual Deploy → Deploy latest commit**. A Vercel normalmente atualiza automaticamente.
3. Esta atualização não adiciona tabelas: guarda um histórico sem credenciais na tabela de auditoria já existente. A API mantém o comando de migração das versões anteriores no início da execução.

## 2. Criar somente a variável de teste

1. No Mercado Pago Developers, abra **a aplicação do portal**.
2. Selecione **Teste**, como nas capturas enviadas, e copie o **Access Token** mostrado em **Credenciais de teste**. Não é a Public Key.
3. No Render → API do portal → **Environment → Edit**, adicione:

```text
Nome: MP_TEST_ACCESS_TOKEN
Valor: cole o Access Token da aba Teste
```

4. Salve e faça novo deploy da API. Não coloque o token em variáveis `VITE_*`, no GitHub ou no chat.
5. Não é necessário criar `MP_ACCESS_TOKEN` ou `MP_COLLECTOR_ID` de produção para este teste. Não substitua as variáveis do ALP e mantenha as contratações comerciais desativadas.

**Não identifique o ambiente apenas pelo prefixo do token:** as credenciais atuais de teste do Checkout Pro também podem começar com `APP_USR`. O sistema consulta `/users/me` e exige a identificação de conta de teste (`test_user`) antes de criar a ordem. Se essa identificação não estiver presente, o teste é bloqueado. Não há fallback para a credencial de produção.

## 3. Gerar o checkout

1. Entre no portal como administrador.
2. Abra **Meu painel → Teste Mercado Pago**.
3. Clique em **Criar compra de teste**.
4. O painel exibirá o Order ID e o link do checkout, com valor simulado de R$ 1,00.
5. Clique em **Copiar link**. Abra uma janela anônima com **Ctrl + Shift + N** e cole o link.

O teste pode ser criado com as contratações comerciais desativadas e sem comissões definidas. O botão gera apenas uma ordem para simulação; não conclui automaticamente o pagamento. Em caso de falha de rede, tente novamente: a tentativa usa uma chave de idempotência mantida na sessão do navegador para evitar criação repetida. O histórico exibe as últimas 20 ordens deste portal.

## 4. Pagar com o comprador e cartão de teste

1. Feche todas as janelas anônimas anteriores. Abra uma nova janela anônima e cole o link copiado do portal. **Não inicie sessão em nenhuma conta do Mercado Pago**, real ou de teste: o fluxo Checkout Pro via Orders permite a compra sem login. Se for solicitado apenas um e-mail, informe um endereço válido; não é necessário usar conta de teste ou domínio específico.
2. Use o cartão, nome do titular, documento, validade e código de segurança exibidos pelo próprio Developers para simular **pagamento aprovado**.
3. Não use conta nem cartão reais. Não envie dados de cartões ao portal: o preenchimento acontece no checkout hospedado pelo Mercado Pago.
4. Conclua o checkout e volte ao painel do administrador na janela original.

Se aparecer “Uma das partes com as quais você está tentando efetuar o pagamento é de teste”, pode haver uma sessão de conta real misturada ao checkout de teste. Feche todas as janelas anônimas, abra uma nova, cole o link e prossiga sem login, selecionando cartão com os dados de teste. Se persistir, confira se o link vem da aba Teste Mercado Pago do portal, com Order ID ORDTST, e se MP_TEST_ACCESS_TOKEN foi copiado da aba Teste da mesma aplicação. Não troque para credenciais de produção para tentar resolver. A orientação anterior de entrar com comprador de teste correspondia ao fluxo por Preferences, e foi corrigida para o fluxo por Orders implementado aqui.

## 5. Obter o ID para a medição

1. No painel do portal, clique em **Consultar pagamento** na ordem criada.
2. Quando a API retornar a ordem `processed`, com valor pago e data dentro dos últimos 7 dias, será liberado **Copiar Order ID aprovado**.
3. No Developers da **mesma aplicação**, volte à etapa **Medir a qualidade da integração**, informe esse Order ID e inicie a medição.
4. O ID da ordem começa com `ORDTST`. Não confunda com o ID da aplicação, ID de pagamento ou ID de preferência.

Criar a ordem sem concluir o pagamento não atende ao pedido de compra concluída. Ordens antigas podem ser consultadas, mas o botão de cópia para medição não é liberado após 7 dias. Reabrir o painel exige uma nova consulta para confirmar o status atual. A aceitação da medição e eventuais ajustes exigidos dependem do Mercado Pago; o sistema não garante aprovação da qualidade da integração.

## Limites e verificação

- Exclusivo para administradores. As APIs de teste não gravam na tabela de anúncios nem na tabela de negociações.
- O link retornado precisa ser HTTPS do checkout brasileiro do Mercado Pago, vinculado ao mesmo Order ID de teste, vendedor, referência, moeda e valor esperados.
- Não altera callbacks ou webhooks da aplicação/ALP. Este auxiliar de teste via Orders não migra automaticamente o fluxo comercial existente por Preferences nem homologa esse fluxo de produção.
- Se o Developers retornar erro de compatibilidade, confira se a aplicação permite Checkout Pro via Orders e consulte os logs do Developers. Não troque para credenciais de produção para contornar o bloqueio.
- Nenhum token ou `client_token` é devolvido ao frontend ou gravado no histórico.
- Não houve chamada de teste real nesta sessão, pois o responsável ainda não forneceu a credencial no ambiente. Os testes automatizados usam respostas simuladas do provedor.

## Documentação oficial consultada

- [Criar e configurar uma order](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/create-order)
- [API de criação de order Checkout Pro](https://www.mercadopago.com.br/developers/pt/reference/online-payments/checkout-pro-orders/create-order/post)
- [Contas de teste e credenciais APP_USR](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-preferences/test-accounts)
- [Status da order](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/payment-management/status/order-status)

- [Compra de teste via Orders sem sessão iniciada](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/integration-test/test-purchase-with-card)
