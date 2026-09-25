import logger from "../utils/logger";
import startUserMonitor from "./userMonitor";

const processRole = String(process.env.PROCESS_ROLE || "all").toLowerCase();
const isWorkerRole = processRole === "all" || processRole === "worker";

export const startQueueProcess = async (): Promise<void> => {
  if (!isWorkerRole) {
    logger.info(`[QUEUES] startQueueProcess ignorado para PROCESS_ROLE=${processRole}`);
    return;
  }

  await startUserMonitor();
  logger.info(`[QUEUES] Processos de queue/monitor iniciados com sucesso [role=${processRole}]`);
};