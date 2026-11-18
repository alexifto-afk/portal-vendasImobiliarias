import { categoryFor } from "./classified-catalog.js";
export const templateProfiles = {
  HOUSE: {
    name: "Casa",
    lead: "Um espaço para o seu próximo capítulo. Confira os ambientes e as condições desta oferta.",
    fields: [
      "Banheiros",
      "Vagas de garagem",
      "Quintal e áreas de convivência",
      "Conservação e pontos de atenção",
    ],
  },
  APARTMENT: {
    name: "Apartamento",
    lead: "Seu próximo endereço pode estar aqui. Veja os detalhes dos ambientes e do condomínio.",
    fields: [
      "Andar e elevador",
      "Banheiros e vagas",
      "Condomínio e estrutura disponível",
      "Valor do condomínio e despesas",
      "Conservação e pontos de atenção",
    ],
  },
  LOT: {
    name: "Lote",
    lead: "Dê espaço aos seus planos. Conheça as características do terreno e as condições da oferta.",
    fields: [
      "Dimensões e topografia",
      "Acesso e infraestrutura disponível",
      "Uso permitido e restrições",
      "Situação da documentação",
    ],
  },
  FARM: {
    name: "Fazenda",
    lead: "Conheça uma nova possibilidade para seus planos no campo. Veja a estrutura e os detalhes desta propriedade.",
    fields: [
      "Acesso e distância aproximada da cidade",
      "Água e energia disponíveis",
      "Benfeitorias e estruturas",
      "Uso atual da propriedade",
      "Situação da documentação e restrições",
    ],
  },
  COMMERCIAL: {
    name: "Imóvel comercial",
    lead: "Um novo endereço para seus planos profissionais. Confira os espaços e as condições desta oferta.",
    fields: [
      "Distribuição dos ambientes",
      "Banheiros, vagas e acessibilidade",
      "Fachada e acesso",
      "Uso permitido e restrições",
      "Conservação e despesas adicionais",
    ],
  },
  CAR: {
    name: "Carro",
    lead: "Seu próximo caminho pode começar aqui. Confira a configuração e as condições do veículo.",
    fields: [
      "Versão, motor e câmbio",
      "Combustível",
      "Itens e acessórios",
      "Manutenção e histórico",
      "Documentação e pontos de atenção",
    ],
  },
  MOTORCYCLE: {
    name: "Moto",
    lead: "Para quem busca uma nova opção sobre duas rodas. Confira os detalhes desta moto.",
    fields: [
      "Cilindrada e versão",
      "Freios e pneus",
      "Acessórios incluídos",
      "Revisões e histórico",
      "Documentação e pontos de atenção",
    ],
  },
  TRUCK: {
    name: "Caminhão",
    lead: "Uma opção para seus próximos trajetos de trabalho. Conheça a configuração deste caminhão.",
    fields: [
      "Configuração de eixos e carroceria",
      "Capacidade de carga",
      "Motor e câmbio",
      "Manutenção e histórico de uso",
      "Documentação e pontos de atenção",
    ],
  },
  OTHER_VEHICLE: {
    name: "Veículo",
    lead: "Conheça as características deste veículo e tire suas dúvidas antes de negociar.",
    fields: [
      "Tipo de veículo e versão",
      "Motor e configuração",
      "Capacidade e uso indicado",
      "Manutenção e histórico",
      "Documentação e pontos de atenção",
    ],
  },
  PHONE: {
    name: "Celular",
    lead: "Pensando em trocar de aparelho? Confira os recursos e as condições desta oferta.",
    fields: [
      "Armazenamento e memória",
      "Tela e câmeras",
      "Bateria e funcionamento",
      "Acessórios incluídos",
      "Marcas de uso, reparos ou defeitos",
    ],
  },
  COMPUTER: {
    name: "Computador",
    lead: "Conheça a configuração e descubra se este computador combina com o que você precisa.",
    fields: [
      "Processador",
      "Memória RAM e armazenamento",
      "Placa de vídeo e tela",
      "Sistema e acessórios incluídos",
      "Funcionamento, marcas de uso ou defeitos",
    ],
  },
  TV: {
    name: "TV",
    lead: "Uma nova opção para seus momentos de entretenimento. Veja os recursos e as condições.",
    fields: [
      "Polegadas e resolução",
      "Recursos Smart e conexões",
      "Controle, base e acessórios",
      "Funcionamento da tela e do som",
      "Marcas de uso, reparos ou defeitos",
    ],
  },
  OTHER_ELECTRONIC: {
    name: "Eletrônico",
    lead: "Uma opção para suas necessidades do dia a dia. Conheça os recursos deste aparelho.",
    fields: [
      "Nome e função do aparelho",
      "Especificações principais",
      "Conexões e compatibilidade",
      "Acessórios incluídos",
      "Funcionamento e pontos de atenção",
    ],
  },
  FURNITURE: {
    name: "Móvel",
    lead: "Um novo detalhe para o seu ambiente. Confira as medidas, o material e as condições deste móvel.",
    fields: [
      "Tipo de móvel e medidas",
      "Material e acabamento",
      "Cor e detalhes",
      "Conservação, marcas ou avarias",
      "Desmontagem, retirada e entrega",
    ],
  },
  APPLIANCE: {
    name: "Eletrodoméstico",
    lead: "Conheça uma opção para sua rotina em casa. Confira as características e as condições do aparelho.",
    fields: [
      "Tipo de aparelho e capacidade",
      "Voltagem",
      "Medidas e recursos",
      "Funcionamento, manutenção ou defeitos",
      "Acessórios, retirada e entrega",
    ],
  },
  HOME_ITEM: {
    name: "Item para casa",
    lead: "Dê um novo toque ao seu espaço. Veja as características e as condições deste item.",
    fields: [
      "Nome do item e finalidade",
      "Material, cor e acabamento",
      "Medidas e quantidade",
      "Conteúdo incluído",
      "Conservação, retirada e entrega",
    ],
  },
  FARM_MACHINE: {
    name: "Máquina agrícola",
    lead: "Conheça uma opção para os próximos trabalhos no campo. Confira a configuração e as condições da máquina.",
    fields: [
      "Tipo de máquina e potência",
      "Ano e horímetro",
      "Implementos e acessórios",
      "Histórico de manutenção",
      "Funcionamento, documentação e pontos de atenção",
    ],
  },
  RURAL_EQUIPMENT: {
    name: "Equipamento rural",
    lead: "Uma opção para sua atividade rural. Veja a aplicação, as características e as condições deste equipamento.",
    fields: [
      "Tipo e aplicação",
      "Capacidade e medidas",
      "Compatibilidade e instalação",
      "Peças e acessórios incluídos",
      "Funcionamento, conservação e transporte",
    ],
  },
  OTHER: {
    name: "Produto",
    lead: "Sua próxima descoberta pode estar aqui. Conheça o produto e confira os detalhes da oferta.",
    fields: [
      "Nome e finalidade do produto",
      "Características e medidas",
      "Itens incluídos",
      "Conservação, funcionamento ou defeitos",
      "Retirada, entrega e disponibilidade",
    ],
  },
};
const blank = (label) => `[preencha: ${label}]`;
const text = (value) =>
  String(value ?? "")
    .replace(/\s+/g, " ")
    .trim();
const short = (value, max) =>
  value.length <= max ? value : value.slice(0, max - 1).trimEnd() + "…";
function number(value, label, min = 0) {
  const parsed = Number(value);
  return text(value) && Number.isFinite(parsed) && parsed >= min
    ? parsed.toLocaleString("pt-BR")
    : blank(label);
}
export const hasTemplatePlaceholders = (value) =>
  /\[preencha\s*:/i.test(String(value || ""));
export function listingTemplate(values) {
  const profile = templateProfiles[values.type] || templateProfiles.OTHER;
  const category = categoryFor(values.type),
    realEstate = category === "REAL_ESTATE",
    vehicle = category === "VEHICLES",
    renting = values.purpose === "RENT";
  const action = renting ? "para alugar" : "à venda";
  const product = text([values.brand, values.model].filter(Boolean).join(" "));
  const location = text(values.city)
    ? [values.neighborhood, values.city, values.state]
        .map(text)
        .filter(Boolean)
        .join(" · ")
    : blank("bairro e cidade");
  const title = realEstate
    ? `${profile.name} ${action} em ${short(text(values.city) || blank("local"), 24)} — ${blank("destaque")}`
    : `${short(product || profile.name, 35)}${vehicle && text(values.year) ? " " + short(text(values.year), 4) : ""} ${action} — ${blank("destaque")}`;
  const lines = [
    `${profile.name} ${action}. ${profile.lead}`,
    "",
    `Principal diferencial: ${blank("o que merece destaque")}.`,
    "",
    "Características:",
  ];
  if (realEstate) {
    lines.push(
      `• Região: ${location}.`,
      `• Área total: ${number(values.area, "área", 0.01)} m².`,
    );
    if (["HOUSE", "APARTMENT"].includes(values.type))
      lines.push(`• Quartos: ${number(values.bedrooms, "quartos")}.`);
  } else {
    lines.push(
      `• Marca e modelo: ${product || blank("marca e modelo, se houver")}.`,
    );
    const condition = { NEW: "Novo", USED: "Usado" }[values.condition];
    lines.push(`• Condição: ${condition || blank("novo ou usado")}.`);
    if (vehicle)
      lines.push(
        `• Ano: ${text(values.year) || blank("ano")}.`,
        `• Quilometragem: ${number(values.mileage, "quilometragem")} km.`,
      );
  }
  lines.push(
    ...profile.fields.map((label) => `• ${label}: ${blank("detalhes")}.`),
    "",
    renting
      ? `Prazo, despesas e condições do aluguel: ${blank("condições reais do aluguel")}.`
      : `Condições da negociação: ${blank("condições que você aceita")}.`,
    "",
    `Disponibilidade: ${blank("quando estará disponível")}.`,
    "",
    realEstate
      ? "Gostou? Use o botão de contato do anúncio para tirar dúvidas e combinar uma visita."
      : "Quer saber mais? Use o botão de contato do anúncio para tirar dúvidas e combinar a negociação.",
  );
  return { title, description: lines.join("\n") };
}
