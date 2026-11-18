# Modelos de título e descrição

Na etapa **Detalhes** do cadastro e da edição, a seção **Uma ajuda para destacar seu anúncio** oferece:

- **Modelo de título:** mostra a sugestão e aplica apenas ao título.
- **Modelo de descrição:** mostra o esqueleto e aplica apenas à descrição.
- **Ver os dois modelos:** permite revisar e aplicar os dois juntos.

O modelo só é aplicado depois do clique de confirmação na prévia. Se o campo já tiver texto, a janela avisa e o botão informa que haverá substituição. **Cancelar e manter meu texto** fecha a prévia sem alterar os campos. Os demais dados do anúncio não são substituídos. Os modelos nunca são aplicados automaticamente na troca de categoria ou na abertura de anúncios antigos.

Depois de aplicar, o anunciante edita os campos normalmente e substitui todos os trechos **[preencha: …]** por dados reais. O formulário e a API recusam esses marcadores enquanto não forem personalizados. Colchetes comuns, como `[novo]`, continuam permitidos.

## Modelos disponíveis

Há modelos específicos para os 19 tipos atuais, adaptados a venda ou aluguel:

- Casa, apartamento, lote, fazenda e imóvel comercial.
- Carro, moto, caminhão e outro veículo.
- Celular, computador, TV e outro eletrônico.
- Móvel, eletrodoméstico e outro item para casa.
- Máquina agrícola, equipamento rural e outro produto.

Cada descrição apresenta uma abertura, diferencial, características próprias do item, condições da negociação/aluguel, disponibilidade e convite para contato. Exemplos de campos específicos: área e documentação em fazendas, cilindrada em motos, voltagem em eletrodomésticos, memória em computadores e medidas/material em móveis.

O gerador usa somente os dados já informados: marca/modelo, ano, quilometragem, condição, área, quartos e região, quando aplicáveis. O que falta vira uma marcação editável. Não afirma documentação regular, estado impecável, garantia, financiamento ou acessórios sem que o anunciante forneça essas informações. Não insere endereço exato ou telefone na descrição.

Título e descrição mantêm os limites atuais de 100 e 5.000 caracteres. Os textos aplicados se tornam parte do anúncio comum, sujeitos à edição, autorização e análise já existentes. Preços, prazos, pagamentos, comissão, créditos, fotos e localização não mudam.

## Implementação e publicação

São modelos locais determinísticos, sem IA externa, API paga, chaves ou novas variáveis. Não há migração ou dados novos no banco. A validação da API também vale para a edição e impede publicar marcadores por chamadas diretas.

Após revisar e mesclar o PR, atualizar API no Render para incluir a validação e confirmar o frontend na Vercel. Não é necessário executar comandos no Neon.

Testes cobrem todos os tipos/finalidades, limites de texto, dados reais sem invenção de atributos, zero km/quartos, preservação do objeto original e distinção entre marcadores e colchetes comuns. O navegador foi conferido em desktop/mobile para cancelamento, substituição por campo, aplicação conjunta, bloqueio de marcadores, gravação da edição e novo modelo para aluguel. As integrações usam exclusivamente PostgreSQL local isolado.
