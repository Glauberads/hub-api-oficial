import WarmupConnection from "../models/WarmupConnection";
import Company from "../models/Company";
import Plan from "../models/Plan";
import { initWarmupSession } from "./WarmupSessionService";
import { startWarmupCluster } from "./WarmupClusterService";

let initialized = false;

export const startWarmupOnBoot = async () => {
  if (initialized) return;

  initialized = true;

  console.log("🔥 Iniciando Warmup automaticamente...");

  try {
    const connections = await WarmupConnection.findAll({
      where: {
        isActive: true
      },
      include: [
        {
          model: Company,
          include: [
            {
              model: Plan,
              where: {
                chipWarmup: true
              }
            }
          ]
        }
      ]
    });

    for (const connection of connections) {
      try {
        await initWarmupSession(connection.id, connection.session);
      } catch (err) {
        console.error(
          `Erro ao iniciar sessão warmup ${connection.session}:`,
          err
        );
      }
    }

    await startWarmupCluster();
  } catch (err) {
    console.error("Erro ao iniciar warmup no boot:", err);
  }
};