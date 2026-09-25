import express from "express";
import isAuth from "../middleware/isAuth";
import multer from "multer";
// import uploadConfig from "../config/uploadExt";
import uploadConfig from "../config/upload";

import * as FlowBuilderController from "../controllers/FlowBuilderController";

const upload = multer(uploadConfig);

const flowBuilder = express.Router();

flowBuilder.post("/flowbuilder", isAuth, FlowBuilderController.createFlow);

flowBuilder.put("/flowbuilder", isAuth, FlowBuilderController.updateFlow);

flowBuilder.delete("/flowbuilder/:idFlow", isAuth, FlowBuilderController.deleteFlow);

flowBuilder.get("/flowbuilder", isAuth, FlowBuilderController.myFlows);

flowBuilder.get("/flowbuilder/:idFlow", isAuth, FlowBuilderController.flowOne);

flowBuilder.post("/flowbuilder/flow", isAuth, FlowBuilderController.FlowDataUpdate);

flowBuilder.post("/flowbuilder/duplicate", isAuth, FlowBuilderController.FlowDuplicate);

flowBuilder.get("/flowbuilder/flow/:idFlow", isAuth, FlowBuilderController.FlowDataGetOne);

flowBuilder.post("/flowbuilder/img", isAuth, upload.array("medias"), FlowBuilderController.FlowUploadImg);

flowBuilder.post("/flowbuilder/audio", isAuth, upload.array("medias"), FlowBuilderController.FlowUploadAudio);

flowBuilder.post("/flowbuilder/content", isAuth, upload.array('medias'), FlowBuilderController.FlowUploadAll);

flowBuilder.put("/flowbuilder/:idFlow/toggle-active", isAuth, FlowBuilderController.toggleFlowActive);

// Exporta um fluxo para JSON contendo lista de mídias
flowBuilder.get("/flowbuilder/:idFlow/export", isAuth, FlowBuilderController.exportFlow);

// Importa um fluxo via ZIP contendo flow.json e pasta midias/
flowBuilder.post("/flowbuilder/import", isAuth, upload.single("file"), FlowBuilderController.importFlow);

export default flowBuilder;