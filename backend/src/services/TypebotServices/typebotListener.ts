import axios from "axios";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import { getJidOf } from "../WbotServices/getJidOf";
import QueueIntegrations from "../../models/QueueIntegrations";
import { proto } from "@whiskeysockets/baileys";
import { getBodyMessage } from "../WbotServices/wbotMessageListener";
import logger from "../../utils/logger";
import { isNil } from "lodash";
import UpdateTicketService from "../TicketServices/UpdateTicketService";
import moment from "moment";
import formatBody from "../../helpers/Mustache";
import { Session } from "../../libs/wbot";
import delay from "../../utils/delay";
import {
    handleIntegrationGatilho,
    handleIntegrationTransfer,
    handleIntegrationCloseTicket,
    handleIntegrationOpenTicket
} from "../IntegrationServices/IntegrationActionsService";

const getTicketFlowVariables = (ticket: Ticket): Record<string, any> => {
    const globalAny = global as any;
    const source = globalAny.flowVariables || {};
    const prefix = `${ticket.id}_`;
    const output: Record<string, any> = {};

    Object.keys(source).forEach(key => {
        if (key.startsWith(prefix)) {
            output[key.replace(prefix, "")] = source[key];
        }
    });

    return output;
};

type TypebotPayload = Partial<QueueIntegrations> & Record<string, any>;

interface Request {
    wbot: Session;
    msg?: proto.IWebMessageInfo | null;
    body?: string;
    ticket: Ticket;
    typebot: TypebotPayload;
}

const normalizeString = (value: any): string => String(value || "").trim();

const normalizeLower = (value: any): string =>
    normalizeString(value).toLocaleLowerCase();

const normalizeSlug = (value: any): string =>
    normalizeString(value).replace(/^\/+/, "").replace(/\/+$/, "");

const extractOrigin = (rawUrl: string): string => {
    const value = normalizeString(rawUrl);
    if (!value) return "";

    try {
        const parsed = new URL(value);
        return `${parsed.protocol}//${parsed.host}`;
    } catch {
        return value.replace(/\/+$/, "");
    }
};

const extractSlugFromFullUrl = (rawUrl: string): string => {
    const value = normalizeString(rawUrl);
    if (!value) return "";

    try {
        const parsed = new URL(value);
        const parts = parsed.pathname.split("/").filter(Boolean);
        if (parts.length === 0) return "";
        return normalizeSlug(parts[parts.length - 1]);
    } catch {
        const parts = value.split("/").filter(Boolean);
        if (parts.length === 0) return "";
        return normalizeSlug(parts[parts.length - 1]);
    }
};

const getTicketRemoteJid = (ticket: Ticket): string => {
    const contact: any = ticket?.contact || {};

    return normalizeString(
        contact.remoteJid ||
        contact.jid ||
        (contact.number
            ? `${String(contact.number).replace(/\D/g, "")}@s.whatsapp.net`
            : "")
    );
};

const getTicketPushName = (ticket: Ticket): string => {
    const contact: any = ticket?.contact || {};

    return normalizeString(
        contact.pushName ||
        contact.name ||
        contact.number ||
        ""
    );
};

const buildStartChatCandidates = (config: {
    apiBaseUrl: string;
    fullUrl: string;
    typebotSlug: string;
    typebotId: string;
}): string[] => {
    const urls: string[] = [];
    const seen = new Set<string>();

    const push = (value: string) => {
        const normalized = normalizeString(value).replace(/\/+$/, "");
        if (!normalized || seen.has(normalized)) return;
        seen.add(normalized);
        urls.push(normalized);
    };

    if (config.typebotSlug) {
        push(`${config.apiBaseUrl}/api/v1/typebots/${config.typebotSlug}/startChat`);
    }

    if (config.typebotId) {
        push(`${config.apiBaseUrl}/api/v1/typebots/${config.typebotId}/startChat`);
    }

    if (config.fullUrl) {
        push(`${config.fullUrl}/startChat`);
    }

    return urls;
};

const serializeRichTextNode = (node: any): string => {
    if (!node) return "";

    let text = "";

    if (node.text) {
        text = node.text;
    }

    if (Array.isArray(node.children) && node.children.length > 0) {
        text = node.children.map(serializeRichTextNode).join("");
    }

    if (node.url) {
        const label = text || node.url;
        text = `${label} ${node.url}`;
    }

    if (node.bold) {
        text = `*${text}*`;
    }

    if (node.italic) {
        text = `_${text}_`;
    }

    if (node.underline) {
        text = `~${text}~`;
    }

    return text;
};

const formatTypebotRichText = (richText: any[] = []): string => {
    if (!Array.isArray(richText) || richText.length === 0) return "";

    return richText
        .map(block => serializeRichTextNode(block))
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim();
};

const persistFlowVariable = async (
    ticket: Ticket,
    variableName: string,
    value: any
): Promise<void> => {
    const normalizedName = normalizeString(variableName);
    if (!normalizedName) return;

    const globalAny = global as any;
    if (!globalAny.flowVariables) {
        globalAny.flowVariables = {};
    }

    globalAny.flowVariables[normalizedName] = value;
    globalAny.flowVariables[`${ticket.id}_${normalizedName}`] = value;

    logger.info(
        `[TYPEBOT] Variável persistida: ${normalizedName}="${String(value)}" (ticket ${ticket.id})`
    );
};

const isFlowbuilderTypebot = (ticket: Ticket, typebot: TypebotPayload): boolean => {
    const dataWebhook: any = ticket.dataWebhook || {};

    return (
        dataWebhook?.type === "typebot" ||
        !!dataWebhook?.flowContinuation ||
        !!dataWebhook?.waitingTypebot ||
        !isNil(typebot?.waitForResponse) ||
        !isNil(typebot?.variableName) ||
        !isNil(typebot?.fullUrl)
    );
};

const resolveTypebotConfig = (typebot: TypebotPayload) => {
    const rawFullUrl =
        typebot.fullUrl ||
        typebot.url ||
        "";

    const rawBaseUrl =
        typebot.urlN8N ||
        typebot.typebotUrl ||
        typebot.urlBase ||
        typebot.typebot ||
        rawFullUrl ||
        "https://typebot.io";

    const typebotSlug = normalizeSlug(
        typebot.typebotSlug ||
        typebot.botSlug ||
        typebot.slug ||
        extractSlugFromFullUrl(rawFullUrl)
    );

    const typebotId = normalizeString(
        typebot.typebotId || typebot.botId || typebot.idTypebot
    );

    const apiBaseUrl = extractOrigin(rawBaseUrl) || "https://typebot.io";

    const fullUrl = normalizeString(rawFullUrl)
        ? normalizeString(rawFullUrl).replace(/\/+$/, "")
        : typebotSlug
            ? `${apiBaseUrl}/${typebotSlug}`
            : apiBaseUrl;

    return {
        url: apiBaseUrl,
        apiBaseUrl,
        fullUrl,
        typebotSlug,
        typebotId,
        typebotExpires: Number(
            typebot.typebotExpires ??
            typebot.expireMinutes ??
            typebot.sessionExpiryMinutes ??
            0
        ) || 0,
        typebotKeywordFinish:
            normalizeString(
                typebot.typebotKeywordFinish ||
                typebot.keywordFinish ||
                typebot.finishKeyword
            ) || "#",
        typebotKeywordRestart:
            normalizeString(
                typebot.typebotKeywordRestart ||
                typebot.keywordRestart ||
                typebot.restartKeyword
            ) || "00",
        typebotUnknownMessage:
            normalizeString(
                typebot.typebotUnknownMessage ||
                typebot.invalidOptionMessage ||
                typebot.unknownMessage
            ) || "Opção inválida, por favor envie #",
        typebotDelayMessage: Number(
            typebot.typebotDelayMessage ??
            typebot.messageInterval ??
            typebot.messageDelay ??
            1000
        ) || 1000,
        typebotRestartMessage:
            normalizeString(
                typebot.typebotRestartMessage ||
                typebot.restartMessage
            ) || "Vamos começar novamente?",
        variableName: normalizeString(typebot.variableName),
        waitForResponse: Boolean(typebot.waitForResponse),
        prefilledVariables:
            typeof typebot.prefilledVariables === "object" && typebot.prefilledVariables
                ? typebot.prefilledVariables
                : {}
    };
};

const startTypebotSession = async ({
    msg,
    typebotConfig,
    number,
    ticket
}: {
    msg?: proto.IWebMessageInfo | null;
    typebotConfig: ReturnType<typeof resolveTypebotConfig>;
    number: string;
    ticket: Ticket;
}) => {
    const flowVariables = getTicketFlowVariables(ticket);

    const requestData = JSON.stringify({
        isStreamEnabled: true,
        message: "string",
        resultId: "string",
        isOnlyRegistering: false,
        prefilledVariables: {
            ...flowVariables,
            ...(typebotConfig.prefilledVariables || {}),
            number,
            pushName: normalizeString(msg?.pushName || getTicketPushName(ticket)),
            remoteJid: getTicketRemoteJid(ticket)
        }
    });

    const candidates = buildStartChatCandidates(typebotConfig);
    let lastError: any = null;

    logger.info(
        `[TYPEBOT] startTypebotSession -> ticket=${ticket.id}, candidates=${JSON.stringify(
            candidates
        )}`
    );

    for (const endpoint of candidates) {
        try {
            logger.info(`[TYPEBOT] Tentando iniciar sessão em: ${endpoint}`);

            const response = await axios.request({
                method: "post",
                maxBodyLength: Infinity,
                url: endpoint,
                headers: {
                    "Content-Type": "application/json",
                    Accept: "application/json"
                },
                data: requestData
            });

            logger.info(
                `[TYPEBOT] Sessão iniciada com sucesso em: ${endpoint} | sessionId=${response.data?.sessionId || "N/A"}`
            );
            return response.data;
        } catch (error: any) {
            lastError = error;
            logger.warn(
                `[TYPEBOT] Falha ao iniciar sessão em ${endpoint}: ${error?.response?.data?.message ||
                error?.message ||
                "erro desconhecido"
                }`
            );
        }
    }

    throw lastError || new Error("Não foi possível iniciar sessão no Typebot");
};

const continueTypebotSession = async ({
    sessionId,
    body,
    typebotConfig,
    ticketId
}: {
    sessionId: string;
    body: string;
    typebotConfig: ReturnType<typeof resolveTypebotConfig>;
    ticketId: number;
}) => {
    const requestData = JSON.stringify({
        message: body
    });

    logger.info(
        `[TYPEBOT] continueTypebotSession -> ticket=${ticketId}, sessionId=${sessionId}, body="${body}"`
    );

    return axios.request({
        method: "post",
        maxBodyLength: Infinity,
        url: `${typebotConfig.apiBaseUrl}/api/v1/sessions/${sessionId}/continueChat`,
        headers: {
            "Content-Type": "application/json",
            Accept: "application/json"
        },
        data: requestData
    });
};

const finalizeFlowbuilderTypebot = async ({
    ticket,
    variableName,
    value
}: {
    ticket: Ticket;
    variableName?: string;
    value?: string;
}): Promise<void> => {
    if (variableName && !isNil(value) && String(value).trim() !== "") {
        await persistFlowVariable(ticket, variableName, value);
    }

    logger.info(
        `[TYPEBOT] Finalizando Typebot FlowBuilder -> ticket=${ticket.id}, sessionIdAnterior=${ticket.typebotSessionId || "null"}`
    );

    await ticket.update({
        typebotSessionId: null,
        typebotSessionTime: null,
        typebotStatus: false,
        useIntegration: false,
        integrationId: null,
        dataWebhook: null
    });
};

const typebotListener = async ({
    wbot,
    msg,
    body: explicitBody,
    ticket,
    typebot
}: Request): Promise<void> => {
    // Buscar o contato diretamente no banco para garantir que LID,
    // remoteJid e number estejam atualizados, mesmo quando ticket.contact
    // não foi carregado completamente pelo Flowbuilder.
    const storedContact = await Contact.findByPk(ticket.contactId);

    let remoteJid = "";

    if (storedContact) {
        remoteJid = getJidOf(storedContact);
    } else {
        remoteJid = normalizeString(
            msg?.key?.remoteJid || getTicketRemoteJid(ticket)
        );
    }

    if (!remoteJid) {
        logger.error(`[TYPEBOT] remoteJid não encontrado para o ticket ${ticket?.id}`);
        return;
    }

    logger.info(
        `[TYPEBOT-LID] Destinatário resolvido para ticket ${ticket.id}: ${remoteJid}`
    );

    if (remoteJid === "status@broadcast") return;

    const number = remoteJid.replace(/\D/g, "");

    const body = normalizeString(
        explicitBody !== undefined && explicitBody !== null
            ? explicitBody
            : msg
                ? getBodyMessage(msg) || ""
                : ""
    );

    const isFlowbuilderMode = isFlowbuilderTypebot(ticket, typebot);

    const typebotConfig = resolveTypebotConfig(typebot);

    const {
        url,
        fullUrl,
        typebotSlug,
        typebotId,
        typebotExpires,
        typebotKeywordFinish,
        typebotKeywordRestart,
        typebotUnknownMessage,
        typebotDelayMessage,
        typebotRestartMessage,
        variableName
    } = typebotConfig;

    logger.info(
        `[TYPEBOT] Ticket ${ticket.id} | mode=${isFlowbuilderMode ? "flowbuilder" : "legacy"
        } | base=${url} | fullUrl=${fullUrl} | slug=${typebotSlug || "N/A"} | body="${body}"`
    );

    let sessionId = normalizeString(ticket.typebotSessionId);
    let dataStart: any = null;
    let status = ticket.typebotStatus !== false;

    logger.info(
        `[TYPEBOT] Estado inicial -> ticket=${ticket.id}, sessionId=${sessionId || "null"}, typebotStatus=${String(ticket.typebotStatus)}, flowWebhook=${String(ticket.flowWebhook)}, lastFlowId=${String(ticket.lastFlowId || "")}`
    );

    try {
        const now = moment();

        if (
            typebotExpires > 0 &&
            ticket.typebotSessionTime &&
            moment(ticket.typebotSessionTime).isBefore(
                now.clone().subtract(typebotExpires, "minutes")
            )
        ) {
            logger.info(
                `[TYPEBOT] Sessão expirada para ticket ${ticket.id}, reiniciando`
            );

            await ticket.update({
                typebotSessionId: null,
                typebotSessionTime: null,
                typebotStatus: true,
                isBot: true
            });

            await ticket.reload();
            sessionId = "";
            status = true;
        }

        if (!sessionId) {
            logger.info(
                `[TYPEBOT] ticket ${ticket.id} sem sessionId -> iniciando nova sessão`
            );

            dataStart = await startTypebotSession({
                msg,
                typebotConfig,
                number,
                ticket
            });

            sessionId = normalizeString(dataStart?.sessionId);
            status = true;

            logger.info(
                `[TYPEBOT] Salvando nova sessão no ticket ${ticket.id} -> sessionId=${sessionId || "null"}`
            );

            await ticket.update({
                typebotSessionId: sessionId,
                typebotStatus: true,
                useIntegration: true,
                integrationId: typebot.id || ticket.integrationId || null,
                typebotSessionTime: moment().toDate()
            });

            await ticket.reload();

            logger.info(
                `[TYPEBOT] Ticket ${ticket.id} após salvar sessão -> sessionId=${ticket.typebotSessionId || "null"}, typebotStatus=${String(ticket.typebotStatus)}`
            );
        } else {
            logger.info(
                `[TYPEBOT] Reaproveitando sessão existente -> ticket=${ticket.id}, sessionId=${sessionId}`
            );
        }

        if (!status || !sessionId) {
            logger.warn(
                `[TYPEBOT] Sessão inválida para ticket ${ticket.id} | status=${String(status)} | sessionId=${sessionId || "null"}`
            );
            return;
        }

        const bodyLower = normalizeLower(body);
        const finishLower = normalizeLower(typebotKeywordFinish);
        const restartLower = normalizeLower(typebotKeywordRestart);

        if (body && bodyLower === restartLower) {
            logger.info(`[TYPEBOT] Palavra de reinício detectada no ticket ${ticket.id}`);

            await ticket.update({
                isBot: true,
                typebotSessionId: null,
                typebotSessionTime: null,
                typebotStatus: true
            });

            await ticket.reload();

            if (typebotRestartMessage) {
                const sentMessage = await wbot.sendMessage(remoteJid, {
                    text: formatBody(typebotRestartMessage, ticket)
                });
                wbot.store(sentMessage);
            }

            logger.info(`[TYPEBOT] Sessão reiniciada para ticket ${ticket.id}`);
            return;
        }

        if (body && bodyLower === finishLower) {
            logger.info(`[TYPEBOT] Palavra de finalização detectada no ticket ${ticket.id}`);

            if (isFlowbuilderMode) {
                await finalizeFlowbuilderTypebot({
                    ticket,
                    variableName
                });

                logger.info(
                    `[TYPEBOT] Typebot do FlowBuilder finalizado por palavra-chave no ticket ${ticket.id}`
                );
                return;
            }

            if (typebot.enableCloseTicket) {
                await handleIntegrationCloseTicket(typebot as QueueIntegrations, ticket);
                return;
            }

            if (typebot.enableTransfer) {
                await handleIntegrationTransfer(typebot as QueueIntegrations, ticket);
                return;
            }

            await UpdateTicketService({
                ticketData: {
                    status: "closed",
                    useIntegration: false,
                    integrationId: null,
                    sendFarewellMessage: true
                },
                ticketId: ticket.id,
                companyId: ticket.companyId
            });

            return;
        }

        if (variableName && body && bodyLower !== finishLower && bodyLower !== restartLower) {
            await persistFlowVariable(ticket, variableName, body);
        }

        let messages = dataStart?.messages || [];
        let input = dataStart?.input;
        let clientSideActions = dataStart?.clientSideActions;

        logger.info(
            `[TYPEBOT] Pré-continue -> ticket=${ticket.id}, dataStartMessages=${Array.isArray(dataStart?.messages) ? dataStart.messages.length : "N/A"}, input=${input?.type || "null"}`
        );

        if (!dataStart || (Array.isArray(dataStart?.messages) && dataStart.messages.length === 0)) {
            logger.info(
                `[TYPEBOT] Chamando continueChat -> ticket=${ticket.id}, sessionId=${sessionId}, body="${body}"`
            );

            const requestContinue = await continueTypebotSession({
                sessionId,
                body,
                typebotConfig,
                ticketId: ticket.id
            });

            messages = requestContinue.data?.messages || [];
            input = requestContinue.data?.input;
            clientSideActions = requestContinue.data?.clientSideActions;

            logger.info(
                `[TYPEBOT] continueChat OK -> ticket=${ticket.id}, messages=${messages?.length || 0}, input=${input?.type || "null"}, clientActions=${clientSideActions?.length || 0}`
            );
        } else {
            logger.info(
                `[TYPEBOT] Usando mensagens retornadas no startChat -> ticket=${ticket.id}, messages=${messages?.length || 0}`
            );
        }

        await ticket.update({
            typebotSessionTime: moment().toDate()
        });

        if ((!messages || messages.length === 0) && !input) {
            logger.info(
                `[TYPEBOT] Sem mensagens e sem input - fluxo Typebot concluído para ticket ${ticket.id}`
            );

            if (isFlowbuilderMode) {
                await finalizeFlowbuilderTypebot({
                    ticket,
                    variableName,
                    value: body
                });
                return;
            }

            await ticket.update({
                typebotSessionId: null,
                typebotSessionTime: null,
                typebotStatus: false,
                useIntegration: false,
                integrationId: null
            });

            return;
        }

        if ((!messages || messages.length === 0) && input) {
            logger.info(
                `[TYPEBOT] Nenhuma mensagem, mas há input pendente -> ticket=${ticket.id}, inputType=${input?.type}`
            );
            messages = [];
        }

        if ((!messages || messages.length === 0) && !input && typebotUnknownMessage) {
            logger.info(`[TYPEBOT] Enviando unknownMessage para ticket ${ticket.id}`);

            const sentMessage = await wbot.sendMessage(remoteJid, {
                text: formatBody(typebotUnknownMessage, ticket)
            });
            wbot.store(sentMessage);
            return;
        }

        for (const message of messages || []) {
            logger.info(
                `[TYPEBOT] Processando message.type=${message?.type || "unknown"} para ticket ${ticket.id}`
            );

            if (message.type === "text") {
                let formattedText = formatTypebotRichText(message?.content?.richText || []);

                if (!formattedText) {
                    formattedText = normalizeString(message?.content?.text || "");
                }

                if (formattedText === "Invalid message. Please, try again.") {
                    formattedText = typebotUnknownMessage;
                }

                if (formattedText.startsWith("#")) {
                    const gatilho = formattedText.replace(/^#/, "");

                    const handled = await handleIntegrationGatilho(
                        gatilho,
                        typebot as QueueIntegrations,
                        ticket
                    );

                    if (handled) return;

                    try {
                        const jsonGatilho = JSON.parse(gatilho);

                        if (
                            jsonGatilho.stopBot &&
                            isNil(jsonGatilho.userId) &&
                            isNil(jsonGatilho.queueId)
                        ) {
                            if (isFlowbuilderMode) {
                                await finalizeFlowbuilderTypebot({
                                    ticket,
                                    variableName,
                                    value: body
                                });
                            } else {
                                await ticket.update({
                                    useIntegration: false,
                                    isBot: false
                                });
                            }

                            return;
                        }

                        if (
                            !isNil(jsonGatilho.queueId) &&
                            jsonGatilho.queueId > 0 &&
                            isNil(jsonGatilho.userId)
                        ) {
                            await UpdateTicketService({
                                ticketData: {
                                    queueId: jsonGatilho.queueId,
                                    isBot: false,
                                    useIntegration: false,
                                    integrationId: null
                                },
                                ticketId: ticket.id,
                                companyId: ticket.companyId
                            });

                            return;
                        }

                        if (
                            !isNil(jsonGatilho.queueId) &&
                            jsonGatilho.queueId > 0 &&
                            !isNil(jsonGatilho.userId) &&
                            jsonGatilho.userId > 0
                        ) {
                            await UpdateTicketService({
                                ticketData: {
                                    queueId: jsonGatilho.queueId,
                                    userId: jsonGatilho.userId,
                                    isBot: false,
                                    useIntegration: false,
                                    integrationId: null
                                },
                                ticketId: ticket.id,
                                companyId: ticket.companyId
                            });

                            return;
                        }

                        if (
                            !isNil(jsonGatilho.openTicketQueueId) ||
                            !isNil(jsonGatilho.openTicketUserId)
                        ) {
                            await handleIntegrationOpenTicket(
                                typebot as QueueIntegrations,
                                ticket
                            );
                            return;
                        }
                    } catch (err) {
                        logger.warn(`[TYPEBOT] Gatilho não é JSON válido: ${gatilho}`);
                    }
                }

                if (formattedText) {
                    await wbot.presenceSubscribe(remoteJid);
                    await wbot.sendPresenceUpdate("composing", remoteJid);
                    await delay(typebotDelayMessage);
                    await wbot.sendPresenceUpdate("paused", remoteJid);

                    const sentMessage = await wbot.sendMessage(remoteJid, {
                        text: formatBody(formattedText, ticket)
                    });
                    wbot.store(sentMessage);

                    logger.info(
                        `[TYPEBOT] Texto enviado para ticket ${ticket.id}: "${formattedText.slice(0, 120)}"`
                    );
                }
            }

            if (message.type === "audio") {
                await wbot.presenceSubscribe(remoteJid);
                await wbot.sendPresenceUpdate("composing", remoteJid);
                await delay(typebotDelayMessage);
                await wbot.sendPresenceUpdate("paused", remoteJid);

                const sentMessage = await wbot.sendMessage(remoteJid, {
                    audio: { url: message.content.url },
                    mimetype: "audio/mp4",
                    ptt: true
                });
                wbot.store(sentMessage);

                logger.info(`[TYPEBOT] Áudio enviado para ticket ${ticket.id}`);
            }

            if (message.type === "image") {
                await wbot.presenceSubscribe(remoteJid);
                await wbot.sendPresenceUpdate("composing", remoteJid);
                await delay(typebotDelayMessage);
                await wbot.sendPresenceUpdate("paused", remoteJid);

                const sentMessage = await wbot.sendMessage(remoteJid, {
                    image: { url: message.content.url }
                });
                wbot.store(sentMessage);

                logger.info(`[TYPEBOT] Imagem enviada para ticket ${ticket.id}`);
            }

            if (message.type === "video") {
                await wbot.presenceSubscribe(remoteJid);
                await wbot.sendPresenceUpdate("composing", remoteJid);
                await delay(typebotDelayMessage);
                await wbot.sendPresenceUpdate("paused", remoteJid);

                const sentMessage = await wbot.sendMessage(remoteJid, {
                    video: { url: message.content.url }
                });
                wbot.store(sentMessage);

                logger.info(`[TYPEBOT] Vídeo enviado para ticket ${ticket.id}`);
            }

            if (clientSideActions) {
                for (const action of clientSideActions) {
                    if (action?.lastBubbleBlockId === message.id && action.wait) {
                        logger.info(
                            `[TYPEBOT] Delay clientSideAction de ${action.wait.secondsToWaitFor}s para ticket ${ticket.id}`
                        );
                        await delay(action.wait.secondsToWaitFor * 1000);
                    }
                }
            }
        }

        if (input) {
            logger.info(
                `[TYPEBOT] Input pendente detectado -> ticket=${ticket.id}, inputType=${input.type}`
            );

            if (input.type === "choice input") {
                let formattedChoices = "";
                const items = input.items || [];

                for (const item of items) {
                    formattedChoices += `▶️ ${item.content}\n`;
                }

                formattedChoices = formattedChoices.replace(/\n$/, "");

                if (formattedChoices) {
                    await wbot.presenceSubscribe(remoteJid);
                    await wbot.sendPresenceUpdate("composing", remoteJid);
                    await delay(typebotDelayMessage);
                    await wbot.sendPresenceUpdate("paused", remoteJid);

                    const sentMessage = await wbot.sendMessage(remoteJid, {
                        text: formattedChoices
                    });
                    wbot.store(sentMessage);

                    logger.info(
                        `[TYPEBOT] Choice input enviado para ticket ${ticket.id}`
                    );
                }
            }
        }

        logger.info(
            `[TYPEBOT] Final do processamento -> ticket=${ticket.id}, sessionId=${sessionId}, messages=${messages?.length || 0}, input=${input?.type || "null"}`
        );
    } catch (error: any) {
        logger.info("Error on typebotListener: ", error);
        logger.error(
            `[TYPEBOT] Erro detalhado ticket ${ticket.id}: ${error?.response?.data?.message ||
            error?.response?.data ||
            error?.message ||
            "erro desconhecido"
            }`
        );

        await ticket.update({
            typebotSessionId: null
        });

        throw error;
    }
};

export default typebotListener;