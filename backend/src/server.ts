import "./moduleAlias";
import "dotenv/config";
import gracefulShutdown from "http-graceful-shutdown";
import app from "./app";
import { initIO } from "./libs/socket";
import logger from "./utils/logger";
import { startWarmupOnBoot } from "./services/WarmupBootService";

const processRole = String(process.env.PROCESS_ROLE || "all").toLowerCase();
const isWebRole = processRole === "all" || processRole === "web";
const isWorkerRole = processRole === "all" || processRole === "worker";

const startWebServer = async () => {
  const port = Number(process.env.PORT) || 8080;

  const server = app.listen(port, async () => {
    logger.info(`Server started on port: ${port} [role=${processRole}]`);

    // 🔥 iniciar warmup automaticamente
    await startWarmupOnBoot();
  });

  initIO(server);
  gracefulShutdown(server);

  return server;
};

const startWorkerServices = async () => {
  logger.info(`🔄 Iniciando serviços de worker [role=${processRole}]...`);

  const { initializeWhatsAppVersion } = require("./libs/wbot");
  const Company = require("./models/Company").default;
  const {
    StartAllWhatsAppsSessions
  } = require("./services/WbotServices/StartAllWhatsAppsSessions");
  const BullQueue = require("./libs/queue").default;
  const { startQueueProcess } = require("./queues");
  const { startLidSyncJob } = require("./jobs/LidSyncJob");

  logger.info("🔄 Inicializando versão do WhatsApp Web...");
  await initializeWhatsAppVersion();

  const companies = await Company.findAll({
    where: { status: true },
    attributes: ["id"]
  });

  await Promise.all(
    companies.map((company: { id: number }) => StartAllWhatsAppsSessions(company.id))
  );

  await startQueueProcess();

  try {
    const { startAllTelegramPersonalSessions } = require("./services/TelegramServices/TelegramPersonalService");
    await startAllTelegramPersonalSessions();
  } catch (error) {
    console.error("[TELEGRAM PERSONAL] Falha ao iniciar sessões pessoais:", error);
  }


  if (process.env.REDIS_URI_ACK && process.env.REDIS_URI_ACK !== "") {
    BullQueue.process();
  }

  startLidSyncJob();

  logger.info(`✅ Serviços de worker iniciados [role=${processRole}]`);
};

const bootstrap = async () => {
  if (!isWebRole && !isWorkerRole) {
    throw new Error(
      `PROCESS_ROLE inválido: "${processRole}". Use "all", "web" ou "worker".`
    );
  }

  if (isWebRole) {
    await startWebServer();
  }

  if (isWorkerRole) {
    await startWorkerServices();
  }
};

process.on("uncaughtException", err => {
  console.error(`${new Date().toUTCString()} uncaughtException:`, err.message);
  console.error(err.stack);
  process.exit(1);
});

process.on("unhandledRejection", (reason, p) => {
  console.error(`${new Date().toUTCString()} unhandledRejection:`, reason, p);
  process.exit(1);
});

bootstrap().catch(err => {
  logger.error(err);
  process.exit(1);
});