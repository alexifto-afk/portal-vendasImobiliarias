# Cadastro do parceiro com login e senha

## Como cadastrar

1. Entre como administrador e abra **Meu painel → Parceiros e cupons → Novo parceiro**.
2. Mantenha **Criar login e senha**, a opção padrão.
3. Preencha nome completo, CPF, celular com DDD e endereço do parceiro.
4. Informe o **e-mail de acesso** (será o login), a senha e a confirmação da senha, com pelo menos 12 caracteres.
5. Defina o saque mínimo e clique em **Cadastrar parceiro e criar acesso**.
6. Após o cadastro, informe ao parceiro o endereço do portal, o e-mail e a senha definidos. O sistema não envia e-mail ou WhatsApp automaticamente.
7. Crie o cupom na aba **Novo cupom** e selecione o parceiro.

O cadastro cria a conta e o vínculo de parceria juntos. Em caso de conflito de e-mail/CPF ou falha no vínculo, não é deixada uma conta parcial. A senha é armazenada como hash bcrypt; não é retornada na resposta da API, na tabela ou na auditoria. Depois de cadastrar, não há consulta da senha no painel. Este recurso não inclui recuperação ou redefinição de senha.

## O que o parceiro acessa

O parceiro usa **Entrar** no próprio portal com o e-mail e a senha cadastrados. Após autenticar, abre diretamente seu painel de indicações. Ao atualizar a página com a sessão válida, retorna à área de parceiro.

As novas contas usam o nível **PARTNER / Parceiro**. A faixa superior identifica esse nível e mantém Meu painel, Meu perfil e Sair. Meu painel abre os próprios cupons, créditos, extrato e pedidos de saque. O parceiro pode atualizar seu perfil.

A API bloqueia operações de anúncios (cadastro, listagem privada, checkout e consulta de pagamento) e envio/exclusão de fotos para esse nível, além de manter o bloqueio administrativo. O bloqueio é no servidor, não apenas nos menus. As consultas financeiras continuam limitadas ao vínculo da própria conta.

O parceiro pode consultar o catálogo público normalmente. Parceria desativada mantém consulta ao histórico, mas bloqueia novos saques e indicações, conforme as regras existentes.

## Conta que já existe

Escolha **Vincular conta existente** e informe o e-mail e o saque mínimo. A senha, o papel e os anúncios da conta anterior são preservados. Contas que já eram de proprietário podem continuar com os dois acessos; ao entrar, o painel padrão passa a ser o de parceiro, e Anunciar imóvel continua disponível para elas. Essa opção não permite trocar a senha de outra conta.

Para mudar uma conta antiga para um nível exclusivamente de parceiro, será necessária uma decisão específica sobre seus anúncios e permissões anteriores; este deploy não faz essa conversão automaticamente.

Excluir uma parceria sem histórico mantém a conta e suas credenciais. Uma conta PARTNER sem vínculo pode acessar Meu perfil e Sair, mas precisa ser vinculada novamente pelo administrador para consultar o painel de parceiro.

## Publicação e verificação

Não há novas variáveis ou migrações nesta atualização: o campo de papel já é textual no banco. Faça o merge do PR e aguarde os deploys da API e do frontend. Se controlar a ordem, publique primeiro a API. Cadastros de parceiros anteriores continuam funcionando.

```sh
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

A integração `npm run test:partners --prefix api`, com `PORTAL_PARTNER_TEST_DATABASE_URL` apontando para o PostgreSQL local isolado descrito no manual anterior, valida criação atômica, hash da senha, login, permissões PARTNER, conflito de credenciais/documentos e preservação da senha de contas já existentes. Os testes de navegador validam cadastro administrativo, confirmação de senha, entrada no painel correto, restauração da sessão e acesso ao perfil no celular, contra API e banco locais, sem cobrança real.
