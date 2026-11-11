# Recuperação de senha por código de e-mail

## O que o usuário faz

1. Abre **Entrar → Esqueci minha senha**.
2. Informa o e-mail de acesso, inclusive para contas de parceiro ou administrador.
3. Recebe um código de **6 dígitos** no e-mail. Deve usar o código mais recente em até **10 minutos**.
4. Digita o código e a nova senha duas vezes, com pelo menos 12 caracteres.
5. Após confirmar, volta à tela de entrada e usa sua nova senha. O papel e os dados da conta são preservados.

O botão Reenviar código aguarda o intervalo informado. Se precisar corrigir o endereço, use Usar outro e-mail. Confira também o spam. A mensagem da solicitação é genérica para não informar a terceiros quais e-mails estão cadastrados.

## Configurar o envio no Render

O envio usa a API HTTPS do **Resend**, sem depender de portas SMTP. Para o funcionamento real é necessário configurar uma conta de envio e um remetente autorizado.

1. Acesse [resend.com](https://resend.com/) e entre/crie sua conta.
2. Em **Domains**, adicione um domínio que você controla, por exemplo `seudominio.com.br` ou um subdomínio de envio.
3. No provedor de DNS do domínio, cadastre os registros solicitados pelo Resend e aguarde o domínio aparecer como **Verified**. O domínio `vercel.app` não é um domínio de e-mail seu para essa verificação.
4. Em **API Keys**, crie uma chave com permissão de envio para o domínio verificado. Copie a chave diretamente para o Render; não a envie no chat ou para o GitHub.
5. No Render, abra **portal-vendas-imobiliarias-api → Environment → Edit** e adicione:

| Variável           | Valor                                                                                |
| ------------------ | ------------------------------------------------------------------------------------ |
| `RESEND_API_KEY`   | A chave privada criada no Resend                                                     |
| `RESET_EMAIL_FROM` | Remetente no domínio verificado, por exemplo `LP Imóveis <acesso@seudominio.com.br>` |

6. Clique em **Save, rebuild, and deploy** e aguarde **Live**.
7. Faça um teste com o e-mail de uma conta real do portal, confira o recebimento do código e entre com a nova senha.

O remetente de teste `onboarding@resend.dev` tem restrições de destinatário e não serve como configuração geral para os clientes do portal. Para uso com clientes reais, configure o domínio/remetente autorizado. O provedor pode aplicar limites de volume e plano.

As variáveis são somente da **API no Render**. Não coloque a chave na Vercel ou em variáveis `VITE_`/`NEXT_PUBLIC_`. O `JWT_SECRET` existente também participa da proteção dos códigos; não precisa criar outro segredo nem alterar o atual para ativar a recuperação.

## Implantação

Faça o merge do PR e acompanhe os deploys da API e do frontend. Se controlar a ordem, publique a API antes do frontend. O `npm start` já configurado aplica a migração aditiva antes de iniciar: adiciona a versão de sessão no usuário e a tabela de solicitações de recuperação. Não apaga contas, senhas ou dados financeiros.

Contas/sessões anteriores continuam funcionando com versão inicial zero. Depois de redefinir a senha, tokens de sessões anteriores são recusados na próxima chamada autenticada; eles não voltam a autorizar acesso. O usuário precisa entrar novamente com a nova senha. Não há notificação por push para limpar uma tela já aberta em outro aparelho.

Sem as variáveis de envio, o portal continua funcionando, mas a solicitação de recuperação retorna indisponibilidade temporária. A configuração comercial/Mercado Pago não controla esse recurso.

## Proteções e limites

- Código aleatório de seis dígitos, válido por 10 minutos, vinculado ao e-mail, à solicitação e à versão das credenciais.
- Cinco tentativas incorretas invalidam o código. Reenvio substitui a solicitação anterior.
- Intervalo de 60 segundos e máximo de cinco solicitações por hora por e-mail, persistidos no banco. Endereços não cadastrados recebem o mesmo tratamento público de intervalos.
- Limites adicionais por IP: dez solicitações e trinta confirmações a cada quinze minutos. Esses limites por IP ficam em memória da instância, além do limite geral da API.
- Solicitações concorrentes não disparam códigos duplicados dentro do intervalo. Confirmações concorrentes não reutilizam o código.
- O banco guarda HMAC do código e uma chave derivada do e-mail, sem o código/e-mail em claro nessa tabela. A chave HMAC usa o segredo do servidor. O código não vai para a resposta pública ou os logs.
- Senha nova é gravada com bcrypt. Não há login automático após redefinir e o nível de acesso não é alterado.
- E-mail antigo após correção cadastral e códigos de uma versão anterior da senha não autorizam a troca.
- Registros de recuperação antigos são limpos, após 24 horas, quando há novas solicitações. Auditorias de conclusão/aceite/falha não contêm código, senha ou e-mail em claro.

## Entrega e diagnóstico

O envio é iniciado depois que a resposta genérica da API foi concluída, para que o tempo/falha do provedor não exponha a existência de uma conta. A resposta da solicitação **não confirma entrega na caixa de entrada**.

O envio não tem fila durável nem repetição automática. Se a instância reiniciar durante o envio ou ocorrer falha, aguarde o intervalo e solicite um novo código. Uma tentativa de envio que falha invalida o código daquela solicitação.

Consulte o painel de e-mails do Resend e os logs do Render. A linha `Falha no envio do código de recuperação` registra somente o status HTTP ou `network`, sem dados secretos. Verifique chave/permissão se houver 401/403, remetente/domínio se houver 422, limites do provedor se houver 429 e conectividade se houver `network`. O histórico administrativo também registra `PASSWORD_RESET_EMAIL_ACCEPTED`, `PASSWORD_RESET_EMAIL_FAILED` e `PASSWORD_RESET_COMPLETED`. Aceite do provedor não garante entrega final.

Não peça ao usuário para enviar o código no chat. O código deve ser digitado somente na tela de recuperação do portal.

## Verificação técnica

```sh
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

Com PostgreSQL local isolado e as migrações aplicadas, configure `PORTAL_PARTNER_TEST_DATABASE_URL` com host local e banco `portal_partner_test`, conforme os outros guias, e execute `npm run test:partners --prefix api`. Não use a conexão de produção nos testes.

Os testes cobrem validade, cinco erros, consumo único, reenvio/limites persistentes, concorrência, resposta genérica, entrega após resposta com remetente substituído por captura local, falha de envio, vínculo ao e-mail/versão e revogação de JWTs antigos com/sem versão. O teste de navegador usa API e banco locais e captura de e-mail local para verificar a tela, os erros, a nova senha, a sessão antiga recusada e a entrada normal com a senha nova. Não envia e-mails reais, cobranças ou Pix.
