# Retornos, fatura, 3DS e recebimento de notificações

Esta atualização complementa as recomendações de qualidade enviadas pelo responsável. Não garante pontuação, aprovação de pagamento ou transferência de responsabilidade em uma transação específica.

## O que muda no código

- Novas ordens administrativas de **teste via Orders** incluem `config.statement_descriptor=LPIMOVEIS`, `config.online.success_url`, `failure_url`, `pending_url` HTTPS e `config.online.transaction_security.liability_shift=required`.
- `WEB_ORIGIN` determina o domínio de retorno. `MP_STATEMENT_DESCRIPTOR` permite alterar o texto da fatura; o portal aceita 1 a 13 letras maiúsculas, números ou espaços. O padrão LPIMOVEIS identifica a marca mostrada no portal.
- Ao voltar do checkout, o site orienta consultar o status. Parâmetros de retorno não confirmam pagamento nem publicam anúncios.
- A cobrança comercial existente **continua por Preferences**: mantém os Back URLs HTTPS e recebe `statement_descriptor` no campo correspondente desse schema. A opção 3DS acima aplica-se ao fluxo Orders, não foi copiada como campo incompatível para Preferences. Este PR não migra a cobrança comercial para Orders.
- O SDK oficial `mercadopago` já foi integrado no PR #7 e permanece em uso. Os testes verificam a presença dos headers de identificação do SDK e a preservação da chave de idempotência. Se a avaliação foi feita com uma ordem anterior ao deploy, não reconhecerá os headers de uma nova requisição. Uma recomendação persistente exige conferir a nova ordem e a avaliação do provedor, sem inventar IDs de integrador.

`required` exige a política de liability shift solicitada pelo responsável e pode restringir meios de pagamento/cartões não compatíveis ou exigir autenticação adicional. Homologue novamente o pagamento após a implantação. A transferência efetiva de responsabilidade depende do resultado de autenticação e das regras do Mercado Pago/bandeira.

## Aplicar o PR

1. Aprove o PR e faça merge no GitHub.
2. No Render da API deste portal, execute **Manual Deploy → Deploy latest commit**. A Vercel normalmente atualiza automaticamente.
3. A atualização não adiciona tabelas. Usa a auditoria existente para registrar recebimentos e deduplicar entregas.
4. Mantenha `WEB_ORIGIN=https://portal-vendas-imobiliarias.vercel.app`, sem barra final. Caso use domínio próprio, configure o domínio HTTPS correspondente.
5. `MP_STATEMENT_DESCRIPTOR=LPIMOVEIS` é opcional porque esse é o padrão do código. Se definir outro valor, use o nome reconhecível do negócio e respeite o limite.

## Configurar o webhook de TESTE (faça este primeiro)

1. No Developers, abra a aplicação que está usando para o portal, selecione **Teste** e entre em **Configuração de Webhooks**.
2. Em URL para notificações, informe:

```text
https://portal-vendas-imobiliarias-api.onrender.com/api/webhooks/mercadopago/test
```

3. Marque **Order (Mercado Pago)**. Salve a configuração.
4. Copie a **Assinatura secreta** desse ambiente de teste.
5. No Render → Environment, adicione:

```text
MP_TEST_WEBHOOK_SECRET=cole_a_assinatura_secreta_de_teste
```

Não é o Access Token. Mantenha MP_TEST_ACCESS_TOKEN com a credencial da mesma aplicação e ambiente. Não envie os segredos no chat, no frontend ou no GitHub.

6. Salve e faça novo deploy da API. Aguarde ficar Live.
7. No Developers, use **Enviar teste** com tema Order. Confira o retorno HTTP 200. Um recurso fictício/desconhecido pode ser recebido e registrado como `ignored`, sem efeito financeiro.
8. No site → Meu painel → Teste Mercado Pago, abra **Recebimento de webhooks** e clique em **Atualizar notificações**. Esse painel é exclusivo do administrador.
9. Crie uma **nova ordem** pelo painel, conclua a compra de teste e confira o evento recebido como `test_payment_verified` com status `processed`. As ordens de teste não alteram a receita ou publicam anúncios reais.
10. Consulte o pagamento e use esse novo Order ID aprovado na medição do Developers. Configurar uma URL sem receber o evento não demonstra funcionamento do webhook.

O serviço gratuito do Render pode suspender por inatividade e atrasar o primeiro recebimento. Confira o histórico de entregas no Developers e os registros no painel; o Mercado Pago possui política de reenvio. Para operação comercial contínua, avalie disponibilidade do serviço.

## Configurar o webhook de PRODUÇÃO quando ativar cobranças reais

A cobrança comercial atual usa Preferences/Payments. Na **mesma aplicação de produção configurada no portal**, selecione Produção, cadastre a URL abaixo e marque **Pagamentos (legacy)**:

```text
https://portal-vendas-imobiliarias-api.onrender.com/api/webhooks/mercadopago/production
```

No Render, configure `MP_WEBHOOK_SECRET` com a assinatura secreta de produção dessa aplicação, além de MP_ACCESS_TOKEN e MP_COLLECTOR_ID já exigidos para os pagamentos reais. Faça novo deploy.

O endpoint de produção processa pagamentos de anúncios por Payments, não ordens comerciais novas por Orders. Não substitua webhooks do ALP; mantenha as aplicações/configurações separadas. Caso o projeto futuramente migre a cobrança comercial para Orders, será necessário estender a conciliação de produção antes de trocar o tópico.

## Como a segurança funciona

- Os endereços de teste e produção usam segredos e tokens separados.
- A assinatura HMAC é validada pelo SDK oficial com `data.id`, `x-request-id` e `x-signature`. O timestamp assinado é verificado com janela de 10 minutos, aceitando segundos e milissegundos. A verificação local das duas unidades evita a limitação do SDK 3.6.1 que interpreta a tolerância apenas em segundos.
- O recurso no body deve corresponder ao ID assinado na query; o status do body não concede pagamento.
- Ordens de teste conhecidas são consultadas pelo SDK e comparadas ao vendedor, referência, moeda e valor armazenados na criação.
- Pagamentos reais são consultados pelo SDK e comparados ao anúncio, valor, moeda, modo real e conta recebedora.
- Um pagamento aprovado confirmado marca o anúncio como pago, mas não substitui a análise/aprovação do corretor.
- Repetições da mesma entrega são deduplicadas na auditoria. Novas entregas do mesmo pagamento também não repetem a baixa, que exige `paidAt` vazio.
- Pagamentos estornados ou contestados retiram da vitrine anúncios associados àquele pagamento ainda não encerrados; o histórico de recebimento é preservado. Os totais atuais do painel continuam históricos/brutos, não são um demonstrativo líquido de reembolsos.
- Notificação desconhecida é reconhecida sem alterar anúncios. Falha na consulta ao provedor gera resposta de erro para permitir reenvio; não há confirmação financeira baseada só na assinatura.

## Deep links: requisito de aplicativo mobile

Este projeto é um **site React/Vite**, sem aplicativo Android/iOS e sem configuração de App Links, Universal Links ou esquema próprio. Os retornos HTTPS do site são implementados; não foi criado um deep link fictício só para tentar aumentar a nota.

Confira em Dados da integração se a aplicação foi cadastrada como integração de website. Se a avaliação exigir deep links apesar de ser um site, valide a classificação e a aplicabilidade do item com o Mercado Pago. Para atender deep links de fato é necessário um aplicativo mobile e suas associações de domínio/esquema. Usar o mesmo campo com uma URL HTTPS não transforma o site em aplicativo nativo.

## Verificação e limites

Testes automatizados cobrem assinatura ausente/falsa/expirada, timestamp nas duas unidades, divergência de recurso, duplicidade, isolamento de ambientes, status e valores conferidos na API, manutenção da revisão administrativa e retirada por estorno. O SDK, retornos HTTPS, texto da fatura e flag 3DS são verificados. Não houve recebimento de webhook real, teste de autenticação 3DS online nem medição de pontuação nesta sessão. Os testes de rotas usam banco simulado.

## Documentação oficial

- [URLs de retorno](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/web-integration/configure-back-urls)
- [Descrição de fatura](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/additional-settings/configure-invoice-description)
- [Notificações e validação de assinatura](https://www.mercadopago.com.br/developers/pt/docs/checkout-pro-orders/notifications)
- [SDK oficial Node.js](https://github.com/mercadopago/sdk-nodejs)
