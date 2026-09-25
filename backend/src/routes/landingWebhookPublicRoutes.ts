import { Router } from "express";

import * as LandingWebhookPublicController from "../controllers/LandingWebhookPublicController";

const landingWebhookPublicRoutes = Router();

landingWebhookPublicRoutes.post(
  "/webhook/landing/:token",
  LandingWebhookPublicController.receiveLead
);

export default landingWebhookPublicRoutes;