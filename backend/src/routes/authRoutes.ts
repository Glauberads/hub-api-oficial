import express from "express";
import isAuth from "../middleware/isAuth";
import * as UserController from "../controllers/UserController";
import * as SessionController from "../controllers/SessionController";

const authRoutes = express.Router();

authRoutes.post("/signup", UserController.store);
authRoutes.post("/login", SessionController.store);
authRoutes.post("/refresh_token", SessionController.update);
authRoutes.delete("/logout", isAuth, SessionController.remove);
authRoutes.get("/me", isAuth, SessionController.me);
authRoutes.post("/validate-cnpj", UserController.validateCnpj);

authRoutes.post("/verify-email", UserController.verifyEmail);
authRoutes.post(
  "/resend-verification-code",
  UserController.resendVerificationCode
);

export default authRoutes;