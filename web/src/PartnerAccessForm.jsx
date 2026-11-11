import React, { useState } from "react";
import { IdentityFields } from "./Profile.jsx";
import { Input, MoneyInput, ActionForm } from "./partner-ui.jsx";
import { partnerAccountPayload } from "./partner-access.js";
export default function PartnerAccessForm({ onSave }) {
  const [mode, setMode] = useState("CREATE"),
    [visible, setVisible] = useState(false);
  return (
    <>
      <fieldset className="plan-checkboxes">
        <legend>Acesso do parceiro</legend>
        <label className="checkbox">
          <input
            type="radio"
            name="partnerAccessMode"
            checked={mode === "CREATE"}
            onChange={() => {
              setMode("CREATE");
              setVisible(false);
            }}
          />
          Criar login e senha
        </label>
        <label className="checkbox">
          <input
            type="radio"
            name="partnerAccessMode"
            checked={mode === "EXISTING"}
            onChange={() => {
              setMode("EXISTING");
              setVisible(false);
            }}
          />
          Vincular conta existente
        </label>
      </fieldset>
      <ActionForm
        key={mode}
        label={
          mode === "CREATE"
            ? "Cadastrar parceiro e criar acesso"
            : "Vincular parceiro"
        }
        action={(f) => onSave(partnerAccountPayload(f, mode))}
      >
        {mode === "CREATE" ? (
          <>
            <div className="notice">
              <strong>Nível de acesso: Parceiro</strong>
              <p>
                Entrará com o e-mail e a senha definidos abaixo para acompanhar
                os próprios cupons, créditos e saques.
              </p>
            </div>
            <IdentityFields />
          </>
        ) : (
          <p>
            Informe o e-mail de uma conta comum já cadastrada. A senha e as
            permissões existentes serão mantidas.
          </p>
        )}
        <div className="form-grid">
          <Input
            label={
              mode === "CREATE"
                ? "E-mail de acesso do parceiro"
                : "E-mail da conta existente"
            }
            name="email"
            type="email"
            maxLength={254}
            autoComplete="off"
            required
          />
          <MoneyInput label="Saque mínimo (R$)" name="minWithdrawal" />
        </div>
        {mode === "CREATE" && (
          <>
            <div className="form-grid">
              <Input
                label="Senha de acesso"
                name="password"
                type={visible ? "text" : "password"}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
              <Input
                label="Confirmar senha"
                name="confirmPassword"
                type={visible ? "text" : "password"}
                minLength={12}
                maxLength={128}
                autoComplete="new-password"
                required
              />
            </div>
            <label className="checkbox">
              <input
                type="checkbox"
                checked={visible}
                onChange={(e) => setVisible(e.target.checked)}
              />
              Mostrar senhas
            </label>
            <p className="form-help">
              Use pelo menos 12 caracteres. Após cadastrar, informe ao parceiro
              o e-mail e a senha que você definiu. A senha não poderá ser
              consultada no painel.
            </p>
          </>
        )}
      </ActionForm>
    </>
  );
}
