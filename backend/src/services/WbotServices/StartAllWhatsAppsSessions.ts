import ListWhatsAppsService from "../WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "./StartWhatsAppSession";
import * as Sentry from "@sentry/node";
import logger from "../../utils/logger";

const BATCH_SIZE = 3; // Sessões simultâneas por lote
const DELAY_BETWEEN_SESSIONS = 5000; // 5s entre cada sessão
const DELAY_BETWEEN_BATCHES = 10000; // 10s entre lotes

export const StartAllWhatsAppsSessions = async (
  companyId: number
): Promise<void> => {
  try {
    const whatsapps = await ListWhatsAppsService({ companyId });

    if (!whatsapps.length) {
      logger.info(`[BOOT] Nenhuma sessão encontrada para empresa ${companyId}`);
      return;
    }

    const whatsappSessions = whatsapps.filter(
      whatsapp => whatsapp.channel === "whatsapp"
    );

    logger.info(
      `[BOOT] Iniciando ${whatsappSessions.length} sessões para empresa ${companyId} em lotes de ${BATCH_SIZE}`
    );

    for (let i = 0; i < whatsappSessions.length; i += BATCH_SIZE) {
      const batch = whatsappSessions.slice(i, i + BATCH_SIZE);
      const batchNum = Math.floor(i / BATCH_SIZE) + 1;
      const totalBatches = Math.ceil(whatsappSessions.length / BATCH_SIZE);

      logger.info(`[BOOT] Lote ${batchNum}/${totalBatches} - ${batch.length} sessões`);

      for (const whatsapp of batch) {
        try {
          await StartWhatsAppSession(whatsapp, companyId);
        } catch (error) {
          Sentry.captureException(error);
          logger.error(
            `[BOOT] Erro ao iniciar sessão ${whatsapp.id} (${whatsapp.name}) da empresa ${companyId}: ${error}`
          );
        }

        await new Promise(resolve =>
          setTimeout(resolve, DELAY_BETWEEN_SESSIONS)
        );
      }

      if (i + BATCH_SIZE < whatsappSessions.length) {
        logger.info(
          `[BOOT] Aguardando ${DELAY_BETWEEN_BATCHES / 1000}s antes do próximo lote...`
        );

        await new Promise(resolve =>
          setTimeout(resolve, DELAY_BETWEEN_BATCHES)
        );
      }
    }

    logger.info(`[BOOT] Todas as sessões da empresa ${companyId} foram processadas.`);
  } catch (e) {
    Sentry.captureException(e);
    logger.error(`[BOOT] Erro ao iniciar sessões da empresa ${companyId}: ${e}`);
  }
};