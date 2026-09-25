import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as AsaasController from "../controllers/AsaasController";

const asaasRoutes = Router();

asaasRoutes.post("/asaas/second-copy", isAuth, AsaasController.secondCopy);

export default asaasRoutes;