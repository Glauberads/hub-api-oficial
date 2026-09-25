import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";
import Queue from "../../models/Queue";
import Chatbot from "../../models/Chatbot";
import { FindOptions } from "sequelize/types";
import Prompt from "../../models/Prompt";
import { FlowBuilderModel } from "../../models/FlowBuilder";
import { SimpleObjectCache } from "../../utils/SimpleObjectCache";

// ✅ Cache de WhatsApp por id+companyId (TTL 2 min)
// ShowWhatsAppService é chamado 1-3x por mensagem com JOINs pesados (Queue, Chatbot, Prompt, FlowBuilder)
const whatsappCache = new SimpleObjectCache<Whatsapp>(120); // 2 min TTL

const ShowWhatsAppService = async (
  id: string | number,
  companyId: number,
  session?: any
): Promise<Whatsapp> => {
  // Validar ID antes de consultar o banco — evita erro "invalid input syntax for type integer: null"
  if (id === null || id === undefined || id === "null" || id === "undefined" || id === "") {
    throw new AppError("ERR_NO_WAPP_FOUND - ID inválido recebido: " + String(id), 404);
  }

  // ✅ Usar cache para chamadas sem session customizado (caso mais comum no hot path)
  const cacheKey = `whatsapp:${id}:${companyId}:${session ?? "default"}`;
  const cached = whatsappCache.get(cacheKey);
  if (cached) return cached;

  const findOptions: FindOptions = {
    include: [
      {
        model: FlowBuilderModel,
      },
      {
        model: Queue,
        as: "queues",
        attributes: ["id", "name", "color", "greetingMessage", "integrationId", "fileListId", "closeTicket"],
        include: [
          {
            model: Chatbot,
            as: "chatbots",
            attributes: ["id", "name", "greetingMessage", "closeTicket"]
          }
        ]
      },
      {
        model: Prompt,
        as: "prompt",
      }
    ],
    order: [
      ["queues", "orderQueue", "ASC"],
      ["queues", "chatbots", "id", "ASC"]
    ]
  };

  if (session !== undefined && session == 0) {
    findOptions.attributes = { exclude: ["session"] };
  }

  const whatsapp = await Whatsapp.findByPk(id, findOptions);

  if (whatsapp?.companyId !== companyId) {
    throw new AppError("Não é possível acessar registros de outra empresa");
  }

  if (!whatsapp) {
    throw new AppError("ERR_NO_WAPP_FOUND", 404);
  }

  whatsappCache.set(cacheKey, whatsapp);
  return whatsapp;
};

/**
 * Invalida o cache de um WhatsApp específico (chamar ao atualizar configurações).
 */
export const invalidateWhatsAppCache = (id: string | number, companyId: number): void => {
  whatsappCache.del(`whatsapp:${id}:${companyId}:default`);
  whatsappCache.del(`whatsapp:${id}:${companyId}:0`);
  whatsappCache.del(`whatsapp:${id}:${companyId}:undefined`);
};

export default ShowWhatsAppService;
