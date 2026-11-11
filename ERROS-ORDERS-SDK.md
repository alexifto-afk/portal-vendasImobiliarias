# Preservar os erros de validação de Orders no SDK

## Problema confirmado no código instalado

O SDK oficial mercadopago 3.6.1 cria a exceção a partir da resposta, mas seu construtor preserva status, message, error e cause. A lista `errors` usada pela Orders API é descartada. Assim, o portal podia informar somente HTTP 400 mesmo quando o provedor devolvia detalhes estruturados.

## Ajuste

Usa patch-package para aplicar uma alteração de uma linha em `dist/utils/errors/index.js`: preservar `body.errors` no objeto de erro. O patch é versionado em `api/patches/mercadopago+3.6.1.patch` e aplicado pelo postinstall durante `npm ci`. O comando falha se não conseguir aplicar o patch; não ignora incompatibilidade com uma versão futura do SDK.

Não substitui o SDK por chamadas diretas, não repete POSTs, não altera credenciais, pedido, idempotência ou configurações de segurança. Os headers de identificação do SDK permanecem iguais.

A camada do portal mostra somente HTTP, códigos técnicos e caminhos de campos permitidos. Mensagens livres, valores, dados pessoais, token e objeto bruto da exceção não são enviados ao navegador ou adicionados ao log.

## Atualizar

1. Após merge, no Render executar **Manual Deploy → Deploy latest commit**.
2. O Build Command precisa executar `npm ci --include=dev && npm run generate`, com scripts de instalação habilitados.
3. O log do build deve mostrar `patch-package` e aplicação do patch mercadopago 3.6.1.
4. Aguarde Live e tente criar uma ordem uma vez pelo portal. Não é necessário alterar variáveis ou criar outra aplicação.
5. Se a API ainda rejeitar, copie a mensagem com códigos/campos. Ela permitirá corrigir o formato específico sem depender de novos logs no Developers.

Um log antigo no Developers não comprova que não houve chamada nova; pode haver filtro, atraso ou associação de conta. Este patch elimina uma perda confirmada de informação no backend, mas **não comprova a causa do HTTP 400 nem corrige automaticamente o campo rejeitado**.

## Teste de regressão

Um teste usa o SDK real com resposta HTTP simulada contendo somente errors[], reproduzindo a perda. Ele exige que código e caminho cheguem ao diagnóstico e que campos livres sejam descartados. Também confirma uma única requisição, sem retentativa financeira. Não foi realizada criação de ordem online nesta sessão.
