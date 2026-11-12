# Editar, excluir e renovar anúncios

## Painel do anunciante

- **Editar anúncio** aparece para anúncios pagos, não encerrados nem estornados, dentro do prazo. Um anúncio pago ainda sem primeira aprovação pode ser corrigido antes de iniciar seu período. É possível revisar título, descrição, preço, detalhes, fotos, localização e WhatsApp. Categoria/tipo, finalidade e plano permanecem os contratados.
- Ao salvar, o anúncio volta para análise e fica fora da busca até nova aprovação. Não há cobrança nem crédito novo por edição, nem reinício, prorrogação ou pausa do vencimento. O aceite comercial e o pagamento original permanecem intactos.
- **Excluir anúncio** exige confirmação e retira o registro da divulgação e do painel do cliente. A exclusão é lógica: administrador, auditoria, pagamentos, cupons, créditos e saques preservam o histórico. Não solicita estorno automaticamente; eventuais reembolsos continuam no fluxo do Mercado Pago.
- O vencimento torna o anúncio indisponível no servidor. O painel identifica “Prazo encerrado” e oferece **Comprar mais 30 dias**. O catálogo público é atualizado ao voltar à página inicial, ao retornar à aba e a cada minuto; o painel recalcula o prazo a cada 30 segundos. A validação do servidor é exata e não depende desses intervalos.

## Renovação

A renovação é uma nova contratação de divulgação por **30 dias**, com os preços vigentes e opção de plano Divulgação/Destaque. O cliente confirma o WhatsApp, o aceite e os dados de pagamento. Pode aplicar um cupom válido; não se reaplica silenciosamente o cupom antigo.

Como definido pelo responsável, cada nova contratação com cupom gera um crédito novo ao parceiro somente após confirmação do novo pagamento. Notificações repetidas não duplicam o crédito. O prazo de liberação e a recompensa ficam congelados conforme o cupom da renovação; os lançamentos anteriores não são recalculados.

O anúncio continua indisponível até confirmar o pagamento e receber aprovação administrativa. Os 30 dias começam nessa aprovação. Cada período usa um registro financeiro próprio, com vínculo ao anterior, sem reutilizar pagamento ou checkout antigo. As fotos e informações são reaproveitadas sem duplicar os bytes das imagens no Neon. O painel mostra o período atual; os anteriores ficam em “Divulgações anteriores”.

Cliques concorrentes/repetidos não criam duas renovações ativas do mesmo período. Uma renovação pendente permanece no painel para **Pagar anúncio** se o checkout falhar. Para mudar uma contratação pendente já criada, é necessário excluí-la e iniciar outra; não são trocados valores/condições depois de gerar o checkout. Reservas de limite de cupom continuam seguindo a regra existente de reserva no cadastro, inclusive antes do pagamento.

Anúncios encerrados como negociados, excluídos ou com estorno não oferecem renovação. Anúncios vencidos permanecem no painel até serem renovados ou excluídos.

## Proteções e APIs

- `PUT /api/owner/listings/:id`: revisão otimista obrigatória (`revision`), checagem de dono/prazo/pagamento e lista explícita de campos editáveis. Dados financeiros e vencimento enviados pelo navegador não alteram o contrato. Categorias/finalidade/plano não podem ser trocados na edição.
- `DELETE /api/owner/listings/:id`: define `deletedAt`, status CANCELLED e registra auditoria; não apaga o histórico financeiro.
- `POST /api/owner/listings/:id/renew`: recebe plano, WhatsApp/consentimento, aceite da versão de renovação e cupom opcional. Usa preço/termos do servidor, relação `renewalOfId`, transação serializável e índice único parcial para uma renovação não excluída por período.
- `/api/config` acrescenta `renewalDurationDays`, `renewalTermsVersion` e `renewalTerms`. O frontend usa a presença dessa versão para habilitar as ações novas, evitando mutações incompatíveis se a Vercel publicar antes do Render.
- A aprovação administrativa recebe `revision` e recusa aprovar uma versão editada desde que a tela foi carregada. Após reaprovar uma edição, preserva `expiresAt` se já existia.
- Fotos só ficam públicas quando referenciadas por alguma divulgação paga, vigente, revisada e sem estorno/exclusão. Imagens removidas não permanecem públicas só por sua associação antiga; uma renovação aprovada pode reutilizar os mesmos arquivos. URLs HTTPS antigas só podem ser mantidas se já pertenciam ao anúncio; novas imagens continuam obrigatoriamente pelo upload.
- Um pagamento confirmado tardiamente de um anúncio excluído permanece registrado para conciliação, mas não reabre a divulgação. Eventual reembolso requer acompanhamento no Mercado Pago.

## Publicação

1. Mesclar o PR depois da revisão.
2. Publicar no Render com build `npm ci --include=dev && npm run generate` e start `npm start`. A migração `202611121800_listing_lifecycle` acrescenta revisão, exclusão lógica, vínculo entre períodos e índices. Não remove anúncios ou dados financeiros.
3. Conferir o deploy/health e o commit correspondente ativo na Vercel. Não há novas variáveis nem credenciais.
4. Validar no painel um anúncio vigente, um vencido e uma renovação de homologação. Nenhuma cobrança real foi feita nos testes desta atualização.

## Verificação

Testes unitários e integração com PostgreSQL local isolado cobrem autorização, vencimento, edição sem alteração financeira, revisão administrativa, fotos privadas/compartilhadas, concorrência/idempotência de renovação, cupom/crédito, novo prazo de 30 dias, exclusão e preservação do histórico. Não apontar os testes de integração para Neon/produção.

O navegador foi verificado em computador e celular: edição com fotos existentes sem checkout, revisão sem campos de pagamento, anúncio vencido sem edição, renovação com cupom, retomada após falha de checkout, exclusão confirmada, agrupamento de períodos anteriores e acesso/login. Também foi verificado o bloqueio temporário das ações quando a API ainda não informa a capacidade de renovação.
