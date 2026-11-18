# Tours virtuais e visualização 360°

## Uso

Na criação ou edição de um anúncio, vá à etapa **Fotos → Tour virtual ou visualização 360° (opcional)**. Cole o link público de um tour pronto e clique em **Conferir tour ou visualização 360°**. A revisão final também oferece a prévia. Para excluir o tour, use **Remover tour** e salve o anúncio.

A opção está disponível para imóveis, veículos, móveis, eletrônicos, máquinas e demais categorias. A edição continua sujeita ao prazo contratado e volta à análise, sem renovar o vencimento ou cobrar novamente. A renovação conserva o tour. Anúncios anteriores e anúncios sem tour permanecem com suas fotos comuns.

Serviços aceitos nesta etapa:

- **Matterport:** `https://my.matterport.com/show/?m=IDENTIFICADOR`. Para tours de imóveis e ambientes.
- **Kuula:** links `https://kuula.co/post/IDENTIFICADOR`, `https://kuula.co/share/IDENTIFICADOR` ou `https://kuula.co/share/collection/IDENTIFICADOR`. Para panorâmicas e tours 360°.
- **Sketchfab:** link público de modelo 3D em `https://sketchfab.com/3d-models/nome-IDENTIFICADOR` ou `https://sketchfab.com/models/IDENTIFICADOR`. Para objetos, veículos e modelos interativos. O identificador tem 32 caracteres hexadecimais.

Os exemplos são formatos, não tours reais. É necessário produzir/hospedar o tour ou modelo no serviço escolhido e permitir compartilhamento/incorporação pública. Contas, produção do material, planos e disponibilidade dependem do serviço externo. O portal não transforma fotos comuns em 360°, não cria modelos 3D e não faz upload de panorâmicas nesta versão. Continua sendo exigida pelo menos uma foto comum para a capa.

## Visualização

No detalhe do anúncio, o visitante clica em **Visita virtual / 360°**. O visualizador interativo abre em janela própria, com controles do serviço e suporte a tela cheia quando disponível. Há um link para abrir o conteúdo no serviço original se a incorporação não carregar, for privada ou estiver bloqueada. O administrador também pode abrir a prévia ao revisar anúncios.

Nenhum iframe ou requisição ao serviço de tour é criado antes desse clique. Fechar a janela desmonta o visualizador. O conteúdo do tour será público junto com o anúncio; o anunciante deve conferir o material antes de publicar.

## Validação e persistência

A API e o navegador validam HTTPS, hosts exatos e formatos de identificador. Recusam hosts semelhantes, URLs com usuário/senha, portas alternativas, HTML, JavaScript e serviços não suportados. URLs são normalizadas e parâmetros extras de rastreamento são removidos. O servidor não baixa o conteúdo externo e não recebe HTML de incorporação. A consistência dos parsers nas duas aplicações é coberta por testes.

O campo `Listing.virtualTourUrl` é opcional e só é retornado publicamente nos anúncios que já satisfazem os critérios de publicação, pagamento e vigência. A alteração passa pela mesma autorização e análise das demais edições. Fotos, mapa, contatos diretos, planos e créditos de parceiros não mudam.

## Publicação e testes

A migração aditiva `202611181500_virtual_tours` adiciona uma coluna opcional; os anúncios existentes ficam sem tour. Após revisar/mesclar o PR, atualizar primeiro a API no Render (build gera Prisma Client e início normal aplica `prisma migrate deploy`), depois confirmar o frontend na Vercel. Não requer novas variáveis, chave do Google ou SQL manual no Neon.

Validação local: testes da API/frontend, integrações com PostgreSQL local isolado, build Vite e navegação desktop/mobile. O navegador foi testado com respostas externas simuladas para verificar abertura sob clique, interação do iframe, fechamento, ausência de botão sem tour e edição/remoção. A disponibilidade e as permissões de cada tour real dependem do link fornecido pelo anunciante.
