import { Request, Response } from "express";
import createCallHistorical from "../services/CallService/CreateCallService";
import getHistorical from "../services/CallService/GetCallService";
import GetWhatsappUserId from "../services/CallService/GetWhatsappUserId";
import DeleteCallService from "../services/CallService/DeleteCallService";

interface CallHistorical {
    user_id?: number;
    token_wavoip?: string;
    whatsapp_id?: number;
    contact_id?: number;
    company_id?: number;
    phone_to?: string;
    name?: string;
    url?: string;

    direction?: "incoming" | "outgoing" | string;
    status?: string;
    source?: string;
    duration?: number;
    call_id?: string;
    started_at?: string | Date;
    ended_at?: string | Date;
}

export const createCallHistoric = async (req: Request, res: Response): Promise<Response> => {
    const body = req.body as CallHistorical;

    const payload: CallHistorical = {
        ...body,
        user_id: body.user_id || parseInt(req.user.id),
        company_id: body.company_id || req.user.companyId
    };

    const callHistorical = await createCallHistorical(payload);

    return res.status(200).json({ callHistorical });
};

export const getHistoric = async (req: Request, res: Response) => {
    try {
        const historical = await getHistorical({
            "user_id": parseInt(req.user.id),
            "company_id": req.user.companyId
        });

        return res.status(200).json({ historical });
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error('getHistoric error:', msg);
        // Retorna dados vazios em vez de erro 500 para não quebrar o frontend
        return res.status(200).json({
            historical: { resultFinal: [], total: 0, totalReject: 0, totalServed: 0, totalFinish: 0 },
            warning: msg
        });
    }
}

export const getWhatsappUserId = async (req: Request, res: Response): Promise<Response> => {
    const whatsapps = await GetWhatsappUserId(parseInt(req.user.id));
    return res.status(200).json(whatsapps);
};

export const deleteCallHistoric = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { id } = req.params;

  await DeleteCallService({
    id: Number(id),
    companyId: Number(req.user.companyId)
  });

  return res.status(200).json({
    message: "Registro de chamada removido com sucesso."
  });
};