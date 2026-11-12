import React from "react";
export const brandName = "Negocieê";
export const brandSlogan = "Seu lugar para comprar, vender e alugar.";
export default function Brand() {
  return (
    <span className="brand-lockup">
      <img
        className="brand-wordmark"
        src="/brand/negociee-wordmark.png"
        alt={brandName}
        width="232"
        height="60"
      />
      <span className="brand-tagline">{brandSlogan}</span>
    </span>
  );
}
