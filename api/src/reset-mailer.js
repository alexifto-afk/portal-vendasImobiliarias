export function createResetMailer(env, fetchImpl = fetch) {
  const token = env.RESEND_API_KEY?.trim(),
    from = env.RESET_EMAIL_FROM?.trim();
  const configured = Boolean(token && from && !/[\r\n]/.test(from));
  return {
    configured,
    async send({ email, code, requestId }) {
      if (!configured)
        throw Object.assign(Error("Envio não configurado."), { status: 503 });
      const response = await fetchImpl("https://api.resend.com/emails", {
        method: "POST",
        signal: AbortSignal.timeout(10000),
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
          "Idempotency-Key": "password-reset-" + requestId,
        },
        body: JSON.stringify({
          from,
          to: [email],
          subject: "Código para recuperar sua senha — LP Imóveis",
          text: `Seu código de recuperação do LP Imóveis é: ${code}\n\nEle vale por 10 minutos e pode ser usado apenas uma vez. Use o código mais recente no portal para definir sua nova senha.\n\nNão compartilhe este código. Se você não solicitou a troca de senha, ignore esta mensagem.`,
        }),
      });
      if (!response.ok)
        throw Object.assign(Error("Envio não concluído."), {
          status: response.status,
        });
      const result = await response.json().catch(() => null);
      if (!result?.id)
        throw Object.assign(Error("Envio sem confirmação do provedor."), {
          status: 502,
        });
      return { accepted: true };
    },
  };
}
