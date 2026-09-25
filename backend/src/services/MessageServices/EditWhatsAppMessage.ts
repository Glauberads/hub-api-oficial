import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Message from "../../models/Message";
import Ticket from "../../models/Ticket";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

interface Request {
  messageId: string;
  body: string;
}

const EditWhatsAppMessage = async ({
  messageId,
  body
}: Request): Promise<{ ticket: Ticket; message: Message }> => {
  const message = await Message.findByPk(messageId, {
    include: [
      {
        model: Ticket,
        as: "ticket",
        include: [
          "contact",
          {
            model: Whatsapp,
            attributes: ["id", "name", "groupAsTicket", "color"]
          }
        ]
      }
    ]
  });

  if (!message) {
    throw new AppError("Mensagem não encontrada.", 404);
  }

  if (!message.fromMe) {
    throw new AppError(
      "Não é possível editar uma mensagem recebida do contato.",
      400
    );
  }

  const novoTexto = String(body || "").trim();

  if (!novoTexto) {
    throw new AppError("O texto da mensagem não pode ficar vazio.", 400);
  }

  const { ticket } = message;
  const wbot = await GetTicketWbot(ticket);

  let dataJson: any = {};

  try {
    dataJson = JSON.parse(message.dataJson || "{}");
  } catch {
    dataJson = {};
  }

  const originalKey = dataJson?.key || {};

  const remoteJid = String(
    originalKey.remoteJid ||
    message.remoteJid ||
    ticket.contact?.lid ||
    ticket.contact?.remoteJid ||
    ""
  ).trim();

  const wid = String(
    originalKey.id ||
    message.wid ||
    ""
  ).trim();

  if (!remoteJid || !remoteJid.includes("@")) {
    throw new AppError(
      "JID original da mensagem não encontrado.",
      400
    );
  }

  if (!wid) {
    throw new AppError(
      "Identificador original da mensagem não encontrado.",
      400
    );
  }

  const editKey: any = {
    remoteJid,
    fromMe: true,
    id: wid
  };

  const participant =
    originalKey.participant ||
    message.participant;

  if (participant) {
    editKey.participant = participant;
  }

  try {
    logger.info(
      `[MESSAGE-EDIT-SEND] Editando wid=${wid}, jid=${remoteJid}, ticket=${ticket.id}`
    );

    const sent = await wbot.sendMessage(remoteJid, {
      text: novoTexto,
      edit: editKey
    });

    if (!sent?.key?.id) {
      throw new Error("Baileys não retornou a chave da edição.");
    }

    logger.info(
      `[MESSAGE-EDIT-SEND] Edição enviada: id=${sent.key.id}, jid=${sent.key.remoteJid}`
    );

    await message.update({
      body: novoTexto,
      isEdited: true
    });

    await ticket.update({
      lastMessage: novoTexto
    });

    await ticket.reload();

    return {
      ticket,
      message
    };
  } catch (error: any) {
    logger.error(
      `[MESSAGE-EDIT-SEND] Falha ao editar wid=${wid}, jid=${remoteJid}: ${error?.message || error}`
    );

    throw new AppError("ERR_EDITING_WAPP_MSG");
  }
};

export default EditWhatsAppMessage;
