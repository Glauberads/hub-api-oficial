import { Server as SocketIO, Socket } from "socket.io";
import { Server } from "http";
import AppError from "../errors/AppError";
import logger from "../utils/logger";
import { instrument } from "@socket.io/admin-ui";
import User from "../models/User";
import { ReceibedWhatsAppService } from "../services/WhatsAppOficial/ReceivedWhatsApp";
import { JwtPayload, verify, decode } from "jsonwebtoken";
import authConfig from "../config/auth";
import BirthdayService from "../services/BirthdayService/BirthdayService";
import Contact from "../models/Contact";
import Ticket from "../models/Ticket";
import Whatsapp from "../models/Whatsapp";
import CallHistory from "../models/CallHistory";

let io: SocketIO | null = null;
let socketEmitter: any = null;
const heartbeatTimeouts = new Map<string, NodeJS.Timeout>();

const parseBoolean = (value: any): boolean => {
  if (typeof value === "boolean") return value;
  return String(value || "").toLowerCase() === "true";
};

const getCompanyNamespace = (companyId: number | string): string => `/${companyId}`;

const getCompanyRoom = (companyId: number | string): string => `company-${companyId}`;

const clearHeartbeatTimeout = (socketId: string): void => {
  const timeout = heartbeatTimeouts.get(socketId);
  if (timeout) {
    clearTimeout(timeout);
    heartbeatTimeouts.delete(socketId);
  }
};

const extractTokenFromSocket = (socket: Socket): string | null => {
  const rawToken = socket?.handshake?.query?.token;

  if (Array.isArray(rawToken)) {
    const tokenValue = rawToken[1] || rawToken[0];
    if (!tokenValue) return null;
    return String(tokenValue).startsWith("Bearer ")
      ? String(tokenValue).split(" ")[1]
      : String(tokenValue);
  }

  if (!rawToken) return null;

  const tokenValue = String(rawToken);
  return tokenValue.startsWith("Bearer ")
    ? tokenValue.split(" ")[1]
    : tokenValue;
};

type SocketAuthContext = {
  isApiOficialToken: boolean;
  companyId: number;
  userId?: number;
};

const resolveSocketAuth = (socket: Socket, token: string, tokenApiOficial: string): SocketAuthContext => {
  const companyId = Number(socket.nsp.name.split("/")[1]);

  if (!companyId) {
    throw new AppError("Invalid company namespace", 401);
  }

  if (token === tokenApiOficial) {
    return {
      isApiOficialToken: true,
      companyId
    };
  }

  try {
    const decodedToken = verify(token, authConfig.secret) as JwtPayload;
    const companyIdToken = Number(decodedToken.companyId);

    if (companyIdToken !== companyId) {
      logger.error(
        `CompanyId do token ${companyIdToken} diferente da companyId do socket ${companyId}`
      );
      throw new AppError("Invalid socket token company", 401);
    }

    return {
      isApiOficialToken: false,
      companyId,
      userId: Number(decodedToken.id)
    };
  } catch (error: any) {
    logger.error(JSON.stringify(error), "Error decoding token");

    if (error?.message === "jwt expired") {
      const expiredPayload = decode(token) as JwtPayload | null;
      const companyIdToken = Number(expiredPayload?.companyId || 0);

      if (companyIdToken && companyIdToken !== companyId) {
        logger.error(
          `CompanyId do token expirado ${companyIdToken} diferente da companyId do socket ${companyId}`
        );
        throw new AppError("Invalid expired socket token company", 401);
      }

      return {
        isApiOficialToken: false,
        companyId,
        userId: Number(expiredPayload?.id || 0)
      };
    }

    throw new AppError("Invalid socket token", 401);
  }
};

const initSocketRedisAdapter = async (socketServer: SocketIO): Promise<void> => {
  if (!parseBoolean(process.env.SOCKET_REDIS_ADAPTER)) {
    return;
  }

  if (!process.env.REDIS_URI) {
    logger.warn("[SOCKET] SOCKET_REDIS_ADAPTER=true, mas REDIS_URI não foi definido.");
    return;
  }

  try {
    const { createClient } = await import("redis");
    const { createAdapter } = await import("@socket.io/redis-adapter");

    const pubClient = createClient({ url: process.env.REDIS_URI });
    const subClient = pubClient.duplicate();

    await pubClient.connect();
    await subClient.connect();

    socketServer.adapter(createAdapter(pubClient, subClient));
    logger.info("[SOCKET] Redis adapter inicializado com sucesso.");
  } catch (error) {
    logger.error("[SOCKET] Erro ao inicializar Redis adapter:", error);
  }
};

const initSocketEmitter = async (): Promise<void> => {
  if (socketEmitter) {
    return;
  }

  if (!parseBoolean(process.env.SOCKET_REDIS_EMITTER) && !parseBoolean(process.env.SOCKET_REDIS_ADAPTER)) {
    return;
  }

  if (!process.env.REDIS_URI) {
    logger.warn("[SOCKET] Redis emitter não inicializado: REDIS_URI não definido.");
    return;
  }

  try {
    const { createClient } = await import("redis");
    const { Emitter } = await import("@socket.io/redis-emitter");

    const redisClient = createClient({ url: process.env.REDIS_URI });
    await redisClient.connect();

    socketEmitter = new Emitter(redisClient);
    logger.info("[SOCKET] Redis emitter inicializado com sucesso.");
  } catch (error) {
    logger.error("[SOCKET] Erro ao inicializar Redis emitter:", error);
  }
};

export const emitNamespaceEvent = async (
  namespace: string,
  event: string,
  payload: any
): Promise<void> => {
  try {
    if (io) {
      io.of(namespace).emit(event, payload);
      return;
    }

    await initSocketEmitter();

    if (socketEmitter) {
      socketEmitter.of(namespace).emit(event, payload);
      return;
    }

    logger.warn(
      `[SOCKET] Não foi possível emitir evento "${event}" no namespace "${namespace}": IO/emitter indisponível.`
    );
  } catch (error) {
    logger.error(`[SOCKET] Erro ao emitir evento "${event}" no namespace "${namespace}":`, error);
  }
};

export const emitCompanyEvent = async (
  companyId: number | string,
  event: string,
  payload: any
): Promise<void> => {
  await emitNamespaceEvent(getCompanyNamespace(companyId), event, payload);
};

const checkAndEmitBirthdays = async (companyId: number): Promise<void> => {
  try {
    const birthdayData = await BirthdayService.getTodayBirthdaysForCompany(companyId);

    if (birthdayData.users.length > 0) {
      for (const user of birthdayData.users) {
        await emitCompanyEvent(companyId, "user-birthday", {
          userId: user.id,
          userName: user.name,
          userAge: user.age
        });

        logger.info(`[GLOBAL] Emitido evento de aniversário para usuário: ${user.name}`);
      }
    }

    if (birthdayData.contacts.length > 0) {
      for (const contact of birthdayData.contacts) {
        await emitCompanyEvent(companyId, "contact-birthday", {
          contactId: contact.id,
          contactName: contact.name,
          contactAge: contact.age
        });

        logger.info(`[GLOBAL] Emitido evento de aniversário para contato: ${contact.name}`);
      }
    }
  } catch (error) {
    logger.error("[SOCKET] Error checking birthdays:", error);
  }
};

const handleHeartbeat = async (socket: Socket, companyId: number, userId: number): Promise<void> => {
  try {
    await User.update(
      {
        online: true,
        lastSeen: new Date()
      },
      { where: { id: userId } }
    );

    socket.broadcast.to(getCompanyRoom(companyId)).emit("user:online", {
      userId,
      lastSeen: new Date()
    });

    clearHeartbeatTimeout(socket.id);

    const timeout = setTimeout(async () => {
      try {
        await User.update(
          {
            online: false,
            lastSeen: new Date()
          },
          { where: { id: userId } }
        );

        socket.broadcast.to(getCompanyRoom(companyId)).emit("user:offline", {
          userId,
          lastSeen: new Date()
        });
      } catch (error) {
        logger.error("[SOCKET] Error in delayed heartbeat timeout:", error);
      }
    }, 30000);

    heartbeatTimeouts.set(socket.id, timeout);
  } catch (error) {
    logger.error("[SOCKET] Error in handleHeartbeat:", error);
  }
};

const handleAuthenticatedUserConnection = async (
  socket: Socket,
  companyId: number,
  userId: number
): Promise<void> => {
  try {
    socket.join(getCompanyRoom(companyId));

    await User.update(
      {
        online: true,
        lastSeen: new Date()
      },
      { where: { id: userId } }
    );

    const user = await User.findByPk(userId, {
      attributes: ["id", "name", "profileImage", "lastSeen"]
    });

    socket.broadcast.to(getCompanyRoom(companyId)).emit("user:new", {
      userId,
      user
    });

    const onlineUsers = await User.findAll({
      where: {
        companyId,
        online: true
      },
      attributes: ["id", "name", "profileImage", "lastSeen"]
    });

    socket.emit("users:online", onlineUsers);

    await checkAndEmitBirthdays(companyId);
  } catch (error) {
    logger.error("[SOCKET] Error in authenticated user connection:", error);
  }
};

export const initIO = async (httpServer: Server): Promise<SocketIO> => {
  io = new SocketIO(httpServer, {
    cors: {
      origin: process.env.FRONTEND_URL
    }
  });

  await initSocketRedisAdapter(io);
  await initSocketEmitter();

  if (parseBoolean(process.env.SOCKET_ADMIN)) {
    User.findByPk(1).then(adminUser => {
      if (!adminUser) {
        logger.warn("[SOCKET] Usuário admin não encontrado para admin-ui.");
        return;
      }

      instrument(io as SocketIO, {
        auth: {
          type: "basic",
          username: process.env.SOCKET_ADMIN_USER || adminUser.email,
          password: process.env.SOCKET_ADMIN_PASS || adminUser.passwordHash
        },
        mode: "development"
      });
    });
  }

  const workspaces = io.of(/^\/\w+$/);

  workspaces.on("connection", async socket => {
    try {
      const tokenApiOficial = process.env.TOKEN_API_OFICIAL || "";
      const token = extractTokenFromSocket(socket);

      if (!token) {
        return socket.disconnect();
      }

      const authContext = resolveSocketAuth(socket, token, tokenApiOficial);

      if (authContext.isApiOficialToken) {
        logger.info(`Client connected namespace ${socket.nsp.name}`);
        logger.info("Conectado com sucesso na API OFICIAL");
      } else if (authContext.userId) {
        await handleAuthenticatedUserConnection(
          socket,
          authContext.companyId,
          authContext.userId
        );
      }

      socket.on("checkBirthdays", async () => {
        try {
          await checkAndEmitBirthdays(authContext.companyId);
        } catch (error) {
          logger.error("[SOCKET] Error in manual birthday check:", error);
        }
      });

      socket.on("joinChatBox", (ticketId: string) => {
        socket.join(ticketId);
      });

      socket.on("joinNotification", () => {
        socket.join("notification");
      });

      socket.on("joinVersion", () => {
        logger.info(`A client joined version channel namespace ${socket.nsp.name}`);
        socket.join("version");
      });

      socket.on("joinTickets", (status: string) => {
        socket.join(status);
      });

      socket.on("joinTicketsLeave", (status: string) => {
        socket.leave(status);
      });

      socket.on("joinChatBoxLeave", (ticketId: string) => {
        socket.leave(ticketId);
      });

      socket.on(
        "presenceSubscribe",
        async (data: { contactNumber: string; whatsappId: number; isGroup: boolean }) => {
          try {
            if (!data?.contactNumber || !data?.whatsappId) return;

            const { getWbot } = await import("./wbot");
            const wbot = getWbot(data.whatsappId);
            if (!wbot) return;

            const jid = data.isGroup
              ? `${data.contactNumber}@g.us`
              : `${data.contactNumber}@s.whatsapp.net`;

            await wbot.presenceSubscribe(jid);
          } catch (err) {
            // Silenciar — sessão pode não estar conectada
          }
        }
      );

      socket.on("receivedMessageWhatsAppOficial", (data: any) => {
        const receivedService = new ReceibedWhatsAppService();
        receivedService.getMessage(data);
      });

      socket.on("readMessageWhatsAppOficial", (data: any) => {
        const receivedService = new ReceibedWhatsAppService();
        receivedService.readMessage(data);
      });

      socket.on("officialCallWhatsAppOficial", async (data: any) => {
        try {
          const companyId = Number(data?.companyId || authContext.companyId);
          const calls = Array.isArray(data?.calls) ? data.calls : [];

          logger.info(
            `[OFFICIAL CALL SOCKET] companyId=${companyId} calls=${calls.length}`
          );

          if (!companyId || calls.length === 0) {
            logger.warn("[OFFICIAL CALL SOCKET] Payload inválido recebido da API Oficial.");
            return;
          }

          const createCallHistorical = (
            await import("../services/CallService/CreateCallService")
          ).default;

          const WhatsappModel = (await import("../models/Whatsapp")).default;

          const officialWhatsapp = await WhatsappModel.findOne({
            where: {
              companyId,
              channel: "whatsapp_oficial"
            } as any,
            order: [["id", "ASC"]]
          });

          const backendOfficialWhatsappId = Number((officialWhatsapp as any)?.id || 0);

          logger.info(
            `[OFFICIAL CALL SOCKET WHATSAPP] companyId=${companyId} backendOfficialWhatsappId=${backendOfficialWhatsappId}`
          );

          for (const call of calls) {
            const rawEvent = String(call?.event || call?.status || "ringing").toLowerCase();

            const statusMap: Record<string, string> = {
              connect: "ringing",
              incoming: "ringing",
              ringing: "ringing",
              pre_accept: "answered",
              pre_accepted: "answered",
              accept: "answered",
              accepted: "answered",
              answer: "answered",
              answered: "answered",
              terminate: "ended",
              terminated: "ended",
              ended: "ended",
              reject: "rejected",
              rejected: "rejected",
              missed: "missed"
            };

            const directionRaw = String(call?.direction || "inbound").toLowerCase();

            const isBusinessInitiated =
              directionRaw.includes("business_initiated") ||
              directionRaw.includes("business-initiated") ||
              directionRaw.includes("businessinitiated");

            const direction =
              isBusinessInitiated || directionRaw.includes("out")
                ? "outgoing"
                : "incoming";

            const status =
              rawEvent === "connect" && direction === "outgoing"
                ? "calling"
                : statusMap[rawEvent] || rawEvent || "ringing";

            const phone =
              direction === "outgoing"
                ? String(call?.to || call?.phone_to || call?.from || "").replace(/\D/g, "")
                : String(call?.from || call?.phone || call?.to || "").replace(/\D/g, "");

            const callId = String(call?.call_id || call?.id || "").trim();

            const backendWhatsappId =
              Number(
                call?.backendWhatsappId ||
                  data?.backendWhatsappId ||
                  0
              ) || null;

            const apiConexaoId =
              Number(
                call?.conexaoId ||
                  call?.connectionId ||
                  data?.conexaoId ||
                  data?.connectionId ||
                  data?.whatsappOficialId ||
                  0
              ) || null;

            const officialSocketToken = String(
              call?.token ||
                data?.token ||
                data?.token_mult100 ||
                ""
            ).trim();

            const officialPhoneNumberId = String(
              call?.phone_number_id ||
                data?.phone_number_id ||
                ""
            ).trim();

            const officialDisplayNumber = String(
              call?.display_phone_number ||
                data?.display_phone_number ||
                data?.phone_number ||
                ""
            ).replace(/\D/g, "");

            let officialWhatsapp: any = null;

            if (backendWhatsappId) {
              officialWhatsapp = await Whatsapp.findOne({
                where: {
                  id: backendWhatsappId,
                  companyId,
                  channel: "whatsapp_oficial"
                } as any
              });
            }

            if (!officialWhatsapp && officialSocketToken) {
              officialWhatsapp = await Whatsapp.findOne({
                where: {
                  companyId,
                  channel: "whatsapp_oficial",
                  token: officialSocketToken
                } as any
              });
            }

            if (!officialWhatsapp && officialPhoneNumberId) {
              officialWhatsapp = await Whatsapp.findOne({
                where: {
                  companyId,
                  channel: "whatsapp_oficial",
                  phone_number_id: officialPhoneNumberId
                } as any
              });
            }

            if (!officialWhatsapp && officialDisplayNumber) {
              officialWhatsapp =
                (await Whatsapp.findOne({
                  where: {
                    companyId,
                    channel: "whatsapp_oficial",
                    phone_number: officialDisplayNumber
                  } as any
                })) ||
                (await Whatsapp.findOne({
                  where: {
                    companyId,
                    channel: "whatsapp_oficial",
                    number: officialDisplayNumber
                  } as any
                }));
            }

            const officialWhatsappId = officialWhatsapp?.id || null;

            const apiOfficialConexaoId =
              Number(
                data?.conexaoId ||
                  data?.whatsappOficialId ||
                  call?.conexaoId ||
                  call?.connectionId ||
                  call?.whatsappOficialId ||
                  0
              ) || null;

            logger.info(
              `[OFFICIAL CALL SOCKET MAP] companyId=${companyId} apiConexaoId=${apiConexaoId || "N/A"} token=${officialSocketToken ? "SIM" : "NAO"} phone_number_id=${officialPhoneNumberId || "N/A"} display=${officialDisplayNumber || "N/A"} backendWhatsappId=${officialWhatsappId || "N/A"} backendWhatsappName=${officialWhatsapp?.name || "N/A"}`
            );

            let officialUserId =
              Number(
                call?.user_id ||
                  call?.userId ||
                  call?.attendantId ||
                  call?.attendant_id ||
                  call?.raw?.user_id ||
                  call?.raw?.userId ||
                  call?.raw?.attendantId ||
                  call?.raw?.attendant_id ||
                  data?.user_id ||
                  data?.userId ||
                  data?.attendantId ||
                  data?.attendant_id ||
                  data?.raw?.user_id ||
                  data?.raw?.userId ||
                  data?.raw?.attendantId ||
                  data?.raw?.attendant_id ||
                  0
              ) || null;

            if (!officialUserId && phone) {
              const contactForCall: any = await Contact.findOne({
                where: {
                  companyId,
                  number: phone
                } as any
              });

              if (contactForCall?.id) {
                const ticketWhere: any = {
                  companyId,
                  contactId: contactForCall.id
                };

                if (officialWhatsappId) {
                  ticketWhere.whatsappId = officialWhatsappId;
                }

                const ticketForCall: any = await Ticket.findOne({
                  where: ticketWhere,
                  order: [["updatedAt", "DESC"]]
                } as any);

                if (ticketForCall?.userId) {
                  officialUserId = Number(ticketForCall.userId) || null;
                }
              }
            }

            logger.info(
              `[OFFICIAL CALL SOCKET NORMALIZED] rawDirection=${call?.direction || ""} direction=${direction} from=${call?.from || ""} to=${call?.to || ""} phone=${phone} status=${status} call_id=${callId || "N/A"}`
            );

            const timestampNumber = Number(call?.timestamp || 0);
            const eventAt =
              Number.isFinite(timestampNumber) && timestampNumber > 0
                ? new Date(
                    String(call?.timestamp).length <= 10
                      ? timestampNumber * 1000
                      : timestampNumber
                  )
                : new Date();

            const isEndedStatus =
              ["ended", "rejected", "missed"].includes(status) ||
              ["terminate", "terminated", "reject", "rejected", "missed"].includes(rawEvent) ||
              String(call?.status || "").toLowerCase() === "completed";

            const startedAt = eventAt;
            const endedAt = isEndedStatus ? eventAt : null;
            const frontendAction = isEndedStatus
              ? "update"
              : direction === "outgoing"
                ? "outgoing"
                : "incoming";

            let callHistorical: any = null;

            try {
              callHistorical = await createCallHistorical({
                company_id: companyId,
                user_id: officialUserId,
                whatsapp_id: officialWhatsappId,
                phone_to: phone,
                name: phone || "Chamada API Oficial",
                direction,
                status,
                source: "meta_official",
                duration: 0,
                call_id: callId,
                started_at: startedAt,
                ended_at: endedAt
              } as any);

              if (officialWhatsappId && callHistorical?.id) {
                const forcePayload: any = {
                  whatsapp_id: officialWhatsappId,
                  updatedAt: new Date()
                };

                if (officialUserId) {
                  forcePayload.user_id = officialUserId;
                }

                await CallHistory.update(forcePayload, {
                  where: {
                    id: callHistorical.id,
                    company_id: companyId,
                    source: "meta_official"
                  } as any
                });

                callHistorical.whatsapp_id = officialWhatsappId;

                if (officialUserId) {
                  callHistorical.user_id = officialUserId;
                }

                logger.info(
                  `[OFFICIAL CALL SOCKET FORCE UPDATE] callHistoryId=${callHistorical.id} call_id=${callId || "N/A"} whatsapp_id=${officialWhatsappId} user_id=${officialUserId || "N/A"}`
                );
              }
            } catch (saveError: any) {
              logger.error(
                `[OFFICIAL CALL SOCKET] Falha ao salvar CallHistory: ${saveError?.message || saveError}`
              );
            }

            io.of(String(companyId)).emit(`company-${companyId}-officialCall`, {
              action: frontendAction,
              provider: "meta_official",
              call: {
                ...call,
                companyId,
                phone,
                status,
                direction,
                call_id: callId,
                user_id: officialUserId,
                userId: officialUserId,
                whatsapp_id: officialWhatsappId,
                whatsappId: officialWhatsappId,
                backendWhatsappId: officialWhatsappId,
                apiConexaoId: apiOfficialConexaoId,
                conexaoId: apiOfficialConexaoId,
                connectionId: apiOfficialConexaoId,
                phone_number_id: data?.phone_number_id || call?.phone_number_id || null,
                display_phone_number: data?.display_phone_number || call?.display_phone_number || null,
                whatsappOficialId: data?.whatsappOficialId || apiOfficialConexaoId || null,
                callHistoryId: callHistorical?.id || null
              }
            });

            logger.info(
              `[OFFICIAL CALL SOCKET] Evento emitido para frontend company-${companyId}-officialCall call_id=${callId || "N/A"} status=${status}`
            );
          }
        } catch (error: any) {
          logger.error(
            `[OFFICIAL CALL SOCKET] Erro ao processar chamada oficial: ${error?.message || error}`
          );
        }
      });

      socket.on("heartbeat", async () => {
        if (authContext.isApiOficialToken || !authContext.userId) {
          return;
        }

        await handleHeartbeat(socket, authContext.companyId, authContext.userId);
      });

      socket.on("disconnect", async () => {
        try {
          clearHeartbeatTimeout(socket.id);

          if (authContext.isApiOficialToken || !authContext.userId) {
            return;
          }

          await User.update(
            {
              online: false,
              lastSeen: new Date()
            },
            { where: { id: authContext.userId } }
          );

          socket.broadcast.to(getCompanyRoom(authContext.companyId)).emit("user:offline", {
            userId: authContext.userId,
            lastSeen: new Date()
          });
        } catch (error) {
          logger.error("[SOCKET] Error in socket disconnect:", error);
        }
      });
    } catch (error) {
      logger.error("[SOCKET] Error on connection:", error);
      return socket.disconnect();
    }
  });

  return io;
};

export const getIO = (): SocketIO => {
  if (!io) {
    throw new AppError("Socket IO not initialized");
  }

  return io;
};

export const emitBirthdayEvents = async (companyId: number) => {
  try {
    await checkAndEmitBirthdays(companyId);
  } catch (error) {
    logger.error(
      `[RDS-SOCKET] Erro ao emitir eventos de aniversário para empresa ${companyId}:`,
      error instanceof Error ? error.message : "Unknown error"
    );

    if (error instanceof Error && error.stack) {
      logger.debug("[RDS-SOCKET] Error stack:", error.stack);
    }
  }
};
