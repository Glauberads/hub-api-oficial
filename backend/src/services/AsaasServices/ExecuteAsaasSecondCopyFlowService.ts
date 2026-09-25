import { getAsaasSecondCopyByCpfCnpj } from "./AsaasApiService";
import FormatAsaasSecondCopyMessageService from "./FormatAsaasSecondCopyMessageService";

interface Request {
  companyId: number;
  cpfCnpj: string;
}

interface Response {
  success: boolean;
  found: boolean;
  reason: string;
  replyMessage: string;

  customerId?: string;
  customerName?: string;
  customerCpfCnpj?: string;

  paymentsCount: number;

  paymentId?: string;
  paymentValue?: number;
  paymentStatus?: string;
  paymentDueDate?: string;
  invoiceUrl?: string;
  bankSlipUrl?: string;
  identificationField?: string;
}

const ExecuteAsaasSecondCopyFlowService = async ({
  companyId,
  cpfCnpj
}: Request): Promise<Response> => {
  try {
    const result = await getAsaasSecondCopyByCpfCnpj({
      companyId,
      cpfCnpj
    });

    const replyMessage = FormatAsaasSecondCopyMessageService(result);

    const firstPayment = result.payments?.[0];

    return {
      success: result.found,
      found: result.found,
      reason: result.reason,
      replyMessage,

      customerId: result.customer?.id,
      customerName: result.customer?.name,
      customerCpfCnpj: result.customer?.cpfCnpj,

      paymentsCount: result.payments?.length || 0,

      paymentId: firstPayment?.id,
      paymentValue: firstPayment?.value,
      paymentStatus: firstPayment?.status,
      paymentDueDate: firstPayment?.dueDate,
      invoiceUrl: firstPayment?.invoiceUrl,
      bankSlipUrl: firstPayment?.bankSlipUrl,
      identificationField: firstPayment?.identificationField
    };
  } catch (error) {
    const errorMessage =
      error instanceof Error
        ? error.message
        : "Não foi possível consultar a segunda via no momento.";

    return {
      success: false,
      found: false,
      reason: "ASAAS_ERROR",
      paymentsCount: 0,
      replyMessage: [
        "Não consegui consultar a segunda via agora.",
        "",
        errorMessage,
        "",
        "Por favor, confira os dados informados ou fale com o setor financeiro."
      ].join("\n")
    };
  }
};

export default ExecuteAsaasSecondCopyFlowService;