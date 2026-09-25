import { Request, Response } from "express";
import ShowServerReportService from "../services/ServerReport/ShowServerReportService";

const ServerReportController = {
  async show(req: Request, res: Response): Promise<Response> {
    const report = await ShowServerReportService();
    return res.status(200).json(report);
  }
};

export default ServerReportController;
