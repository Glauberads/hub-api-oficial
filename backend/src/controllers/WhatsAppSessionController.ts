import { Request, Response } from "express";
import { getWbot, removeWbot, requestPairingCode as wbotRequestPairingCode } from "../libs/wbot";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import cacheLayer from "../libs/cache";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";

const store = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  // Limpar sessão antiga para evitar bloqueios
  try {
    removeWbot(whatsapp.id, false);
  } catch (e) {
    // Sessão não existia, ok
  }

  await DeleteBaileysService(whatsappId);
  await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
  await whatsapp.update({ status: "PENDING", session: "", qrcode: "" });

  await StartWhatsAppSession(whatsapp, companyId);

  return res.status(200).json({ message: "Starting session." });
};

const update = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;

  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
  if (!whatsapp) {
    return res.status(404).json({ error: "Conexão WhatsApp não encontrada." });
  }

  await whatsapp.update({ session: "" });
  
  if (whatsapp.channel === "whatsapp") {
    await StartWhatsAppSession(whatsapp, companyId);
  }

  return res.status(200).json({ message: "Starting session." });
};

const remove = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  console.log("DISCONNECTING SESSION", whatsappId)
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);

    const wbot = getWbot(whatsapp.id);

    wbot.logout();
    wbot.ws.close();
  }

  return res.status(200).json({ message: "Session disconnected." });
};

const requestPairingCode = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { phoneNumber } = req.body;
  const { companyId } = req.user;

  if (!phoneNumber) {
    return res.status(400).json({ error: "Número de telefone é obrigatório." });
  }

  const cleanNumber = phoneNumber.replace(/\D/g, "");

  if (cleanNumber.length < 10) {
    return res.status(400).json({ error: "Número inválido. Use o formato: 5511999998888" });
  }

  const whatsapp = await Whatsapp.findOne({ where: { id: whatsappId, companyId } });
  if (!whatsapp) {
    return res.status(404).json({ error: "Conexão não encontrada." });
  }

  // Statuses válidos para gerar pairing code
  const allowedStatuses = ["qrcode", "PENDING", "DISCONNECTED", "TIMEOUT", "CONNECTED"];
  if (!allowedStatuses.includes(whatsapp.status)) {
    return res.status(400).json({
      error: `Não é possível gerar código neste momento. Status atual: ${whatsapp.status}.`
    });
  }

  try {
    // Sempre limpar e reiniciar sessão para garantir estado limpo
    // Isso resolve o problema de sessões órfãs que existem no DB mas não na memória
    const needsRestart = whatsapp.status !== "qrcode";

    if (needsRestart) {
      console.log(`[PairingCode] Status=${whatsapp.status}, limpando sessão antiga e reiniciando...`);

      try {
        removeWbot(whatsapp.id, false);
      } catch (e) {
        console.log(`[PairingCode] Nenhuma sessão ativa para remover: ${(e as any).message}`);
      }

      await DeleteBaileysService(whatsappId);
      await cacheLayer.delFromPattern(`sessions:${whatsapp.id}:*`);
      await whatsapp.update({ status: "PENDING", session: "", qrcode: "" });

      await StartWhatsAppSession(whatsapp, companyId);
    } else {
      // Mesmo em status qrcode, verificar se a sessão existe em memória
      try {
        getWbot(whatsapp.id);
      } catch {
        console.log(`[PairingCode] Status=qrcode mas sessão não está em memória. Reiniciando...`);
        await StartWhatsAppSession(whatsapp, companyId);
      }
    }

    // Aguarda a sessão chegar no estado qrcode (máx 25s)
    const maxWait = 25000;
    const interval = 500;
    let elapsed = 0;
    let ready = false;

    while (elapsed < maxWait) {
      await new Promise(r => setTimeout(r, interval));
      elapsed += interval;

      // Verificar se sessão está em memória E no status qrcode
      const updated = await Whatsapp.findByPk(whatsapp.id);
      if (updated?.status === "qrcode") {
        // Confirmar que a sessão realmente existe em memória
        try {
          getWbot(whatsapp.id);
          ready = true;
          break;
        } catch {
          // Status qrcode no DB mas não em memória ainda, continuar aguardando
        }
      }
      if (updated?.status === "CONNECTED") {
        return res.status(200).json({ error: "Sessão já está conectada.", connected: true });
      }
    }

    if (!ready) {
      return res.status(408).json({
        error: "Timeout aguardando sessão ficar pronta. Tente novamente em alguns segundos."
      });
    }

    // Aguardar socket estabilizar após QR ser gerado
    console.log(`[PairingCode] Sessão pronta em memória. Aguardando 2s para socket estabilizar...`);
    await new Promise(r => setTimeout(r, 2000));

    if (res.headersSent) return res;
    console.log(`[PairingCode] Solicitando código para número: ${cleanNumber}, whatsappId: ${whatsappId}`);
    const code = await wbotRequestPairingCode(Number(whatsappId), cleanNumber);
    console.log(`[PairingCode] ✅ Código gerado com sucesso: ${code}`);
    if (res.headersSent) return res;
    return res.status(200).json({ code });
  } catch (err: any) {
    if (res.headersSent) return res;
    const message = err?.message || "Erro ao solicitar código de pareamento.";
    console.error(`[PairingCode] ❌ Erro final: ${message}`);
    return res.status(500).json({ error: message });
  }
};

export default { store, remove, update, requestPairingCode };
