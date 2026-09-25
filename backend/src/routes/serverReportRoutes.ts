import { Router } from "express";

import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";
import ServerReportController from "../controllers/ServerReportController";

const serverReportRoutes = Router();

serverReportRoutes.get(
  "/server-report",
  isAuth,
  isSuper,
  ServerReportController.show
);

export default serverReportRoutes;
