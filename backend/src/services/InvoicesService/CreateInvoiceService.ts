import * as Yup from "yup";
import AppError from "../../errors/AppError";
import Invoice from "../../models/Invoices";
import ShowInvoceService from "./ShowInvoiceService";

interface InvoiceData {
    companyId: number;
    dueDate: string;
    detail: string;
    status: string;
    value: number;
    currency?: string;
    users: number;
    connections: number;
    queues: number;
    useWhatsapp: boolean;   
    useFacebook: boolean;   
    useInstagram: boolean;   
    useCampaigns: boolean;   
    useSchedules: boolean;   
    useInternalChat: boolean;   
    useExternalApi: boolean;   
    linkInvoice: string;
}

const CreateInvoiceService = async (invoiceData: InvoiceData): Promise<Invoice> => {
   const currency = String(invoiceData.currency || "BRL").toUpperCase();
   if (!["BRL", "COP", "USD"].includes(currency)) {
       throw new AppError("ERR_INVOICE_INVALID_CURRENCY", 400);
   }

   let invoice = await Invoice.create({ ...invoiceData, currency });
    invoice = await ShowInvoceService( invoice.id);

    return invoice;
};

export default CreateInvoiceService;
