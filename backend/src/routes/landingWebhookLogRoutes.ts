import { Router } from "express";

import isAuth from "../middleware/isAuth";
import * as LandingWebhookLogController from "../controllers/LandingWebhookLogController";

const landingWebhookLogRoutes = Router();

landingWebhookLogRoutes.get(
  "/landing-webhook-logs",
  isAuth,
  LandingWebhookLogController.index
);

export default landingWebhookLogRoutes;