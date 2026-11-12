# Parceiros, cupons e saques

Esta atualização adiciona indicação por **cupom**, sem depender de link ou cookie. Cada anúncio pode ter um cupom, informado e aplicado **antes do cadastro**. Vale a cada contratação elegível, não só na primeira compra. O crédito de parceiro é pela divulgação paga do anúncio; não é a comissão de corretagem sobre venda/aluguel.

## Implantar por PR

1. Revise e faça o merge do PR no GitHub.
2. Aguarde o deploy da API no Render. O `npm start` existente executa `prisma migrate deploy` antes de iniciar: a migração adiciona tabelas e campos, sem apagar anúncios ou dados anteriores.
3. Aguarde o deploy da Vercel e atualize o navegador. A API é compatível com o formulário anterior sem cupom; publique o backend antes do frontend se controlar os deploys manualmente.
4. Não há novas variáveis, tokens, serviços ou configuração no Neon. O build existente do Render deve continuar executando `npm ci --include=dev && npm run generate`.
5. Mantenha o webhook **produção / Pagamentos (legacy)** e `MP_WEBHOOK_SECRET` já configurados. Ele registra créditos e estornos. A consulta **Já paguei: verificar** também registra créditos, na mesma transação que confirma o pagamento. Não cria crédito com base no retorno do navegador.

## Cadastrar um blogueiro

1. Como administrador, entre em **Meu painel → Parceiros e cupons → Novo parceiro**.
2. Em **Criar login e senha**, preencha os dados pessoais, e-mail de acesso, senha e confirmação, além do saque mínimo.
3. Salve em **Cadastrar parceiro e criar acesso**. A conta já é criada com nível Parceiro; ele não precisa se cadastrar antes.
4. Informe ao parceiro o e-mail e a senha definidos. Ao entrar no portal, ele será direcionado ao próprio painel.
5. Se a conta já existe, escolha **Vincular conta existente**: preserva a senha e as permissões anteriores.
6. Desativar uma parceria bloqueia novas utilizações de cupons e novas solicitações de saque, mas preserva o extrato, os créditos anteriores e saques já solicitados. Para liberar saldo de uma parceria desativada, regularize a parceria no painel; não remova seus dados.

Veja [ACESSO-DO-PARCEIRO.md](ACESSO-DO-PARCEIRO.md) para os níveis de acesso e os detalhes de login.

## Criar o cupom

No mesmo painel, preencha **Novo cupom**:

- Parceiro e código exclusivo, de 3 a 32 letras/números, `_` ou `-`. O sistema normaliza para maiúsculas.
- Desconto fixo em reais para o anunciante e crédito fixo em reais para o parceiro.
- Plano Divulgação, Destaque ou ambos.
- Prazo de liberação do crédito: de 0 a 365 dias a partir da confirmação do pagamento. Com 0 dias, o crédito fica disponível assim que o pagamento é confirmado; o repasse continua sujeito à solicitação de saque e ao valor mínimo. Configure o prazo comercial combinado. Esse prazo não impede chargebacks futuros.
- Data e horário de expiração, no horário local do seu navegador.
- Limite opcional de anúncios: cada **cadastro concluído** reserva uma utilização, mesmo antes de pagar. Não é limite de pagamentos. Reservas não são liberadas automaticamente; um cadastro abandonado continua consumindo a utilização.

Os valores e o prazo são obrigatórios; nenhum cupom ou desconto é criado automaticamente. Desconto + crédito não podem superar o preço do plano. Considere também as taxas do Mercado Pago ao definir sua margem.

Em **Cupons cadastrados → Editar**, os valores, validade, planos e prazo podem ser alterados para novas contratações. Anúncios anteriores preservam as condições registradas. O parceiro do cupom e o código já utilizado são preservados. A edição exige que cotações antigas sejam aplicadas novamente antes de contratar. Também é possível ativar/desativar o cupom. O sistema revalida validade, plano, limite, preço e parceria no cadastro. O parceiro não pode usar o próprio cupom na mesma conta. Isso não constitui verificação de identidade entre contas diferentes.

## O que o anunciante vê

1. Escolhe o plano no formulário do anúncio.
2. Digita o código em **Tem um cupom de desconto?** e clica em **Aplicar cupom**.
3. Confere preço original, economia e preço final. Se mudar o plano, precisa aplicar o cupom novamente.
4. Aceita as condições com o valor final e conclui o cadastro/pagamento.

Digitar um código sem aplicá-lo bloqueia a continuação até aplicá-lo ou removê-lo. O cliente não envia um preço confiável: o servidor recalcula e grava o preço do anúncio, código, recompensa e prazo contratados. Não é possível trocar/adicionar cupom em um anúncio já cadastrado. Desativar ou vencer o cupom depois não muda um anúncio anteriormente contratado. A comissão de intermediação do imóvel permanece separada.

## Créditos e Pix

- Só pagamento real aprovado, com referência, valor, moeda e recebedor conferidos na API, gera crédito. Cadastro, pagamento pendente e transação de teste não geram crédito.
- Repetir a notificação ou consultar novamente não duplica crédito.
- Antes de terminar o prazo, aparece em **A liberar**. Depois, passa ao saldo **Disponível**; a mudança é calculada ao consultar o painel, sem cron.
- O parceiro acompanha cupons, anúncios pagos (quantidade), extrato por referência de anúncio e seus saques. Não vê nome, contato, endereço ou título dos imóveis/clientes indicados.
- Para solicitar, informa titular e chave Pix e confirma as regras. É reservado **todo o saldo disponível líquido**, respeitando o mínimo. Só há uma solicitação em análise por parceiro.
- No painel administrativo, confira titular, valor e chave. Faça o Pix no seu banco. **Somente depois** registre a referência/identificador do comprovante e marque como pago. O sistema não faz Pix, não valida a titularidade bancária e não integra split automático. O identificador fica visível ao parceiro, mas não há upload de arquivo de comprovante nesta versão.
- Se recusar, informe o motivo: os lançamentos voltam ao saldo disponível.

## Estornos e disputas

Estorno total, parcial ou chargeback comunicado pelo webhook cancela integralmente o crédito daquele anúncio. A regra conservadora de estorno parcial deve constar do acordo com o parceiro.

- Antes de repassar: o crédito positivo e o estorno negativo se anulam. Se houver saque solicitado com esse crédito, o pedido inteiro é recusado automaticamente e os demais créditos são liberados para novo pedido.
- Após repassar: mantém-se o histórico pago; o valor vira débito no saldo disponível, compensado em futuros créditos. O sistema não devolve nem debita dinheiro na conta bancária do parceiro.
- A baixa manual e o estorno usam transações serializáveis e reserva de saldo. O Pix externo não faz parte da transação: sempre atualize o painel e confira a situação imediatamente antes de transferir. Se um estorno chegar após o Pix, trate a compensação conforme o acordo com o parceiro.

A consulta manual de pagamentos busca aprovações; **não substitui o webhook nem faz varredura periódica de estornos**. Acompanhe entregas em **Teste Mercado Pago → notificações** e no painel Developers. Em indisponibilidade prolongada, confira os pagamentos e estornos diretamente no Mercado Pago.

## Verificação técnica

```sh
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

Para integração financeira/concor­rência, use PostgreSQL **local e isolado**, banco chamado `portal_partner_test`. O script recusa outro host/nome. Aplique as migrações nesse banco com Prisma; nunca use a URL do Neon de produção:

```sh
cd api
# DATABASE_URL deve apontar exclusivamente ao banco local de teste.
npx prisma migrate deploy
# Use a mesma URL local, agora nesta variável, e execute:
PORTAL_PARTNER_TEST_DATABASE_URL="$DATABASE_URL" npm run test:partners
```

A suíte cria seus próprios usuários/anúncios e remove os fixtures ao terminar. Os testes de notificações substituem somente a consulta ao Mercado Pago por respostas locais; não enviam cobranças ou Pix reais. Cobrem anúncio com cupom via API real, valores adulterados, privacidade/permissões, limite concorrente, idempotência de créditos, prazo, saldo reservado, aprovação/recusa de saque e estornos antes/depois do repasse.

Para tabelas, pesquisa, edição e exclusão protegida, veja [NAVEGACAO-E-PERFIL.md](NAVEGACAO-E-PERFIL.md).

Alterações no prazo do cupom valem para novos anúncios. Anúncios já contratados mantêm o prazo registrado na contratação.
