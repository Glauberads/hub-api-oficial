import { initWASocket, getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import { wbotMessageListener } from "./wbotMessageListener";
import { emitCompanyEvent } from "../../libs/socket";
import wbotMonitor from "./wbotMonitor";
import logger from "../../utils/logger";
import * as Sentry from "@sentry/node";
import { redisGroupCache } from "../../utils/RedisGroupCache";

const startingSessions = new Map<number, NodeJS.Timeout>();
const START_SESSION_GUARD_MS = 2 * 60 * 1000;

const releaseStartLock = (whatsappId: number): void => {
  const timeout = startingSessions.get(whatsappId);
  if (timeout) {
    clearTimeout(timeout);
  }
  startingSessions.delete(whatsappId);
};

export const StartWhatsAppSession = async (
  whatsapp: Whatsapp,
  companyId: number
): Promise<void> => {
  if (startingSessions.has(whatsapp.id)) {
    logger.warn(
      `[WBOT] Sessão ${whatsapp.name} (${whatsapp.id}) já está iniciando, ignorando chamada duplicada.`
    );
    return;
  }

  const guardTimeout = setTimeout(() => {
    logger.warn(
      `[WBOT] Sessão ${whatsapp.name} (${whatsapp.id}) ficou presa em inicialização. Liberando lock preventivamente.`
    );
    startingSessions.delete(whatsapp.id);
  }, START_SESSION_GUARD_MS);

  if (guardTimeout.unref) {
    guardTimeout.unref();
  }

  startingSessions.set(whatsapp.id, guardTimeout);

  try {
    try {
      const existingWbot = getWbot(whatsapp.id) as any;
      const wsAny = existingWbot?.ws as any;

      const isOpen =
        typeof wsAny?.readyState === "number"
          ? wsAny.readyState === 1
          : typeof wsAny?.isClosed === "boolean"
            ? !wsAny.isClosed
            : !!existingWbot?.ws;

      if (isOpen) {
        logger.info(
          `[WBOT] Sessão ${whatsapp.name} (${whatsapp.id}) já possui socket ativo${
            existingWbot?.user?.id
              ? " e está conectada"
              : " aguardando QR/abertura"
          }, pulando nova inicialização.`
        );
        releaseStartLock(whatsapp.id);
        return;
      }
    } catch {
      // Sessão ainda não inicializada, segue fluxo normal
    }

    await whatsapp.update({ status: "OPENING" });

    await emitCompanyEvent(companyId, `company-${companyId}-whatsappSession`, {
      action: "update",
      session: whatsapp
    });

    initWASocket(whatsapp)
      .then(async (wbot) => {
        if (wbot?.id) {
          try {
            wbotMessageListener(wbot, companyId);
            wbotMonitor(wbot, whatsapp, companyId);
            logger.info(
              `[WBOT] Sessão ${whatsapp.name} (${whatsapp.id}) listeners registrados com sucesso.`
            );
          } catch (listenerErr) {
            logger.error(
              `[WBOT] Erro ao registrar listeners para sessão ${whatsapp.id}: ${listenerErr}`
            );
          }
        }
      })
      .catch(async (err) => {
        Sentry.captureException(err);
        logger.error(
          `[WBOT] Erro ao iniciar sessão ${whatsapp.name} (${whatsapp.id}): ${err}`
        );

        try {
          await whatsapp.reload();
          await whatsapp.update({ status: "DISCONNECTED" });

          await emitCompanyEvent(companyId, `company-${companyId}-whatsappSession`, {
            action: "update",
            session: whatsapp
          });
        } catch (updateErr) {
          logger.error(
            `[WBOT] Erro ao atualizar status da sessão ${whatsapp.id} após falha na inicialização: ${updateErr}`
          );
        }
      })
      .finally(() => {
        releaseStartLock(whatsapp.id);
      });
  } catch (err) {
    Sentry.captureException(err);
    logger.error(err);
    releaseStartLock(whatsapp.id);
  }
};