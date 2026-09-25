interface AsaasPaymentWithLine {
  id: string;
  value: number;
  billingType?: string;
  status: string;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  identificationField?: string;
  description?: string;
}

interface AsaasCustomer {
  id: string;
  name?: string;
  cpfCnpj?: string;
}

interface FormatRequest {
  found: boolean;
  reason: string;
  message: string;
  customer: AsaasCustomer | null;
  payments: AsaasPaymentWithLine[];
}

const formatCurrency = (value: number): string => {
  return Number(value || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
};

const formatDate = (date: string): string => {
  if (!date) return "";

  const [year, month, day] = date.split("-");

  if (!year || !month || !day) return date;

  return `${day}/${month}/${year}`;
};

const getStatusLabel = (status: string): string => {
  const labels: Record<string, string> = {
    PENDING: "Em aberto",
    OVERDUE: "Vencida",
    RECEIVED: "Recebida",
    CONFIRMED: "Confirmada"
  };

  return labels[status] || status;
};

const FormatAsaasSecondCopyMessageService = ({
  found,
  reason,
  customer,
  payments
}: FormatRequest): string => {
  if (!found && reason === "CUSTOMER_NOT_FOUND") {
    return [
      "Não encontrei nenhum cadastro com esse CPF/CNPJ.",
      "",
      "Confira se digitou corretamente, usando somente números.",
      "",
      "Se preferir, posso te encaminhar para o setor financeiro."
    ].join("\n");
  }

  if (!found && reason === "PAYMENTS_NOT_FOUND") {
    return [
      `Localizei seu cadastro${customer?.name ? `, ${customer.name}` : ""}, mas não encontrei boletos em aberto ou vencidos.`,
      "",
      "Caso precise de ajuda, posso te encaminhar para o setor financeiro."
    ].join("\n");
  }

  if (!payments || payments.length === 0) {
    return [
      "Não encontrei boletos disponíveis para envio no momento.",
      "",
      "Caso precise de ajuda, posso te encaminhar para o setor financeiro."
    ].join("\n");
  }

  if (payments.length === 1) {
    const payment = payments[0];

    const lines = [
      `Olá${customer?.name ? `, ${customer.name}` : ""}! Encontrei sua cobrança:`,
      "",
      `💰 Valor: ${formatCurrency(payment.value)}`,
      `📅 Vencimento: ${formatDate(payment.dueDate)}`,
      `📌 Status: ${getStatusLabel(payment.status)}`,
      ""
    ];

    if (payment.invoiceUrl) {
      lines.push("🔗 Link da fatura:");
      lines.push(payment.invoiceUrl);
      lines.push("");
    }

    if (payment.bankSlipUrl) {
      lines.push("📄 PDF do boleto:");
      lines.push(payment.bankSlipUrl);
      lines.push("");
    }

    if (payment.identificationField) {
      lines.push("💳 Linha digitável:");
      lines.push(payment.identificationField);
      lines.push("");
    }

    lines.push("Após o pagamento, a compensação pode levar alguns minutos ou horas, dependendo da forma de pagamento.");

    return lines.join("\n");
  }

  const lines = [
    `Olá${customer?.name ? `, ${customer.name}` : ""}! Encontrei mais de uma cobrança em aberto ou vencida:`,
    ""
  ];

  payments.forEach((payment, index) => {
    lines.push(
      `${index + 1} - ${formatCurrency(payment.value)} | Vencimento: ${formatDate(payment.dueDate)} | Status: ${getStatusLabel(payment.status)}`
    );
  });

  lines.push("");
  lines.push("Digite o número da cobrança que deseja receber.");

  return lines.join("\n");
};

export default FormatAsaasSecondCopyMessageService;