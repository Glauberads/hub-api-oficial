import { getWbot } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";
import { getIO } from "../libs/socket";
import logger from "../utils/logger";

const GetWhatsappWbot = async (whatsapp: Whatsapp) => {
  try {
    const wbot = getWbot(whatsapp.id);

    // Verificar se o websocket ainda está realmente ativo
    const wsAny = (wbot as any)?.ws as any;
    const isOpen = typeof wsAny?.readyState === "number"
      ? wsAny.readyState === 1
      : typeof wsAny?.isClosed === "boolean"
        ? !wsAny.isClosed
        : !!wbot?.user?.id;

    if (!isOpen) {
      throw new Error("WebSocket não está aberto");
    }

    return wbot;
  } catch (err) {
    // Se o wbot não existe ou não está ativo, mas o DB ainda diz CONNECTED,
    // corrigir o status automaticamente para evitar toasts de erro repetitivos
    if (whatsapp.status === "CONNECTED") {
      logger.warn(
        `[GetWhatsappWbot] Sessão ${whatsapp.name} (${whatsapp.id}) não encontrada na memória mas DB diz CONNECTED. Corrigindo para DISCONNECTED.`
      );

      await whatsapp.update({ status: "DISCONNECTED", qrcode: "" });

      try {
        const io = getIO();
        io.of(String(whatsapp.companyId))
          .emit(`company-${whatsapp.companyId}-whatsappSession`, {
            action: "update",
            session: whatsapp
          });
      } catch (socketErr) {
        logger.error(`[GetWhatsappWbot] Erro ao emitir evento socket: ${socketErr}`);
      }
    }

    throw err;
  }
};

export default GetWhatsappWbot;
