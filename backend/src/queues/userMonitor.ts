import Queue from "bull";
import * as Sentry from "@sentry/node";
import { QueryTypes } from "sequelize";
import { isNil } from "lodash";

import logger from "../utils/logger";
import sequelize from "../database";
import User from "../models/User";

const connection = process.env.REDIS_URI || "";
const processRole = String(process.env.PROCESS_ROLE || "all").toLowerCase();
const canStartUserMonitor = processRole === "all" || processRole === "worker";

export const userMonitor = new Queue("UserMonitor", connection);

let processorsStarted = false;
let repeatableJobsInitialized = false;

async function handleLoginStatus(job: any) {
  const users: { id: number }[] = await sequelize.query(
    `select id from "Users" where "updatedAt" < now() - '5 minutes'::interval and online = true`,
    { type: QueryTypes.SELECT }
  );

  for (const item of users) {
    try {
      const user = await User.findByPk(item.id);

      if (!user) {
        continue;
      }

      await user.update({ online: false });
      logger.info(`Usuario passado para offline: ${item.id}`);
    } catch (e: any) {
      Sentry.captureException(e);
    }
  }
}

async function handleUserConnection(job: any) {
  try {
    const { id } = job.data || {};

    if (!isNil(id) && id !== "null") {
      const user = await User.findByPk(id);

      if (user) {
        user.online = true;
        await user.save();
      }
    }
  } catch (e) {
    Sentry.captureException(e);
  }
}

export async function initUserMonitorQueues() {
  if (!canStartUserMonitor) {
    logger.info(
      `[USER_MONITOR] initUserMonitorQueues ignorado para PROCESS_ROLE=${processRole}`
    );
    return;
  }

  if (repeatableJobsInitialized) {
    logger.info("[USER_MONITOR] Repeatable jobs já inicializados, ignorando nova chamada.");
    return;
  }

  const repeatableJobs = await userMonitor.getRepeatableJobs();

  for (const job of repeatableJobs) {
    await userMonitor.removeRepeatableByKey(job.key);
  }

  await userMonitor.add(
    "VerifyLoginStatus",
    {},
    {
      repeat: { cron: "* * * * *", key: "verify-loginstatus" },
      removeOnComplete: { age: 60 * 60, count: 10 },
      removeOnFail: { age: 60 * 60, count: 10 }
    }
  );

  repeatableJobsInitialized = true;
  logger.info("Queue: monitoramento de status de usuário inicializado");
}

export async function startUserMonitor() {
  if (!canStartUserMonitor) {
    logger.info(
      `[USER_MONITOR] startUserMonitor ignorado para PROCESS_ROLE=${processRole}`
    );
    return;
  }

  if (!processorsStarted) {
    userMonitor.process("UserConnection", handleUserConnection);
    userMonitor.process("VerifyLoginStatus", handleLoginStatus);

    userMonitor.on("failed", (job, err) => {
      logger.error(
        `[USER_MONITOR] Job failed: ${job?.name || "unknown"} | id=${job?.id}`
      );
      logger.error(err);
      Sentry.captureException(err);
    });

    userMonitor.on("error", err => {
      logger.error("[USER_MONITOR] Queue error");
      logger.error(err);
      Sentry.captureException(err);
    });

    processorsStarted = true;
    logger.info("[USER_MONITOR] Processors iniciados com sucesso");
  } else {
    logger.info("[USER_MONITOR] Processors já iniciados, ignorando nova chamada");
  }

  await initUserMonitorQueues();
}

export default startUserMonitor;