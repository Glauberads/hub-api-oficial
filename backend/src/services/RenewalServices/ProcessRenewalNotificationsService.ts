import { Op } from "sequelize";

import RenewalNotification from "../../models/RenewalNotification";
import logger from "../../utils/logger";

import {
  dispatchNotification
} from "./RenewalDispatchService";

const RETRY_INTERVAL_MINUTES = 10;

const PROCESSING_TIMEOUT_MINUTES = 15;

export const recoverStuckProcessing =
  async (): Promise<number> => {
    const now =
      new Date();

    const staleBefore =
      new Date(
        Date.now() -
          PROCESSING_TIMEOUT_MINUTES *
            60 *
            1000
      );

    /*
     * Recupera notificações que ficaram presas
     * em processing por queda/restart do processo.
     *
     * A tentativa já consumida permanece contabilizada.
     */
    const [recovered] =
      await RenewalNotification.update(
        {
          status: "pending",

          nextAttemptAt:
            now,

          errorMessage:
            "PROCESSING_RECOVERED_AFTER_TIMEOUT"
        } as any,
        {
          where: {
            status: "processing",

            [Op.or]: [
              {
                lastAttemptAt: {
                  [Op.lte]:
                    staleBefore
                }
              },
              {
                lastAttemptAt:
                  null,

                updatedAt: {
                  [Op.lte]:
                    staleBefore
                }
              }
            ]
          }
        }
      );

    if (recovered > 0) {
      logger.warn(
        `[RENEWAL] Recuperadas ${recovered} notificação(ões) presas em processing há mais de ${PROCESSING_TIMEOUT_MINUTES} minutos.`
      );
    }

    return recovered;
  };


const ProcessRenewalNotificationsService =
  async (): Promise<void> => {

    await recoverStuckProcessing();

    const now = new Date();

    const notifications =
      await RenewalNotification.findAll({
        where: {
          status: "pending",

          scheduledAt: {
            [Op.lte]: now
          },

          [Op.or]: [
            {
              nextAttemptAt: null
            },
            {
              nextAttemptAt: {
                [Op.lte]: now
              }
            }
          ]
        },

        order: [
          ["scheduledAt", "ASC"],
          ["id", "ASC"]
        ],

        limit: 50
      });

    for (
      const item of notifications
    ) {
      const attempts =
        Number(
          item.attempts || 0
        );

      const maxAttempts =
        Number(
          item.maxAttempts || 3
        );

      /*
       * Proteção adicional para registros
       * inconsistentes que porventura tenham
       * permanecido como pending após esgotar
       * as tentativas.
       */
      if (
        attempts >= maxAttempts
      ) {
        await RenewalNotification.update(
          {
            status: "failed",
            nextAttemptAt: null
          } as any,
          {
            where: {
              id: item.id,
              status: "pending"
            }
          }
        );

        continue;
      }

      const attemptNumber =
        attempts + 1;

      const attemptAt =
        new Date();

      /*
       * Claim atômico.
       * Somente um worker consegue transformar
       * pending em processing.
       */
      const [claimed] =
        await RenewalNotification.update(
          {
            status: "processing",

            attempts:
              attemptNumber,

            lastAttemptAt:
              attemptAt,

            nextAttemptAt:
              null,

            errorMessage:
              null
          } as any,
          {
            where: {
              id: item.id,
              status: "pending"
            }
          }
        );

      if (!claimed) {
        continue;
      }

      try {
        const sent =
          await dispatchNotification(
            item.id
          );

        if (sent) {
          logger.info(
            `[RENEWAL] Notificação enviada: id=${item.id} tentativa=${attemptNumber}/${maxAttempts}`
          );
        }

      } catch (error: any) {
        const message =
          String(
            error?.message ||
            error ||
            "Erro desconhecido"
          );

        const definitiveFailure =
          attemptNumber >=
          maxAttempts;

        if (definitiveFailure) {
          /*
           * Esgotou as tentativas.
           */
          await RenewalNotification.update(
            {
              status: "failed",

              nextAttemptAt:
                null,

              errorMessage:
                message.slice(
                  0,
                  5000
                )
            } as any,
            {
              where: {
                id: item.id,
                status: "processing"
              }
            }
          );

          logger.error(
            `[RENEWAL] Falha definitiva id=${item.id} tentativa=${attemptNumber}/${maxAttempts}: ${message}`
          );

          continue;
        }

        /*
         * Falha temporária:
         * devolve para pending e agenda
         * nova tentativa daqui a 10 minutos.
         */
        const nextAttemptAt =
          new Date(
            Date.now() +
              RETRY_INTERVAL_MINUTES *
                60 *
                1000
          );

        await RenewalNotification.update(
          {
            status: "pending",

            nextAttemptAt,

            errorMessage:
              message.slice(
                0,
                5000
              )
          } as any,
          {
            where: {
              id: item.id,
              status: "processing"
            }
          }
        );

        logger.warn(
          `[RENEWAL] Falha temporária id=${item.id} tentativa=${attemptNumber}/${maxAttempts}. Nova tentativa em ${RETRY_INTERVAL_MINUTES} minutos: ${message}`
        );
      }
    }
  };

export default ProcessRenewalNotificationsService;
