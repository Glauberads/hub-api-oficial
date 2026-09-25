import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as TarefaController from "../controllers/TarefaController";

const tarefaRoutes = Router();

tarefaRoutes.get(
  "/tarefas/resumo",
  isAuth,
  TarefaController.resumo
);

tarefaRoutes.get("/tarefas", isAuth, TarefaController.index);
tarefaRoutes.post("/tarefas", isAuth, TarefaController.store);
tarefaRoutes.put("/tarefas/:id", isAuth, TarefaController.update);
tarefaRoutes.put("/tarefas/:id/mover", isAuth, TarefaController.mover);
tarefaRoutes.post("/tarefas/:id/duplicar", isAuth, TarefaController.duplicar);
tarefaRoutes.delete(
  "/tarefas/resolvidas/limpar",
  isAuth,
  TarefaController.removeResolved
);

tarefaRoutes.delete("/tarefas/:id", isAuth, TarefaController.remove);

export default tarefaRoutes;
