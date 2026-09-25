import { Router } from "express";
import isAuth from "../middleware/isAuth";
import EmbeddedSignupController from "../controllers/EmbeddedSignupController";

const embeddedSignupRoutes = Router();

embeddedSignupRoutes.post(
  "/embedded-signup/start",
  isAuth,
  EmbeddedSignupController.start
);

embeddedSignupRoutes.post(
  "/embedded-signup/complete",
  isAuth,
  EmbeddedSignupController.complete
);

embeddedSignupRoutes.get(
  "/embedded-signup/status/:whatsappId",
  isAuth,
  EmbeddedSignupController.status
);

embeddedSignupRoutes.get(
  "/embedded-signup/diagnostics/:whatsappId",
  isAuth,
  EmbeddedSignupController.diagnostics
);

embeddedSignupRoutes.get(
  "/embedded-signup/logs/:whatsappId",
  isAuth,
  EmbeddedSignupController.logs
);

embeddedSignupRoutes.post(
  "/embedded-signup/test-send/:whatsappId",
  isAuth,
  EmbeddedSignupController.testSend
);

embeddedSignupRoutes.post(
  "/embedded-signup/reconnect/:whatsappId",
  isAuth,
  EmbeddedSignupController.reconnect
);

export default embeddedSignupRoutes;