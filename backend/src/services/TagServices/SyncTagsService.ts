import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import ContactTag from "../../models/ContactTag";
import ShowContactService from "../ContactServices/ShowContactService";
import CheckContactOpenTickets from "../../helpers/CheckContactOpenTickets";
import Ticket from "../../models/Ticket";
import { Op } from "sequelize";
import ShowTicketService from "../TicketServices/ShowTicketService";
import { getIO } from "../../libs/socket";
import logger from "../../utils/logger";
import { pushTagToWhatsApp, removeTagFromWhatsApp } from "./WhatsAppLabelSyncService";

interface Request {
  tags: Tag[];
  contactId: number;
  companyId: number;
}

const SyncTags = async ({
  tags,
  contactId,
  companyId
}: Request): Promise<Contact | null> => {

  // Buscar tags antigas antes de atualizar
  const tagsAntigas = await ContactTag.findAll({
    where: { contactId },
    include: [{ model: Tag, as: 'tags' }]
  });
  const nomesTagsAntigas = tagsAntigas.map(ct => (ct as any).tags?.name).filter(Boolean);

  const tagList = tags.map(t => ({ tagId: t.id, contactId }));

  // Identificar tags removidas e adicionadas para sincronizar com WhatsApp
  const oldTagIds = tagsAntigas.map(ct => (ct as any).tags?.id).filter(Boolean);
  const newTagIds = tags.map(t => t.id);
  const addedTagIds = newTagIds.filter(id => !oldTagIds.includes(id));
  const removedTagIds = oldTagIds.filter(id => !newTagIds.includes(id));

  await ContactTag.destroy({ where: { contactId } });
  await ContactTag.bulkCreate(tagList);

  // Sincronizar com WhatsApp Labels (não-bloqueante)
  Promise.allSettled([
    ...addedTagIds.map(tagId => pushTagToWhatsApp(companyId, contactId, tagId)),
    ...removedTagIds.map(tagId => removeTagFromWhatsApp(companyId, contactId, tagId))
  ]).then(results => {
    const errors = results.filter(r => r.status === "rejected");
    if (errors.length > 0) {
      logger.warn(`[LABEL SYNC] ${errors.length} erro(s) ao sincronizar labels do WhatsApp`);
    }
  });

  // Buscar tags novas após atualizar
  const tagsNovas = await Tag.findAll({
    where: { id: { [Op.in]: tags.map(t => t.id) }, companyId }
  });
  const nomesTagsNovas = tagsNovas.map(t => t.name);

  // Identificar tags que foram adicionadas (estão nas novas mas não nas antigas)
  const tagsAdicionadas = nomesTagsNovas.filter(nome => !nomesTagsAntigas.includes(nome));

  const contact = await ShowContactService(contactId, companyId);

  const _ticket = await Ticket.findOne({ where: { contactId, status: { [Op.or]: ["open", "pending", "group"] } } });

  if (_ticket) {
    const ticket = await ShowTicketService(_ticket?.id, companyId);

    const io = getIO();
    io.of(String(companyId))
      .emit(`company-${companyId}-ticket`, {
        action: "update",
        ticket
      });
  }

  // Verificar e iniciar Floups para cada tag adicionada
  if (tagsAdicionadas.length > 0) {
    logger.info(`[TAG] SyncTags → ${tagsAdicionadas.length} tag(s) adicionada(s) ao contato ${contactId}: ${tagsAdicionadas.join(', ')}`);
    try {
      const FloupService = (await import('../../plugins/floup/service')).default;
      for (const tagName of tagsAdicionadas) {
        logger.info(`[TAG] SyncTags → Tag "${tagName}" adicionada ao contato ${contactId}, verificando Floups...`);
        await FloupService.verificarEIniciarFloupsAoAdicionarTag(contactId, companyId, tagName);
      }
    } catch (floupError) {
      logger.error(`[TAG] SyncTags → Erro ao verificar Floups após adicionar tags:`, floupError);
    }
  } else {
    logger.debug(`[TAG] SyncTags → Nenhuma tag nova adicionada ao contato ${contactId}. Tags antigas: [${nomesTagsAntigas.join(', ')}], Tags novas: [${nomesTagsNovas.join(', ')}]`);
  }

  return contact;
};

export default SyncTags;
