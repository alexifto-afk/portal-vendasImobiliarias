# Mapa aproximado dos imóveis

## Experiência

Nos detalhes de imóveis, o botão **Mapa** fica sobre a foto principal. Abre uma janela independente com título Localização aproximada, mapa navegável e círculo na cor da marca. Não há pino indicando o imóvel. A janela fecha pelo X, Esc ou pelo fundo externo, mantendo o anúncio aberto e devolvendo o foco ao botão.

O mapa suporta arrastar, aproximar/afastar e celular. O círculo é uma geometria geográfica: acompanha o zoom e o deslocamento do mapa. Ao redimensionar a janela, o enquadramento volta a mostrar a área inteira. Anúncios ilustrativos não fazem consultas. A categoria Casa e móveis mantém o mapa de região já existente.

## O que significa o círculo

O cadastro e a edição de imóveis agora permitem marcar a localização no mapa. Depois de escolher cidade e bairro/setor, o anunciante toca no mapa ou arrasta o ponto azul, confere o círculo roxo público e confirma. Também pode deslocar o mapa pelo teclado e usar “Marcar no centro do mapa”. Alterar cidade/UF/bairro limpa a seleção anterior. O formulário atual exige confirmação para imóveis; o backend mantém compatibilidade com anúncios antigos sem coordenadas.

O ponto exato é reservado ao anunciante/administrador (`locationLatitude`, `locationLongitude`) e não integra os campos das consultas públicas. A API converte-o para o centro de uma grade de 0,005 grau e retorna somente esse centro aproximado com raio de 500 m (`level=listing`). O círculo cobre a posição marcada sem expor o ponto. A prévia no formulário usa a mesma regra. A renovação conserva a marcação. Não é uma delimitação do imóvel.

Nos anúncios antigos, sem ponto marcado, permanece a referência regional descrita abaixo.

A API consulta somente bairro/cidade/UF no Nominatim/OpenStreetMap. Rejeita ruas, escolas, lojas, edifícios, pontos de interesse, cidades ou estados diferentes. O centro é arredondado a três casas decimais.

Quando o bairro é um ponto regional do OpenStreetMap (`osm_type=node`), a API usa sua coordenada pública com **raio de 500 m**. A caixa retornada para esses pontos costuma ser uma extensão sintética de vários quilômetros; ela não representa os limites do bairro e não deve dimensionar o círculo. Para bairros delimitados por área, o círculo cobre a caixa da região, com margem de 150 m, arredondamento do raio para cima a cada 250 m e mínimo de 500 m.

Se o bairro informado não for confirmado, a API retorna uma mensagem para confirmar a região com o anunciante, sem substituí-lo pela cidade inteira. Somente dados legados sem bairro podem usar uma referência municipal identificada como tal. Mantém nova tentativa e link externo usando o nome da região.

Não usa GPS do visitante, endereço privado, número da casa, telefone ou CPF nas buscas. Para anúncios marcados, a consulta pública retorna somente o centro aproximado da grade; para anúncios antigos, retorna a referência pública do bairro. O ponto reservado não é enviado ao geocodificador. O endereço exato continua sendo combinado com o anunciante.

## Publicação da marcação no mapa

A migração `202611122130_marked_location` adiciona duas colunas opcionais e uma restrição de coordenadas em par, sem alterar anúncios existentes. Publique primeiro a API no Render: o início normal executa `prisma migrate deploy`. O build precisa executar `npm run generate`, como na configuração atual. Depois publique/confirme o frontend na Vercel. Não há novas variáveis, chave de Google Maps ou dependência paga.

A interface usa Leaflet/OpenStreetMap, como o mapa público existente. Mosaicos e geocodificação dependem da disponibilidade desses serviços. Se a busca de bairro falhar no cadastro, o anunciante pode navegar no mapa e marcar manualmente. Falha ao carregar mosaicos gera aviso para conferir antes de confirmar.

## API e serviços

`POST /api/owner/location-preview` exige anunciante autenticado, recebe somente bairro/cidade/UF e ajuda a enquadrar o mapa de seleção. Pode usar a cidade como ponto inicial se o bairro não for encontrado; isso nunca confirma uma posição automaticamente.

`GET /api/listings/:id/region` retorna `{latitude, longitude, radiusMeters, level, label}` para imóvel pago, revisado, publicado, vigente e sem estorno. Faz nova verificação após a consulta externa, caso a publicação tenha mudado. A resposta HTTP usa `no-store`.

A API consulta o Nominatim com identificação do portal, intervalo mínimo de 1,1 segundo entre buscas, fila serial, limite de quatro regiões simultâneas e compartilhamento de buscas iguais. Geometrias e resultados regionais são cacheados em memória por sete dias; regiões não encontradas por 30 minutos; até 200 entradas em cada cache. Falhas de rede não ficam cacheadas. O serviço público é adequado ao volume inicial de uma instância; ao escalar o tráfego ou as instâncias, revisar os limites e a contratação de geocodificação.

O frontend carrega Leaflet 1.9.4 sob demanda e usa mosaicos padrão OpenStreetMap, com atribuição visível e sem download offline/prefetch. Não solicita chave paga. Não troca a marca do portal nem tenta reproduzir o serviço Apple Maps das imagens de referência.

## Publicação

Mesclar o PR e publicar no Render e na Vercel. Não há migração de banco, nova variável de ambiente nem alteração de credencial. O build do frontend instala a nova dependência pelo lockfile existente. Publicar a API antes de liberar a nova interface para que a rota de região esteja disponível.

Pagamentos, cupons, parceiros, comissões históricas, contatos e anúncios existentes são preservados.

## Verificação

- Testes de geometria, raio mínimo, caixa inválida, validação de município/UF, rejeição de pontos de interesse, cache, concorrência e intervalo do serviço.
- Teste HTTP da seleção mínima de dados públicos, resposta sem cache e anúncio indisponível antes/depois da geocodificação.
- Navegador em computador/celular: botão sobre foto, janela, círculo com zoom, ausência de pino, fechar/reabrir, foco, erro/nova tentativa, aviso de cidade e preservação do mapa de móveis.
- Consulta real de Centro, Araguatins–TO validou o ponto regional e o raio de 500 m. Não houve cobrança nem envio de endereço privado ao provedor.
- A marcação exige a migração aditiva descrita acima, aplicada pelo início normal da API. Não exige novas variáveis.
