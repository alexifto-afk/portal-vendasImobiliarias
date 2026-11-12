import React, { useEffect, useState } from "react";
import { formatCpf, formatPhone, maskedChange } from "./input-masks.js";
export default function MaskedInput({
  mask,
  value,
  defaultValue = "",
  onChange,
  maxLength: _maxLength,
  ...props
}) {
  const format = mask === "cpf" ? formatCpf : formatPhone;
  const [local, setLocal] = useState(() => format(defaultValue));
  useEffect(() => {
    setLocal(format(defaultValue));
  }, [defaultValue, mask]);
  const display = value === undefined ? local : format(value);
  return (
    <input
      {...props}
      type={mask === "cpf" ? "text" : "tel"}
      inputMode={mask === "cpf" ? "numeric" : "tel"}
      maxLength={mask === "cpf" ? 14 : 24}
      value={display}
      onChange={(event) => {
        const node = event.target;
        const result = maskedChange(
          display,
          node.value,
          node.selectionStart ?? node.value.length,
          event.nativeEvent.inputType,
          mask,
        );
        node.value = result.value;
        setLocal(result.value);
        onChange?.(event);
        requestAnimationFrame(() => {
          if (document.activeElement === node)
            node.setSelectionRange(result.caret, result.caret);
        });
      }}
    />
  );
}
