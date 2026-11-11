# Boas práticas: dados do pagador e mensagens

Este conjunto implementa melhorias reais da lista enviada pelo responsável. Não considera todas as 30 práticas concluídas e não promete nota de qualidade.

## Novas ordens administrativas de teste (Orders)

- `items[].external_code` = PORTAL-TEST-ADVERTISEMENT, identificando o serviço de simulação.
- `payer.phone` com DDD e telefone sintéticos.
- Chaves literais de `additional_info`: payer.authentication_type = PASSWORD, payer.is_first_purchase_online = false e payer.last_purchase com data fixa posterior à data de cadastro sintética.

Esse é um perfil de comprador recorrente **exclusivamente para teste**. Não corresponde aos dados reais do administrador ou do anunciante. Mantém o valor de R$ 10,00, os dados de teste já usados e o restante da configuração de segurança. A tentativa pendente no navegador muda de namespace para não repetir chave de uma versão anterior com payload diferente. Ordens antigas continuam consultáveis.

## Checkout comercial de anúncios (Preferences)

O formulário solicita o telefone com DDD do titular da conta anunciante. Aceita telefone brasileiro com DDD e prefixo internacional 55 opcional, sem confundir DDD 55 com código do país. Esse telefone é separado do contato público do corretor e do telefone cadastrado no imóvel. O portal não o grava no anúncio ou na auditoria; ele é enviado no checkout.

Como a API comercial é Preferences, o código do item continua no campo `items.id`, já existente. O campo `external_code` é adicionado no schema Orders de teste, onde é solicitado; não é copiado indiscriminadamente entre schemas.

No servidor, antes de gerar uma nova preferência, consulta o último anúncio do mesmo usuário com `paidAt` preenchido. Esse campo é definido após confirmação de pagamento pela integração. A informação de primeira compra é relativa **ao histórico conhecido deste portal**, não a compras em outras plataformas. Estornos não apagam o fato histórico de que uma compra aconteceu.

- Sem pagamento anterior no portal: is_first_purchase_online = true; last_purchase omitida.
- Com pagamento anterior: is_first_purchase_online = false; last_purchase recebe a data do último pagamento confirmado.
- authentication_type = PASSWORD reflete a autenticação por senha efetivamente implementada.
- Se o builder não receber histórico verificado, não inventa primeira compra nem data da última compra.

Nenhuma dessas informações é aceita como histórico informado pelo navegador. Clientes antigos da API que não enviam telefone continuam compatíveis; o novo formulário exige o preenchimento, e dados inválidos enviados são recusados no backend. Os demais dados de cobrança ficam fora da criação do anúncio.

## Mensagens de retorno

O site diferencia retorno do checkout, pendência e falha/cancelamento. Orienta conferir o painel e aguardar a confirmação antes de repetir a compra. O retorno não é tratado como prova de pagamento, porque parâmetros de URL podem ser alterados pelo visitante.

## Implantação e validação

1. Após aprovar e fazer merge, Manual Deploy da API no Render e aguardar a Vercel atualizar o site.
2. Não há migration ou nova variável.
3. Atualizar o navegador e gerar uma nova ordem de teste pelo painel para homologar os campos adicionais.
4. Concluir e consultar o pagamento. Somente depois medir o novo Order ID no Developers.
5. Os dados novos não são acrescentados retroativamente a preferências/ordens existentes.

Testes automatizados verificam telefone com DDD/código do país, metadados com e sem histórico, ausência de datas inventadas e mensagens que não afirmam confirmação bancária. Não houve teste online ou medição de qualidade nesta sessão. Os metadados são adequados ao schema de cada fluxo.

## Itens para conjuntos seguintes

Cancelamento de ordens, devoluções parciais/totais, relatórios de conciliação, logo oficial e homologação de cenários intermediários ainda exigem implementação ou execução específica. Integrator ID depende de certificação real. Práticas de aplicativo nativo não são consideradas implementadas neste site.
