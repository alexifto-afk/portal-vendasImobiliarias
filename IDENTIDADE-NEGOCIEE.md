# Identidade Negocieê

**Nome:** Negocieê (com dois “e” no final; o último tem circunflexo).

**Slogan aprovado:** Seu lugar para comprar, vender e alugar.

A identidade usa azul-violeta `#5845F5`, turquesa `#18CDBA`, fundos claros frios e texto escuro. O símbolo de conexão/troca representa uma marca de classificados ampla. Esta entrega aplica a marca aos módulos de imóveis existentes; as categorias de veículos, eletros e outros produtos exigem uma atualização funcional própria.

## Aplicação

- Cabeçalho e rodapé com a logomarca aprovada, slogan e nome correto.
- Paleta de botões, formulários, filtros, abas, tabelas, sessão e painéis atualizada, com estados de erro e confirmação distinguíveis.
- Título da página, descrição, cor do navegador, ícone, touch icon e metadados de compartilhamento.
- Assunto e corpo dos e-mails de recuperação com nome e slogan.
- Nome nos novos itens de checkout e descritor padrão da fatura `NEGOCIEE`, sem acento para respeitar o formato aceito.
- Documentação e nomes dos pacotes de aplicação alinhados à marca.

Os dados profissionais do corretor, CRECI, conta recebedora, planos, comissões e condições dos anúncios são preservados. Pagamentos, créditos, senhas, sessões e registros anteriores não são reescritos. Um checkout já criado pode continuar mostrando a identificação registrada anteriormente pelo provedor; os novos checkouts usam a nova identidade.

## Arquivos

- `web/public/brand/negociee-wordmark.png`: versão horizontal com fundo transparente para cabeçalho/rodapé.
- `web/public/brand/negociee-icon.png`: ícone quadrado com fundo externo transparente.
- `web/public/brand/negociee-social.png`: apresentação aprovada com nome/slogan para compartilhamento.
- `web/public/site.webmanifest`: identificação e ícone do site.
- `web/src/Brand.jsx`: nome, slogan e componente visual reutilizado.
- `api/src/brand.js`: nome, slogan e normalização da identificação de e-mail/fatura.

O slogan é texto HTML nas telas, mantendo a leitura em tamanhos menores. No cabeçalho de celulares pequenos, a logo se adapta e o slogan continua visível na introdução e no rodapé.

## Configurações existentes

Não há novas variáveis, segredos, dependências ou migrações de banco.

- `RESET_EMAIL_FROM=LP Imóveis <acesso@negociee.com>` tem somente o nome antigo do remetente normalizado para `Negocieê <acesso@negociee.com>` ao enviar. O endereço verificado e a chave do Resend não mudam. Também pode atualizar o valor explicitamente no Render para a nova grafia.
- O descritor ausente ou o padrão anterior `LPIMOVEIS` passa a `NEGOCIEE`. Um descritor personalizado diferente continua respeitado. Se desejar alinhar esse valor personalizado, configure `MP_STATEMENT_DESCRIPTOR=NEGOCIEE` no Render.
- O domínio `negociee.com`, o endereço da API no Render, `WEB_ORIGIN`, `VITE_API_URL`, o repositório e os nomes dos serviços não são renomeados. Esses endereços/identificadores mantêm as integrações existentes.
- A tentativa administrativa de teste do Mercado Pago usa uma nova chave local de versão para gerar uma nova ordem com a marca atual, preservando o histórico anterior.

## Publicar e conferir

1. Faça o merge do PR e acompanhe os deploys da API e da Vercel.
2. Atualize o navegador com Ctrl + Shift + R. Ícones e previews de redes sociais podem manter cache próprio por algum tempo.
3. Confira a logo, o slogan, o ícone da aba e os painéis no computador e no celular.
4. Se desejar homologar a identificação do remetente, use Esqueci minha senha com sua própria conta. O assunto/corpo e o antigo nome de remetente configurado serão atualizados. O Resend precisa continuar configurado e autorizado conforme o guia de recuperação.

## Verificação

```sh
npm test --prefix api
npm test --prefix web
npm run build --prefix web
```

Os testes existentes de payload e envio verificam o descritor e a mudança do antigo nome do remetente mantendo seu endereço. A verificação visual usa Chromium com dados de teste e API simulada para conferir logomarca carregada, cores, nome/ícones, login, painéis, acessibilidade aos botões e ausência de rolagem horizontal da página em computador e celulares de 390/360px. Não foram enviados e-mails, cobranças ou Pix reais nesta atualização.
