import { Router } from "express";

import isAuth from "../middleware/isAuth";
import CallHistory from "../models/CallHistory";

const callHistoryRoutes = Router();

callHistoryRoutes.delete("/call/historical", isAuth, async (req: any, res: any) => {
  try {
    const requestUser = req.user || {};
    const companyId = Number(requestUser.companyId || requestUser.company_id || 0);

    const ids = Array.isArray(req.body?.ids)
      ? req.body.ids.map((id: any) => Number(id)).filter((id: number) => id > 0)
      : [];

    if (!companyId) {
      return res.status(400).json({
        error: "Empresa não identificada."
      });
    }

    if (!ids.length) {
      return res.status(400).json({
        error: "Nenhuma chamada selecionada para apagar."
      });
    }

    const deleted = await CallHistory.destroy({
      where: {
        id: ids,
        company_id: companyId
      } as any
    });

    return res.json({
      success: true,
      deleted,
      ids
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Erro ao apagar histórico de chamadas."
    });
  }
});


callHistoryRoutes.delete("/call/historical/:id", isAuth, async (req: any, res: any) => {
  try {
    const requestUser = req.user || {};
    const companyId = Number(requestUser.companyId || requestUser.company_id || 0);
    const id = Number(req.params.id || 0);

    if (!companyId) {
      return res.status(400).json({ error: "Empresa não identificada." });
    }

    if (!id) {
      return res.status(400).json({ error: "Chamada não informada." });
    }

    const deleted = await CallHistory.destroy({
      where: {
        id,
        company_id: companyId
      } as any
    });

    return res.json({
      success: true,
      deleted,
      id
    });
  } catch (error: any) {
    return res.status(500).json({
      error: error?.message || "Erro ao apagar histórico de chamada."
    });
  }
});

export default callHistoryRoutes;
