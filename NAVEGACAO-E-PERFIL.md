# Navegação, registros e Meu perfil

## Publicação

Faça o merge do PR e acompanhe os deploys do Render e da Vercel. A API aplica a migração aditiva pelo `npm start` já configurado; não há novas variáveis ou credenciais. Se controlar a ordem dos deploys, publique primeiro a API e depois o frontend. Atualize o navegador ao concluir.

A migração adiciona CPF, celular e endereço opcionais no banco para preservar as contas anteriores, com CPF único quando preenchido. **Novos cadastros exigem os quatro dados pessoais**. Não altera senha, papel, anúncios, pagamentos ou créditos existentes. O administrador antigo continua entrando normalmente e pode completar os dados em Meu perfil.

## Sessão e perfil

- Após entrar, uma faixa no topo mostra o nome da pessoa conectada e os botões Meu painel, Meu perfil, Área do parceiro (quando habilitada) e Sair. A faixa permanece acessível no celular.
- Sair limpa a sessão do navegador e fecha a área privada. Uma resposta atrasada de gravação de perfil não restaura a sessão após a saída.
- Meu perfil permite atualizar nome completo, CPF, celular com DDD e endereço completo. O nome é atualizado na faixa superior após salvar.
- O e-mail fica visível para identificação, mas não é editado nessa tela. A atualização não muda senha, papel ou a conta que está sendo editada.
- CPF é normalizado e validado pelos dígitos verificadores; celular brasileiro com DDD é normalizado para 11 dígitos. A validação de formato não verifica a titularidade do documento ou da linha.
- CPF, celular e endereço do cadastro ficam na consulta privada da própria pessoa. Não são incluídos no catálogo, nas tabelas de outros parceiros ou nos detalhes do log geral de alterações de perfil.

## Parceiros e cupons

Abra **Meu painel → Parceiros e cupons**. O menu do administrador e o submenu usam abas visíveis também no celular; teclado com setas, Home e End navega entre as abas.

- **Parceiros cadastrados:** pesquisa por nome/e-mail, sem diferenciar acentos ou maiúsculas, filtro por situação e tabela com saldo, mínimo de saque e ações na última coluna.
- **Cupons cadastrados:** pesquisa por código/parceiro, tabela com desconto, crédito, validade, utilizações, situação e ações.
- **Solicitações de saque:** filtro por situação e tabela com parceiro, data, valor e ações. Analisar abre os detalhes e permite registrar Pix já efetuado ou recusar. Solicitações resolvidas permitem consultar o histórico.
- **Novo parceiro** e **Novo cupom:** formulários separados, sem misturar cadastro e listagem. Ao salvar, a tela retorna à tabela correspondente.

As tabelas mostram 10 registros por página. No celular, deslize horizontalmente para consultar todas as colunas e ações. Pesquisar redefine a paginação para a primeira página.

### Editar e ativar/desativar

Editar abre uma janela com os dados do registro. No parceiro, permite alterar o nome da conta vinculada, mínimo de saque e situação, sem trocar o e-mail, senha ou documentos de outra pessoa.

No cupom, a edição de desconto, crédito, prazo, validade, planos e limite vale **apenas para novas contratações**. Anúncios anteriores mantêm preço, crédito, prazo e cupom registrados. O parceiro do cupom é preservado; código utilizado também não pode ser trocado. O limite não pode ficar abaixo das reservas existentes.

As cotações são versionadas: se o cupom for alterado enquanto um anunciante preenche o anúncio, ele deve aplicá-lo novamente e conferir o preço. Reservar uma utilização não muda a versão das condições. Edições concorrentes com versão antiga são recusadas até atualizar a tabela.

### Excluir

A exclusão pede confirmação e é validada novamente no servidor, dentro de transação:

- Cupom sem reserva/utilização pode ser excluído.
- Parceiro sem cupons, lançamentos ou saques pode ser excluído. Isso remove a parceria, **não a conta do usuário**.
- Registros com vínculos ou histórico devem ser desativados. O botão Excluir fica indisponível nesses casos.
- Saques resolvidos não têm exclusão ou alteração de valor/status nessa interface. O histórico financeiro é preservado.

## Verificação

```sh
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

A suíte `npm run test:partners --prefix api` também cobre os fluxos de perfil e administração. Configure `PORTAL_PARTNER_TEST_DATABASE_URL` exclusivamente com PostgreSQL local, banco `portal_partner_test`, com as migrações aplicadas, conforme [PARCEIROS-E-CUPONS.md](PARCEIROS-E-CUPONS.md). Não use credenciais ou banco de produção.

Os testes verificam cadastro obrigatório, normalização e unicidade de CPF, contas antigas, acesso restrito ao próprio perfil, prevenção de mudança de privilégios, edição de cupons sem alterar anúncios anteriores, cotações antigas e exclusão protegida. A validação de navegador foi feita em Chromium, em computador e celular, contra API e PostgreSQL locais, incluindo formulários, tabelas, ações e saída da sessão; sem cobranças ou Pix reais.
