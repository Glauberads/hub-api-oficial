// backend/src/services/WarmupSessionService.ts

import path from "path";
import { DisconnectReason, WASocket } from "@whiskeysockets/baileys";
import { getIO } from "../libs/socket";
import WarmupConnection from "../models/WarmupConnection";
import Company from "../models/Company";
import Plan from "../models/Plan";
import AppError from "../errors/AppError";

const baileys = require("@whiskeysockets/baileys");

const makeWASocket = baileys.default || baileys.makeWASocket;
const fetchLatestBaileysVersion = baileys.fetchLatestBaileysVersion;
const useMultiFileAuthState = baileys.useMultiFileAuthState;

type WarmupPoolItem = {
  id: number;
  sessionId: string;
  sock: WASocket;
  number?: string;
  companyId: number;
};

const warmupPool: WarmupPoolItem[] = [];
const warmupReconnectAttempts: Record<string, number> = {};
const warmupReconnectTimers: Record<string, NodeJS.Timeout> = {};

const getWarmupSessionPath = (sessionId: string): string => {
  return path.resolve(
    __dirname,
    "..",
    "..",
    "..",
    "warmup_sessions",
    sessionId
  );
};

const emitToCompany = (event: string, companyId: number, data: any) => {
  const io = getIO();

  io.to(`company-${companyId}`).emit(event, {
    ...data,
    companyId
  });

  io.emit(`${event}:${companyId}`, {
    ...data,
    companyId
  });
};

const checkCompanyWarmupPlan = async (companyId: number): Promise<void> => {
  const company = await Company.findByPk(companyId, {
    include: [
      {
        model: Plan
      }
    ]
  });

  if (!company) {
    throw new AppError("ERR_COMPANY_NOT_FOUND", 404);
  }

  const plan = (company as any).plan || (company as any).Plan;

  if (!plan || !plan.chipWarmup) {
    throw new AppError("ERR_CHIP_WARMUP_NOT_AVAILABLE_IN_PLAN", 403);
  }
};

export const initWarmupSession = async (
  id: number,
  sessionId: string
): Promise<string | null> => {
  if (!makeWASocket) {
    throw new Error("makeWASocket não encontrado no Baileys.");
  }

  if (!fetchLatestBaileysVersion) {
    throw new Error("fetchLatestBaileysVersion não encontrado no Baileys.");
  }

  if (!useMultiFileAuthState) {
    throw new Error("useMultiFileAuthState não encontrado no Baileys.");
  }

  const connection = await WarmupConnection.findOne({
    where: { id, session: sessionId }
  });

  if (!connection) {
    throw new Error("WarmupConnection não encontrada.");
  }

  const companyId = Number((connection as any).companyId);

  if (!companyId) {
    throw new Error("WarmupConnection sem companyId.");
  }

  await checkCompanyWarmupPlan(companyId);

  const sessionPath = getWarmupSessionPath(sessionId);

  const { state, saveCreds } = await useMultiFileAuthState(sessionPath);
  const { version } = await fetchLatestBaileysVersion();

  return new Promise(resolve => {
    let resolved = false;

    const sock: WASocket = makeWASocket({
      version,
      auth: state,
      printQRInTerminal: true,
      browser: ["Multizap Warmup", "Chrome", "1.0.0"]
    });

    sock.ev.on("creds.update", saveCreds);

    sock.ev.on("connection.update", async update => {
      const { connection: socketConnection, qr, lastDisconnect } = update;

      if (qr && !resolved) {
        resolved = true;

        emitToCompany("warmup:qr", companyId, {
          sessionId,
          qr
        });

        resolve(qr);
      }

      if (socketConnection === "open") {
        warmupReconnectAttempts[sessionId] = 0;

        if (warmupReconnectTimers[sessionId]) {
          clearTimeout(warmupReconnectTimers[sessionId]);
          delete warmupReconnectTimers[sessionId];
        }

        const number = sock.user?.id
          ? sock.user.id.replace("@s.whatsapp.net", "").replace(/:\d+$/, "")
          : undefined;

        const exists = warmupPool.find(item => item.sessionId === sessionId);

        if (!exists) {
          warmupPool.push({
            id,
            sessionId,
            sock,
            number,
            companyId
          });
        }

        await WarmupConnection.update(
          {
            status: "CONNECTED",
            number
          },
          {
            where: {
              session: sessionId,
              companyId
            }
          }
        );

        if (!resolved) {
          resolved = true;
          resolve(null);
        }

        emitToCompany("warmup:connected", companyId, {
          sessionId,
          number: sock.user?.id
        });

        console.log(`Warmup conectado: ${sessionId} empresa=${companyId}`);
      }

      if (socketConnection === "close") {
        const statusCode = (lastDisconnect?.error as any)?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;

        await WarmupConnection.update(
          {
            status: "DISCONNECTED"
          },
          {
            where: {
              session: sessionId,
              companyId
            }
          }
        );

        emitToCompany("warmup:disconnected", companyId, {
          sessionId
        });

        removeWarmupSessionFromPool(sessionId);

        if (shouldReconnect) {
          if (warmupReconnectTimers[sessionId]) {
            return;
          }

          const attempts = warmupReconnectAttempts[sessionId] || 0;

          if (attempts >= 5) {
            console.warn(
              `Warmup reconexão pausada após muitas tentativas: ${sessionId}`
            );
            return;
          }

          const delay = Math.min(30000, 5000 * (attempts + 1));

          warmupReconnectAttempts[sessionId] = attempts + 1;

          warmupReconnectTimers[sessionId] = setTimeout(async () => {
            delete warmupReconnectTimers[sessionId];

            try {
              await checkCompanyWarmupPlan(companyId);
              await initWarmupSession(id, sessionId);
            } catch (err) {
              console.error(
                `Warmup não reconectado. Plano sem permissão ou erro na empresa=${companyId}:`,
                err
              );
            }
          }, delay);
        }
      }
    });
  });
};

export const getWarmupSession = (sessionId: string): WASocket | undefined => {
  return warmupPool.find(item => item.sessionId === sessionId)?.sock;
};

export const getWarmupPool = (): WarmupPoolItem[] => {
  return warmupPool;
};

export const removeWarmupSessionFromPool = (sessionId: string): void => {
  const index = warmupPool.findIndex(item => item.sessionId === sessionId);

  if (index !== -1) {
    warmupPool.splice(index, 1);
  }
};