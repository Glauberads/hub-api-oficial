import express from "express";
import isAuth from "../middleware/isAuth";

import * as QuickMessageController from "../controllers/QuickMessageController";
import multer from "multer";
import uploadConfig from "../config/upload";

const upload = multer(uploadConfig);

const routes = express.Router();

routes.get("/quick-messages/list", isAuth, QuickMessageController.findList);

routes.get("/quick-messages", isAuth, QuickMessageController.index);

// Estas rotas precisam ficar antes de /quick-messages/:id
routes.get(
  "/quick-messages/export",
  isAuth,
  QuickMessageController.exportQuickMessages
);

routes.post(
  "/quick-messages/import",
  isAuth,
  upload.single("file"),
  QuickMessageController.importQuickMessages
);

routes.delete(
  "/quick-messages/bulk",
  isAuth,
  QuickMessageController.bulkRemove
);

routes.get("/quick-messages/:id", isAuth, QuickMessageController.show);

routes.post("/quick-messages", isAuth, QuickMessageController.store);

routes.put("/quick-messages/:id", isAuth, QuickMessageController.update);

routes.delete("/quick-messages/:id", isAuth, QuickMessageController.remove);

// Upload de mídia geral (imagem, vídeo, documento)
routes.post(
    "/quick-messages/:id/media-upload",
    isAuth,
    upload.array("file"),
    QuickMessageController.mediaUpload
);

// Novo endpoint específico para upload de áudio gravado
routes.post(
    "/quick-messages/:id/audio-upload",
    isAuth,
    upload.array("audio"),
    QuickMessageController.audioUpload
);
  
routes.delete(
    "/quick-messages/:id/media-upload",
    isAuth,
    QuickMessageController.deleteMedia
);
  
export default routes;