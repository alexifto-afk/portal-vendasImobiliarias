export function paymentReturnMessage(params) {
  const state = params.get("payment"),
    test = params.get("flow") === "test";
  if (!["returned", "pending", "failure"].includes(state)) return null;
  const next = test
    ? "Abra Meu painel → Teste Mercado Pago e consulte a ordem."
    : "Entre em Meu painel para conferir o pagamento do anúncio.";
  const text = {
    returned:
      "Você voltou do checkout. Estamos aguardando a confirmação do Mercado Pago.",
    pending:
      "Seu pagamento pode estar pendente de processamento. Aguarde a confirmação antes de tentar novamente.",
    failure:
      "O checkout retornou uma falha ou cancelamento. Consulte o status antes de iniciar outra tentativa.",
  };
  return `${test ? "Compra de teste: " : ""}${text[state]} ${next} O retorno a esta página não comprova pagamento.`;
}
