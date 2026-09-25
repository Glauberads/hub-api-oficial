import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as InteractiveTemplateController from "../controllers/InteractiveTemplateController";

const routes = Router();

routes.get("/interactive-templates", isAuth, InteractiveTemplateController.index);
routes.post("/interactive-templates", isAuth, InteractiveTemplateController.store);
routes.put("/interactive-templates/:id", isAuth, InteractiveTemplateController.update);
routes.delete("/interactive-templates/:id", isAuth, InteractiveTemplateController.remove);

export default routes;
