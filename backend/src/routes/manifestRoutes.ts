import { Router } from "express";
import ManifestController from "../controllers/ManifestController";

const manifestRoutes = Router();

manifestRoutes.get("/manifest.json", ManifestController.showManifest);

export default manifestRoutes;