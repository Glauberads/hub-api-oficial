import axios, { AxiosInstance } from "axios";
import AppError from "../../errors/AppError";
import Setting from "../../models/Setting";

interface AsaasConfig {
  apiKey: string;
  environment: "sandbox" | "production";
  baseUrl: string;
}

const onlyNumbers = (value: string): string => {
  return String(value || "").replace(/\D/g, "");
};

const getSettingValue = async (
  key: string,
  companyId: number
): Promise<string> => {
  const setting = await Setting.findOne({
    where: {
      key,
      companyId
    }
  });

  return setting?.value || "";
};

export const getAsaasConfig = async (
  companyId: number
): Promise<AsaasConfig> => {
  // Token já existente nas configurações do sistema:
  // Configurações > ASAAS > Token Asaas
  const apiKey =
    (await getSettingValue("asaastoken", companyId)) ||
    (await getSettingValue("asaasApiKey", companyId));

  if (!apiKey) {
    throw new AppError("Token do Asaas não configurado nas configurações do sistema.", 400);
  }

  // Ambiente opcional. Se não existir configuração, usa produção.
  const environment =
    (await getSettingValue("asaasEnvironment", companyId)) || "production";

  const isSandbox = environment === "sandbox";

  return {
    apiKey,
    environment: isSandbox ? "sandbox" : "production",
    baseUrl: isSandbox
      ? "https://api-sandbox.asaas.com/v3"
      : "https://api.asaas.com/v3"
  };
};

export const getAsaasClient = async (
  companyId: number
): Promise<AxiosInstance> => {
  const config = await getAsaasConfig(companyId);

  return axios.create({
    baseURL: config.baseUrl,
    timeout: 20000,
    headers: {
      "Content-Type": "application/json",
      "User-Agent": "MultizapOficial/1.0",
      access_token: config.apiKey
    }
  });
};

export interface AsaasCustomer {
  id: string;
  name?: string;
  cpfCnpj?: string;
  email?: string;
  phone?: string;
  mobilePhone?: string;
}

export interface AsaasPayment {
  id: string;
  customer: string;
  value: number;
  netValue?: number;
  billingType?: string;
  status: string;
  dueDate: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  description?: string;
  externalReference?: string;
}

export const findAsaasCustomerByCpfCnpj = async ({
  companyId,
  cpfCnpj
}: {
  companyId: number;
  cpfCnpj: string;
}): Promise<AsaasCustomer | null> => {
  const cleanCpfCnpj = onlyNumbers(cpfCnpj);

  if (![11, 14].includes(cleanCpfCnpj.length)) {
    throw new AppError("CPF/CNPJ inválido. Informe somente números.", 400);
  }

  const client = await getAsaasClient(companyId);

  const { data } = await client.get("/customers", {
    params: {
      cpfCnpj: cleanCpfCnpj,
      limit: 1
    }
  });

  if (!data?.data || data.data.length === 0) {
    return null;
  }

  return data.data[0];
};

export const listAsaasOpenPayments = async ({
  companyId,
  customerId,
  limit = 10
}: {
  companyId: number;
  customerId: string;
  limit?: number;
}): Promise<AsaasPayment[]> => {
  const client = await getAsaasClient(companyId);

  const statuses = ["PENDING", "OVERDUE"];
  const allPayments: AsaasPayment[] = [];

  for (const status of statuses) {
    const { data } = await client.get("/payments", {
      params: {
        customer: customerId,
        status,
        limit
      }
    });

    if (data?.data?.length) {
      allPayments.push(...data.data);
    }
  }

  return allPayments
    .filter(payment => ["PENDING", "OVERDUE"].includes(payment.status))
    .sort((a, b) => {
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    })
    .slice(0, limit);
};

export const getAsaasPaymentIdentificationField = async ({
  companyId,
  paymentId
}: {
  companyId: number;
  paymentId: string;
}): Promise<string> => {
  const client = await getAsaasClient(companyId);

  try {
    const { data } = await client.get(
      `/payments/${paymentId}/identificationField`
    );

    return data?.identificationField || "";
  } catch (error) {
    return "";
  }
};

export const getAsaasSecondCopyByCpfCnpj = async ({
  companyId,
  cpfCnpj
}: {
  companyId: number;
  cpfCnpj: string;
}) => {
  const customer = await findAsaasCustomerByCpfCnpj({
    companyId,
    cpfCnpj
  });

  if (!customer) {
    return {
      found: false,
      reason: "CUSTOMER_NOT_FOUND",
      message: "Nenhum cliente encontrado no Asaas com este CPF/CNPJ.",
      customer: null,
      payments: []
    };
  }

  const payments = await listAsaasOpenPayments({
    companyId,
    customerId: customer.id,
    limit: 5
  });

  if (!payments.length) {
    return {
      found: false,
      reason: "PAYMENTS_NOT_FOUND",
      message: "Nenhuma cobrança em aberto ou vencida encontrada.",
      customer,
      payments: []
    };
  }

  const paymentsWithLine = await Promise.all(
    payments.map(async payment => {
      const identificationField = await getAsaasPaymentIdentificationField({
        companyId,
        paymentId: payment.id
      });

      return {
        ...payment,
        identificationField
      };
    })
  );

  return {
    found: true,
    reason: "PAYMENTS_FOUND",
    message: "Cobranças encontradas com sucesso.",
    customer,
    payments: paymentsWithLine
  };
};