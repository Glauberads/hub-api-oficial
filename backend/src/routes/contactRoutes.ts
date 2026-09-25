import express from "express";
import multer from "multer";
import isAuth from "../middleware/isAuth";
import uploadConfig from "../config/upload";

import * as ContactController from "../controllers/ContactController";
import * as ImportPhoneContactsController from "../controllers/ImportPhoneContactsController";

const contactRoutes = express.Router();
const upload = multer(uploadConfig);

// ========== Rotas estáticas PRIMEIRO (antes de :contactId) ==========
contactRoutes.post("/contacts/bulk-delete", isAuth, ContactController.bulkDelete);
contactRoutes.delete("/contacts/all", isAuth, ContactController.deleteAll);
contactRoutes.post("/contacts/import", isAuth, ImportPhoneContactsController.store);
contactRoutes.get("/contacts/sync-status", isAuth, ImportPhoneContactsController.syncStatus);
contactRoutes.get("/contacts/list", isAuth, ContactController.list);
contactRoutes.get("/contacts/wallets", isAuth, ContactController.listWallets);
contactRoutes.get("/contacts/profile/:number", isAuth, ContactController.getContactProfileURL);
contactRoutes.post("/contacts/upload", isAuth, upload.array("file"), ContactController.upload);
contactRoutes.post("/contactsImport", isAuth, ContactController.importXls);

// ========== Rotas base ==========
contactRoutes.get("/contacts", isAuth, ContactController.index);
contactRoutes.post("/contacts", isAuth, ContactController.store);

// ========== Rotas parametrizadas por :contactId POR ÚLTIMO ==========
contactRoutes.get("/contacts/:contactId(\\d+)", isAuth, ContactController.show);
contactRoutes.put("/contacts/:contactId(\\d+)", isAuth, ContactController.update);
contactRoutes.delete("/contacts/:contactId(\\d+)", isAuth, ContactController.remove);
contactRoutes.get("/contacts/:contactId(\\d+)/participants", isAuth, ContactController.getGroupParticipants);
contactRoutes.get("/contacts/:contactId(\\d+)/media", isAuth, ContactController.getContactMedia);
contactRoutes.get("/contacts/:contactId(\\d+)/messages/search", isAuth, ContactController.searchMessages);
contactRoutes.put("/contacts/toggleAcceptAudio/:contactId", isAuth, ContactController.toggleAcceptAudio);
contactRoutes.put("/contacts/block/:contactId", isAuth, ContactController.blockUnblock);
contactRoutes.put("/contacts/toggleDisableBot/:contactId", isAuth, ContactController.toggleDisableBot);
contactRoutes.put("/contacts/wallet/:contactId", isAuth, ContactController.updateContactWallet);
contactRoutes.delete("/contacts/wallet/:contactId", isAuth, ContactController.deleteContactWallet);
contactRoutes.get("/contactTags/:contactId", isAuth, ContactController.getContactTags);

export default contactRoutes;
