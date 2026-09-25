import { Router } from "express";
import multer from "multer";
import fs from "fs";
import path from "path";

import isAuth from "../middleware/isAuth";
import OfficialCallRecordingController from "../controllers/OfficialCallRecordingController";

const officialCallRecordingRoutes = Router();

const storage = multer.diskStorage({
  destination: (req: any, file, cb) => {
    const companyId = Number(req?.user?.companyId || req?.body?.companyId || 0) || 0;

    const folder = path.resolve(
      __dirname,
      "..",
      "..",
      "public",
      `company${companyId}`,
      "official-call-recordings"
    );

    fs.mkdirSync(folder, { recursive: true });

    cb(null, folder);
  },

  filename: (req, file, cb) => {
    const originalExt = path.extname(file.originalname || "").toLowerCase();

    const ext =
      originalExt ||
      (file.mimetype === "audio/ogg"
        ? ".ogg"
        : file.mimetype === "audio/webm"
          ? ".webm"
          : ".webm");

    const safeName = `meta-official-${Date.now()}-${Math.random()
      .toString(36)
      .slice(2)}${ext}`;

    cb(null, safeName);
  }
});

const upload = multer({
  storage,
  limits: {
    fileSize: 50 * 1024 * 1024
  }
});

officialCallRecordingRoutes.post(
  "/official-call-recording",
  isAuth,
  upload.single("recording"),
  OfficialCallRecordingController.store
);

export default officialCallRecordingRoutes;
