import { Request, Response } from "express";

import AISuggestReplyService from "../services/AI/AISuggestReplyService";

export const suggestReply = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { ticketId } = req.params;

  const result = await AISuggestReplyService({
    ticketId: Number(ticketId),
    companyId
  });

  return res.status(200).json(result);
};