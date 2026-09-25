import { Request, Response } from "express";
import AnalyzeOpportunityService from "../services/TicketServices/AnalyzeOpportunityService";

export const analyze = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { ticketId } = req.params;

  const user = req.user as any;
  const companyId = Number(user.companyId);

  const result = await AnalyzeOpportunityService({
    ticketId: Number(ticketId),
    companyId
  });

  return res.status(200).json(result);
};
