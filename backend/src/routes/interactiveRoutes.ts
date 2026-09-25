import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as InteractiveMessageController from "../controllers/InteractiveMessageController";

const interactiveRoutes = Router();

interactiveRoutes.post("/interactive/send", isAuth, InteractiveMessageController.send);

export default interactiveRoutes;
