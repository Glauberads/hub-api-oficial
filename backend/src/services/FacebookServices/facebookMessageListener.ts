// @ts-nocheck
// Recuperado do JavaScript compilado funcional em 15/08/2026.
"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || function (mod) {
    if (mod && mod.__esModule) return mod;
    var result = {};
    if (mod != null) for (var k in mod) if (k !== "default" && Object.prototype.hasOwnProperty.call(mod, k)) __createBinding(result, mod, k);
    __setModuleDefault(result, mod);
    return result;
};
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.handleChange = exports.handleMessage = exports.verifyQuotedMessage = exports.verifyMessageMedia = exports.verifyMessageFace = void 0;
const logger_1 = __importDefault(require("../../utils/logger"));
const fs_1 = require("fs");
const fs_2 = __importDefault(require("fs"));
const axios_1 = __importDefault(require("axios"));
const moment_1 = __importDefault(require("moment"));
const path_1 = require("path");
const sequelize_1 = require("sequelize");
const Ticket_1 = __importDefault(require("../../models/Ticket"));
const CreateOrUpdateContactService_1 = __importDefault(require("../ContactServices/CreateOrUpdateContactService"));
const CreateMessageService_1 = __importDefault(require("../MessageServices/CreateMessageService"));
const FindOrCreateTicketService_1 = __importDefault(require("../TicketServices/FindOrCreateTicketService"));
const graphAPI_1 = require("./graphAPI");
const Whatsapp_1 = __importDefault(require("../../models/Whatsapp"));
const UpdateTicketService_1 = __importDefault(require("../TicketServices/UpdateTicketService"));
const ShowWhatsAppService_1 = __importDefault(require("../WhatsappService/ShowWhatsAppService"));
const Mustache_1 = __importDefault(require("../../helpers/Mustache"));
const Queue_1 = __importDefault(require("../../models/Queue"));
const Chatbot_1 = __importDefault(require("../../models/Chatbot"));
const Message_1 = __importDefault(require("../../models/Message"));
const ChatbotListenerFacebook_1 = require("../WbotServices/ChatbotListenerFacebook");
const lodash_1 = require("lodash");
const FindOrCreateATicketTrakingService_1 = __importDefault(require("../TicketServices/FindOrCreateATicketTrakingService"));
const wbotMessageListener_1 = require("../WbotServices/wbotMessageListener");
const CompaniesSettings_1 = __importDefault(require("../../models/CompaniesSettings"));
const sendFacebookMessage_1 = require("./sendFacebookMessage");
const async_mutex_1 = require("async-mutex");
const TicketTag_1 = __importDefault(require("../../models/TicketTag"));
const Tag_1 = __importDefault(require("../../models/Tag"));
const ShowQueueIntegrationService_1 = __importDefault(require("../QueueIntegrationServices/ShowQueueIntegrationService"));
const FlowBuilder_1 = require("../../models/FlowBuilder");
const FlowCampaign_1 = require("../../models/FlowCampaign");
const ActionsWebhookFacebookService_1 = require("./WebhookFacebookServices/ActionsWebhookFacebookService");
const verifyContact = async (msgContact, token, companyId) => {
    if (!msgContact)
        return null;
    // Comentários nem sempre incluem a foto no webhook.
    // Enviar vazio permite preservar a foto atual no serviço de contatos.
    let profilePicUrl = "";
    if (msgContact.profile_pic) {
        profilePicUrl = msgContact.profile_pic;
    }
    const contactData = {
        name: msgContact?.name || `${msgContact?.first_name} ${msgContact?.last_name}`,
        number: msgContact.id,
        profilePicUrl,
        isGroup: false,
        companyId: companyId,
        channel: token.channel,
        whatsappId: token.id
    };
    const contact = (0, CreateOrUpdateContactService_1.default)(contactData);
    return contact;
};
const verifyMessageFace = async (msg, body, ticket, contact, fromMe = false) => {
    const quotedMsg = await (0, exports.verifyQuotedMessage)(msg);
    // ✅ CORRIGIDO: Garantir que wid sempre tenha um valor válido
    const wid = msg?.mid || msg?.message_id || `fb-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    if (!wid) {
        console.error("[FACEBOOK] ⚠️ Erro: wid está undefined!", {
            msg: msg,
            hasMid: !!msg?.mid,
            hasMessageId: !!msg?.message_id
        });
    }
    // ✅ NOVO: Verificar se mensagem já existe antes de criar (evitar duplicação)
    if (fromMe && wid && wid !== `fb-msg-${Date.now()}`) {
        const existingMessage = await Message_1.default.findOne({
            where: {
                wid: wid,
                companyId: ticket.companyId,
                fromMe: true,
                ticketId: ticket.id
            }
        });
        if (existingMessage) {
            console.log(`[FACEBOOK] ⚠️ Mensagem já existe (wid: ${wid}) - ignorando duplicata`);
            return;
        }
    }
    const messageData = {
        wid: wid,
        ticketId: ticket.id,
        contactId: fromMe ? undefined : msg?.is_echo ? undefined : contact.id,
        body: msg?.text || body,
        fromMe: fromMe ? fromMe : msg?.is_echo ? true : false,
        read: fromMe ? fromMe : msg?.is_echo,
        quotedMsgId: quotedMsg?.id,
        ack: 3,
        dataJson: JSON.stringify(msg),
        channel: ticket.channel
    };
    await (0, CreateMessageService_1.default)({ messageData, companyId: ticket.companyId });
    // Verificar e cancelar Floups se contato enviou mensagem e condições de parada estão ativas
    if (!fromMe && !msg?.is_echo && contact?.id) {
        try {
            const FloupService = (await Promise.resolve().then(() => __importStar(require('../../plugins/floup/service')))).default;
            await FloupService.verificarECancelarFloupsAoReceberMensagem(ticket.id, contact.id, ticket.companyId, msg?.text || body || '');
        }
        catch (floupError) {
            // Log mas não interrompe o fluxo se houver erro na verificação de Floup
            console.warn(`[FLOUP] Erro ao verificar condições de parada (Facebook):`, floupError);
        }
    }
    // await ticket.update({
    //   lastMessage: msg.text
    // });
};
exports.verifyMessageFace = verifyMessageFace;
const verifyMessageMedia = async (msg, ticket, contact, fromMe = false) => {
    const mediaUrl = msg?.attachments?.[0]?.payload?.url;

    // Eventos is_echo de Media Template possuem attachment_id,
    // mas não fornecem uma URL direta para download.
    if (!mediaUrl || typeof mediaUrl !== "string") {
        console.warn(
            "[FACEBOOK] Anexo sem URL direta ignorado:",
            {
                mid: msg?.mid || msg?.message_id,
                isEcho: Boolean(msg?.is_echo),
                attachmentType: msg?.attachments?.[0]?.type,
                templateType: msg?.attachments?.[0]?.payload?.template_type
            }
        );
        return;
    }

    const { data } = await axios_1.default.get(mediaUrl, {
        responseType: "arraybuffer"
    });
    // eslint-disable-next-line no-eval
    const { fileTypeFromBuffer } = await eval('import("file-type")');
    const type = await fileTypeFromBuffer(data);
    const fileName = `${new Date().getTime()}.${type.ext}`;
    const folder = `public/company${ticket.companyId}`;
    if (!fs_2.default.existsSync(folder)) {
        fs_2.default.mkdirSync(folder);
        fs_2.default.chmodSync(folder, 0o777);
    }
    (0, fs_1.writeFileSync)((0, path_1.join)(__dirname, "..", "..", "..", folder, fileName), data, "base64");
    // ✅ CORRIGIDO: Garantir que wid sempre tenha um valor válido
    const wid = msg.mid || msg.message_id || `fb-media-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const messageData = {
        wid: wid,
        ticketId: ticket.id,
        contactId: fromMe ? undefined : msg.is_echo ? undefined : contact.id,
        body: msg.text || fileName,
        fromMe: fromMe ? fromMe : msg.is_echo ? true : false,
        mediaType: msg.attachments[0].type,
        mediaUrl: fileName,
        read: fromMe ? fromMe : msg.is_echo,
        quotedMsgId: null,
        ack: 3,
        dataJson: JSON.stringify(msg),
        channel: ticket.channel
    };
    await (0, CreateMessageService_1.default)({ messageData, companyId: ticket.companyId });
    // await ticket.update({
    //   lastMessage: msg.text
    // });
};
exports.verifyMessageMedia = verifyMessageMedia;
const verifyQuotedMessage = async (msg) => {
    if (!msg)
        return null;
    const quoted = msg?.reply_to?.mid;
    if (!quoted)
        return null;
    const quotedMsg = await Message_1.default.findOne({
        where: { wid: quoted }
    });
    if (!quotedMsg)
        return null;
    return quotedMsg;
};
exports.verifyQuotedMessage = verifyQuotedMessage;
const flowBuilderQueue = async (ticket, message, getSession, companyId, contact, isFirstMsg) => {
    // ✅ CORRIGIDO: Se o ticket está "open" (aceito pelo atendente), parar o fluxo
    if (ticket.status === "open") {
        console.log(`[FLOW QUEUE - FACEBOOK] ⚠️ Ticket ${ticket.id} está OPEN - Parando fluxo`);
        return;
    }
    // Verificar se existe fluxo interrompido válido
    if (!ticket.flowStopped || !ticket.lastFlowId) {
        console.log("[FLOW QUEUE - FACEBOOK] Ticket sem fluxo interrompido ou ID de último fluxo");
        return;
    }
    try {
        const flow = await FlowBuilder_1.FlowBuilderModel.findOne({
            where: {
                id: ticket.flowStopped,
                company_id: companyId,
                active: true // ✅ CORRIGIDO: Verificar se flow está ativo
            }
        });
        if (!flow) {
            console.error(`[FLOW QUEUE - FACEBOOK] ❌ Fluxo ${ticket.flowStopped} não encontrado, inativo ou não pertence à empresa ${companyId}`);
            return;
        }
        const nodes = flow.flow["nodes"];
        const connections = flow.flow["connections"];
        // ✅ CORRIGIDO: Validar estrutura do flow
        if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
            console.error(`[FLOW QUEUE - FACEBOOK] ❌ Fluxo ${flow.id} não possui nós válidos`);
            return;
        }
        const mountDataContact = {
            number: contact.number,
            name: contact.name,
            email: contact.email
        };
        console.log("[FLOW QUEUE - FACEBOOK] ======================================");
        console.log("[FLOW QUEUE - FACEBOOK] |         flowBuilderQueue           |");
        console.log(`[FLOW QUEUE - FACEBOOK] Ticket: ${ticket.id}, Flow: ${flow.id}`);
        console.log("[FLOW QUEUE - FACEBOOK] ======================================");
        if (ticket.flowWebhook) {
            await (0, ActionsWebhookFacebookService_1.ActionsWebhookFacebookService)(getSession, parseInt(ticket.flowStopped), ticket.companyId, nodes, connections, ticket.lastFlowId, null, "", "", message.text, ticket.id, mountDataContact);
        }
    }
    catch (error) {
        console.error(`[FLOW QUEUE - FACEBOOK] ❌ Erro ao processar flowBuilderQueue para ticket ${ticket.id}:`, error);
    }
};
const flowbuilderIntegration = async (ticket, companyId, isFirstMsg, getSession, contact, message) => {
    const body = message?.text || ticket.lastMessage || "";
    console.log("[FLOW BUILDER - FACEBOOK] ======================================");
    console.log("[FLOW BUILDER - FACEBOOK] |      flowbuilderIntegration        |");
    console.log(`[FLOW BUILDER - FACEBOOK] Ticket: ${ticket.id}, Mensagem: "${body}"`);
    console.log("[FLOW BUILDER - FACEBOOK] ======================================");
    // ✅ CORRIGIDO: Verificar se ticket está em estado válido
    if (ticket.status !== "pending") {
        console.log(`[FLOW BUILDER - FACEBOOK] Ticket ${ticket.id} não está em status "pending" (status: ${ticket.status}), ignorando flow`);
        return;
    }
    // ✅ CORRIGIDO: Verificar se já está em fluxo ativo
    if (ticket.flowWebhook && ticket.lastFlowId) {
        console.log(`[FLOW BUILDER - FACEBOOK] Ticket ${ticket.id} já está em fluxo ativo (lastFlowId: ${ticket.lastFlowId}), ignorando nova execução`);
        return;
    }
    await ticket.update({
        lastMessage: body,
    });
    // ✅ CORRIGIDO: Contar mensagens do cliente para verificar se é primeira interação
    const messageCount = await Message_1.default.count({
        where: {
            ticketId: ticket.id,
            fromMe: false // Apenas mensagens do cliente
        }
    });
    // ✅ CORRIGIDO: Verificar se o contato é novo na base
    const isNewContact = contact.createdAt &&
        Math.abs(new Date().getTime() - new Date(contact.createdAt).getTime()) < 5000; // 5 segundos de tolerância
    console.log(`[FLOW BUILDER - FACEBOOK] Ticket ${ticket.id} - Mensagens do cliente: ${messageCount}`);
    console.log(`[FLOW BUILDER - FACEBOOK] Contato ${contact.id} - Novo na base: ${isNewContact}, Criado em: ${contact.createdAt}`);
    // ✅ CORRIGIDO: Buscar campanhas para verificar se há match
    const listPhrase = await FlowCampaign_1.FlowCampaignModel.findAll({
        where: {
            companyId: ticket.companyId,
            status: true
        }
    });
    // ✅ CORRIGIDO: Verificar se alguma campanha faz match com a mensagem
    const matchingCampaign = listPhrase.find(campaign => {
        try {
            if (!campaign.status) {
                return false;
            }
            // Usar método que considera a conexão específica
            const matches = campaign.matchesMessage(body, getSession.id);
            if (matches) {
                console.log(`[FLOW BUILDER - FACEBOOK] ✅ MATCH encontrado! Campanha "${campaign.name}" (ID: ${campaign.id}) para mensagem: "${body}"`);
            }
            return matches;
        }
        catch (error) {
            console.error(`[FLOW BUILDER - FACEBOOK] Erro ao verificar match da campanha ${campaign.id}:`, error);
            return false;
        }
    });
    // ✅ CORRIGIDO: Se houver match de campanha, executar campanha (prioridade máxima)
    if (matchingCampaign) {
        console.log(`[FLOW BUILDER - FACEBOOK] 🚀 EXECUTANDO CAMPANHA! Campanha: ${matchingCampaign.name} (ID: ${matchingCampaign.id}) | Fluxo: ${matchingCampaign.flowId} | Conexão: ${getSession.id} | Ticket: ${ticket.id}`);
        try {
            const flow = await FlowBuilder_1.FlowBuilderModel.findOne({
                where: {
                    id: matchingCampaign.flowId,
                    company_id: companyId,
                    active: true
                }
            });
            if (!flow) {
                console.error(`[FLOW BUILDER - FACEBOOK] ❌ Fluxo ${matchingCampaign.flowId} não encontrado, inativo ou não pertence à empresa ${companyId}`);
                return;
            }
            const nodes = flow.flow["nodes"];
            const connections = flow.flow["connections"];
            if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
                console.error(`[FLOW BUILDER - FACEBOOK] ❌ Fluxo ${flow.id} não possui nós válidos`);
                return;
            }
            const mountDataContact = {
                number: contact.number,
                name: contact.name,
                email: contact.email
            };
            // ✅ NOVO: Log para verificar contato e ticket
            console.log(`[FLOW BUILDER - FACEBOOK] 📋 Informações do contato:`);
            console.log(`[FLOW BUILDER - FACEBOOK] - Contact ID: ${contact.id}`);
            console.log(`[FLOW BUILDER - FACEBOOK] - Contact Number (PSID): ${contact.number}`);
            console.log(`[FLOW BUILDER - FACEBOOK] - Contact Name: ${contact.name}`);
            console.log(`[FLOW BUILDER - FACEBOOK] - Ticket ID: ${ticket.id}`);
            console.log(`[FLOW BUILDER - FACEBOOK] - Ticket Channel: ${ticket.channel}`);
            // Marcar ticket como em fluxo
            await ticket.update({
                flowWebhook: true,
                flowStopped: null,
                lastFlowId: null,
                hashFlowId: null,
                dataWebhook: null,
                isBot: true,
                status: "pending"
            });
            // ✅ NOVO: Verificar se o ticket foi criado a partir de um comentário
            // Isso é importante para usar MESSAGE_TAG ao enviar mensagens diretas
            const isFromComment = message?.attachments?.[0]?.type === "facebookPostPreview" ||
                body.includes("|https://www.facebook.com/") ||
                body.includes("|https://www.instagram.com/");
            // ✅ NOVO: Extrair commentId do message (vem do pseudoEvent criado em handleChange)
            let commentId = null;
            if (isFromComment) {
                // O commentId já foi adicionado ao message.comment_id no pseudoEvent
                commentId = message?.comment_id || null;
                console.log(`[FLOW BUILDER - FACEBOOK] 📋 Comment ID extraído: ${commentId}`);
            }
            await (0, ActionsWebhookFacebookService_1.ActionsWebhookFacebookService)(getSession, matchingCampaign.flowId, ticket.companyId, nodes, connections, flow.flow["nodes"][0].id, null, "", "", null, ticket.id, mountDataContact, undefined, isFromComment, // ✅ NOVO: Passar flag indicando se foi ativado por comentário
            commentId // ✅ NOVO: Passar commentId para fallback
            );
            console.log(`[FLOW BUILDER - FACEBOOK] ✅ Campanha executada com sucesso!`);
            return;
        }
        catch (error) {
            console.error(`[FLOW BUILDER - FACEBOOK] ❌ Erro ao executar campanha:`, error);
            await ticket.update({
                flowWebhook: false,
                isBot: false
            });
            return;
        }
    }
    // ✅ CORRIGIDO: Função para verificar se tem match com alguma campanha
    const hasAnyPhraseMatch = (campaigns, messageBody, whatsappId) => {
        if (!campaigns || !Array.isArray(campaigns) || campaigns.length === 0) {
            return false;
        }
        return campaigns.some(campaign => {
            try {
                if (!campaign.status) {
                    return false;
                }
                return campaign.matchesMessage(messageBody, whatsappId);
            }
            catch (error) {
                console.error(`[FLOW BUILDER - FACEBOOK] Erro ao verificar campanha ${campaign.id}:`, error);
                return false;
            }
        });
    };
    // ✅ CORRIGIDO: FLUXO flowIdWelcome: Para contatos que JÁ EXISTEM na base
    if (!hasAnyPhraseMatch(listPhrase, body, getSession.id) &&
        getSession.flowIdWelcome &&
        messageCount === 1 &&
        !isNewContact) {
        console.log(`[FLOW BUILDER - FACEBOOK] 🚀 Iniciando flowIdWelcome (${getSession.flowIdWelcome}) - Contato existente na primeira mensagem`);
        try {
            const flow = await FlowBuilder_1.FlowBuilderModel.findOne({
                where: {
                    id: getSession.flowIdWelcome,
                    company_id: companyId,
                    active: true
                }
            });
            if (!flow) {
                console.error(`[FLOW BUILDER - FACEBOOK] ❌ Fluxo flowIdWelcome ${getSession.flowIdWelcome} não encontrado, inativo ou não pertence à empresa ${companyId}`);
            }
            else {
                const nodes = flow.flow["nodes"];
                const connections = flow.flow["connections"];
                if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
                    console.error(`[FLOW BUILDER - FACEBOOK] ❌ Fluxo flowIdWelcome ${flow.id} não possui nós válidos`);
                }
                else {
                    const mountDataContact = {
                        number: contact.number,
                        name: contact.name,
                        email: contact.email
                    };
                    // Marcar ticket como em fluxo
                    await ticket.update({
                        flowWebhook: true,
                        flowStopped: null,
                        lastFlowId: null,
                        hashFlowId: null,
                        dataWebhook: null,
                        isBot: true
                    });
                    await (0, ActionsWebhookFacebookService_1.ActionsWebhookFacebookService)(getSession, getSession.flowIdWelcome, ticket.companyId, nodes, connections, flow.flow["nodes"][0].id, null, "", "", null, ticket.id, mountDataContact);
                    console.log(`[FLOW BUILDER - FACEBOOK] ✅ Fluxo flowIdWelcome executado com sucesso!`);
                }
            }
        }
        catch (error) {
            console.error("[FLOW BUILDER - FACEBOOK] ❌ Erro ao executar fluxo flowIdWelcome:", error);
            await ticket.update({
                flowWebhook: false,
                isBot: false
            });
        }
    }
    // ✅ CORRIGIDO: FLUXO flowIdNotPhrase: Para contatos NOVOS na primeira mensagem SEM match de campanha
    else if (!hasAnyPhraseMatch(listPhrase, body, getSession.id) &&
        getSession.flowIdNotPhrase &&
        messageCount === 1 &&
        isNewContact) {
        console.log(`[FLOW BUILDER - FACEBOOK] 🚀 Iniciando flowIdNotPhrase (${getSession.flowIdNotPhrase}) - Contato NOVO na primeira mensagem sem match de campanha`);
        try {
            const flow = await FlowBuilder_1.FlowBuilderModel.findOne({
                where: {
                    id: getSession.flowIdNotPhrase,
                    company_id: companyId,
                    active: true
                }
            });
            if (!flow) {
                console.error(`[FLOW BUILDER - FACEBOOK] ❌ Fluxo flowIdNotPhrase ${getSession.flowIdNotPhrase} não encontrado, inativo ou não pertence à empresa ${companyId}`);
            }
            else {
                const nodes = flow.flow["nodes"];
                const connections = flow.flow["connections"];
                if (!nodes || !Array.isArray(nodes) || nodes.length === 0) {
                    console.error(`[FLOW BUILDER - FACEBOOK] ❌ Fluxo flowIdNotPhrase ${flow.id} não possui nós válidos`);
                }
                else {
                    const mountDataContact = {
                        number: contact.number,
                        name: contact.name,
                        email: contact.email
                    };
                    // Marcar ticket como em fluxo
                    await ticket.update({
                        flowWebhook: true,
                        flowStopped: null,
                        lastFlowId: null,
                        hashFlowId: null,
                        dataWebhook: null,
                        isBot: true
                    });
                    await (0, ActionsWebhookFacebookService_1.ActionsWebhookFacebookService)(getSession, getSession.flowIdNotPhrase, ticket.companyId, nodes, connections, flow.flow["nodes"][0].id, null, "", "", null, ticket.id, mountDataContact);
                    console.log(`[FLOW BUILDER - FACEBOOK] ✅ Fluxo flowIdNotPhrase executado com sucesso!`);
                }
            }
        }
        catch (error) {
            console.error("[FLOW BUILDER - FACEBOOK] ❌ Erro ao executar fluxo flowIdNotPhrase:", error);
            await ticket.update({
                flowWebhook: false,
                isBot: false
            });
        }
    }
    else {
        console.log(`[FLOW BUILDER - FACEBOOK] ℹ️ Nenhuma condição de flow atendida para ticket ${ticket.id}`);
    }
    /*
    if (ticketUpdate.flowWebhook) {
      const webhook = await WebhookModel.findOne({
        where: {
          company_id: ticketUpdate.companyId,
          hash_id: ticketUpdate.hashFlowId
        }
      });
  
      if (webhook && webhook.config["details"]) {
        const flow = await FlowBuilderModel.findOne({
          where: {
            id: webhook.config["details"].idFlow
          }
        });
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];
  
        // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");
  
        // console.log('DISPARO4')
        // // Enviar as variáveis como parte da mensagem para o Worker
        // const data = {
        //   idFlowDb: webhook.config["details"].idFlow,
        //   companyId: ticketUpdate.companyId,
        //   nodes: nodes,
        //   connects: connections,
        //   nextStage: ticketUpdate.lastFlowId,
        //   dataWebhook: ticketUpdate.dataWebhook,
        //   details: webhook.config["details"],
        //   hashWebhookId: ticketUpdate.hashFlowId,
        //   pressKey: body,
        //   idTicket: ticketUpdate.id,
        //   numberPhrase: ""
        // };
        // worker.postMessage(data);
  
        // worker.on("message", message => {
        //   console.log(`Mensagem do worker: ${message}`);
        // });
  
        await ActionsWebhookFacebookService(
          getSession,
          webhook.config["details"].idFlow,
          ticketUpdate.companyId,
          nodes,
          connections,
          ticketUpdate.lastFlowId,
          ticketUpdate.dataWebhook,
          webhook.config["details"],
          ticketUpdate.hashFlowId,
          message.text,
          ticketUpdate.id
        );
      } else {
        const flow = await FlowBuilderModel.findOne({
          where: {
            id: ticketUpdate.flowStopped
          }
        });
  
        const nodes: INodes[] = flow.flow["nodes"];
        const connections: IConnections[] = flow.flow["connections"];
  
        if (!ticketUpdate.lastFlowId) {
          return
        }
  
        const mountDataContact = {
          number: contact.number,
          name: contact.name,
          email: contact.email
        };
  
        // const worker = new Worker("./src/services/WebhookService/WorkerAction.ts");
  
        // console.log('DISPARO5')
        // // Enviar as variáveis como parte da mensagem para o Worker
        // const data = {
        //   idFlowDb: parseInt(ticketUpdate.flowStopped),
        //   companyId: ticketUpdate.companyId,
        //   nodes: nodes,
        //   connects: connections,
        //   nextStage: ticketUpdate.lastFlowId,
        //   dataWebhook: null,
        //   details: "",
        //   hashWebhookId: "",
        //   pressKey: body,
        //   idTicket: ticketUpdate.id,
        //   numberPhrase: mountDataContact
        // };
        // worker.postMessage(data);
        // worker.on("message", message => {
        //   console.log(`Mensagem do worker: ${message}`);
        // });
  
        await ActionsWebhookFacebookService(
          getSession,
          parseInt(ticketUpdate.flowStopped),
          ticketUpdate.companyId,
          nodes,
          connections,
          ticketUpdate.lastFlowId,
          null,
          "",
          "",
          message.text,
          ticketUpdate.id,
          mountDataContact
        );
      }
    }
    */
};
const handleMessage = async (token, webhookEvent, channel, companyId, options = {}) => {
    try {
        const mergedOptions = {
            ...options
        };
        if (webhookEvent.reaction && !webhookEvent.message) {
            const reaction = webhookEvent.reaction;
            const reactionSenderId = reaction?.sender?.id ||
                webhookEvent.sender?.id;
            webhookEvent.message = {
                mid: reaction?.mid ||
                    reaction?.message_id ||
                    `reaction-${Date.now()}`,
                text: `REACTION:${reaction?.reaction || reaction?.action || reaction?.emoji || ""}`,
                is_echo: reactionSenderId === token.facebookPageUserId
            };
            if (!mergedOptions.eventType) {
                mergedOptions.eventType = "reaction";
            }
            if (mergedOptions.skipFlows === undefined) {
                mergedOptions.skipFlows = true;
            }
            if (!mergedOptions.payload) {
                mergedOptions.payload = webhookEvent;
            }
            if (!mergedOptions.contactData &&
                reactionSenderId &&
                reactionSenderId !== token.facebookPageUserId) {
                mergedOptions.contactData = {
                    id: reactionSenderId
                };
            }
        }
        if (webhookEvent.message) {
            let msgContact;
            const senderPsid = webhookEvent.sender.id;
            const recipientPsid = webhookEvent.recipient.id;
            const { message } = webhookEvent;
            const fromMe = message.is_echo;
            let bodyMessage = message.text;
            // ✅ CORRIGIDO: Verificar se a mensagem echo já foi processada (evitar duplicação)
            if (fromMe && message.mid) {
                const existingMessage = await Message_1.default.findOne({
                    where: {
                        wid: message.mid,
                        companyId,
                        fromMe: true
                    }
                });
                if (existingMessage) {
                    console.log(`[FACEBOOK] ⚠️ Mensagem echo já processada (wid: ${message.mid}) - ignorando duplicata`);
                    return;
                }
                // ✅ NOVO: Verificar também se existe mensagem com mesmo conteúdo e timestamp recente (últimos 5 segundos)
                // Isso evita duplicação quando o wid gerado é diferente do mid do echo
                if (bodyMessage) {
                    const recentDuplicate = await Message_1.default.findOne({
                        where: {
                            body: bodyMessage,
                            companyId,
                            fromMe: true,
                            createdAt: {
                                [sequelize_1.Op.gte]: new Date(Date.now() - 5000) // Últimos 5 segundos
                            }
                        },
                        order: [["createdAt", "DESC"]],
                        limit: 1
                    });
                    if (recentDuplicate) {
                        console.log(`[FACEBOOK] ⚠️ Mensagem duplicada detectada por conteúdo (últimos 5s) - ignorando echo`);
                        return;
                    }
                }
            }
            if (mergedOptions?.contactData) {
                msgContact = mergedOptions.contactData;

                // Webhooks de comentários normalmente trazem apenas ID e nome.
                // Buscar o perfil completo para recuperar o avatar sem impedir
                // o processamento caso a Meta não disponibilize a foto.
                if (!fromMe && senderPsid && !msgContact?.profile_pic) {
                    try {
                        const fetchedProfile = await (0, graphAPI_1.profilePsid)(
                            senderPsid,
                            token.facebookUserToken
                        );

                        msgContact = {
                            ...fetchedProfile,
                            ...msgContact,
                            id: msgContact?.id || fetchedProfile?.id || senderPsid,
                            name:
                                msgContact?.name ||
                                fetchedProfile?.name ||
                                fetchedProfile?.username ||
                                senderPsid,
                            profile_pic:
                                fetchedProfile?.profile_pic ||
                                msgContact?.profile_pic ||
                                null
                        };

                        console.log(
                            `[${channel.toUpperCase()}] ✅ Perfil do autor do comentário consultado`,
                            {
                                senderPsid,
                                hasProfilePic: Boolean(msgContact?.profile_pic)
                            }
                        );
                    }
                    catch (profileError) {
                        console.warn(
                            `[${channel.toUpperCase()}] ⚠️ Não foi possível buscar o avatar do comentário`,
                            profileError?.message || profileError
                        );
                    }
                }
            }
            else {
                if (fromMe) {
                    if (/\u200e/.test(bodyMessage))
                        return;
                    msgContact = await (0, graphAPI_1.profilePsid)(recipientPsid, token.facebookUserToken);
                }
                else {
                    msgContact = await (0, graphAPI_1.profilePsid)(senderPsid, token.facebookUserToken);
                }
            }
            const contact = await verifyContact(msgContact, token, companyId);
            const unreadCount = fromMe ? 0 : 1;
            const getSession = await Whatsapp_1.default.findOne({
                where: {
                    facebookPageUserId: token.facebookPageUserId
                },
                include: [
                    {
                        model: Queue_1.default,
                        as: "queues",
                        attributes: ["id", "name", "color", "greetingMessage"],
                        include: [
                            {
                                model: Chatbot_1.default,
                                as: "chatbots",
                                attributes: ["id", "name", "greetingMessage"]
                            }
                        ]
                    }
                ],
                order: [
                    ["queues", "id", "ASC"],
                    ["queues", "chatbots", "id", "ASC"]
                ]
            });
            if (!getSession) {
                logger_1.default.error(`[Facebook] Sessão não encontrada para facebookPageUserId: ${token.facebookPageUserId}`);
                return;
            }
            const settings = await CompaniesSettings_1.default.findOne({
                where: { companyId }
            });
            const isFirstMsg = await Ticket_1.default.findOne({
                where: {
                    contactId: contact.id,
                    companyId,
                },
                order: [["id", "DESC"]]
            });
            const mutex = new async_mutex_1.Mutex();
            const ticket = await mutex.runExclusive(async () => {
                const createTicket = await (0, FindOrCreateTicketService_1.default)(contact, getSession, unreadCount, companyId, 0, 0, null, channel, null, false, settings);
                return createTicket;
            });
            let bodyRollbackTag = "";
            let bodyNextTag = "";
            let rollbackTag;
            let nextTag;
            let ticketTag = undefined;
            // console.log(ticket.id)
            if (ticket?.company?.plan?.useKanban) {
                ticketTag = await TicketTag_1.default.findOne({
                    where: {
                        ticketId: ticket.id
                    }
                });
                if (ticketTag) {
                    const tag = await Tag_1.default.findByPk(ticketTag.tagId);
                    if (tag.nextLaneId) {
                        nextTag = await Tag_1.default.findByPk(tag.nextLaneId);
                        bodyNextTag = nextTag.greetingMessageLane;
                    }
                    if (tag.rollbackLaneId) {
                        rollbackTag = await Tag_1.default.findByPk(tag.rollbackLaneId);
                        bodyRollbackTag = rollbackTag.greetingMessageLane;
                    }
                }
            }
            const ticketTraking = await (0, FindOrCreateATicketTrakingService_1.default)({
                ticketId: ticket.id,
                companyId,
                whatsappId: getSession?.id,
                userId: ticket.userId
            });
            if ((getSession.farewellMessage &&
                (0, Mustache_1.default)(getSession.farewellMessage, ticket) === message.text) ||
                (getSession.ratingMessage &&
                    (0, Mustache_1.default)(getSession.ratingMessage, ticket) === message.text))
                return;
            if (rollbackTag && (0, Mustache_1.default)(bodyNextTag, ticket) !== bodyMessage && (0, Mustache_1.default)(bodyRollbackTag, ticket) !== bodyMessage) {
                await TicketTag_1.default.destroy({ where: { ticketId: ticket.id, tagId: ticketTag.tagId } });
                await TicketTag_1.default.create({ ticketId: ticket.id, tagId: rollbackTag.id });
            }
            await ticket.update({
                lastMessage: message.text
            });
            const allowFlowProcessing = !mergedOptions?.skipFlows;
            if (allowFlowProcessing) {
                try {
                    if (!fromMe) {
                        /**
                         * Tratamento para avaliação do atendente
                         */
                        if (ticket.status === "nps" && ticketTraking !== null && (0, wbotMessageListener_1.verifyRating)(ticketTraking)) {
                            if (!isNaN(parseFloat(bodyMessage))) {
                                (0, wbotMessageListener_1.handleRating)(parseFloat(bodyMessage), ticket, ticketTraking);
                                await ticketTraking.update({
                                    ratingAt: (0, moment_1.default)().toDate(),
                                    finishedAt: (0, moment_1.default)().toDate(),
                                    rated: true
                                });
                                return;
                            }
                            else {
                                if (ticket.amountUsedBotQueuesNPS < getSession.maxUseBotQueuesNPS) {
                                    let bodyErrorRating = `\u200eOpção inválida, tente novamente.\n`;
                                    const sentMessage = await (0, graphAPI_1.sendText)(contact.number, bodyErrorRating, getSession.facebookUserToken);
                                    await (0, exports.verifyMessageFace)(sentMessage, bodyErrorRating, ticket, contact);
                                    // await delay(1000);
                                    let bodyRatingMessage = `\u200e${getSession.ratingMessage}\n`;
                                    const msg = await (0, graphAPI_1.sendText)(contact.number, bodyRatingMessage, getSession.facebookUserToken);
                                    await (0, exports.verifyMessageFace)(sentMessage, bodyRatingMessage, ticket, contact);
                                    await ticket.update({
                                        amountUsedBotQueuesNPS: ticket.amountUsedBotQueuesNPS + 1
                                    });
                                }
                                return;
                            }
                        }
                        const enableLGPD = settings.enableLGPD === "enabled";
                        //TRATAMENTO LGPD
                        if (enableLGPD && ticket.status === "lgpd") {
                            if ((0, lodash_1.isNil)(ticket.lgpdAcceptedAt) && !(0, lodash_1.isNil)(ticket.lgpdSendMessageAt)) {
                                let choosenOption = null;
                                if (!isNaN(parseFloat(bodyMessage))) {
                                    choosenOption = parseFloat(bodyMessage);
                                }
                                //Se digitou opção numérica
                                if (!Number.isNaN(choosenOption) && Number.isInteger(choosenOption) && !(0, lodash_1.isNull)(choosenOption) && choosenOption > 0) {
                                    //Se digitou 1, aceitou o termo e vai pro bot
                                    if (choosenOption === 1) {
                                        await contact.update({
                                            lgpdAcceptedAt: (0, moment_1.default)().toDate(),
                                        });
                                        await ticket.update({
                                            lgpdAcceptedAt: (0, moment_1.default)().toDate(),
                                            amountUsedBotQueues: 0
                                        });
                                        //Se digitou 2, recusou o bot e encerra chamado
                                    }
                                    else if (choosenOption === 2) {
                                        if (getSession.complationMessage !== "" && getSession.complationMessage !== undefined) {
                                            const sentMessage = await (0, graphAPI_1.sendText)(contact.number, `\u200e${getSession.complationMessage}`, getSession.facebookUserToken);
                                            await (0, exports.verifyMessageFace)(sentMessage, `\u200e${getSession.complationMessage}`, ticket, contact);
                                        }
                                        await ticket.update({
                                            status: "closed",
                                            amountUsedBotQueues: 0
                                        });
                                        await ticketTraking.destroy;
                                        return;
                                        //se digitou qualquer opção que não seja 1 ou 2 limpa o lgpdSendMessageAt para 
                                        //enviar de novo o bot respeitando o numero máximo de vezes que o bot é pra ser enviado
                                    }
                                    else {
                                        if (ticket.amountUsedBotQueues < getSession.maxUseBotQueues) {
                                            await ticket.update({
                                                amountUsedBotQueues: ticket.amountUsedBotQueues + 1,
                                                lgpdSendMessageAt: null
                                            });
                                        }
                                    }
                                    //se digitou qualquer opção que não número o lgpdSendMessageAt para 
                                    //enviar de novo o bot respeitando o numero máximo de vezes que o bot é pra ser enviado
                                }
                                else {
                                    if (ticket.amountUsedBotQueues < getSession.maxUseBotQueues) {
                                        await ticket.update({
                                            amountUsedBotQueues: ticket.amountUsedBotQueues + 1,
                                            lgpdSendMessageAt: null
                                        });
                                    }
                                }
                            }
                            if ((contact.lgpdAcceptedAt === null || settings?.lgpdConsent === "enabled") &&
                                !contact.isGroup && (0, lodash_1.isNil)(ticket.lgpdSendMessageAt) &&
                                ticket.amountUsedBotQueues <= getSession.maxUseBotQueues && !(0, lodash_1.isNil)(settings?.lgpdMessage)) {
                                // ✅ NOVO: Verificar se é preview de post do Facebook
                                const isPostPreview = message.attachments?.[0]?.type === "facebookPostPreview";
                                if (message.attachments && !isPostPreview) {
                                    await (0, exports.verifyMessageMedia)(message, ticket, contact);
                                }
                                else {
                                    // ✅ NOVO: Para preview de post, salvar com mediaType especial
                                    if (isPostPreview) {
                                        const quotedMsg = await (0, exports.verifyQuotedMessage)(message);
                                        const wid = message.mid || message.message_id || `fb-post-preview-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                        const messageData = {
                                            wid: wid,
                                            ticketId: ticket.id,
                                            contactId: fromMe ? undefined : message.is_echo ? undefined : contact.id,
                                            body: message.text,
                                            fromMe: fromMe ? fromMe : message.is_echo ? true : false,
                                            mediaType: "facebookPostPreview",
                                            mediaUrl: message.attachments[0].payload.url,
                                            read: fromMe ? fromMe : message.is_echo,
                                            quotedMsgId: quotedMsg?.id,
                                            ack: 3,
                                            dataJson: JSON.stringify(message),
                                            channel: ticket.channel
                                        };
                                        await (0, CreateMessageService_1.default)({ messageData, companyId: ticket.companyId });
                                    }
                                    else {
                                        await (0, exports.verifyMessageFace)(message, message.text, ticket, contact);
                                    }
                                }
                                if (!(0, lodash_1.isNil)(settings?.lgpdMessage) && settings.lgpdMessage !== "") {
                                    const bodyMessageLGPD = (0, Mustache_1.default)(`\u200e${settings.lgpdMessage}`, ticket);
                                    const sentMessage = await (0, graphAPI_1.sendText)(contact.number, bodyMessageLGPD, getSession.facebookUserToken);
                                    await (0, exports.verifyMessageFace)(sentMessage, bodyMessageLGPD, ticket, contact);
                                }
                                // await delay(1000);
                                if (!(0, lodash_1.isNil)(settings?.lgpdLink) && settings?.lgpdLink !== "") {
                                    const bodyLink = (0, Mustache_1.default)(`\u200e${settings.lgpdLink}`, ticket);
                                    const sentMessage = await (0, graphAPI_1.sendText)(contact.number, bodyLink, getSession.facebookUserToken);
                                    await (0, exports.verifyMessageFace)(sentMessage, bodyLink, ticket, contact);
                                }
                                ;
                                // await delay(1000);
                                const bodyBot = (0, Mustache_1.default)(`\u200eEstou ciente sobre o tratamento dos meus dados pessoais. \n\n*[1]* Sim\n*[2]* Não`, ticket);
                                const sentMessageBot = await (0, graphAPI_1.sendText)(contact.number, bodyBot, getSession.facebookUserToken);
                                await (0, exports.verifyMessageFace)(sentMessageBot, bodyBot, ticket, contact);
                                await ticket.update({
                                    lgpdSendMessageAt: (0, moment_1.default)().toDate(),
                                    amountUsedBotQueues: ticket.amountUsedBotQueues + 1
                                });
                                await ticket.reload();
                                return;
                            }
                            ;
                            if (!(0, lodash_1.isNil)(ticket.lgpdSendMessageAt) && (0, lodash_1.isNil)(ticket.lgpdAcceptedAt))
                                return;
                        }
                    }
                }
                catch (e) {
                    throw new Error(e);
                    console.log(e);
                }
            }
            // ✅ NOVO: Verificar se é preview de post do Facebook
            const isPostPreview = message.attachments?.[0]?.type === "facebookPostPreview";
            if (message.attachments && !isPostPreview) {
                await (0, exports.verifyMessageMedia)(message, ticket, contact);
            }
            else {
                // ✅ NOVO: Para preview de post, salvar com mediaType especial
                if (isPostPreview) {
                    const quotedMsg = await (0, exports.verifyQuotedMessage)(message);
                    const wid = message.mid || message.message_id || `fb-post-preview-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                    const messageData = {
                        wid: wid,
                        ticketId: ticket.id,
                        contactId: fromMe ? undefined : message.is_echo ? undefined : contact.id,
                        body: message.text,
                        fromMe: fromMe ? fromMe : message.is_echo ? true : false,
                        mediaType: "facebookPostPreview",
                        mediaUrl: message.attachments[0].payload.url,
                        read: fromMe ? fromMe : message.is_echo,
                        quotedMsgId: quotedMsg?.id,
                        ack: 3,
                        dataJson: JSON.stringify(message),
                        channel: ticket.channel
                    };
                    await (0, CreateMessageService_1.default)({ messageData, companyId: ticket.companyId });
                }
                else {
                    await (0, exports.verifyMessageFace)(message, message.text, ticket, contact);
                }
            }
            // ✅ CORRIGIDO: Verificar se ticket está aguardando resposta de Input node
            if (allowFlowProcessing &&
                !fromMe &&
                ticket.flowWebhook &&
                ticket.flowStopped &&
                ticket.lastFlowId &&
                ticket.dataWebhook &&
                ticket.dataWebhook.waitingInput === true) {
                console.log(`[INPUT NODE - FACEBOOK] Processando resposta para nó de input - ticket ${ticket.id}`);
                try {
                    const body = message.text || "";
                    // @ts-ignore
                    const inputVariableName = ticket.dataWebhook.inputVariableName;
                    // @ts-ignore
                    const inputIdentifier = ticket.dataWebhook.inputIdentifier || `${ticket.id}_${inputVariableName}`;
                    global.flowVariables = global.flowVariables || {};
                    global.flowVariables[inputVariableName] = body;
                    global.flowVariables[inputIdentifier] = body; // Salvar com o identificador também
                    const nextNode = global.flowVariables[`${inputIdentifier}_next`];
                    // Fallback: se o ponteiro em memória não existir, usa o salvo no ticket
                    // @ts-ignore
                    const fallbackNextNode = ticket.dataWebhook?.nextNodeId;
                    const resolvedNextNode = nextNode || fallbackNextNode;
                    await ticket.update({
                        dataWebhook: {
                            ...ticket.dataWebhook,
                            waitingInput: false,
                            inputProcessed: true,
                            inputVariableName: null,
                            inputIdentifier: null,
                            lastInputValue: body
                        }
                    });
                    // Fallback de flowId: se flowStopped estiver ausente, tenta pegar de dataWebhook.flowId
                    // @ts-ignore
                    const resolvedFlowId = ticket.flowStopped || ticket.dataWebhook?.flowId;
                    if (resolvedFlowId && resolvedNextNode) {
                        const flow = await FlowBuilder_1.FlowBuilderModel.findOne({
                            where: {
                                id: parseInt(resolvedFlowId),
                                company_id: companyId,
                                active: true
                            }
                        });
                        if (flow) {
                            const nodes = flow.flow["nodes"];
                            const connections = flow.flow["connections"];
                            const mountDataContact = {
                                number: contact.number,
                                name: contact.name,
                                email: contact.email
                            };
                            console.log(`[INPUT NODE - FACEBOOK] Continuando fluxo após resposta do input - próximo nó: ${resolvedNextNode}`);
                            await (0, ActionsWebhookFacebookService_1.ActionsWebhookFacebookService)(getSession, parseInt(resolvedFlowId), ticket.companyId, nodes, connections, resolvedNextNode, // Continuar a partir do próximo nó salvo
                            ticket.dataWebhook, "", ticket.hashFlowId || "", body, // A resposta do usuário como pressKey
                            ticket.id, mountDataContact);
                            console.log(`[INPUT NODE - FACEBOOK] ✅ Fluxo continuado após resposta do input`);
                            return; // Não processar mais nada
                        }
                        else {
                            console.error(`[INPUT NODE - FACEBOOK] ❌ Fluxo ${resolvedFlowId} não encontrado ou inativo`);
                        }
                    }
                    else {
                        console.error(`[INPUT NODE - FACEBOOK] ❌ FlowId ou NextNode não encontrados: flowId=${resolvedFlowId}, nextNode=${resolvedNextNode}`);
                    }
                }
                catch (error) {
                    console.error(`[INPUT NODE - FACEBOOK] ❌ Erro ao processar resposta do input:`, error);
                }
            }
            // ✅ CORRIGIDO: Buscar flow com validações de company_id e active
            let isMenu = false;
            if (ticket.flowStopped) {
                try {
                    const flow = await FlowBuilder_1.FlowBuilderModel.findOne({
                        where: {
                            id: ticket.flowStopped,
                            company_id: companyId,
                            active: true
                        }
                    });
                    if (flow && flow.flow && flow.flow["nodes"]) {
                        isMenu = flow.flow["nodes"].find((node) => node.id === ticket.lastFlowId)?.type === "menu";
                    }
                }
                catch (error) {
                    console.error(`[FLOW BUILDER - FACEBOOK] Erro ao verificar se é menu:`, error);
                }
            }
            if (!ticket.fromMe &&
                isMenu &&
                !isNaN(message.text)) {
                await ticket.update({
                    queueId: ticket.queueId ? ticket.queueId : null,
                });
                await flowBuilderQueue(ticket, message, getSession, companyId, contact, isFirstMsg);
            }
            // ✅ CORRIGIDO: Condições de entrada para flowbuilder - removidas restrições desnecessárias
            if (allowFlowProcessing &&
                !ticket.imported &&
                !fromMe &&
                !ticket.isGroup &&
                !isMenu &&
                ticket.status === "pending" && // ✅ CORRIGIDO: Verificar status do ticket
                (!ticket.flowWebhook || !ticket.lastFlowId) && // ✅ CORRIGIDO: Só executar se não estiver em fluxo ativo
                !(0, lodash_1.isNil)(getSession.integrationId) &&
                !ticket.useIntegration) {
                try {
                    const integrations = await (0, ShowQueueIntegrationService_1.default)(getSession.integrationId, companyId);
                    if (integrations && integrations.type === "flowbuilder") {
                        console.log(`[FLOW BUILDER - FACEBOOK] Condições atendidas para executar flowbuilder no ticket ${ticket.id}`);
                        // ✅ CORRIGIDO: Não atualizar dataWebhook aqui, isso será feito dentro do flowbuilderIntegration
                        await flowbuilderIntegration(ticket, companyId, isFirstMsg, getSession, contact, message);
                    }
                }
                catch (error) {
                    console.error(`[FLOW BUILDER - FACEBOOK] ❌ Erro ao verificar integração ou executar flowbuilder:`, error);
                }
            }
            if (allowFlowProcessing &&
                !ticket.queue &&
                !fromMe &&
                !ticket.userId &&
                getSession.queues.length >= 1) {
                await verifyQueue(getSession, message, ticket, contact);
            }
            if (allowFlowProcessing && ticket.queue && ticket.queueId) {
                // ✅ CORRIGIDO: Executar ChatBot apenas se ticket não estiver "open" (aceito por atendente)
                if (ticket.status !== "open" && ticket.queue?.chatbots?.length > 0) {
                    await (0, ChatbotListenerFacebook_1.sayChatbot)(ticket.queueId, getSession, ticket, contact, message);
                }
            }
        }
        return;
    }
    catch (error) {
        throw new Error(error);
    }
};
exports.handleMessage = handleMessage;
const handleChange = async (token, change, channel, companyId) => {
    console.log(`[${channel.toUpperCase()}] ==========================================`);
    console.log(`[${channel.toUpperCase()}] 🔄 handleChange INICIADO`);
    console.log(`[${channel.toUpperCase()}] 📋 Estrutura COMPLETA do change recebido:`, JSON.stringify(change, null, 2));
    console.log(`[${channel.toUpperCase()}] ==========================================`);
    const field = change?.field;
    const value = change?.value || {};
    console.log(`[${channel.toUpperCase()}] 🔄 handleChange - field: ${field}, channel: ${channel}`);
    console.log(`[${channel.toUpperCase()}] 📋 Estrutura COMPLETA do change:`, JSON.stringify(change, null, 2));
    try {
        if (!field) {
            console.warn(`[${channel.toUpperCase()}] ⚠️ Evento change sem field:`, JSON.stringify(change, null, 2));
            return;
        }
        console.log(`[${channel.toUpperCase()}] 🔍 Processando change - field: "${field}"`);
        console.log(`[${channel.toUpperCase()}] 📦 Estrutura do value:`, JSON.stringify(value, null, 2));
        const ensureContactData = (from, fallbackId) => {
            if (!from) {
                if (!fallbackId)
                    return undefined;
                return { id: fallbackId };
            }
            return {
                id: from.id || fallbackId,
                name: from.name || from.username,
                first_name: from.first_name,
                last_name: from.last_name
            };
        };
        const ensureSenderId = (...candidates) => {
            for (const candidate of candidates) {
                if (candidate)
                    return candidate;
            }
            return undefined;
        };
        if (field === "feed" && value?.item === "comment") {
            // ✅ NOVO: Verificar se recebimento de comentários está habilitado
            if (token.receiveComments === false) {
                console.log(`[${channel.toUpperCase()}] ⚠️ Comentário ignorado - recebimento de comentários desabilitado para conexão ${token.id}`);
                return;
            }
            console.log("[FACEBOOK] 📝 Comentário recebido no feed:", JSON.stringify(change, null, 2));
            const senderId = value?.from?.id ||
                value?.commenter_id ||
                value?.sender_id;
            if (!senderId) {
                console.warn("[FACEBOOK] ⚠️ Comentário ignorado - sem senderId:", change);
                return;
            }
            const isFromPage = senderId === token.facebookPageUserId;
            const messageText = value?.message || "";
            if (!messageText && isFromPage) {
                console.log("[FACEBOOK] ℹ️ Comentário da própria página sem texto - ignorado");
                return;
            }
            const hasText = Boolean(messageText && messageText.trim().length > 0);
            // ✅ NOVO: Extrair informações do post
            const postId = value?.post_id || value?.parent_id;
            const postMessage = value?.post?.message || value?.post_message || "";
            const postLink = postId
                ? `https://www.facebook.com/${postId}`
                : value?.post?.permalink_url || "";
            // ✅ NOVO: Buscar dados completos do post para preview
            // ✅ CORRIGIDO: Adicionar timeout e não bloquear o fluxo se falhar
            let postData = null;
            let postImage = "";
            if (postId && token.facebookUserToken) {
                try {
                    // ✅ NOVO: Usar Promise.race com timeout para não bloquear o fluxo
                    const timeoutPromise = new Promise((_, reject) => setTimeout(() => reject(new Error("Timeout ao buscar dados do post")), 5000));
                    postData = await Promise.race([
                        (0, graphAPI_1.getPostData)(postId, token.facebookUserToken),
                        timeoutPromise
                    ]);
                    if (postData) {
                        // Extrair imagem do post
                        postImage = postData.full_picture ||
                            postData.picture ||
                            (postData.attachments?.data?.[0]?.media?.image?.src) ||
                            (postData.attachments?.data?.[0]?.subattachments?.data?.[0]?.media?.image?.src) ||
                            "";
                    }
                }
                catch (error) {
                    // ✅ CORRIGIDO: Logar erro mas não bloquear o fluxo
                    if (error.code === "ETIMEDOUT" || error.message?.includes("Timeout")) {
                        console.warn("[FACEBOOK] ⚠️ Timeout ao buscar dados do post (continuando sem preview):", postId);
                    }
                    else {
                        console.error("[FACEBOOK] ⚠️ Erro ao buscar dados do post (continuando sem preview):", error.message || error);
                    }
                    // Continuar sem dados do post - o fluxo não será bloqueado
                }
            }
            // ✅ NOVO: Montar mensagem com preview do post
            let finalMessage = messageText;
            let mediaType = null;
            let mediaUrl = null;
            if (postId && (postMessage || postLink || postImage)) {
                // Usar formato especial para preview: image|sourceUrl|title|body|comment
                const postTitle = "Publicação do Facebook";
                const postBody = postMessage || postData?.story || "Ver publicação no Facebook";
                const commentText = messageText || "Comentário";
                // Formato: image|url|title|body|comment
                finalMessage = `${postImage || ""}|${postLink}|${postTitle}|${postBody.substring(0, 200)}|${commentText}`;
                mediaType = "facebookPostPreview";
                mediaUrl = postLink;
            }
            else if (postMessage || postLink) {
                // Fallback para formato antigo se não conseguir buscar dados
                finalMessage = `💬 Comentário em publicação:\n\n`;
                if (postMessage) {
                    finalMessage += `📄 Publicação: ${postMessage.substring(0, 200)}${postMessage.length > 200 ? '...' : ''}\n\n`;
                }
                finalMessage += `💭 Seu comentário: ${messageText}`;
                if (postLink) {
                    finalMessage += `\n\n🔗 Ver publicação: ${postLink}`;
                }
            }
            // ✅ CORRIGIDO: Garantir que mid sempre tenha um valor válido e único
            const commentMid = value?.comment_id || `feed-comment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            // ✅ NOVO: Extrair commentId para uso no fluxo
            const commentId = value?.comment_id || null;
            const pseudoEvent = {
                sender: {
                    id: senderId
                },
                recipient: {
                    id: token.facebookPageUserId
                },
                message: {
                    mid: commentMid,
                    message_id: commentMid,
                    text: finalMessage,
                    is_echo: isFromPage,
                    // ✅ NOVO: Adicionar informações de mídia para preview
                    attachments: mediaType ? [{
                            type: mediaType,
                            payload: {
                                url: mediaUrl
                            }
                        }] : undefined,
                    // ✅ NOVO: Adicionar commentId para uso no fluxo
                    comment_id: commentId
                }
            };
            console.log("[FACEBOOK] 📝 pseudoEvent criado com mid:", commentMid);
            const contactData = isFromPage
                ? undefined
                : {
                    id: senderId,
                    name: value?.from?.name || value?.sender_name,
                    first_name: value?.from?.first_name,
                    last_name: value?.from?.last_name
                };
            console.log("[FACEBOOK] ✅ Processando comentário do feed - senderId:", senderId, "hasText:", hasText);
            console.log("[FACEBOOK] 📋 ContactData criado:", JSON.stringify(contactData, null, 2));
            console.log("[FACEBOOK] 📋 Comment ID do webhook:", value?.comment_id);
            await (0, exports.handleMessage)(token, pseudoEvent, channel, companyId, {
                contactData,
                skipFlows: !hasText,
                eventType: "comment",
                payload: change
            });
            return;
        }
        if (field === "mention" || field === "mentions") {
            const senderId = ensureSenderId(value?.from?.id, value?.sender_id, value?.commenter_id, value?.username);
            if (!senderId || senderId === token.facebookPageUserId)
                return;
            const messageText = value?.message || value?.mention_message || "";
            const hasText = Boolean(messageText && messageText.trim().length > 0);
            // ✅ CORRIGIDO: Garantir que mid sempre tenha um valor válido e único
            const mentionMid = value?.comment_id || value?.post_id || `mention-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const pseudoEvent = {
                sender: {
                    id: senderId
                },
                recipient: {
                    id: token.facebookPageUserId
                },
                message: {
                    mid: mentionMid,
                    message_id: mentionMid,
                    text: messageText || "[menção sem texto]",
                    is_echo: false
                }
            };
            const contactData = ensureContactData(value?.from, senderId);
            if (!contactData?.id) {
                console.warn("[FACEBOOK] Menção ignorada - sem identificador de contato:", change);
                return;
            }
            await (0, exports.handleMessage)(token, pseudoEvent, channel, companyId, {
                contactData,
                skipFlows: !hasText,
                eventType: "mention",
                payload: change
            });
            return;
        }
        // ✅ NOVO: Tratar campo "comments" (Instagram pode usar este formato)
        if (field === "comments" || field === "comment") {
            // ✅ NOVO: Verificar se recebimento de comentários está habilitado
            if (token.receiveComments === false) {
                console.log(`[${channel.toUpperCase()}] ⚠️ Comentário ignorado - recebimento de comentários desabilitado para conexão ${token.id}`);
                return;
            }
            console.log(`[${channel.toUpperCase()}] 📝 Evento '${field}' recebido:`, JSON.stringify(change, null, 2));
            console.log(`[${channel.toUpperCase()}] 🔍 Estrutura COMPLETA do value:`, JSON.stringify(value, null, 2));
            console.log(`[${channel.toUpperCase()}] 🔑 Todas as chaves do value:`, Object.keys(value || {}));
            // ✅ NOVO: Instagram pode enviar comentários em diferentes estruturas
            // Tentar múltiplas formas de extrair o remetente
            const senderId = ensureSenderId(value?.from?.id, value?.from?.username, value?.commenter_id, value?.sender_id, value?.username, value?.user?.id, value?.user?.username, value?.sender?.id, value?.sender?.username);
            if (!senderId) {
                console.warn(`[${channel.toUpperCase()}] ⚠️ Comentário ignorado - sem remetente.`);
                console.warn(`[${channel.toUpperCase()}] 🔍 Tentativas de extrair senderId:`, {
                    "value?.from?.id": value?.from?.id,
                    "value?.from?.username": value?.from?.username,
                    "value?.commenter_id": value?.commenter_id,
                    "value?.sender_id": value?.sender_id,
                    "value?.username": value?.username,
                    "value?.user?.id": value?.user?.id,
                    "value?.user?.username": value?.user?.username,
                    "value?.sender?.id": value?.sender?.id,
                    "value?.sender?.username": value?.sender?.username
                });
                console.warn(`[${channel.toUpperCase()}] 📋 Estrutura completa:`, JSON.stringify(change, null, 2));
                return;
            }
            console.log(`[${channel.toUpperCase()}] ✅ Remetente identificado:`, senderId);
            const isFromPage = senderId === token.facebookPageUserId || senderId === token.facebookPageUserId?.toString();
            // ✅ NOVO: Tentar múltiplas formas de extrair o texto do comentário
            const messageText = value?.text ||
                value?.message ||
                value?.body ||
                value?.comment ||
                value?.comment_text ||
                value?.text_message ||
                "";
            const hasText = Boolean(messageText && messageText.trim().length > 0);
            console.log(`[${channel.toUpperCase()}] 📄 Texto do comentário:`, messageText, "hasText:", hasText);
            if (!messageText && isFromPage) {
                console.log("[INSTAGRAM] ℹ️ Comentário da própria página sem texto - ignorado");
                return;
            }
            // ✅ CORRIGIDO: Segundo documentação do Instagram, media.id está em value.media.id
            // Documentação: https://developers.facebook.com/docs/instagram-platform/comment-moderation
            const mediaId = value?.media?.id || // ✅ Campo principal segundo documentação
                value?.media_id ||
                value?.parent_id; // parent_id é para comentários em resposta a outros comentários
            // ✅ NOVO: Buscar dados do post do Instagram para preview (se disponível)
            let postData = null;
            let postImage = "";
            let mediaPermalink = "";
            let mediaCaption = "";
            if (mediaId && token.facebookUserToken && channel === "instagram") {
                try {
                    // ✅ NOVO: Usar função específica para Instagram
                    // Documentação: https://developers.facebook.com/docs/instagram-platform/comment-moderation
                    postData = await (0, graphAPI_1.getInstagramMediaData)(mediaId, token.facebookUserToken);
                    if (postData) {
                        postImage = postData.media_url || "";
                        mediaPermalink = postData.permalink || "";
                        mediaCaption = postData.caption || "";
                    }
                }
                catch (error) {
                    console.log(`[INSTAGRAM] ⚠️ Não foi possível buscar dados da mídia ${mediaId}:`, error.message);
                    // Continuar sem preview se não conseguir buscar
                }
            }
            // Fallback: construir permalink básico se não foi encontrado
            if (!mediaPermalink && mediaId) {
                // Instagram media IDs precisam ser convertidos para shortcode para o link funcionar
                // Por enquanto, usamos um formato genérico
                mediaPermalink = `https://www.instagram.com/p/${mediaId}/`;
            }
            console.log(`[${channel.toUpperCase()}] 📸 Informações da mídia:`, {
                mediaId,
                mediaPermalink,
                hasCaption: !!mediaCaption,
                captionLength: mediaCaption?.length || 0,
                hasImage: !!postImage,
                hasPostData: !!postData
            });
            // ✅ NOVO: Montar mensagem com preview do post (se disponível)
            let finalMessage = messageText;
            let mediaType = null;
            let mediaUrl = null;
            if (mediaId && (mediaCaption || mediaPermalink || postImage)) {
                // Usar formato especial para preview: image|url|title|body|comment
                const postTitle = "Publicação do Instagram";
                const postBody = mediaCaption || "Ver publicação no Instagram";
                const commentText = messageText || "Comentário";
                // Formato: image|url|title|body|comment
                finalMessage = `${postImage || ""}|${mediaPermalink}|${postTitle}|${postBody.substring(0, 200)}|${commentText}`;
                mediaType = "facebookPostPreview";
                mediaUrl = mediaPermalink;
            }
            else if (mediaPermalink) {
                // Fallback para formato antigo se não conseguir buscar dados
                finalMessage = `💬 Comentário em publicação:\n\n`;
                finalMessage += `💭 Seu comentário: ${messageText}`;
                if (mediaPermalink) {
                    finalMessage += `\n\n🔗 Ver publicação: ${mediaPermalink}`;
                }
            }
            // ✅ CORRIGIDO: Segundo documentação, comment_id está em value.comment_id
            // Documentação: https://developers.facebook.com/docs/instagram-platform/comment-moderation
            const commentMid = value?.comment_id || value?.id || `ig-comment-${Date.now()}-${Math.random().toString(36).substring(7)}`;
            const pseudoEvent = {
                sender: {
                    id: senderId
                },
                recipient: {
                    id: token.facebookPageUserId
                },
                message: {
                    mid: commentMid,
                    message_id: commentMid,
                    text: finalMessage,
                    is_echo: isFromPage,
                    // ✅ NOVO: Adicionar informações de mídia para preview
                    attachments: mediaType ? [{
                            type: mediaType,
                            payload: {
                                url: mediaUrl
                            }
                        }] : undefined
                }
            };
            console.log(`[${channel.toUpperCase()}] 📝 pseudoEvent criado com mid:`, commentMid);
            // ✅ CORRIGIDO: Segundo documentação do Instagram, from contém id e username
            // Documentação: https://developers.facebook.com/docs/instagram-platform/comment-moderation
            // value.from.id = Instagram-scoped ID
            // value.from.username = username do Instagram
            const contactData = ensureContactData(value?.from, senderId);
            // ✅ NOVO: Se não encontrou contactData, tentar criar com username do Instagram
            if (!contactData?.id && value?.from?.username) {
                const contactDataFromUsername = {
                    id: senderId,
                    name: value.from.username,
                    username: value.from.username
                };
                console.log(`[${channel.toUpperCase()}] ✅ Usando username como fallback para contactData:`, contactDataFromUsername);
                await (0, exports.handleMessage)(token, pseudoEvent, channel, companyId, {
                    contactData: contactDataFromUsername,
                    skipFlows: !hasText,
                    eventType: "comment",
                    payload: change
                });
                return;
            }
            if (!contactData?.id) {
                console.warn(`[${channel.toUpperCase()}] ⚠️ Comentário ignorado - sem contactData válido. senderId:`, senderId);
                console.warn(`[${channel.toUpperCase()}] 📋 value.from:`, value?.from);
                console.warn(`[${channel.toUpperCase()}] 📋 Estrutura completa do value:`, JSON.stringify(value, null, 2));
                return;
            }
            console.log(`[${channel.toUpperCase()}] ✅ Processando comentário - senderId:`, senderId, "hasText:", hasText, "contactData:", contactData);
            await (0, exports.handleMessage)(token, pseudoEvent, channel, companyId, {
                contactData,
                skipFlows: !hasText,
                eventType: "comment",
                payload: change
            });
            return;
        }
        if (field === "message_reactions" || field === "message_reaction") {
            const senderId = value?.sender_id || value?.from?.id;
            if (!senderId)
                return;
            const reaction = value?.reaction_type ||
                value?.reaction ||
                value?.verb ||
                "reaction";
            const pseudoEvent = {
                sender: {
                    id: senderId
                },
                recipient: {
                    id: token.facebookPageUserId
                },
                message: {
                    mid: value?.comment_id
                        ? `reaction-${value.comment_id}`
                        : `reaction-${Date.now()}`,
                    text: `REACTION:${reaction}`,
                    is_echo: senderId === token.facebookPageUserId
                }
            };
            const contactData = senderId === token.facebookPageUserId
                ? undefined
                : {
                    id: senderId,
                    name: value?.sender_name
                };
            await (0, exports.handleMessage)(token, pseudoEvent, channel, companyId, {
                contactData,
                skipFlows: true,
                eventType: "reaction",
                payload: change
            });
            return;
        }
        // ✅ NOVO: Log detalhado para eventos não tratados
        console.warn(`[${channel.toUpperCase()}] ⚠️ Evento change não tratado - field: "${field}"`, JSON.stringify({
            field,
            value: {
                item: value?.item,
                from: value?.from?.id,
                hasMessage: !!value?.message,
                hasText: !!value?.text,
                verb: value?.verb
            },
            change: change
        }, null, 2));
    }
    catch (error) {
        console.error(`[${channel.toUpperCase()}] ❌ Erro ao processar evento change:`, error);
        console.error(`[${channel.toUpperCase()}] 📋 Stack trace:`, error.stack);
    }
};
exports.handleChange = handleChange;
const verifyQueue = async (getSession, msg, ticket, contact) => {
    // console.log("VERIFYING QUEUE", ticket.whatsappId, getSession.id)
    const { queues, greetingMessage } = await (0, ShowWhatsAppService_1.default)(getSession.id, ticket.companyId);
    if (queues.length === 1) {
        const firstQueue = (0, lodash_1.head)(queues);
        let chatbot = false;
        if (firstQueue?.chatbots) {
            chatbot = firstQueue?.chatbots?.length > 0;
        }
        await (0, UpdateTicketService_1.default)({
            ticketData: { queueId: queues[0].id, isBot: chatbot },
            ticketId: ticket.id,
            companyId: ticket.companyId
        });
        return;
    }
    let selectedOption = "";
    if (ticket.status !== "lgpd") {
        selectedOption = msg.text;
    }
    else {
        if (!(0, lodash_1.isNil)(ticket.lgpdAcceptedAt))
            await ticket.update({
                status: "pending"
            });
        await ticket.reload();
    }
    const choosenQueue = queues[+selectedOption - 1];
    if (choosenQueue) {
        await (0, UpdateTicketService_1.default)({
            ticketData: { queueId: choosenQueue.id },
            ticketId: ticket.id,
            companyId: ticket.companyId
        });
        if (choosenQueue.chatbots.length > 0) {
            let options = "";
            choosenQueue.chatbots.forEach((chatbot, index) => {
                options += `[${index + 1}] - ${chatbot.name}\n`;
            });
            const body = `${choosenQueue.greetingMessage}\n\n${options}\n[#] Voltar para o menu principal`;
            const sentMessage = await (0, sendFacebookMessage_1.sendFacebookMessage)({
                ticket,
                body: body
            });
            // const debouncedSentChatbot = debounce(
            //   async () => {
            //     await sendText(
            //   contact.number,
            //   formatBody(body, ticket),
            //   ticket.whatsapp.facebookUserToken
            // );
            //   },
            //   3000,
            //   ticket.id
            // );
            // debouncedSentChatbot();
            // return await verifyMessage(msg, body, ticket, contact);
        }
        if (!choosenQueue.chatbots.length) {
            const body = `${choosenQueue.greetingMessage}`;
            const sentMessage = await (0, sendFacebookMessage_1.sendFacebookMessage)({
                ticket,
                body: body
            });
            // const debouncedSentChatbot = debounce(
            //   async () => { await sendText(
            //   contact.number,
            //   formatBody(body, ticket),
            //   ticket.whatsapp.facebookUserToken
            // );
            //   },
            //   3000,
            //   ticket.id
            // );
            // debouncedSentChatbot();
            // return await verifyMessage(msg, body, ticket, contact);
        }
    }
    else {
        let options = "";
        queues.forEach((queue, index) => {
            options += `[${index + 1}] - ${queue.name}\n`;
        });
        const body = `${greetingMessage}\n\n${options}`;
        const sentMessage = await (0, sendFacebookMessage_1.sendFacebookMessage)({
            ticket,
            body: body
        });
        // const debouncedSentChatbot = debounce(
        //   async () => { await 
        //     sendText(
        //       contact.number,
        //       formatBody(body, ticket),
        //       ticket.whatsapp.facebookUserToken
        //     );
        //   },
        //   3000,
        //   ticket.id
        // );
        // debouncedSentChatbot();
        // return verifyMessage(msg, body, ticket, contact);
    }
};

export {
  verifyMessageFace,
  verifyMessageMedia,
  handleMessage,
  handleChange
};
