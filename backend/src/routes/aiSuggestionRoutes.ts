import { Router } from "express";
import isAuth from "../middleware/isAuth";

import * as AISuggestionController from "../controllers/AISuggestionController";

const aiSuggestionRoutes = Router();

aiSuggestionRoutes.post(
  "/tickets/:ticketId/ai-suggestion",
  isAuth,
  AISuggestionController.suggestReply
);

export default aiSuggestionRoutes;