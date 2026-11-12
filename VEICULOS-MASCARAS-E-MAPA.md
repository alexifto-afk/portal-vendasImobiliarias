# Seleção de veículos, máscaras e mapa da região

## Veículos

Carros, motos e caminhões têm seletores dependentes: marca → modelo → ano. Trocar a marca limpa o modelo e o ano; trocar o modelo limpa o ano. Anos repetidos por combustível são unificados. A quilometragem continua manual, inclusive zero.

O catálogo de referência é consultado pela API do Negocieê no serviço FIPE da Parallelum (`parallelum.com.br/fipe/api/v1`). Não é consultado nem sugerido preço FIPE; o anunciante define o valor. Cada publicação continua salvando os nomes e o ano, sem depender dos códigos do provedor para mostrar anúncios existentes.

Há opção “Não encontrei meu veículo / preencher manualmente”, disponível também se a consulta falhar. Outros veículos usam preenchimento manual. Ano não listado, inclusive veículo zero km que não tenha ano específico no catálogo, pode ser informado manualmente.

A API aceita somente tipos e IDs numéricos conhecidos, usa timeout de 10 segundos, compartilha consultas simultâneas iguais e mantém cache temporário por 24 horas com limite de entradas e concorrência. A indisponibilidade do provedor não impede usar o modo manual.

## Máscaras

O componente compartilhado aplica CPF `000.000.000-00`, celular `(00) 00000-0000` e telefone fixo `(00) 0000-0000`, com suporte à colagem de número com país +55. Campos vazios e cadastros antigos continuam editáveis.

A máscara cobre cadastro de conta, Meu perfil, cadastro/edição administrativa de clientes, criação de parceiros, telefone do anúncio, alteração do contato e dados de pagamento (incluindo a compra de teste que reutiliza o mesmo formulário). As validações do servidor continuam obrigatórias; máscara não valida a titularidade nem o WhatsApp.

A chave Pix genérica permanece sem máscara, pois também aceita e-mail e chave aleatória e não identifica por si só se 11 dígitos são CPF ou telefone.

## Mapa nos detalhes

Conforme definição do responsável, o objetivo é mostrar a região do anúncio, e não localizar o dispositivo do visitante. Imóveis e anúncios da categoria Casa e móveis mostram a seção Região do anúncio. Não há solicitação de GPS.

“Mostrar mapa da região” carrega o mapa do Google sob demanda; também há um link para abri-lo em outra aba. A consulta usa somente bairro, cidade, estado e Brasil, nunca endereço completo, telefone, CPF ou coordenadas precisas. O mapa é uma referência da região, não a localização exata; ela deve ser combinada com o anunciante.

## Publicação

Após mesclar o PR, publicar a API no Render e conferir o novo frontend ativo na Vercel. Não há novas variáveis, credenciais, dependências npm ou migração de banco. Se o frontend for publicado antes da API, a lista de veículos poderá ficar indisponível até o deploy do Render; o preenchimento manual segue disponível.

A atualização não muda preços, regras de pagamento, cupons, créditos, saques ou anúncios existentes.

## Validação

- Testes automatizados de catálogo, parâmetros, cache, concorrência e tratamento de indisponibilidade.
- Testes de máscaras com colagem, +55, DDD 55, edição no meio e exclusão de separadores.
- Teste da consulta do mapa para garantir ausência de endereço privado e dados pessoais.
- Navegador em computador e celular: listas dependentes, limpeza dos campos, alternativa manual, cadastro completo, máscaras em pagamento/perfil, mapa de imóveis e móveis, carregamento sob demanda, salvamento e ausência de erros JavaScript/transbordamento horizontal.
- Consulta real de marcas/modelos ao catálogo externo foi verificada sem dados de clientes. Mapas no navegador e pagamentos foram simulados nos testes; nenhuma cobrança real foi realizada.
