import { WASocket } from "@whiskeysockets/baileys";
import { getWarmupConfig } from "./WarmupConfigService";
import { getWarmupPool } from "./WarmupSessionService";
import WarmupConfig from "../models/WarmupConfig";

type WarmupPoolItem = {
  id: number;
  sessionId: string;
  number?: string;
  companyId?: number;
  sock: WASocket;
};

type WarmupPair = {
  sender: WarmupPoolItem;
  receiver: WarmupPoolItem;
};

const sleep = (ms: number) =>
  new Promise(resolve => setTimeout(resolve, ms));

const randomBetween = (min: number, max: number) => {
  return Math.floor(Math.random() * (max - min + 1)) + min;
};

const defaultMessages = [
  "Oi, tudo bem?",
  "Tudo certo por aí?",
  "Opa, passando aqui rapidinho",
  "Tranquilo?",
  "Depois te chamo melhor",
  "Tô testando aqui",
  "Beleza então",
  "Show",
  "Combinado",
  "Valeu"
];

const normalizeWarmupJid = (value?: string) => {
  if (!value) return null;

  const clean = value
    .replace("@s.whatsapp.net", "")
    .replace(/:\d+$/, "")
    .replace(/\D/g, "");

  if (!clean) return null;

  return `${clean}@s.whatsapp.net`;
};

const getRandomMessage = (prompt?: string) => {
  if (!prompt) {
    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  }

  const lines = prompt
    .split("\n")
    .map(line => line.trim())
    .filter(Boolean);

  if (!lines.length) {
    return defaultMessages[Math.floor(Math.random() * defaultMessages.length)];
  }

  return lines[Math.floor(Math.random() * lines.length)];
};

const getRandomPair = (companyId: number): WarmupPair | null => {
  const pool = getWarmupPool() as WarmupPoolItem[];

  const companyPool = pool.filter(item => item.companyId === companyId);

  if (companyPool.length < 2) return null;

  const shuffled = [...companyPool].sort(() => Math.random() - 0.5);

  return {
    sender: shuffled[0],
    receiver: shuffled[1]
  };
};

let isRunning = false;

export const startWarmupCluster = async () => {
  if (isRunning) return;

  isRunning = true;

  console.log("🔥 Warmup cluster iniciado");

  while (isRunning) {
    try {
      const activeConfigs = await WarmupConfig.findAll({
        where: {
          isActive: true
        }
      });

      if (!activeConfigs.length) {
        await sleep(10000);
        continue;
      }

      for (const activeConfig of activeConfigs) {
        const companyId = Number((activeConfig as any).companyId);

        if (!companyId) continue;

        const config = await getWarmupConfig(companyId);

        if (!config || !config.isActive) continue;

        const minDelay = Number(config.minDelay) || 30000;
        const maxDelay = Number(config.maxDelay) || 120000;
        const messagesPerCycle = Number(config.messagesPerCycle) || 1;

        for (let i = 0; i < messagesPerCycle; i++) {
          const pair = getRandomPair(companyId);

          if (!pair) {
            console.log(
              `[WARMUP] Empresa ${companyId}: aguardando conexões suficientes...`
            );
            continue;
          }

          const { sender, receiver } = pair;

          if (!sender?.sock || !receiver?.sock) continue;
          if (!receiver.number) continue;

          const receiverJid = normalizeWarmupJid(receiver.number);

          if (!receiverJid) continue;

          const message = getRandomMessage(config.prompt);

          try {
            await sender.sock.sendPresenceUpdate("composing", receiverJid);
            await sleep(randomBetween(2000, 5000));

            await sender.sock.sendMessage(receiverJid, {
              text: message
            });

            await sender.sock.sendPresenceUpdate("paused", receiverJid);

            console.log(
              `[WARMUP] Empresa ${companyId}: ${sender.number} -> ${receiver.number}`
            );
          } catch (err) {
            console.error(
              `[WARMUP] Empresa ${companyId}: erro ao enviar mensagem:`,
              err
            );
          }

          await sleep(randomBetween(minDelay, maxDelay));
        }
      }
    } catch (err) {
      console.error("Warmup cluster error:", err);
      await sleep(15000);
    }
  }
};

export const stopWarmupCluster = () => {
  isRunning = false;
  console.log("🛑 Warmup cluster parado");
};

export const getWarmupClusterStatus = () => {
  const pool = getWarmupPool() as WarmupPoolItem[];

  const byCompany = pool.reduce((acc: any, item) => {
    const companyId = item.companyId || "unknown";

    if (!acc[companyId]) {
      acc[companyId] = 0;
    }

    acc[companyId] += 1;

    return acc;
  }, {});

  return {
    isRunning,
    onlineConnections: pool.length,
    byCompany
  };
};