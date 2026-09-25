import { Router } from "express";
import * as N8NCallbackController from "../controllers/N8NCallbackController";

const n8nCallbackRoutes = Router();

// Endpoint público (autenticação via token no body)
n8nCallbackRoutes.post("/n8n-callback", N8NCallbackController.n8nCallback);

export default n8nCallbackRoutes;
