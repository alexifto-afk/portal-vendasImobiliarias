# Fotos e comissões: aplicar a atualização

Esta versão adiciona upload de fotos e configurações de comissão no painel do administrador. O PR não configura credenciais do Mercado Pago nem recebe pagamentos reais por si só.

## Aplicar depois de aprovar o PR

1. Faça merge do PR no GitHub.
2. No Render, abra **a API deste portal**, confirme Build Command `npm ci --include=dev && npm run generate` e Start Command `npm start`.
3. Clique em **Manual Deploy → Deploy latest commit**. A Vercel normalmente publica o frontend automaticamente.
4. O novo `npm start` aplica a migration versionada, que **adiciona** `ImageUpload` e `CommercialSettings`, e depois inicia a API. Não apaga tabelas ou anúncios anteriores. Faça backup/snapshot do banco deste portal antes da implantação. O usuário PostgreSQL configurado precisa poder criar tabelas.
5. Aguarde o Render ficar Live antes de testar o site. Se a migration falhar, o servidor não inicia e o erro aparece nos logs. Não execute `db push` nem altere o banco ALP.

## Definir as comissões

1. Entre no site como administrador.
2. Abra **Meu painel → Configurações**.
3. Informe a comissão de venda (%) e a de aluguel (%).
4. A de venda é sobre o preço final; a de aluguel é sobre um aluguel mensal.
5. Clique em **Salvar configurações**. Pode salvar os percentuais mantendo as contratações desativadas.

Os percentuais são os acordados no contrato de intermediação; nenhuma taxa oficial do CRECI é presumida. A configuração salva no painel passa a ter prioridade sobre os percentuais e a ativação por variáveis do ambiente. Os anúncios existentes mantêm os percentuais e os termos aceitos no cadastro. Se as condições mudarem enquanto um proprietário preenche o formulário, ele precisará atualizar a página e conferir o novo aceite.

## Configurar o Mercado Pago

1. Entre na conta Mercado Pago que receberá os valores dos anúncios.
2. No portal de desenvolvedores, crie/selecione a aplicação com **Checkout Pro** e obtenha o **Access Token de produção**.
3. Obtenha também o ID da conta recebedora, correspondente ao `collector_id` dos pagamentos. Não confunda com Client ID da aplicação. Use a identificação da conta ou a consulta autenticada `/users/me` da API do Mercado Pago.
4. No Render, em **Environment**, cadastre `MP_ACCESS_TOKEN` e `MP_COLLECTOR_ID`. Não envie valores no chat nem ao GitHub.
5. Salve e faça novo deploy da API.
6. Volte ao painel do administrador → Configurações e atualize a página. Deve aparecer “credenciais configuradas no servidor”. Esse indicador confirma a presença das variáveis, não valida se a conta/token estão corretos.
7. Com os percentuais contratados preenchidos e a operação revisada, marque **Ativar contratação e pagamento de novos anúncios** e salve.

Comissões maiores que zero são exigidas nas duas modalidades para ativar esta operação. A API continua confirmando apenas pagamentos em modo real. Credenciais de teste não tornam um anúncio pago em produção. Homologue o fluxo antes da divulgação comercial. Os valores de anúncio continuam R$ 29,90 / R$ 59,90 por 30 dias.

## Como o cliente envia fotos

1. Abra **Novo anúncio** e preencha os dados.
2. Em **Fotos do imóvel**, clique em **Selecionar fotos do imóvel**.
3. Selecione de 1 a 12 fotos JPG/JPEG, PNG ou WebP, com até 8 MB por arquivo. No celular, use a galeria ou a opção de câmera oferecida pelo dispositivo.
4. Confira as miniaturas. A primeira foto é a capa. Remova uma foto pelo X; para mudar a capa, remova/reselecione as imagens na ordem desejada.
5. Aceite as condições e clique em **Cadastrar e seguir para pagamento**.
6. As fotos são enviadas sequencialmente. O sistema valida o conteúdo, recusa arquivos inválidos e imagens acima de 40 megapixels, corrige a orientação, reduz para no máximo 1600 × 1600 e converte para WebP sem os metadados originais. Cada imagem processada tem limite de 1 MB.

As fotos ficam persistidas no Neon como dados binários. Anúncios pendentes e fotos não vinculadas só podem ser visualizados pelo proprietário ou pelo administrador autenticados. Fotos de anúncios publicados e vigentes ficam públicas para os visitantes. O carregamento utiliza autorização no cabeçalho; tokens não são colocados na URL. Fotos antigas por URL continuam aparecendo, mas novos cadastros usam o seletor de arquivos.

Até 24 fotos não utilizadas podem ficar vinculadas a uma conta. Remova pela seleção fotos já enviadas que não deseja usar. Se recarregar a página após falha de envio/cadastro, fotos não vinculadas podem continuar no banco sem aparecer no formulário; será necessário acompanhamento/limpeza operacional dessas sobras nesta versão. O armazenamento de imagens consome a cota do Neon; acompanhe o uso e considere object storage quando o volume crescer. Não são armazenados documentos pessoais.

## Verificações realizadas

Testes cobrem validação e conversão de imagens, acesso privado/público conforme status, autenticação de upload, limites no seletor, retomada de fotos enviadas, permissões de configuração e bloqueio de cobrança sem credenciais. A compilação do frontend e validação do esquema Prisma são verificadas. Os testes de rotas usam banco simulado e não substituem o teste de migração e pagamento em homologação com Neon/Mercado Pago reais.
