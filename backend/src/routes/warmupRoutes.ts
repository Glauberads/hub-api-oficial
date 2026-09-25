import { Router } from "express";
import WarmupConnectionController from "../controllers/WarmupConnectionController";

const warmupRoutes = Router();

warmupRoutes.get("/warmup", WarmupConnectionController.index);
warmupRoutes.post("/warmup", WarmupConnectionController.store);
warmupRoutes.delete("/warmup/:id", WarmupConnectionController.delete);

warmupRoutes.post("/warmup/start", WarmupConnectionController.start);
warmupRoutes.post("/warmup/stop", WarmupConnectionController.stop);
warmupRoutes.get("/warmup/status", WarmupConnectionController.status);

warmupRoutes.get("/warmup/config", WarmupConnectionController.getConfig);
warmupRoutes.put("/warmup/config", WarmupConnectionController.updateConfig);
warmupRoutes.post("/warmup/toggle", WarmupConnectionController.toggle);

warmupRoutes.post("/warmup/:id/connect", WarmupConnectionController.connect);

export default warmupRoutes;