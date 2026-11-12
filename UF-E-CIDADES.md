# Seleção de cidades por estado

## Telas atualizadas

A busca pública e o cadastro/edição de anúncios usam o mesmo componente de Estado (UF) e Cidade. Ao escolher uma UF, a cidade passa a ser selecionada na lista correspondente, em ordem alfabética. Trocar a UF limpa a cidade anterior.

Na busca, “Todos os estados” desabilita a escolha de cidade; após escolher a UF, é possível usar “Todas as cidades” ou um município específico. A comparação de um município escolhido é exata, ignorando caixa/acentos, para não confundir São José com São José do Cedro.

No cadastro, os dois campos são obrigatórios. A etapa não avança com lista indisponível ou seleção incompleta. Há opção de tentar carregar novamente. Respostas atrasadas de outra UF são ignoradas.

Os endereços completos do cadastro de pessoas continuam como texto privado; eles não tinham campos separados de UF/Cidade. Esta atualização cobre todos os campos estruturados que já existiam, sem mudar o formato dos endereços pessoais.

## Base e disponibilidade

A API inclui uma referência de **5.571 localidades e 27 UFs**, com nomes e códigos IBGE, em `api/data/brazil-cities.json`. Tocantins contém 139 localidades; São Paulo, 645. A base inclui Boa Esperança do Norte (MT), cujo código 5101837 foi confirmado na página do município no IBGE.

A fonte desta cópia é o repositório `kelvins/municipios-brasileiros`, sob licença MIT, preservada em `api/data/MUNICIPALITIES-LICENSE.txt`. Metadados, data de consulta e hashes dos arquivos de origem estão em `api/data/brazil-cities-source.json`. A API oficial de localidades do IBGE estava indisponível na consulta; por isso não há dependência de chamada externa no uso diário do portal. Esta base é uma referência versionada, não uma consulta em tempo real ao IBGE.

Somente código e nome são incluídos nas listas; coordenadas, DDD e outros campos do arquivo de origem não são usados. O frontend carrega apenas as cidades da UF escolhida, sem baixar as 5.571 localidades de uma vez.

## API e compatibilidade

`GET /api/locations/:state/cities` retorna `[{id, name}]`, com UF maiúscula entre as 27 permitidas e cache público de um dia. UF inválida retorna 400.

Novos anúncios são validados no servidor: cidade e UF precisam corresponder mesmo que o navegador seja burlado. Nome conhecido sem acento ou com caixa diferente é salvo com a grafia canônica da referência. Não é acrescentado código municipal ao banco; os campos existentes `state` e `city` continuam sendo usados.

Nenhum anúncio é reescrito em lote. Uma localidade antiga que não seja um município da referência pode ser mantida ao editar, desde que continue exatamente na UF e localidade já cadastradas. O seletor identifica essa opção como “já cadastrada”. Ao trocar UF, ela não pode ser transportada para outro estado. O cliente pode substituir distrito/localidade pelo município correto e informar o distrito no bairro/região.

A renovação continua reaproveitando a localização anterior. Não muda preço, pagamento, prazo, cupom, créditos ou regras de moderação.

## Atualizar a referência

Obter os arquivos `json/estados.json` e `json/municipios.json` da fonte, revisar a atualização e executar:

```sh
python api/scripts/compile-locations.py /caminho/estados.json /caminho/municipios.json
```

O compilador usa somente a biblioteca padrão do Python; valida UFs, códigos, nomes, duplicidade e quantidade mínima, gera listas ordenadas e atualiza hashes/metadados. Python é necessário apenas para recompilar a referência, não para instalar ou executar o portal no Render. Uma atualização futura com novos municípios deve atualizar também as expectativas de contagem dos testes após revisão.

## Publicação e verificação

Após o merge, publicar a API no Render e conferir o frontend da Vercel. Sem novas variáveis, dependências npm ou migração. O endpoint precisa estar disponível antes de liberar a nova interface de cadastro; até isso ocorrer, o seletor oferece nova tentativa em vez de aceitar cidade arbitrária.

Testes cobrem todas as UFs, nomes/códigos, ordenação, UF inválida, associação UF/cidade, normalização e compatibilidade com localidade antiga. No navegador foram verificados busca, cadastro completo e edição, troca de UF limpando cidade, erro/nova tentativa, resposta atrasada ignorada, retenção do registro antigo e layout em celular. Pagamento foi simulado, sem cobrança real.
