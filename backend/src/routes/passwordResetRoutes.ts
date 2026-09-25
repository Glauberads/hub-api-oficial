import { Router } from "express";
import * as PasswordResetController from "../controllers/PasswordResetController";

const passwordResetRoutes = Router();

passwordResetRoutes.post("/password-reset/request", PasswordResetController.request);
passwordResetRoutes.post("/password-reset/reset", PasswordResetController.reset);

export default passwordResetRoutes;