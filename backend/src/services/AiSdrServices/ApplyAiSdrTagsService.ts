import { Op } from "sequelize";
import Tag from "../../models/Tag";
import Ticket from "../../models/Ticket";
import TicketTag from "../../models/TicketTag";
import AiSdrConfig from "../../models/AiSdrConfig";
import { AiSdrEvaluation } from "./EvaluateAiSdrLeadService";

interface Request {
  ticket: Ticket;
  config: AiSdrConfig;
  evaluation: AiSdrEvaluation;
}

const normalizeTagName = (value: string): string => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9_ -]/g, "")
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_+|_+$/g, "");
};

const getTagColor = (tagName: string): string => {
  if (tagName.includes("quente") || tagName.includes("hot")) return "#f44336";
  if (tagName.includes("humano") || tagName.includes("atendente")) return "#ff9800";
  if (tagName.includes("qualificado")) return "#4caf50";
  if (tagName.includes("frio") || tagName.includes("cold")) return "#607d8b";
  return "#2196f3";
};

const ApplyAiSdrTagsService = async ({
  ticket,
  config,
  evaluation
}: Request): Promise<void> => {
  const tags = new Set<string>();

  if (Array.isArray(config.tags)) {
    config.tags.forEach(tag => {
      const name = normalizeTagName(String(tag || ""));
      if (name) tags.add(name);
    });
  }

  if (Array.isArray(evaluation.tags)) {
    evaluation.tags.forEach(tag => {
      const name = normalizeTagName(String(tag || ""));
      if (name) tags.add(name);
    });
  }

  if (evaluation.leadTemperature === "hot") {
    tags.add("lead_quente");
  }

  if (evaluation.leadTemperature === "warm") {
    tags.add("lead_morno");
  }

  if (evaluation.leadTemperature === "cold") {
    tags.add("lead_frio");
  }

  if (evaluation.status === "waiting_human" || evaluation.shouldHandoff) {
    tags.add("aguardando_humano");
  }

  if (evaluation.status === "qualified") {
    tags.add("lead_qualificado");
  }

  if (!tags.size) return;

  const temperatureTagNames = ["lead_frio", "lead_morno", "lead_quente"];

  const oldTemperatureTags = await Tag.findAll({
    where: {
      companyId: ticket.companyId,
      name: {
        [Op.in]: temperatureTagNames
      }
    }
  });

  if (oldTemperatureTags.length) {
    await TicketTag.destroy({
      where: {
        ticketId: ticket.id,
        tagId: {
          [Op.in]: oldTemperatureTags.map(tag => tag.id)
        }
      }
    });
  }

  for (const tagName of Array.from(tags)) {
    const [tag] = await Tag.findOrCreate({
      where: {
        name: tagName,
        companyId: ticket.companyId
      },
      defaults: {
        name: tagName,
        color: getTagColor(tagName),
        kanban: 0,
        companyId: ticket.companyId
      } as any
    });

    await TicketTag.findOrCreate({
      where: {
        ticketId: ticket.id,
        tagId: tag.id
      },
      defaults: {
        ticketId: ticket.id,
        tagId: tag.id
      } as any
    });
  }
};

export default ApplyAiSdrTagsService;
