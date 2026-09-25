import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as AiSdrController from "../controllers/AiSdrController";

const aiSdrRoutes = Router();

aiSdrRoutes.get("/ai-sdr/configs", isAuth, AiSdrController.index);
aiSdrRoutes.get("/ai-sdr/configs/:id", isAuth, AiSdrController.show);
aiSdrRoutes.post("/ai-sdr/configs", isAuth, AiSdrController.store);
aiSdrRoutes.put("/ai-sdr/configs/:id", isAuth, AiSdrController.update);
aiSdrRoutes.delete("/ai-sdr/configs/:id", isAuth, AiSdrController.remove);
aiSdrRoutes.post("/ai-sdr/tickets/:ticketId/process", isAuth, AiSdrController.processTicket);

export default aiSdrRoutes;
