# Contatos e campanhas no WhatsApp

## Funcionamento

A navegação e os anúncios continuam públicos. Quando a integração estiver habilitada, a página inicial oferece uma inscrição opcional. O visitante informa o WhatsApp com DDD, aceita o texto abaixo e abre uma mensagem pronta para o número oficial do Negocieê:

> Quero receber novidades e anúncios do Negocieê pelo WhatsApp. Posso cancelar a qualquer momento respondendo SAIR.

Versão: `2026-11-whatsapp-news-v1`. O backend salva inicialmente um contato PENDING. O visitante deve enviar a mensagem `QUERO NOVIDADES <código>` do mesmo número informado. Somente o webhook assinado pela Meta confirma esse número e o torna ACTIVE. O código aleatório vale por 30 minutos, tem apenas seu hash salvo e é consumido uma vez. Não há envio automático de código de autenticação ou mensagem de boas-vindas.

Responder SAIR, PARAR, CANCELAR ou STOP cancela o recebimento. A reativação exige uma nova inscrição seguida de confirmação pelo próprio WhatsApp. Pedidos de terceiros não ativam um número nem reativam quem cancelou. Telefones de cadastros, pagamentos e anúncios não são importados para a base de marketing.

O menu do administrador **WhatsApp e campanhas** tem:

- **Contatos:** telefone, situação, data/versão de autorização e cancelamento; pesquisa, filtro e páginas de 50 registros. O administrador pode cancelar o recebimento, mas não confirmar ou reativar um número no lugar de seu titular.
- **Campanhas:** escolher até 3 anúncios dentre os 100 disponíveis mais recentes, salvar rascunho, revisar mensagem e confirmar o envio para todos os contatos aptos. Anúncios precisam estar pagos, revisados, publicados e vigentes. Mudanças em título/preço/finalidade ou indisponibilidade impedem o envio do texto antigo.
- **Fila e resultados:** um clique inicia o lote persistido no banco, processado gradualmente (até um envio a cada 2 segundos por instância). Fechar o painel não interrompe a fila. Cancelar a campanha impede os itens ainda pendentes; uma requisição já em andamento pode concluir.

Cada campanha tem no máximo 10 mil destinatários. A contagem precisa ser conferida novamente se a base mudar antes da confirmação. Cada contato participa uma única vez de cada campanha. Timeout ou interrupção deixam resultado UNCERTAIN sem reenvio automático, pois a Meta pode ter recebido a mensagem. ACCEPTED significa aceito pela API, não entregue. Webhooks assinados atualizam entrega/leitura/falha; callbacks muito rápidos ou ausentes podem deixar o resultado apenas como aceito. COMPLETE significa fila processada, incluindo falhas e cancelamentos.

O processamento usa a API oficial WhatsApp Cloud API, Graph v23.0, com um modelo de **marketing aprovado pela Meta**. Não usa automação do WhatsApp Web, Resend ou contas pessoais. Não houve disparo real na implementação/testes.

## Publicação sem ativar envios

1. Revisar e mesclar o PR.
2. Atualizar primeiro a API no Render: o build gera o Prisma Client e o início normal aplica a migração aditiva `202611122200_whatsapp_campaigns`.
3. Confirmar a publicação do frontend na Vercel.
4. Manter `WHATSAPP_ENABLED=false` enquanto prepara a conta oficial. Sem configuração, o formulário público não aparece e os disparos são bloqueados; a base e os rascunhos ficam disponíveis no administrador.

Não executar SQL manualmente no Neon. A migração cria tabelas próprias e não altera usuários ou anúncios existentes.

## Configuração da Meta e do Render

É necessário ter uma conta WhatsApp Business Platform/Cloud API, número remetente cadastrado e token com permissão de enviar mensagens nesse número. Um número de testes da Meta pode limitar os destinatários permitidos. O modelo precisa estar aprovado, e a conta precisa estar apta ao envio de marketing. Ter variáveis preenchidas não comprova aprovação ou liberação da conta.

No gerenciador da Meta, criar e aprovar um modelo de marketing em **Português (Brasil), pt_BR**, com um único parâmetro de texto no corpo. Para coincidir com a prévia do painel, usar este corpo:

```
Confira os novos anúncios do Negocieê:

{{1}}

Para deixar de receber, responda SAIR.
```

O backend preenche `{{1}}` com títulos, preços e links individuais dos anúncios (até 900 caracteres). Não adicionar cabeçalho, botão dinâmico ou parâmetros extras a esse modelo sem adaptar o código.

No **Render → serviço da API → Environment**, adicionar:

| Variável                      | Valor                                                                                  |
| ----------------------------- | -------------------------------------------------------------------------------------- |
| `WHATSAPP_ENABLED`            | `false` inicialmente; depois `true` para disponibilizar inscrições e permitir disparos |
| `WHATSAPP_ACCESS_TOKEN`       | Token privado da Cloud API, com duração/permissões adequadas ao ambiente               |
| `WHATSAPP_PHONE_NUMBER_ID`    | ID numérico do número remetente, não o telefone nem o WABA ID                          |
| `WHATSAPP_NUMBER`             | Telefone público do remetente brasileiro, somente dígitos: país 55 + DDD + celular     |
| `WHATSAPP_APP_SECRET`         | Segredo do aplicativo Meta, usado para verificar assinaturas                           |
| `WHATSAPP_VERIFY_TOKEN`       | Texto aleatório forte definido por você para validar a configuração do webhook         |
| `WHATSAPP_MARKETING_TEMPLATE` | Nome exato do modelo aprovado, em minúsculas com underscores                           |

Nenhum segredo deve ser colocado no frontend/Vercel, GitHub ou chat. Esses valores são diferentes das credenciais do Mercado Pago e do Resend.

No aplicativo Meta, configurar callback:

`https://portal-vendas-imobiliarias-api.onrender.com/api/whatsapp/webhook`

Usar o mesmo Verify Token do Render e assinar o campo de webhook **messages** da conta WhatsApp Business correspondente. O webhook precisa receber tanto mensagens de texto dos usuários quanto atualizações de status. A API verifica `X-Hub-Signature-256` com o App Secret e o Phone Number ID antes de processar eventos.

Após confirmar modelo, webhook e credenciais, habilitar `WHATSAPP_ENABLED=true` no Render e fazer deploy. Inscrever primeiro apenas um telefone de teste sob seu controle pela página inicial e enviar a mensagem pronta. Conferir que fica Confirmado no administrador. Só então decidir enviar uma campanha de teste a esse contato. Responder SAIR e verificar o cancelamento antes de aumentar a base. A Meta pode cobrar pelas mensagens; consultar as tarifas e os limites atuais da sua conta.

O endereço de destino dos anúncios usa `WEB_ORIGIN`, que deve ser o domínio público do portal. Links com `?anuncio=<id>` abrem o anúncio correspondente e respeitam sua disponibilidade pública.

## Testes e limites

`npm test --prefix api`, `npm test --prefix web`, `npm run build --prefix web`. A suíte de integração usa exclusivamente PostgreSQL local isolado com `PORTAL_PARTNER_TEST_DATABASE_URL`, e injeta um remetente falso: nunca usa credenciais reais ou envia mensagens externas.

Verificações incluem assinatura adulterada, consentimento, confirmação do mesmo número, pendentes fora da audiência, SAIR/reativação, duplicidade, resultados incertos, alterações de anúncios, cancelamento e bloqueio sem configuração.

A fila persiste no banco e continua após reinício; requisições interrompidas não são reenviadas automaticamente. A velocidade por instância é conservadora, mas os limites da conta Meta podem ser menores. A aplicação mostra falhas; não faz retries automáticos nem substitui gestão de reputação/qualidade do remetente. Cancelados permanecem na base como lista de supressão; não devem ser reativados/importados sem nova confirmação.
