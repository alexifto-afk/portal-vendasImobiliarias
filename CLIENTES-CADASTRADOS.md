# Gerenciador de clientes cadastrados

Abra **Meu painel → Clientes cadastrados** com uma conta administrativa.

## Tabela e pesquisa

A tabela reúne contas de clientes, parceiros e clientes que também são parceiros. Contas administrativas não aparecem e não podem ser editadas, excluídas ou convertidas por esta área.

Pesquise por nome/e-mail sem diferenciar acentos ou maiúsculas, ou por celular, inclusive formatado. Filtre por nível: Todos, Clientes, Clientes e parceiros ou Parceiros. A paginação mostra 10 registros por página; a pesquisa e os filtros voltam à primeira página. No celular, deslize a tabela horizontalmente até a última coluna de ações.

A tabela mostra nome, e-mail, celular, nível, quantidade de anúncios e cadastro. CPF e endereço completos são carregados somente ao abrir os dados de um cliente, em consultas administrativas privadas.

## Editar

A última coluna permite editar nome, CPF, celular, endereço e e-mail. Os dados pessoais seguem as validações existentes; dados ausentes de contas antigas podem continuar vazios.

O e-mail é o login. Se alterá-lo, marque a confirmação e informe ao cliente qual e-mail deverá usar na próxima entrada. A senha atual é preservada. Essa operação não altera o papel da conta, os preços dos anúncios, os créditos ou os contratos/fechamentos registrados. Não exibe nem redefine senha.

## Detalhar

Mostra os dados completos do cadastro, nível, situação da parceria quando houver, totais de anúncios/fotos e até 10 anúncios recentes, com referência, situação e valor de divulgação. A consulta não traz senha ou hash, nem os dados de outros clientes. CPF/endereço não são copiados para o log de alterações.

## Excluir

A exclusão exige confirmação. É permitida somente para uma conta sem anúncios e sem vínculo de parceiro; as fotos em rascunho pertencentes a essa conta também serão removidas. Depois de excluída, a conta deixa de autenticar, inclusive com uma sessão antiga.

Clientes com anúncios, mesmo pendentes ou encerrados, são preservados para manter o histórico contratual. Clientes vinculados a parceiro também ficam protegidos. Para remover uma parceria vazia, sem cupons ou movimentação, use a ação Excluir em Parceiros e cupons antes de excluir a conta em Clientes cadastrados. Históricos financeiros não podem ser apagados dessa forma.

A condição é conferida novamente no servidor na transação de exclusão, mesmo se a tela estiver desatualizada.

## Transformar cliente em parceiro

1. Na linha do cliente, clique em **Transformar em parceiro**.
2. Defina o saque mínimo.
3. Confira o nível indicado antes de confirmar:
   - Sem anúncios ou fotos, a opção padrão é **Parceiro**, com acesso à área de indicações e ao próprio perfil. Se desejar que ele continue anunciando, marque **Manter também o acesso de cliente**.
   - Com anúncios ou fotos já cadastrados, o acesso de cliente é mantido obrigatoriamente. O nível fica **Cliente e parceiro**.
4. Confirme. O sistema cria o vínculo e define o nível na mesma transação, sem trocar e-mail ou senha.
5. Cadastre o cupom em **Parceiros e cupons**. O cliente deve atualizar a página ou entrar novamente para visualizar o novo acesso.

Quem já possui parceria aparece com a ação **Já é parceiro** desabilitada. Use Parceiros e cupons para administrar a situação existente. Repetições ou conversões concorrentes não duplicam a parceria.

## Publicação e testes

Faça o merge do PR e aguarde os deploys da API no Render e do frontend na Vercel. Se controlar a ordem, publique a API primeiro. Não há novas variáveis, dependências ou migrações neste recurso.

```sh
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

A suíte `npm run test:partners --prefix api`, com `PORTAL_PARTNER_TEST_DATABASE_URL` em PostgreSQL local isolado chamado `portal_partner_test` e migrações aplicadas, também verifica todas as permissões do gerenciador, detalhes restritos ao cliente, edição e troca de e-mail confirmada, preservação de senha, exclusão protegida e remoção de fotos em rascunho, conversão com/sem anúncios e conversões concorrentes. Não use banco ou credenciais de produção nos testes.

A validação de navegador usa API e banco locais para testar as quatro ações, cancelamento de exclusão, formulários de contas antigas, filtros, pesquisa, paginação e login preservado após converter, em computador e celular. Não há cobrança ou Pix nessa verificação.
