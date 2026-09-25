import { Router } from "express";
import multer from "multer";
import os from "os";
import isAuth from "../middleware/isAuth";
import isSuper from "../middleware/isSuper";

import * as BackupController from "../controllers/BackupController";

const upload = multer({ dest: os.tmpdir() });

const backupRoutes = Router();

backupRoutes.get(
  "/backup/sql",
  isAuth,
  isSuper,
  BackupController.backupSQL
);

backupRoutes.get(
  "/backup/json",
  isAuth,
  isSuper,
  BackupController.backupJSON
);

backupRoutes.post(
  "/backup/restore",
  isAuth,
  isSuper,
  upload.single("file"),
  BackupController.restoreSQL
);

backupRoutes.get(
  "/backup/company/:companyId/sql",
  isAuth,
  isSuper,
  BackupController.backupCompanySQL
);

backupRoutes.get(
  "/backup/company/:companyId/json",
  isAuth,
  isSuper,
  BackupController.backupCompanyJSON
);

export default backupRoutes;
