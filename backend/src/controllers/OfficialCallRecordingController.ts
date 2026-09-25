import { Request, Response } from "express";
import CallHistory from "../models/CallHistory";

class OfficialCallRecordingController {
  async store(req: Request, res: Response): Promise<Response> {
    console.log("[OFFICIAL CALL RECORDING] upload recebido", {
      body: req.body,
      hasFile: !!(req as any).file,
      file: (req as any).file
        ? {
            filename: (req as any).file.filename,
            mimetype: (req as any).file.mimetype,
            size: (req as any).file.size
          }
        : null,
      user: (req as any).user
    });

    const requestUser = (req as any).user || {};
    const companyId = Number(requestUser.companyId || req.body.companyId || 0);

    const callId = String(req.body.call_id || req.body.callId || "").trim();
    const callHistoryId = Number(
      req.body.call_history_id || req.body.callHistoryId || 0
    );
    const duration = Number(req.body.duration || 0);

    const file = (req as any).file;

    if (!companyId) {
      return res.status(400).json({ error: "companyId não informado." });
    }

    if (!file) {
      return res.status(400).json({ error: "Arquivo de gravação não enviado." });
    }

    if (!callId && !callHistoryId) {
      return res.status(400).json({
        error: "call_id ou call_history_id não informado."
      });
    }

    const backendUrl = String(process.env.BACKEND_URL || "").replace(/\/$/, "");

    const relativeUrl = `/public/company${companyId}/official-call-recordings/${file.filename}`;
    const finalUrl = backendUrl ? `${backendUrl}${relativeUrl}` : relativeUrl;

    const where: any = {
      company_id: companyId,
      source: "meta_official"
    };

    if (callHistoryId) {
      where.id = callHistoryId;
    } else {
      where.call_id = callId;
    }

    const call = await CallHistory.findOne({
      where,
      order: [["id", "DESC"]]
    } as any);

    if (!call) {
      return res.status(404).json({
        error: "Histórico da chamada não encontrado.",
        url: finalUrl
      });
    }

    const currentDuration = Number((call as any).duration || 0);

    await call.update({
      url: finalUrl,
      duration: Math.max(currentDuration, duration || 0)
    } as any);

    console.log("[OFFICIAL CALL RECORDING] CallHistory atualizado", {
      callHistoryId: (call as any).id,
      call_id: (call as any).call_id,
      url: finalUrl
    });

    return res.json({
      success: true,
      url: finalUrl,
      callHistoryId: (call as any).id
    });
  }
}

export default new OfficialCallRecordingController();
