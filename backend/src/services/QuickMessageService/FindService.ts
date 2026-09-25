import { Op } from "sequelize";
import QuickMessage from "../../models/QuickMessage";
import Company from "../../models/Company";
import QuickMessageComponent from "../../models/QuickMessageComponent";

type Params = {
  companyId: string;
  userId: string;
  isOficial: string;
  status?: string;
  whatsappId?: string;
};

const FindService = async ({
  companyId,
  userId,
  isOficial,
  status,
  whatsappId
}: Params): Promise<QuickMessage[]> => {
  const orConditions: any[] = [{ visao: true }];

  if (userId) {
    orConditions.push({ userId });
  }

  const isOficialFilter = isOficial === "true";

  const whereCondition: any = {
    companyId,
    [Op.or]: orConditions,
    isOficial: isOficialFilter
  };

  // Templates oficiais devem pertencer à conexão selecionada.
  if (isOficialFilter && whatsappId) {
    const parsedWhatsappId = Number(whatsappId);

    if (Number.isInteger(parsedWhatsappId) && parsedWhatsappId > 0) {
      whereCondition.whatsappId = parsedWhatsappId;
    }
  }

  // Permite listar somente templates aprovados, pendentes etc.
  if (isOficialFilter && status) {
    whereCondition.status = status;
  }

  const notes: QuickMessage[] = await QuickMessage.findAll({
    where: whereCondition,
    include: [
      {
        model: Company,
        as: "company",
        attributes: ["id", "name"]
      },
      {
        model: QuickMessageComponent,
        as: "components",
        attributes: [
          "id",
          "type",
          "text",
          "quickMessageId",
          "buttons",
          "format",
          "example"
        ]
      }
    ],
    order: [
      ["shortcode", "ASC"],
      [{ model: QuickMessageComponent, as: "components" }, "id", "ASC"]
    ]
  });

  return notes;
};

export default FindService;
