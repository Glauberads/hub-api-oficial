import fs from "fs/promises"
import * as Sentry from "@sentry/node";
import makeWASocket, {
  Browsers,
  DisconnectReason,
  WAMessage,
  WAMessageContent,
  WAMessageKey,
  WAMessageStubType,
  WASocket,
  isJidBroadcast,
  isJidGroup,
  isJidNewsletter,
  isJidStatusBroadcast,
  jidNormalizedUser,
  makeCacheableSignalKeyStore,
  proto,
} from "@whiskeysockets/baileys";
import { makeInMemoryStore } from "@whiskeysockets/baileys";
import { FindOptions } from "sequelize/types";
import Whatsapp from "../models/Whatsapp";
import logger from "../utils/logger";
import pino from "pino";
import { useMultiFileAuthState } from "../helpers/useMultiFileAuthState";
import { Boom } from "@hapi/boom";
import AppError from "../errors/AppError";
import { emitCompanyEvent } from "./socket";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "../libs/cache";
import { add } from "date-fns";
import moment from "moment";
import { getTypeMessage, isValidMsg } from "../services/WbotServices/wbotMessageListener";
import { addLogs } from "../helpers/addLogs";
import NodeCache from 'node-cache';
import Message from "../models/Message";
import { getVersionByIndexFromUrl } from "../utils/versionHelper";
import path from "path";
import { getGroupMetadataCache } from "../utils/RedisGroupCache";
import RestoreWhatsAppHistoryService from "../services/WbotServices/RestoreWhatsAppHistoryService";

const loggerBaileys = pino({ level: "error" });

export type Session = WASocket & {
  id?: number;
  myJid?: string;
  myLid?: string;
  store?: (msg: proto.IWebMessageInfo) => void;
  sessionName?: string;
};

const sessions: Session[] = [];
const inMemoryStores = new Map<number, ReturnType<typeof makeInMemoryStore>>();
const jidSessionMap = new Map<number, string>();

export const getInMemoryStore = (whatsappId: number) => inMemoryStores.get(whatsappId);

const retriesQrCodeMap = new Map<number, number>();
const reconnectAttemptsMap = new Map<number, number>();
const MAX_RECONNECT_ATTEMPTS = 30;
const BASE_RECONNECT_DELAY_MS = 1500;
const MAX_RECONNECT_DELAY_MS = 3 * 60 * 1000;

const STABILITY_THRESHOLD_MS = 2 * 60 * 1000;
const stabilityTimerMap = new Map<number, NodeJS.Timeout>();

const conflictDisconnectMap = new Map<number, { count: number; firstAt: number }>();
const CONFLICT_WINDOW_MS = 2 * 60 * 1000;
const MAX_CONFLICT_RECONNECTS = 5;

const lastActivityMap = new Map<number, number>();

const presenceStateMap = new Map<number, "available" | "unavailable">();
const presenceIdleTimerMap = new Map<number, NodeJS.Timeout>();
const presenceBootstrapTimerMap = new Map<number, NodeJS.Timeout>();

const clearPresenceIdleTimer = (whatsappId: number) => {
  const timer = presenceIdleTimerMap.get(whatsappId);
  if (timer) {
    clearTimeout(timer);
    presenceIdleTimerMap.delete(whatsappId);
  }
};

const clearPresenceBootstrapTimer = (whatsappId: number) => {
  const timer = presenceBootstrapTimerMap.get(whatsappId);
  if (timer) {
    clearTimeout(timer);
    presenceBootstrapTimerMap.delete(whatsappId);
  }
};

const setSessionPresence = async (
  sock: Session,
  whatsappId: number,
  sessionName: string,
  presence: "available" | "unavailable"
) => {
  try {
    await sock.sendPresenceUpdate(presence);
    presenceStateMap.set(whatsappId, presence);
    logger.info(`[PRESENCE] ${sessionName} => ${presence}`);
  } catch (err: any) {
    logger.warn(
      `[PRESENCE] Falha ao enviar ${presence} para ${sessionName}: ${err?.message || err}`
    );
  }
};

const scheduleInitialUnavailable = (
  sock: Session,
  whatsappId: number,
  sessionName: string,
  delayMs = 4000
) => {
  clearPresenceBootstrapTimer(whatsappId);

  const timer = setTimeout(() => {
    void (async () => {
      try {
        if (presenceStateMap.get(whatsappId) === "available") {
          return;
        }
        await setSessionPresence(sock, whatsappId, sessionName, "unavailable");
      } finally {
        presenceBootstrapTimerMap.delete(whatsappId);
      }
    })();
  }, delayMs);

  if ((timer as any).unref) {
    (timer as any).unref();
  }

  presenceBootstrapTimerMap.set(whatsappId, timer);
};

const markSessionActive = async (
  sock: Session,
  whatsappId: number,
  sessionName: string,
  idleMs = 45000
) => {
  clearPresenceBootstrapTimer(whatsappId);
  clearPresenceIdleTimer(whatsappId);

  if (presenceStateMap.get(whatsappId) !== "available") {
    await setSessionPresence(sock, whatsappId, sessionName, "available");
  }

  const timer = setTimeout(() => {
    void (async () => {
      try {
        await setSessionPresence(sock, whatsappId, sessionName, "unavailable");
      } finally {
        presenceIdleTimerMap.delete(whatsappId);
      }
    })();
  }, idleMs);

  if ((timer as any).unref) {
    (timer as any).unref();
  }

  presenceIdleTimerMap.set(whatsappId, timer);
};

export const touchSessionActivity = (whatsappId: number): void => {
  lastActivityMap.set(whatsappId, Date.now());

  const session = sessions.find(s => s.id === whatsappId);
  if (!session?.ws) return;

  const wsAny = session.ws as any;
  const isWsOpen =
    (typeof wsAny?.readyState === "number" && wsAny.readyState === 1) ||
    (typeof wsAny?.isClosed === "boolean" && !wsAny.isClosed) ||
    !!session.user?.id;

  if (!isWsOpen) return;

  void markSessionActive(
    session,
    whatsappId,
    session.sessionName || `session-${whatsappId}`
  );
};

export const startIdleCheck = (): void => { };
export const stopIdleCheck = (): void => { };

const scheduleBackoffReset = (whatsappId: number, sessionName: string): void => {
  const existingTimer = stabilityTimerMap.get(whatsappId);
  if (existingTimer) clearTimeout(existingTimer);

  const currentAttempts = reconnectAttemptsMap.get(whatsappId) || 0;
  if (currentAttempts === 0) return;

  logger.info(`[BACKOFF] ${sessionName} conectou. Backoff será resetado em ${STABILITY_THRESHOLD_MS / 60000}min se permanecer estável (tentativas atuais: ${currentAttempts})`);

  const timer = setTimeout(() => {
    reconnectAttemptsMap.delete(whatsappId);
    stabilityTimerMap.delete(whatsappId);
    logger.info(`[BACKOFF] ✅ ${sessionName} estável por ${STABILITY_THRESHOLD_MS / 60000}min — backoff resetado`);
  }, STABILITY_THRESHOLD_MS);

  if (timer.unref) timer.unref();
  stabilityTimerMap.set(whatsappId, timer);
};

const cancelStabilityTimer = (whatsappId: number): void => {
  const timer = stabilityTimerMap.get(whatsappId);
  if (timer) {
    clearTimeout(timer);
    stabilityTimerMap.delete(whatsappId);
  }
};

const getReconnectDelay = (whatsappId: number): number => {
  const attempts = reconnectAttemptsMap.get(whatsappId) || 0;
  const delay = Math.min(
    BASE_RECONNECT_DELAY_MS * Math.pow(2, attempts),
    MAX_RECONNECT_DELAY_MS
  );
  const jitter = delay * 0.2 * (Math.random() * 2 - 1);
  return Math.round(delay + jitter);
};

const HEALTH_CHECK_INTERVAL_MS = 5 * 60 * 1000;
const lastPongMap = new Map<number, number>();
const failedPingCountMap = new Map<number, number>();
const ZOMBIE_FAILED_PINGS = 3;
let healthCheckTimer: NodeJS.Timer | null = null;

const performHealthCheck = async (): Promise<void> => {
  if (sessions.length === 0) return;

  for (const session of sessions) {
    if (!session?.id || !session?.ws) continue;

    const whatsappId = session.id;

    try {
      const wsAny = session.ws as any;
      const isWsOpen = typeof wsAny?.readyState === 'number'
        ? wsAny.readyState === 1
        : typeof wsAny?.isClosed === 'boolean'
          ? !wsAny.isClosed
          : !!session.user?.id;

      if (!isWsOpen) {
        const failedPings = (failedPingCountMap.get(whatsappId) || 0) + 1;
        failedPingCountMap.set(whatsappId, failedPings);
        logger.warn(`[HEALTH-CHECK] Sessão ${whatsappId} - WS fechado (${failedPings}/${ZOMBIE_FAILED_PINGS})`);

        if (failedPings >= ZOMBIE_FAILED_PINGS) {
          logger.error(`[HEALTH-CHECK] Sessão ${whatsappId} - CONEXÃO ZUMBI! Forçando reconexão.`);
          try {
            const whatsapp = await Whatsapp.findByPk(whatsappId);
            if (whatsapp && whatsapp.status === "CONNECTED") {
              await whatsapp.update({ status: "OPENING" });
              removeWbot(whatsappId, false);
              failedPingCountMap.delete(whatsappId);

              const { StartWhatsAppSession } = await import("../services/WbotServices/StartWhatsAppSession");
              setTimeout(() => StartWhatsAppSession(whatsapp, whatsapp.companyId), 3000);
            }
          } catch (restartErr) {
            logger.error(`[HEALTH-CHECK] Erro ao reiniciar sessão ${whatsappId}: ${(restartErr as any).message}`);
          }
        }
        continue;
      }

      failedPingCountMap.set(whatsappId, 0);
      lastPongMap.set(whatsappId, Date.now());
    } catch (err) {
      logger.error(`[HEALTH-CHECK] Erro ao verificar sessão ${whatsappId}: ${(err as any).message}`);
    }
  }
};

export const startHealthCheck = (): void => {
  if (healthCheckTimer) return;

  logger.info(`[HEALTH-CHECK] Iniciando monitoramento periódico (intervalo: ${HEALTH_CHECK_INTERVAL_MS / 1000}s)`);
  healthCheckTimer = setInterval(performHealthCheck, HEALTH_CHECK_INTERVAL_MS);
};

export const stopHealthCheck = (): void => {
  if (healthCheckTimer) {
    clearInterval(healthCheckTimer);
    healthCheckTimer = null;
    logger.info("[HEALTH-CHECK] Monitoramento periódico parado");
  }
};

let cachedWhatsAppVersion: [number, number, number] | null = null;

export const initializeWhatsAppVersion = async (): Promise<void> => {
  try {
    if (!cachedWhatsAppVersion) {
      cachedWhatsAppVersion = [2, 3000, 1044006379];
      console.info("✅ [WBOT] Versão do WhatsApp Web carregada:", cachedWhatsAppVersion);
    }
  } catch (error) {
    console.error("❌ [WBOT] Erro ao buscar versão do WhatsApp Web:", error);
    cachedWhatsAppVersion = [2, 3000, 1044006379];
    console.info("⚠️ [WBOT] Usando versão padrão:", cachedWhatsAppVersion);
  }
};

const getWhatsAppVersion = (): [number, number, number] => {
  if (!cachedWhatsAppVersion) {
    console.warn("⚠️ [WBOT] Versão não inicializada, usando versão padrão");
    return [2, 3000, 1044006379];
  }
  return cachedWhatsAppVersion;
};

async function deleteFolder(folder) {
  try {
    await fs.rm(folder, { recursive: true });
    console.log('Pasta deletada com sucesso!', folder);
  } catch (err) {
    console.error('Erro ao deletar pasta:', err);
  }
}

export const getWbot = (whatsappId: number): Session => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex === -1) {
    throw new AppError("ERR_WAPP_NOT_INITIALIZED");
  }

  touchSessionActivity(whatsappId);

  return sessions[sessionIndex];
};

export const getWbotOrReconnect = async (whatsappId: number): Promise<Session> => {
  const sessionIndex = sessions.findIndex(s => s.id === whatsappId);

  if (sessionIndex !== -1) {
    touchSessionActivity(whatsappId);
    return sessions[sessionIndex];
  }

  throw new AppError("ERR_WAPP_NOT_INITIALIZED");
};

export const restartWbot = async (
  companyId: number,
  session?: any
): Promise<void> => {
  try {
    const options: FindOptions = {
      where: {
        companyId,
      },
      attributes: ["id"],
    }

    const whatsapp = await Whatsapp.findAll(options);

    whatsapp.map(async c => {
      const sessionIndex = sessions.findIndex(s => s.id === c.id);
      if (sessionIndex !== -1) {
        sessions[sessionIndex].ws.close();
      }
    });

  } catch (err) {
    logger.error(err);
  }
};

const checkWbotDuplicity = (currentWhatsappId: number, jid: string): void => {
  if (!jid) return;

  for (const [whatsappId, existingJid] of jidSessionMap.entries()) {
    if (whatsappId !== currentWhatsappId && existingJid === jid) {
      logger.warn(
        `[MUTEX] JID ${jid} já conectado na sessão ${whatsappId}. Removendo duplicata para dar lugar à sessão ${currentWhatsappId}.`
      );
      removeWbot(whatsappId, false);
    }
  }
};

export const removeWbot = async (
  whatsappId: number,
  isLogout = true
): Promise<void> => {
  try {
    const sessionIndex = sessions.findIndex(s => s.id === whatsappId);
    if (sessionIndex !== -1) {
      const session = sessions[sessionIndex];

      try {
        if (session.ev) {
          session.ev.removeAllListeners();
          logger.info(`[WBOT] Todos os listeners removidos da sessão ${whatsappId}`);
        }
      } catch (evError) {
        logger.warn(`[WBOT] Falha ao remover listeners da sessão ${whatsappId}: ${(evError as any)?.message}`);
      }

      if (isLogout) {
        try {
          await session.logout();
        } catch (logoutError) {
          logger.warn(`[WBOT] Falha ao deslogar sessão ${whatsappId}: ${logoutError?.message || logoutError}`);
        }
      }

      try {
        session.ws?.close();
      } catch (closeError) {
        logger.warn(`[WBOT] Falha ao fechar socket da sessão ${whatsappId}: ${closeError?.message || closeError}`);
      }

      sessions.splice(sessionIndex, 1);
      lastPongMap.delete(whatsappId);
      failedPingCountMap.delete(whatsappId);
      cancelStabilityTimer(whatsappId);
      clearPresenceIdleTimer(whatsappId);
      clearPresenceBootstrapTimer(whatsappId);
      presenceStateMap.delete(whatsappId);
      inMemoryStores.delete(whatsappId);
      lastActivityMap.delete(whatsappId);
      jidSessionMap.delete(whatsappId);
      conflictDisconnectMap.delete(whatsappId);

      if (sessions.length === 0) {
        stopHealthCheck();
        stopIdleCheck();
      }
    }
  } catch (err) {
    logger.error(err);
  }
};

export function internalIsJidGroup(jid: string): boolean {
  return isJidGroup(jid);
}

const pairingCodeCallbacks = new Map<number, (code: string) => void>();

const isSessionReadyForPairing = (session: Session | undefined): { ready: boolean; reason: string } => {
  if (!session) return { ready: false, reason: "session_null" };

  const wsAny = session?.ws as any;

  const readyState = wsAny?.readyState;
  const isClosed = wsAny?.isClosed;
  const isWsOpen =
    (typeof readyState === "number" && readyState === 1) ||
    (typeof isClosed === "boolean" && !isClosed) ||
    (readyState === undefined && isClosed === undefined && !!wsAny);

  if (!isWsOpen) return { ready: false, reason: `ws_not_open (readyState=${readyState}, isClosed=${isClosed})` };

  const isRegistered = !!session?.user?.id;
  if (isRegistered) return { ready: false, reason: "already_registered" };

  return { ready: true, reason: "ok" };
};

const normalizePairingCode = (code: string): string => {
  return String(code || "").replace(/[^a-zA-Z0-9]/g, "").toUpperCase();
};

export const requestPairingCode = async (whatsappId: number, phoneNumber: string): Promise<string> => {
  const cleanNumber = phoneNumber.replace(/\D/g, "");

  if (!cleanNumber || cleanNumber.length < 10) {
    throw new AppError("Número inválido. Use o formato: 5511999998888", 400);
  }

  const maxAttempts = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    const session = sessions.find(s => s.id === whatsappId);

    if (!session) {
      logger.error(`[PairingCode] Sessão ${whatsappId} NÃO encontrada em memória. Sessions ativas: [${sessions.map(s => s.id).join(",")}]`);
      throw new AppError("ERR_WAPP_NOT_INITIALIZED — sessão não está em memória. Clique em 'Tentar novamente' na tela de conexões.", 400);
    }

    if (session?.user?.id) {
      throw new AppError("Sessão já está autenticada. Desconecte antes de solicitar novo pareamento.", 400);
    }

    try {
      const readiness = isSessionReadyForPairing(session);
      logger.info(`[PairingCode] Tentativa ${attempt}/${maxAttempts} - readiness: ${JSON.stringify(readiness)}`);

      if (!readiness.ready) {
        if (readiness.reason === "already_registered") {
          throw new AppError("Sessão já está autenticada.", 400);
        }

        logger.warn(`[PairingCode] Sessão ${whatsappId} não pronta: ${readiness.reason}. Aguardando 3s...`);
        await new Promise(resolve => setTimeout(resolve, 3000));

        const retrySession = sessions.find(s => s.id === whatsappId);
        const retryReadiness = isSessionReadyForPairing(retrySession);
        if (!retryReadiness.ready) {
          throw new Error(`PAIRING_SESSION_NOT_READY: ${retryReadiness.reason}`);
        }
      }

      await new Promise(resolve => setTimeout(resolve, 2000));

      const currentSession = sessions.find(s => s.id === whatsappId);
      if (!currentSession) {
        throw new Error("Sessão perdida durante estabilização");
      }

      logger.info(`[PairingCode] Chamando requestPairingCode no Baileys para número ${cleanNumber}...`);
      const rawCode = await (currentSession as any).requestPairingCode(cleanNumber);
      logger.info(`[PairingCode] Baileys retornou código raw: "${rawCode}"`);

      const normalizedCode = normalizePairingCode(rawCode);

      if (!normalizedCode || normalizedCode.length < 4 || normalizedCode === "SUK1CH4N") {
        logger.warn(`[PairingCode] Código inválido recebido: "${normalizedCode}" (raw: "${rawCode}")`);
        throw new Error("INVALID_PAIRING_CODE");
      }

      logger.info(`[PairingCode] ✅ Código gerado para whatsappId=${whatsappId} na tentativa ${attempt}/${maxAttempts}: ${normalizedCode}`);
      return normalizedCode;
    } catch (err: any) {
      lastError = err;
      const message = err?.message || String(err);
      const canRetry =
        attempt < maxAttempts &&
        /(PAIRING_SESSION_NOT_READY|INVALID_PAIRING_CODE|timeout|timed out|closed|connection|stream|conflict|temporarily unavailable|429|rate|not initialized)/i.test(message);

      logger.warn(`[PairingCode] Falha na tentativa ${attempt}/${maxAttempts} para whatsappId=${whatsappId}: ${message}`);

      if (!canRetry) {
        break;
      }

      const retryDelay = 2000 * attempt;
      logger.info(`[PairingCode] Aguardando ${retryDelay}ms antes da próxima tentativa...`);
      await new Promise(resolve => setTimeout(resolve, retryDelay));
    }
  }

  logger.error(`[PairingCode] Erro ao solicitar código após ${maxAttempts} tentativas: ${lastError?.message || lastError}`);
  throw new AppError(lastError?.message || "Erro ao gerar código de pareamento.", 500);
};

export const initWASocket = async (whatsapp: Whatsapp): Promise<Session> => {
  return new Promise(async (resolve, reject) => {
    try {
      (async () => {
        const whatsappUpdate = await Whatsapp.findOne({
          where: { id: whatsapp.id }
        });

        if (!whatsappUpdate) return;

        const { id, name, allowGroup, companyId } = whatsappUpdate;

        logger.info(`Starting session ${name}`);
        let retriesQrCode = 0;

        let wsocket: Session = null;

        const store = new NodeCache({
          stdTTL: 3600,
          checkperiod: 30,
          useClones: false
        });

        const msgRetryCounterCache = new NodeCache({
          stdTTL: 60 * 60,
          useClones: false
        });

        const sessionRetryCache = new NodeCache({
          stdTTL: 60 * 5,
          useClones: false
        });
        const MAX_SESSION_RETRIES = 3;

        async function getMessage(
          key: WAMessageKey
        ): Promise<WAMessageContent> {
          if (!key.id) return null;

          const message = store.get(key.id);

          if (message) {
            logger.info({ message }, "cacheMessage: recovered from cache");
            return message;
          }

          logger.info(
            { key },
            "cacheMessage: not found in cache - fallback to database"
          );

          let msg: Message;

          msg = await Message.findOne({
            where: { wid: key.id, fromMe: true }
          });

          if (!msg) {
            logger.info({ key }, "cacheMessage: not found in database");
            return undefined;
          }

          try {
            const data = JSON.parse(msg.dataJson);
            logger.info(
              { key, data },
              "cacheMessage: recovered from database"
            );
            store.set(key.id, data.message);
            return data.message || undefined;
          } catch (error) {
            logger.error(
              { key },
              `cacheMessage: error parsing message from database - ${error.message}`
            );
          }

          return undefined;
        }

        const versionWA = getWhatsAppVersion();
        console.info(`[WBOT] Usando versão cacheada para ${name}:`, versionWA);

        const publicFolder = path.join(__dirname, '..', '..', '..', 'backend', 'sessions');
        const folderSessions = path.join(publicFolder, `company${whatsapp.companyId}`, whatsapp.id.toString());

        const { state, saveCreds } = await useMultiFileAuthState(whatsapp);

        wsocket = makeWASocket({
          version: versionWA || [2, 3000, 1044006379],
          logger: loggerBaileys,
          printQRInTerminal: false,
          markOnlineOnConnect: false,
          auth: {
            creds: state.creds,
            keys: makeCacheableSignalKeyStore(state.keys, loggerBaileys),
          },
          syncFullHistory: true,
          transactionOpts: { maxCommitRetries: 1, delayBetweenTriesMs: 10 },
          generateHighQualityLinkPreview: true,
          linkPreviewImageThumbnailWidth: 200,
          emitOwnEvents: true,
          browser: Browsers.ubuntu("Chrome"),
          defaultQueryTimeoutMs: 60000,
          connectTimeoutMs: 60000,
          keepAliveIntervalMs: 30000,
          msgRetryCounterCache,
          maxMsgRetryCount: MAX_SESSION_RETRIES,
          shouldIgnoreJid: jid => {
            const ignoreJid = (!allowGroup && isJidGroup(jid)) ||
              isJidBroadcast(jid) ||
              isJidNewsletter(jid) ||
              isJidStatusBroadcast(jid)
            return ignoreJid
          },
          getMessage
        });

        wsocket.id = whatsapp.id;
        wsocket.sessionName = name;

        wsocket.store = (msg: proto.IWebMessageInfo): void => {
          if (!msg.key.fromMe) return;

          logger.debug({ message: msg.message }, "cacheMessage: saved");

          store.set(msg.key.id, msg.message);
        };

        wsocket.ev.on(
          "connection.update",
          async ({ connection, lastDisconnect, qr }) => {
            const lastDisconnectMessage =
              (lastDisconnect?.error as any)?.message || "";

            logger.info(
              `Socket  ${name} Connection Update ${connection || ""} ${lastDisconnectMessage}`
            );

            if (connection === "close") {
              cancelStabilityTimer(id);
              clearPresenceIdleTimer(id);
              clearPresenceBootstrapTimer(id);
              presenceStateMap.delete(id);

              const statusCode = (lastDisconnect?.error as Boom | undefined)?.output?.statusCode;
              const disconnectMessage = (lastDisconnect?.error as Error | undefined)?.message || "";
              const isLoggedOut = statusCode === DisconnectReason.loggedOut;
              const isForbidden = statusCode === 403;
              const isRestartRequired = statusCode === DisconnectReason.restartRequired;
              const isConflictDisconnect =
                statusCode === 440 || /conflict|replaced|stream errored/i.test(disconnectMessage);

              let shouldReconnect = !isLoggedOut && !isForbidden;
              let conflictCount = 0;

              if (isConflictDisconnect) {
                const now = Date.now();
                const previous = conflictDisconnectMap.get(id);
                const withinWindow = !!previous && now - previous.firstAt <= CONFLICT_WINDOW_MS;

                conflictCount = withinWindow ? previous.count + 1 : 1;

                conflictDisconnectMap.set(id, {
                  count: conflictCount,
                  firstAt: withinWindow ? previous.firstAt : now
                });

                if (conflictCount > MAX_CONFLICT_RECONNECTS) {
                  shouldReconnect = false;
                }
              }

              logger.info(
                `[WBOT] ${name} desconectado - statusCode: ${statusCode}, reconectar: ${shouldReconnect}`
              );

              if (isForbidden) {
                await whatsapp.update({ status: "PENDING", session: "" });
                await DeleteBaileysService(whatsapp.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                removeWbot(id, false);
                reconnectAttemptsMap.delete(id);
                conflictDisconnectMap.delete(id);
              } else if (isLoggedOut) {
                logger.info(`[WBOT] ${name} deslogado pelo usuário. Aguardando nova autenticação.`);
                await whatsapp.update({ status: "PENDING", session: "" });
                await DeleteBaileysService(whatsapp.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                removeWbot(id, false);
                reconnectAttemptsMap.delete(id);
                conflictDisconnectMap.delete(id);
              } else if (shouldReconnect) {
                if (isConflictDisconnect) {
                  logger.warn(
                    `[WBOT] ${name} conflito de sessão detectado (${conflictCount}/${MAX_CONFLICT_RECONNECTS}). Tentando reconectar...`
                  );
                }

                await whatsapp.update({ status: "OPENING" });
                await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });

                if (isRestartRequired) {
                  reconnectAttemptsMap.delete(id);
                }

                const attempts = reconnectAttemptsMap.get(id) || 0;

                if (attempts >= MAX_RECONNECT_ATTEMPTS) {
                  logger.warn(`[WBOT] ${name} atingiu máximo de ${MAX_RECONNECT_ATTEMPTS} tentativas de reconexão. Parando.`);
                  await whatsapp.update({ status: "DISCONNECTED" });
                  await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                    action: "update",
                    session: whatsapp
                  });
                  removeWbot(id, false);
                  reconnectAttemptsMap.delete(id);
                } else {
                  const delay = getReconnectDelay(id);
                  reconnectAttemptsMap.set(id, attempts + 1);
                  logger.info(`[WBOT] ${name} reconectando em ${Math.round(delay / 1000)}s (tentativa ${attempts + 1}/${MAX_RECONNECT_ATTEMPTS})`);
                  removeWbot(id, false);
                  setTimeout(
                    () => StartWhatsAppSession(whatsapp, whatsapp.companyId),
                    delay
                  );
                }
              } else {
                logger.warn(
                  `[WBOT] ${name} recebeu conflitos consecutivos (${conflictCount}) e foi marcado como DISCONNECTED para evitar loop.`
                );
                await whatsapp.update({ status: "DISCONNECTED" });
                await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });
                removeWbot(id, false);
                reconnectAttemptsMap.delete(id);
                conflictDisconnectMap.delete(id);
              }
            }

            if (connection === "open") {
              conflictDisconnectMap.delete(id);

              const currentAttempts = reconnectAttemptsMap.get(id) || 0;
              if (currentAttempts > 0) {
                reconnectAttemptsMap.set(id, Math.max(0, currentAttempts - 1));
              }

              scheduleBackoffReset(id, name);
              lastPongMap.set(id, Date.now());
              startHealthCheck();
              lastActivityMap.set(id, Date.now());

              wsocket.myLid = jidNormalizedUser(wsocket.user?.lid)
              wsocket.myJid = jidNormalizedUser(wsocket.user.id)

              const normalizedJid = jidNormalizedUser(wsocket.user.id);
              checkWbotDuplicity(id, normalizedJid);
              jidSessionMap.set(id, normalizedJid);

              await whatsapp.update({
                status: "CONNECTED",
                qrcode: "",
                retries: 0,
                number: jidNormalizedUser((wsocket as WASocket).user.id).split("@")[0]
              });

              await whatsapp.reload();

              logger.debug(
                {
                  id: jidNormalizedUser(wsocket.user.id),
                  name: wsocket.user.name,
                  lid: jidNormalizedUser(wsocket.user?.lid),
                  notify: wsocket.user?.notify,
                  verifiedName: wsocket.user?.verifiedName,
                  imgUrl: wsocket.user?.imgUrl,
                  status: wsocket.user?.status
                },
                `Session ${name} details`
              );

              await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                action: "update",
                session: whatsapp
              });

              const sessionIndex = sessions.findIndex(
                s => s.id === whatsapp.id
              );
              if (sessionIndex === -1) {
                wsocket.id = whatsapp.id;
                sessions.push(wsocket);
              }

              scheduleInitialUnavailable(wsocket, id, name);

              resolve(wsocket);
            }

            if (qr !== undefined) {
              if (retriesQrCodeMap.get(id) && retriesQrCodeMap.get(id) >= 3) {
                await whatsappUpdate.update({
                  status: "DISCONNECTED",
                  qrcode: ""
                });
                await DeleteBaileysService(whatsappUpdate.id);
                await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
                await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsappUpdate
                });
                wsocket.ev.removeAllListeners("connection.update");
                wsocket.ws.close();
                wsocket = null;
                retriesQrCodeMap.delete(id);
                resolve(null as any);
              } else {
                logger.info(`Session QRCode Generate ${name}`);
                retriesQrCodeMap.set(id, (retriesQrCode += 1));

                await whatsapp.update({
                  qrcode: qr,
                  status: "qrcode",
                  retries: 0,
                  number: ""
                });
                const sessionIndex = sessions.findIndex(
                  s => s.id === whatsapp.id
                );

                if (sessionIndex === -1) {
                  wsocket.id = whatsapp.id;
                  sessions.push(wsocket);
                }

                await emitCompanyEvent(whatsapp.companyId, `company-${whatsapp.companyId}-whatsappSession`, {
                  action: "update",
                  session: whatsapp
                });

                if (retriesQrCode === 1) {
                  resolve(wsocket);
                }
              }
            }
          }
        );
        wsocket.ev.on("creds.update", saveCreds);

        // Eventos com controle de importação de contatos
        wsocket.ev.on("messaging-history.set", async (data) => {
          try {
            logger.info(`[WBOT] 📨 messaging-history.set recebido para ${name}`);

            // O Baileys pode enviar os dados em formatos diferentes
            const messages = (data as any).messages || [];
            const contacts = (data as any).contacts || [];
            const chats = (data as any).chats || [];
            const isLatest = (data as any).isLatest || false;
            const progress = (data as any).progress; // 0-100

            const shouldImportAllWhatsappContacts =
              process.env.IMPORT_ALL_WHATSAPP_CONTACTS === "true";

            // Só loga se tiver dados relevantes
            if (messages.length > 0 || contacts.length > 0 || chats.length > 0) {
              logger.info(
                `[WBOT] 📊 Dados recebidos: messages=${messages.length}, `
                + `contacts=${contacts.length}, chats=${chats.length}, `
                + `progress=${progress}%, isLatest=${isLatest}`
              );
            }

            const normalizeHistoryJid = (jid?: string | null): string => {
              const raw = String(jid || "").trim();

              if (!raw) return "";

              try {
                return jidNormalizedUser(raw);
              } catch {
                return raw.split(":")[0];
              }
            };

            const getHistoryName = (item: any): string => {
              return String(
                item?.notify ||
                item?.verifiedName ||
                item?.name ||
                item?.subject ||
                item?.pushName ||
                ""
              ).trim();
            };

            const contactNameMap = new Map<string, string>();

            for (const contact of contacts) {
              const jid = normalizeHistoryJid(
                contact?.id ||
                contact?.jid ||
                contact?.remoteJid ||
                contact?.waId
              );

              const contactName = getHistoryName(contact);

              if (jid && contactName) {
                contactNameMap.set(jid, contactName);
              }
            }

            for (const chat of chats) {
              const jid = normalizeHistoryJid(
                chat?.id ||
                chat?.jid ||
                chat?.remoteJid
              );

              const chatName = getHistoryName(chat);

              if (jid && chatName && !contactNameMap.has(jid)) {
                contactNameMap.set(jid, chatName);
              }
            }

            const messagesWithNames = messages.map((msg: any) => {
              const remoteJid = normalizeHistoryJid(msg?.key?.remoteJid);
              const participant = normalizeHistoryJid(msg?.key?.participant);

              const nameFromMap =
                contactNameMap.get(remoteJid) ||
                contactNameMap.get(participant) ||
                "";

              if (!msg.pushName && nameFromMap) {
                return {
                  ...msg,
                  pushName: nameFromMap
                };
              }

              return msg;
            });

            if ((contacts.length > 0 || chats.length > 0) && !shouldImportAllWhatsappContacts) {
              logger.info(
                `[WBOT] 🚫 Sync completo bloqueado para ${name}. ` +
                `contacts/chats serão usados apenas como mapa de nomes. ` +
                `Não serão enviados ao Restore. ` +
                `contacts=${contacts.length}, chats=${chats.length}, messages=${messages.length}. ` +
                `IMPORT_ALL_WHATSAPP_CONTACTS=false`
              );
            }

            await RestoreWhatsAppHistoryService(whatsapp, {
              chats: shouldImportAllWhatsappContacts ? chats : [],
              contacts: shouldImportAllWhatsappContacts ? contacts : [],
              messages: shouldImportAllWhatsappContacts ? messages : messagesWithNames,
              isLatest
            });
          } catch (err: any) {
            logger.error(`[RESTORE] ❌ Erro no messaging-history.set: ${err?.message || err}`);
          }
        });

        wsocket.ev.on("chats.set", async ({ chats }) => {
          try {
            logger.info(`[WBOT] 💬 chats.set recebido para ${name}: ${chats?.length || 0} chats`);

            if (process.env.IMPORT_ALL_WHATSAPP_CONTACTS !== "true") {
              logger.info(
                `[WBOT] 🚫 chats.set ignorado para ${name}. ` +
                `IMPORT_ALL_WHATSAPP_CONTACTS=false`
              );
              return;
            }

            // ✅ NÃO cria tickets, apenas processa contatos
            await RestoreWhatsAppHistoryService(whatsapp, {
              chats,
              contacts: [],
              messages: []  // Vazio = não cria tickets
            });
          } catch (err: any) {
            logger.error(`[RESTORE] ❌ Erro no chats.set: ${err?.message || err}`);
          }
        });

        wsocket.ev.on("contacts.set", async ({ contacts }) => {
          try {
            logger.info(`[WBOT] 👤 contacts.set recebido para ${name}: ${contacts?.length || 0} contatos`);

            if (process.env.IMPORT_ALL_WHATSAPP_CONTACTS !== "true") {
              logger.info(
                `[WBOT] 🚫 contacts.set ignorado para ${name}. ` +
                `IMPORT_ALL_WHATSAPP_CONTACTS=false`
              );
              return;
            }

            // ✅ NÃO cria tickets, apenas processa contatos
            await RestoreWhatsAppHistoryService(whatsapp, {
              chats: [],
              contacts,
              messages: []  // Vazio = não cria tickets
            });
          } catch (err: any) {
            logger.error(`[RESTORE] ❌ Erro no contacts.set: ${err?.message || err}`);
          }
        });

        wsocket.ev.on("messages.update", async (updates) => {
          for (const update of updates) {
            const updateAny = update as any;
            if (updateAny?.update?.messageStubType === WAMessageStubType.CIPHERTEXT) {
              const msgId = update.key?.id;
              if (!msgId) continue;

              const retryCount = (sessionRetryCache.get(msgId) as number) || 0;
              if (retryCount >= MAX_SESSION_RETRIES) {
                logger.warn(`[SESSION-RETRY] Máximo de tentativas atingido para msg ${msgId}, ignorando`);
                sessionRetryCache.del(msgId);
                continue;
              }

              sessionRetryCache.set(msgId, retryCount + 1);
              logger.info(`[SESSION-RETRY] Tentativa ${retryCount + 1}/${MAX_SESSION_RETRIES} para msg ${msgId} (BAD_MAC/NO_SESSION)`);
            }
          }
        });
      })();
    } catch (error) {
      Sentry.captureException(error);
      console.log(error);
      reject(error);
    }
  });
};
