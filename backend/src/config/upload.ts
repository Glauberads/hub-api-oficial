import path from "path";
import multer from "multer";
import fs from "fs";
import Whatsapp from "../models/Whatsapp";
import { isEmpty, isNil } from "lodash";

const publicFolder = path.resolve(__dirname, "..", "..", "public");

// 🛡️ FUNÇÃO SALVA-VIDAS: Garante que o valor será sempre Texto e nunca uma Lista (Array)
const safeString = (value: any): string => {
  if (Array.isArray(value)) return String(value[0]);
  if (value !== undefined && value !== null) return String(value);
  return "";
};

export default {
  directory: publicFolder,
  storage: multer.diskStorage({
    destination: async function (req, file, cb) {
      let companyId = req.user?.companyId;
      
      // Aplicando a função para evitar o erro "Received an instance of Array"
      const finalTypeArch = safeString(req.body?.typeArch || req.query?.typeArch);
      const userId = safeString(req.body?.userId || req.query?.userId);
      const fileId = safeString(req.body?.fileId);

      if (companyId === undefined && isNil(companyId) && isEmpty(companyId)) {
        const authHeader = req.headers?.authorization;
        if (authHeader) {
          const [, token] = authHeader.split(" ");
          const whatsapp = await Whatsapp.findOne({ where: { token } });
          if (whatsapp) companyId = whatsapp.companyId;
        }
      }

      let folder;

      // Primeiro verifica se é o certificado Efí
      if (req.body?.settingKey === "eficertificado") {
        folder = path.resolve(publicFolder, `company${companyId}`, "efi");
      } else if (finalTypeArch === "user") {
        folder = path.resolve(publicFolder, `company${companyId}`, "user");
      } else if (finalTypeArch && finalTypeArch !== "announcements" && finalTypeArch !== "logo") {
        if (finalTypeArch === "fileList") {
          folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch, fileId);
        } else {
          folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch, userId);
        }
      } else if (finalTypeArch === "announcements") {
        folder = path.resolve(publicFolder, finalTypeArch);
      } else if (finalTypeArch === "flow") {
        folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch);
      } else if (finalTypeArch === "chat") {
        folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch);
      } else if (finalTypeArch === "groups") {
        folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch);
      } else if (finalTypeArch === "logo") {
        folder = path.resolve(publicFolder);
      } else if (finalTypeArch === "quickMessage") {
        folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch);
      } else if (finalTypeArch === "floup") {
        folder = path.resolve(publicFolder, `company${companyId}`, finalTypeArch);
      } else {
        folder = path.resolve(publicFolder, `company${companyId}`);
      }

      if (!fs.existsSync(folder)) {
        fs.mkdirSync(folder, { recursive: true });
        fs.chmodSync(folder, 0o777);
      }

      return cb(null, folder);
    },
    
    filename(req, file, cb) {
      const finalTypeArch = safeString(req.body?.typeArch || req.query?.typeArch);
      const safeOriginalName = file.originalname ? String(file.originalname) : `arquivo_${new Date().getTime()}.tmp`;
      
      // Primeiro verifica se é o certificado Efí
      if (req.body?.settingKey === "eficertificado") {
        const timestamp = new Date().getTime();
        return cb(null, `certificado-efi-${timestamp}.p12`);
      }
      
      if (finalTypeArch === "user" && file.mimetype && file.mimetype.startsWith('image/')) {
        const timestamp = new Date().getTime();
        const extension = path.extname(safeOriginalName) || '.jpg';
        const fileName = `profile_${timestamp}${extension}`;
        return cb(null, fileName);
      }
      
      if (file.fieldname === 'audio') {
        const timestamp = new Date().getTime();
        const fileName = `audio_${timestamp}.ogg`;
        return cb(null, fileName);
      }

      if (file.mimetype && file.mimetype.startsWith('audio/')) {
        const timestamp = new Date().getTime();
        let extension = '.ogg';
        
        const originalExt = path.extname(safeOriginalName).toLowerCase();
        if (['.ogg', '.mp3', '.m4a', '.aac'].includes(originalExt)) {
          extension = originalExt;
        }
        
        const fileName = finalTypeArch && !["chat", "announcements"].includes(finalTypeArch) 
          ? `${path.parse(safeOriginalName).name}_${timestamp}${extension}`
          : `audio_${timestamp}${extension}`;
        
        return cb(null, fileName);
      }

      const nameWithoutSpaces = safeOriginalName.replace(/\//g, '-').replace(/ /g, "_");
      
      const fileName = finalTypeArch && !["chat", "announcements"].includes(finalTypeArch) 
        ? nameWithoutSpaces 
        : new Date().getTime() + '_' + nameWithoutSpaces;
      
      return cb(null, fileName);
    }
  }),

  limits: {
    fileSize: 100 * 1024 * 1024 // 100MB
  }
};