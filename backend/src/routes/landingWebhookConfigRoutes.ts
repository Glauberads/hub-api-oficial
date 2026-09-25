import { Router } from "express";

import isAuth from "../middleware/isAuth";
import * as LandingWebhookConfigController from "../controllers/LandingWebhookConfigController";

const landingWebhookConfigRoutes = Router();

landingWebhookConfigRoutes.get(
  "/landing-webhooks",
  isAuth,
  LandingWebhookConfigController.index
);

landingWebhookConfigRoutes.post(
  "/landing-webhooks",
  isAuth,
  LandingWebhookConfigController.store
);

landingWebhookConfigRoutes.get(
  "/landing-webhooks/:id",
  isAuth,
  LandingWebhookConfigController.show
);

landingWebhookConfigRoutes.put(
  "/landing-webhooks/:id",
  isAuth,
  LandingWebhookConfigController.update
);

landingWebhookConfigRoutes.delete(
  "/landing-webhooks/:id",
  isAuth,
  LandingWebhookConfigController.remove
);

export default landingWebhookConfigRoutes;