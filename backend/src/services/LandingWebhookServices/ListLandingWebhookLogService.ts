import { Op } from "sequelize";

import Contact from "../../models/Contact";
import LandingWebhookConfig from "../../models/LandingWebhookConfig";
import LandingWebhookLog from "../../models/LandingWebhookLog";
import Ticket from "../../models/Ticket";

interface Request {
  companyId: number;
  configId?: number | string;
  status?: string;
  searchParam?: string;
  pageNumber?: string | number;
}

interface Response {
  logs: LandingWebhookLog[];
  count: number;
  hasMore: boolean;
}

const ListLandingWebhookLogService = async ({
  companyId,
  configId,
  status,
  searchParam = "",
  pageNumber = "1"
}: Request): Promise<Response> => {
  const limit = 20;
  const offset = limit * (+pageNumber - 1);

  const whereCondition: any = {
    companyId
  };

  if (configId) {
    whereCondition.configId = configId;
  }

  if (status) {
    whereCondition.status = status;
  }

  const include: any[] = [
    {
      model: LandingWebhookConfig,
      as: "config",
      attributes: ["id", "name", "token"]
    },
    {
      model: Contact,
      as: "contact",
      attributes: ["id", "name", "number", "email"],
      required: false
    },
    {
      model: Ticket,
      as: "ticket",
      attributes: ["id", "status", "lastMessage"],
      required: false
    }
  ];

  if (searchParam) {
    whereCondition[Op.or] = [
      {
        status: {
          [Op.iLike]: `%${searchParam}%`
        }
      },
      {
        errorMessage: {
          [Op.iLike]: `%${searchParam}%`
        }
      }
    ];
  }

  const { count, rows: logs } = await LandingWebhookLog.findAndCountAll({
    where: whereCondition,
    include,
    limit,
    offset,
    order: [["createdAt", "DESC"]],
    distinct: true
  });

  const hasMore = count > offset + logs.length;

  return {
    logs,
    count,
    hasMore
  };
};

export default ListLandingWebhookLogService;