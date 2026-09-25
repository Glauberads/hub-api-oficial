import express from "express";
import multer from "multer";
import uploadConfig from "../config/upload";

import * as ApiController from "../controllers/ApiController";
import tokenAuth from "../middleware/tokenAuth";

const upload = multer(uploadConfig);

const ApiRoutes = express.Router();

// Envio de texto e mídia (principal)
ApiRoutes.post("/send", tokenAuth, upload.array("medias"), ApiController.index);

// Envio de imagem por URL
ApiRoutes.post("/send/linkImage", tokenAuth, ApiController.indexImage);

// Verificar se número existe no WhatsApp
ApiRoutes.post("/checkNumber", tokenAuth, ApiController.checkNumber);

// Envio de texto sem criar ticket (disparo rápido)
ApiRoutes.post("/send/noTicket", tokenAuth, ApiController.sendNoTicket);

// Envio em lote para múltiplos números
ApiRoutes.post("/send/bulk", tokenAuth, ApiController.sendBulk);

// Listar conexões disponíveis
ApiRoutes.get("/connections", tokenAuth, ApiController.listConnections);

// Envio de mensagens interativas (botões, lista, URL, PIX, etc.)
ApiRoutes.post("/send/buttons", tokenAuth, ApiController.sendButtons);

export default ApiRoutes;

