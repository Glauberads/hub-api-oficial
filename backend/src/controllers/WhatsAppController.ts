import GetEmbeddedSignupConfigService from "../services/WhatsAppOficial/EmbeddedSignupServices/GetEmbeddedSignupConfigService";
import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import cacheLayer from "../libs/cache";
import { removeWbot, restartWbot } from "../libs/wbot";
import Whatsapp from "../models/Whatsapp";
import AppError from "../errors/AppError";
import DeleteBaileysService from "../services/BaileysServices/DeleteBaileysService";
import ShowCompanyService from "../services/CompanyService/ShowCompanyService";
import {
  exchangeForLongLivedUserToken,
  getPageProfile,
  subscribeApp
} from "../services/FacebookServices/graphAPI";
import ShowPlanService from "../services/PlanService/ShowPlanService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";

import CreateWhatsAppService from "../services/WhatsappService/CreateWhatsAppService";
import DeleteWhatsAppService from "../services/WhatsappService/DeleteWhatsAppService";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import ShowWhatsAppService from "../services/WhatsappService/ShowWhatsAppService";
import UpdateWhatsAppService from "../services/WhatsappService/UpdateWhatsAppService";
import GetOfficialHealthService from "../services/WhatsappService/GetOfficialHealthService";

import ShowWhatsAppServiceAdmin from "../services/WhatsappService/ShowWhatsAppServiceAdmin";
import UpdateWhatsAppServiceAdmin from "../services/WhatsappService/UpdateWhatsAppServiceAdmin";
import ListAllWhatsAppsService from "../services/WhatsappService/ListAllWhatsAppService";
import ListFilterWhatsAppsService from "../services/WhatsappService/ListFilterWhatsAppsService";
import User from "../models/User";
import logger from "../utils/logger";
import {
  CreateCompanyConnectionOficial,
  DeleteConnectionWhatsAppOficial,
  getTemplatesWhatsAppOficial,
  createTemplateWhatsAppOficial,
  deleteTemplateWhatsAppOficial,
  UpdateConnectionWhatsAppOficial
} from "../libs/whatsAppOficial/whatsAppOficial.service";
import {
  ICreateConnectionWhatsAppOficialCompany,
  ICreateConnectionWhatsAppOficialWhatsApp,
  IUpdateonnectionWhatsAppOficialWhatsApp
} from "../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import QuickMessageComponent from "../models/QuickMessageComponent";
import CreateService from "../services/QuickMessageService/CreateService";
import QuickMessage from "../models/QuickMessage";
import RegisterTelegramWebhookService from "../services/TelegramServices/RegisterTelegramWebhookService";
import {
  startTelegramPersonalSession,
  stopTelegramPersonalSession
} from "../services/TelegramServices/TelegramPersonalService";

interface WhatsappData {
  name: string;
  queueIds: number[];
  companyId: number;
  greetingMessage?: string;
  complationMessage?: string;
  outOfHoursMessage?: string;
  status?: string;
  isDefault?: boolean;
  token?: string;
  maxUseBotQueues?: string;
  timeUseBotQueues?: string;
  expiresTicket?: number;
  allowGroup?: false;
  sendIdQueue?: number;
  timeSendQueue?: number;
  timeInactiveMessage?: string;
  inactiveMessage?: string;
  ratingMessage?: string;
  maxUseBotQueuesNPS?: number;
  expiresTicketNPS?: number;
  whenExpiresTicket?: string;
  expiresInactiveMessage?: string;
  importOldMessages?: string;
  importRecentMessages?: string;
  importOldMessagesGroups?: boolean;
  closedTicketsPostImported?: boolean;
  groupAsTicket?: string;
  timeCreateNewTicket?: number;
  schedules?: any[];
  promptId?: number;
  collectiveVacationMessage?: string;
  collectiveVacationStart?: string;
  collectiveVacationEnd?: string;
  queueIdImportMessages?: number;
  phone_number_id?: string;
  waba_id?: string;
  send_token?: string;
  business_id?: string;
  phone_number?: string;
  meta_app_id?: string;
  waba_webhook?: string;
  channel?: string;
  triggerIntegrationOnClose?: boolean;
  importHistory?: boolean;
  importDays?: number;
  color?: string;

  telegramConnectionType?: string;
  telegramApiId?: number | string;
  telegramApiHash?: string;
  telegramPhone?: string;
  telegramSession?: string;
  telegramPersonalUsername?: string;
  telegramPersonalFirstName?: string;
}

export const officialHealth = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const data = await GetOfficialHealthService(companyId);
  return res.status(200).json(data);
};

interface QueryParams {
  session?: number | string;
  channel?: string;
}

const getApiErrorMessage = (err: any): string => {
  return (
    err?.response?.data?.message ||
    err?.response?.data?.error?.message ||
    err?.response?.data?.error ||
    err?.message ||
    "Erro interno"
  );
};

const isTemplateNotFoundError = (err: any): boolean => {
  const message = getApiErrorMessage(err).toLowerCase();

  return (
    message.includes("not found") ||
    message.includes("does not exist") ||
    message.includes("não existe") ||
    message.includes("nao existe") ||
    message.includes("unknown template") ||
    message.includes("template name does not exist") ||
    message.includes("não foi encontrado") ||
    message.includes("nao foi encontrado")
  );
};


const getTelegramConnectionType = (whatsapp: Whatsapp, body: any = {}): string => {
  return String(
    body?.telegramConnectionType ||
    (whatsapp as any).telegramConnectionType ||
    "bot"
  ).toLowerCase();
};

const isTelegramPersonalConnection = (whatsapp: Whatsapp, body: any = {}): boolean => {
  return whatsapp.channel === "telegram" && getTelegramConnectionType(whatsapp, body) === "personal";
};

const syncTelegramPersonalFields = async (
  whatsapp: Whatsapp,
  body: any = {}
): Promise<void> => {
  if (whatsapp.channel !== "telegram") return;

  const fields = [
    "telegramConnectionType",
    "telegramApiId",
    "telegramApiHash",
    "telegramPhone",
    "telegramSession",
    "telegramPersonalUsername",
    "telegramPersonalFirstName"
  ];

  const payload: any = {};

  fields.forEach(field => {
    if (body[field] !== undefined) {
      payload[field] = body[field];
    }
  });

  if (payload.telegramApiId !== undefined) {
    payload.telegramApiId = payload.telegramApiId ? Number(payload.telegramApiId) : null;
  }

  if (Object.keys(payload).length) {
    await whatsapp.update(payload);
    await whatsapp.reload();
  }
};

const ensureTelegramPersonalConnection = async (whatsapp: Whatsapp): Promise<void> => {
  if ((whatsapp as any).telegramSession) {
    try {
      await startTelegramPersonalSession(whatsapp.id);
    } catch (error: any) {
      const message = getApiErrorMessage(error);
      await whatsapp.update({
        status: "DISCONNECTED",
        telegramLastError: message
      });
      throw new AppError(`Erro ao iniciar Telegram pessoal: ${message}`, 400);
    }

    return;
  }

  await whatsapp.update({
    status: whatsapp.status || "PAIRING",
    telegramLastError: null
  });
};

const removeLocalOfficialTemplateRecords = async (
  companyId: number,
  whatsappId: string | number,
  templateName: string
): Promise<void> => {
  const parsedWhatsappId =
    typeof whatsappId === "number" ? whatsappId : parseInt(whatsappId, 10);

  const quickMessages = await QuickMessage.findAll({
    where: {
      whatsappId: parsedWhatsappId,
      shortcode: templateName,
      isOficial: true,
      companyId
    }
  });

  for (const quickMessage of quickMessages) {
    await QuickMessageComponent.destroy({
      where: {
        quickMessageId: quickMessage.id
      }
    });
  }

  await QuickMessage.destroy({
    where: {
      whatsappId: parsedWhatsappId,
      shortcode: templateName,
      isOficial: true,
      companyId
    }
  });
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  const whatsapps = await ListWhatsAppsService({ companyId, session });

  return res.status(200).json(whatsapps);
};

export const indexFilter = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { session, channel } = req.query as QueryParams;

  const whatsapps = await ListFilterWhatsAppsService({
    companyId,
    session,
    channel
  });

  return res.status(200).json(whatsapps);
};

export const store = async (req: Request, res: Response): Promise<Response> => {
  const {
    name,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds,
    token,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    allowGroup,
    timeSendQueue,
    sendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    groupAsTicket,
    timeCreateNewTicket,
    schedules,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    meta_app_id,
    color,
    waba_webhook,
    channel,
    importHistory,
    importDays
  }: WhatsappData = req.body;
  const { companyId } = req.user;

  const company = await ShowCompanyService(companyId);
  const plan = await ShowPlanService(company.planId);

  if (!plan.useWhatsapp) {
    return res.status(400).json({
      error: "Você não possui permissão para acessar este recurso!"
    });
  }

  const { whatsapp, oldDefaultWhatsapp } = await CreateWhatsAppService({
    name,
    status,
    isDefault,
    greetingMessage,
    complationMessage,
    outOfHoursMessage,
    queueIds,
    companyId,
    token,
    maxUseBotQueues,
    timeUseBotQueues,
    expiresTicket,
    allowGroup,
    timeSendQueue,
    sendIdQueue,
    timeInactiveMessage,
    inactiveMessage,
    ratingMessage,
    maxUseBotQueuesNPS,
    expiresTicketNPS,
    whenExpiresTicket,
    expiresInactiveMessage,
    importOldMessages,
    importRecentMessages,
    closedTicketsPostImported,
    importOldMessagesGroups,
    groupAsTicket,
    timeCreateNewTicket,
    schedules,
    promptId,
    collectiveVacationEnd,
    collectiveVacationMessage,
    collectiveVacationStart,
    queueIdImportMessages,
    phone_number_id,
    waba_id,
    send_token,
    business_id,
    phone_number,
    meta_app_id,
    waba_webhook,
    channel,
    color,
    importHistory,
    importDays
  });

  await syncTelegramPersonalFields(whatsapp, req.body);

  if (whatsapp.channel === "telegram") {
    if (isTelegramPersonalConnection(whatsapp, req.body)) {
      await ensureTelegramPersonalConnection(whatsapp);
    } else {
      try {
        await RegisterTelegramWebhookService({ whatsapp });
      } catch (err: any) {
        const message = getApiErrorMessage(err);
        await whatsapp.update({
          status: "DISCONNECTED",
          telegramLastError: message
        });
        throw new AppError(`Erro ao conectar Telegram: ${message}`, 400);
      }
    }
  }


  if (["whatsapp_oficial"].includes(whatsapp.channel)) {
    try {
      // O Embedded Signup e opcional para conexoes cadastradas manualmente.
      // A ausencia do configId nao pode impedir a criacao na API Oficial.
      try {
        const metaConfig = await GetEmbeddedSignupConfigService({
          companyId: whatsapp.companyId
        });

        if (
          metaConfig.appId &&
          whatsapp.meta_app_id !== metaConfig.appId
        ) {
          whatsapp.meta_app_id = metaConfig.appId;
          await whatsapp.save();
        }
      } catch (metaConfigError) {
        logger.warn(
          "Configuração do Embedded Signup ausente; continuando com o cadastro manual da API Oficial.",
          metaConfigError
        );
      }
      const company: ICreateConnectionWhatsAppOficialCompany = {
        companyId: String(whatsapp.companyId),
        companyName: whatsapp.company.name
      };
      const whatsappOficial: ICreateConnectionWhatsAppOficialWhatsApp = {
        token_mult100: whatsapp.token,
        phone_number_id: whatsapp.phone_number_id,
        waba_id: whatsapp.waba_id,
        send_token: whatsapp.send_token,
        business_id: whatsapp.business_id,
        phone_number: whatsapp.phone_number,
        meta_app_id: whatsapp.meta_app_id,
        idEmpresaMult100: whatsapp.companyId
      };

      const data = {
        email: whatsapp.company.email,
        company,
        whatsApp: whatsappOficial
      };

      const { webhookLink, connectionId } =
        await CreateCompanyConnectionOficial(data);

      if (webhookLink) {
        whatsapp.waba_webhook = webhookLink;
        whatsapp.waba_webhook_id = connectionId;
        whatsapp.status = "CONNECTED";
        await whatsapp.save();
      }
    } catch (error) {
      logger.info("ERROR", error);
    }
  }

  if (["whatsapp"].includes(whatsapp.channel)) {
    StartWhatsAppSession(whatsapp, companyId);
  }
  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const storeFacebook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const {
      facebookUserId,
      facebookUserToken,
      addInstagram
    }: {
      facebookUserId: string;
      facebookUserToken: string;
      addInstagram: boolean;
    } = req.body;
    const { companyId } = req.user;

    const longLivedUserToken = await exchangeForLongLivedUserToken(
      facebookUserToken,
      companyId
    );

    const { data } = await getPageProfile(facebookUserId, longLivedUserToken);

    if (!data || data.length === 0) {
      return res.status(400).json({
        error: "Facebook page not found"
      });
    }

    const io = getIO();
    const pages = [];

    for await (const page of data) {
      const {
        name,
        access_token: pageAccessToken,
        id,
        instagram_business_account
      } = page;

      if (!pageAccessToken) {
        console.log(
          `[FACEBOOK] Página ${id} sem access_token. Pulando conexão.`
        );
        continue;
      }

      if (instagram_business_account && addInstagram) {
        const {
          id: instagramId,
          username,
          name: instagramName
        } = instagram_business_account;

        pages.push({
          companyId,
          name: `Insta ${username || instagramName}`,
          facebookUserId,
          facebookPageUserId: instagramId,
          facebookUserToken: pageAccessToken,
          tokenMeta: longLivedUserToken,
          isDefault: false,
          channel: "instagram",
          status: "CONNECTED",
          greetingMessage: "",
          farewellMessage: "",
          queueIds: [],
          isMultidevice: false
        });

        pages.push({
          companyId,
          name,
          facebookUserId,
          facebookPageUserId: id,
          facebookUserToken: pageAccessToken,
          tokenMeta: longLivedUserToken,
          isDefault: false,
          channel: "facebook",
          status: "CONNECTED",
          greetingMessage: "",
          farewellMessage: "",
          queueIds: [],
          isMultidevice: false
        });

        await subscribeApp(id, pageAccessToken, false);

        console.log(
          `[INSTAGRAM] ℹ️ Comentários e mensagens do Instagram vinculados à página ${id}`
        );
      }

      if (!instagram_business_account) {
        pages.push({
          companyId,
          name,
          facebookUserId,
          facebookPageUserId: id,
          facebookUserToken: pageAccessToken,
          tokenMeta: longLivedUserToken,
          isDefault: false,
          channel: "facebook",
          status: "CONNECTED",
          greetingMessage: "",
          farewellMessage: "",
          queueIds: [],
          isMultidevice: false
        });

        await subscribeApp(id, pageAccessToken);
      }
    }

    for await (const pageConection of pages) {
      const exist = await Whatsapp.findOne({
        where: {
          facebookPageUserId: pageConection.facebookPageUserId
        }
      });

      if (exist) {
        await exist.update({
          ...pageConection
        });

        io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
          action: "update",
          whatsapp: exist
        });
      } else {
        const { whatsapp } = await CreateWhatsAppService(pageConection);

        io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
          action: "update",
          whatsapp
        });
      }
    }

    return res.status(200).json({ success: true });
  } catch (error) {
    console.log(error);
    return res.status(400).json({
      error: "Facebook page not found"
    });
  }
};

export const show = async (req: Request, res: Response): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const { session } = req.query;

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId, session);

  return res.status(200).json(whatsapp);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  console.log(`[WHATSAPP-UPDATE] Dados recebidos para conexão ${whatsappId}:`, {
    flowIdNotPhrase: whatsappData.flowIdNotPhrase,
    flowIdWelcome: whatsappData.flowIdWelcome,
    flowIdInactiveTime: whatsappData.flowIdInactiveTime
  });

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppService({
    whatsappData,
    whatsappId,
    companyId
  });

  await syncTelegramPersonalFields(whatsapp, req.body);

  if (whatsapp.channel === "telegram") {
    if (isTelegramPersonalConnection(whatsapp, req.body)) {
      await ensureTelegramPersonalConnection(whatsapp);
    } else {
      try {
        await RegisterTelegramWebhookService({ whatsapp });
      } catch (err: any) {
        const message = getApiErrorMessage(err);
        await whatsapp.update({
          status: "DISCONNECTED",
          telegramLastError: message
        });
        throw new AppError(`Erro ao conectar Telegram: ${message}`, 400);
      }
    }
  }


  if (["whatsapp_oficial"].includes(whatsapp.channel)) {
    try {
      const metaConfig = await GetEmbeddedSignupConfigService({
        companyId: whatsapp.companyId
      });

      if (
        metaConfig.appId &&
        whatsapp.meta_app_id !== metaConfig.appId
      ) {
        whatsapp.meta_app_id = metaConfig.appId;
        await whatsapp.save();
      }
      const whatsappOficial: IUpdateonnectionWhatsAppOficialWhatsApp = {
        token_mult100: whatsapp.token,
        phone_number_id: whatsapp.phone_number_id,
        waba_id: whatsapp.waba_id,
        send_token: whatsapp.send_token,
        business_id: whatsapp.business_id,
        phone_number: whatsapp.phone_number,
        meta_app_id: whatsapp.meta_app_id
      };

      await UpdateConnectionWhatsAppOficial(
        whatsapp.waba_webhook_id,
        whatsappOficial
      );
    } catch (error) {
      logger.info("ERROR", error);
    }
  }

  const io = getIO();
  io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile } = req.user;
  const io = getIO();

  if (profile !== "admin") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);
    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
    removeWbot(+whatsappId);

    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "whatsapp_oficial") {
    await Whatsapp.destroy({
      where: {
        id: +whatsappId
      }
    });

    try {
      if (whatsapp.waba_webhook_id) {
        await DeleteConnectionWhatsAppOficial(whatsapp.waba_webhook_id);
      }
    } catch (error) {
      logger.info("ERROR", error);
    }

    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "telegram") {
    if (isTelegramPersonalConnection(whatsapp)) {
      try {
        await stopTelegramPersonalSession(+whatsappId);
      } catch (error) {
        logger.warn(
          `[TELEGRAM PERSONAL] Falha ao encerrar sessão ${whatsappId} antes da exclusão:`,
          error
        );
      }
    }

    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);

    io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });

    logger.info(
      `[TELEGRAM] Conexão ${whatsappId} excluída com sucesso`
    );
  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    const { facebookUserToken } = whatsapp;

    const getAllSameToken = await Whatsapp.findAll({
      where: {
        facebookUserToken
      }
    });

    await Whatsapp.destroy({
      where: {
        facebookUserToken
      }
    });

    for await (const whatsapp of getAllSameToken) {
      io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
        action: "delete",
        whatsappId: whatsapp.id
      });
    }
  }

  return res.status(200).json({ message: "Session disconnected." });
};

export const disconnectSession = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId, profile, id } = req.user;
  const io = getIO();

  const user = await User.findByPk(id);
  const allowConnections = user?.allowConnections;

  if (profile !== "admin" && allowConnections === "disabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel !== "whatsapp") {
    throw new AppError("ERR_ONLY_BAILEYS_CONNECTION", 400);
  }

  const whatsappModel = await Whatsapp.findOne({
    where: {
      id: +whatsappId,
      companyId
    }
  });

  if (!whatsappModel) {
    throw new AppError("ERR_WAPP_NOT_FOUND", 404);
  }

  try {
    await DeleteBaileysService(whatsappId);
  } catch (error) {
    logger.error(
      `[WHATSAPP-DISCONNECT-SESSION] Erro ao limpar registros Baileys da conexão ${whatsappId}: ${error}`
    );
  }

  try {
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
  } catch (error) {
    logger.error(
      `[WHATSAPP-DISCONNECT-SESSION] Erro ao limpar cache da sessão ${whatsappId}: ${error}`
    );
  }

  try {
    await removeWbot(+whatsappId, false);
  } catch (error) {
    logger.error(
      `[WHATSAPP-DISCONNECT-SESSION] Erro ao remover socket antigo ${whatsappId}: ${error}`
    );
  }

  try {
    whatsappModel.status = "OPENING";

    if (typeof (whatsappModel as any).set === "function") {
      if (
        Object.prototype.hasOwnProperty.call(
          (whatsappModel as any).dataValues,
          "qrcode"
        )
      ) {
        (whatsappModel as any).set("qrcode", "");
      }

      if (
        Object.prototype.hasOwnProperty.call(
          (whatsappModel as any).dataValues,
          "session"
        )
      ) {
        (whatsappModel as any).set("session", "");
      }

      if (
        Object.prototype.hasOwnProperty.call(
          (whatsappModel as any).dataValues,
          "retries"
        )
      ) {
        (whatsappModel as any).set("retries", 0);
      }

      if (
        Object.prototype.hasOwnProperty.call(
          (whatsappModel as any).dataValues,
          "number"
        )
      ) {
        (whatsappModel as any).set("number", "");
      }
    }

    await whatsappModel.save();
    await whatsappModel.reload();
  } catch (error) {
    logger.error(
      `[WHATSAPP-DISCONNECT-SESSION] Erro ao atualizar status da conexão ${whatsappId}: ${error}`
    );
  }

  io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
    action: "update",
    whatsapp: whatsappModel
  });

  io.of(String(companyId)).emit(`company-${companyId}-whatsappSession`, {
    action: "update",
    session: whatsappModel
  });

  setTimeout(() => {
    StartWhatsAppSession(whatsappModel, companyId);
  }, 1500);

  return res.status(200).json({
    message: "Sessão desconectada com sucesso. Novo QR solicitado.",
    whatsapp: whatsappModel
  });
};

export const restart = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, profile, id } = req.user;

  const user = await User.findByPk(id);
  const { allowConnections } = user;

  if (profile !== "admin" && allowConnections === "disabled") {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  await restartWbot(companyId);

  return res.status(200).json({ message: "Whatsapp restart." });
};

export const listAll = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { session } = req.query as QueryParams;
  const whatsapps = await ListAllWhatsAppsService({ session });
  return res.status(200).json(whatsapps);
};

export const updateAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const whatsappData = req.body;
  const { companyId } = req.user;

  const { whatsapp, oldDefaultWhatsapp } = await UpdateWhatsAppServiceAdmin({
    whatsappData,
    whatsappId,
    companyId
  });

  const io = getIO();
  io.of(String(companyId)).emit(`admin-whatsapp`, {
    action: "update",
    whatsapp
  });

  if (oldDefaultWhatsapp) {
    io.of(String(companyId)).emit(`admin-whatsapp`, {
      action: "update",
      whatsapp: oldDefaultWhatsapp
    });
  }

  return res.status(200).json(whatsapp);
};

export const removeAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const io = getIO();
  console.log("REMOVING WHATSAPP ADMIN", whatsappId);
  const whatsapp = await ShowWhatsAppService(whatsappId, companyId);

  if (whatsapp.channel === "whatsapp") {
    await DeleteBaileysService(whatsappId);
    await DeleteWhatsAppService(whatsappId);
    await cacheLayer.delFromPattern(`sessions:${whatsappId}:*`);
    removeWbot(+whatsappId);

    io.of(String(companyId)).emit(`admin-whatsapp`, {
      action: "delete",
      whatsappId: +whatsappId
    });
  }

  if (whatsapp.channel === "facebook" || whatsapp.channel === "instagram") {
    const { facebookUserToken } = whatsapp;

    const getAllSameToken = await Whatsapp.findAll({
      where: {
        facebookUserToken
      }
    });

    await Whatsapp.destroy({
      where: {
        facebookUserToken
      }
    });

    for await (const whatsapp of getAllSameToken) {
      io.of(String(companyId)).emit(`company-${companyId}-whatsapp`, {
        action: "delete",
        whatsappId: whatsapp.id
      });
    }
  }

  return res.status(200).json({ message: "Session disconnected." });
};

export const showAdmin = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { whatsappId } = req.params;
  const { companyId } = req.user;
  const whatsapp = await ShowWhatsAppServiceAdmin(whatsappId);

  return res.status(200).json(whatsapp);
};

export const syncTemplatesOficial = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId, id: userId } = req.user;
  const { whatsappId } = req.params;

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("Conexão não encontrada", 404);
  }

  const multi100Token = whatsapp.token;
  if (!multi100Token) {
    throw new AppError("Token interno não encontrado para esta conexão.", 400);
  }

  const data = await getTemplatesWhatsAppOficial(multi100Token);
  const io = getIO();
  const statusChanges: Array<{
    name: string;
    oldStatus: string;
    newStatus: string;
  }> = [];

  const remoteTemplates = Array.isArray(data?.data) ? data.data : [];
  const remoteMetaIds = remoteTemplates
    .map(template => String(template.id))
    .filter(Boolean);
  const remoteNames = remoteTemplates
    .map(template => String(template.name))
    .filter(Boolean);

  if (remoteTemplates.length > 0) {
    await Promise.all(
      remoteTemplates.map(async template => {
        const quickMessage = await QuickMessage.findOne({
          where: {
            companyId,
            whatsappId: whatsapp.id,
            metaID: String(template.id),
            isOficial: true
          },
          include: [
            {
              model: QuickMessageComponent,
              as: "components"
            }
          ]
        });

        if (quickMessage) {
          const oldStatus = quickMessage.status;
          const newStatus = template.status;

          if (oldStatus && newStatus && oldStatus !== newStatus) {
            statusChanges.push({
              name: template.name,
              oldStatus,
              newStatus
            });
          }

          await quickMessage.update({
            shortcode: template.name,
            message: template.name,
            category: template.category,
            status: template.status,
            language: template.language,
            metaID: template.id,
            whatsappId: whatsapp.id
          });

          await QuickMessageComponent.destroy({
            where: {
              quickMessageId: quickMessage.id
            }
          });

          if (template?.components?.length > 0) {
            await Promise.all(
              template.components.map(async component => {
                await QuickMessageComponent.create({
                  quickMessageId: quickMessage.id,
                  type: component.type,
                  text: component.text,
                  buttons: JSON.stringify(component?.buttons),
                  format: component?.format,
                  example: JSON.stringify(component?.example)
                });
              })
            );
          }
        } else {
          const templateData = {
            shortcode: template.name,
            message: template.name,
            companyId: companyId,
            userId: userId,
            geral: true,
            isMedia: false,
            mediaPath: null,
            visao: true,
            isOficial: true,
            language: template.language,
            status: template.status,
            category: template.category,
            metaID: template.id,
            whatsappId: whatsapp.id
          };
          const qm = await CreateService(templateData);

          if (template?.components?.length > 0) {
            await Promise.all(
              template.components.map(async component => {
                await QuickMessageComponent.create({
                  quickMessageId: qm.id,
                  type: component.type,
                  text: component.text,
                  buttons: JSON.stringify(component?.buttons),
                  format: component?.format,
                  example: JSON.stringify(component?.example)
                });
              })
            );
          }
        }
      })
    );
  }

  const localQuickMessages = await QuickMessage.findAll({
    where: {
      whatsappId: parseInt(whatsappId, 10),
      isOficial: true,
      companyId
    }
  });

  const staleQuickMessages = localQuickMessages.filter(item => {
    if (item.metaID) {
      return !remoteMetaIds.includes(String(item.metaID));
    }

    return (
      !remoteNames.includes(String(item.shortcode || "")) &&
      !remoteNames.includes(String(item.message || ""))
    );
  });

  for (const stale of staleQuickMessages) {
    await QuickMessageComponent.destroy({
      where: {
        quickMessageId: stale.id
      }
    });

    await stale.destroy();
  }

  if (statusChanges.length > 0) {
    io.of(String(companyId)).emit(`company-${companyId}-templateStatus`, {
      action: "statusChange",
      changes: statusChanges,
      whatsappId: parseInt(whatsappId, 10),
      whatsappName: whatsapp.name
    });
  }

  return res.status(200).json({
    ...data,
    statusChanges,
    removedLocals: staleQuickMessages.map(item => ({
      id: item.id,
      shortcode: item.shortcode,
      metaID: item.metaID
    }))
  });
};

export const createTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId } = req.params;
  const payload =
    typeof req.body.data === "string" ? JSON.parse(req.body.data) : req.body;

  const { name, language, category, components } = payload;

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (whatsapp.channel !== "whatsapp_oficial") {
    throw new AppError("ERR_ONLY_OFICIAL_API", 400);
  }

  const multi100Token = whatsapp.token;
  if (!multi100Token) {
    throw new AppError("Token interno não configurado para esta conexão.", 400);
  }

  try {
    const uploadedFile = req.file as Express.Multer.File | undefined;

    const result = await createTemplateWhatsAppOficial(
      multi100Token,
      {
        name,
        language,
        category,
        components
      },
      uploadedFile?.path
    );

    return res.status(200).json(result);
  } catch (err: any) {
    throw new AppError(getApiErrorMessage(err) || "ERR_CREATING_TEMPLATE", 500);
  }
};

export const deleteTemplate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;
  const { whatsappId, templateName } = req.params;

  const whatsapp = await Whatsapp.findByPk(whatsappId);

  if (!whatsapp || whatsapp.companyId !== companyId) {
    throw new AppError("ERR_NO_PERMISSION", 403);
  }

  if (whatsapp.channel !== "whatsapp_oficial") {
    throw new AppError("ERR_ONLY_OFICIAL_API", 400);
  }

  const multi100Token = whatsapp.token;
  if (!multi100Token) {
    throw new AppError("Token interno não configurado para esta conexão.", 400);
  }

  try {
    const result = await deleteTemplateWhatsAppOficial(
      multi100Token,
      templateName
    );

    await removeLocalOfficialTemplateRecords(companyId, whatsappId, templateName);

    return res.status(200).json(result);
  } catch (err: any) {
    if (isTemplateNotFoundError(err)) {
      await removeLocalOfficialTemplateRecords(
        companyId,
        whatsappId,
        templateName
      );

      return res.status(200).json({
        success: true,
        alreadyDeleted: true,
        message:
          "Template já não existia mais na Meta e foi removido localmente."
      });
    }

    throw new AppError(getApiErrorMessage(err) || "ERR_DELETING_TEMPLATE", 500);
  }
};
