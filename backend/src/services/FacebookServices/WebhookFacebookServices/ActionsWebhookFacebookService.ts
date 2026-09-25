import Chatbot from "../../../models/Chatbot";
import Contact from "../../../models/Contact";
import Queue from "../../../models/Queue";
import Ticket from "../../../models/Ticket";
import Whatsapp from "../../../models/Whatsapp";
import Message from "../../../models/Message";
import ShowTicketService from "../../TicketServices/ShowTicketService";
import { Op } from "sequelize";
import { IConnections, INodes } from "../../WebhookService/DispatchWebHookService"
import { getAccessToken, sendAttachmentFromUrl, sendText, showTypingIndicator } from "../graphAPI";
import { verifyMessageFace, verifyMessageMedia } from "../facebookMessageListener";
import CreateMessageService from "../../MessageServices/CreateMessageService";
import formatBody from "../../../helpers/Mustache";
import axios from "axios";
import logger from "../../../utils/logger";
import fs from "fs";
import { sendFacebookMessageMedia } from "../sendFacebookMessageMedia";
import mime from "mime-types";
import path from "path";
import { getIO } from "../../../libs/socket";
import { randomizarCaminho } from "../../../utils/randomizador";
import CreateLogTicketService from "../../TicketServices/CreateLogTicketService";
import UpdateTicketService from "../../TicketServices/UpdateTicketService";
import FindOrCreateATicketTrakingService from "../../TicketServices/FindOrCreateATicketTrakingService";
import ShowQueueService from "../../QueueService/ShowQueueService";
import ffmpeg from "fluent-ffmpeg";
import { fi } from "date-fns/locale";
import queue from "../../../libs/queue";
import { getWbot } from "../../../libs/wbot";
import flowBuilderQueue from "../../WebhookService/flowBuilderQueue";
import { proto } from "@whiskeysockets/baileys";
import ShowWhatsAppService from "../../WhatsappService/ShowWhatsAppService";
import { FlowBuilderModel } from "../../../models/FlowBuilder";

const os = require("os");

// ✅ FUNÇÃO AUXILIAR: Determinar mime type pela extensão (fallback se mime.lookup falhar)
const getMimeType = (filePath: string): string => {
    try {
        // Usar mime.lookup do mime-types
        const mimeType = mime.lookup(filePath);
        if (mimeType) {
            return mimeType;
        }
    } catch (error) {
        // Se falhar, usar detecção manual pela extensão
    }
    
    // Fallback: determinar pela extensão
    const extension = path.extname(filePath).toLowerCase();
    const mimeTypes: { [key: string]: string } = {
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".png": "image/png",
        ".gif": "image/gif",
        ".webp": "image/webp",
        ".mp4": "video/mp4",
        ".mp3": "audio/mpeg",
        ".wav": "audio/wav",
        ".ogg": "audio/ogg",
        ".pdf": "application/pdf",
        ".doc": "application/msword",
        ".docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        ".xls": "application/vnd.ms-excel",
        ".xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    };
    
    return mimeTypes[extension] || "application/octet-stream";
};

let ffmpegPath;
if (os.platform() === "win32") {
    // Windows
    ffmpegPath = "C:\\ffmpeg\\ffmpeg.exe"; // Substitua pelo caminho correto no Windows
} else if (os.platform() === "darwin") {
    // macOS
    ffmpegPath = "/opt/homebrew/bin/ffmpeg"; // Substitua pelo caminho correto no macOS
} else {
    // Outros sistemas operacionais (Linux, etc.)
    ffmpegPath = "/usr/bin/ffmpeg"; // Substitua pelo caminho correto em sistemas Unix-like
}
ffmpeg.setFfmpegPath(ffmpegPath);

interface IAddContact {
    companyId: number;
    name: string;
    phoneNumber: string;
    email?: string;
    dataMore?: any;
}

interface NumberPhrase {
    number: string,
    name: string,
    email: string
}

export const ActionsWebhookFacebookService = async (
    token: Whatsapp,
    idFlowDb: number,
    companyId: number,
    nodes: INodes[],
    connects: IConnections[],
    nextStage: string,
    dataWebhook: any,
    details: any,
    hashWebhookId: string,
    pressKey?: string,
    idTicket?: number,
    numberPhrase?: NumberPhrase,
    msg?: proto.IWebMessageInfo,
    isFromComment?: boolean, // ✅ NOVO: Flag indicando se o fluxo foi ativado por comentário
    commentId?: string | null // ✅ NOVO: ID do comentário para fallback
): Promise<string> => {

    const io = getIO()
    let next = nextStage;
    let createFieldJsonName = "";
    const connectStatic = connects;

    const lengthLoop = nodes.length;
    const getSession = await Whatsapp.findOne({
        where: {
            facebookPageUserId: token.facebookPageUserId
        },
        include: [
            {
                model: Queue,
                as: "queues",
                attributes: ["id", "name", "color", "greetingMessage"],
                include: [
                    {
                        model: Chatbot,
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
    })

    if (!getSession) {
      logger.error(`[ActionsWebhook] Sessão não encontrada para facebookPageUserId: ${token.facebookPageUserId}`);
      return;
    }

    let execCount = 0;

    let execFn = "";

    let ticket = null;

    let noAlterNext = false;

    let selectedQueueid = null;

    // ✅ CORRIGIDO: Rastrear nós já processados para evitar loop infinito
    const processedNodes = new Set<string>();

    for (var i = 0; i < lengthLoop; i++) {
        let nodeSelected: any;
        let ticketInit: Ticket;

        if (idTicket) {
            ticketInit = await Ticket.findOne({
                where: { id: idTicket }
            });
            if (!ticketInit) {
                logger.warn(`[ActionsWebhook] Ticket ${idTicket} não encontrado. Pulando iteração.`);
                break;
            }
            if (ticketInit.status === "closed") {
                if (numberPhrase === null || numberPhrase === undefined) {
                    break;
                }
            } else {
                await ticketInit.update({
                    dataWebhook: {
                        status: "process",
                    },
                })
            }
        }

        if (pressKey) {
            if (pressKey === "parar") {
                if (idTicket) {
                    const ticket = await Ticket.findOne({
                        where: { id: idTicket }
                    });
                    if (ticket) {
                        await ticket.update({
                            status: "closed"
                        });
                    }
                }
                break;
            }

            // ✅ CORRIGIDO: Se execFn está vazio e há pressKey, pode ser uma resposta de Input
            // Nesse caso, usar o next para buscar o nó correto (o Input já foi processado)
            if (execFn === "") {
                // Verificar se o next aponta para um nó válido
                // Quando há resposta de Input, o next já aponta para o próximo nó
                const nextNode = nodes.filter(node => node.id === next)[0];
                if (nextNode) {
                    // Usar o próximo nó diretamente (pode ser qualquer tipo, não apenas Menu)
                    nodeSelected = nextNode;
                    console.log(`[FLOW - FACEBOOK] Usando próximo nó após Input: ${nextNode.id}, tipo: ${nextNode.type}`);
                } else {
                    // Se não encontrou o nó, assumir Menu (comportamento padrão)
                    console.log(`[FLOW - FACEBOOK] Nó ${next} não encontrado, assumindo Menu`);
                    nodeSelected = {
                        type: "menu"
                    };
                }
            } else {
                nodeSelected = nodes.filter(node => node.id === execFn)[0];
            }
        } else {
            const otherNode = nodes.filter(node => node.id === next)[0];
            if (otherNode) {
                nodeSelected = otherNode;
            }
        }

        // ✅ CORRIGIDO: Verificar se nodeSelected foi definido antes de usar
        if (!nodeSelected) {
            console.error(`[FLOW - FACEBOOK] ❌ nodeSelected é null/undefined - next: ${next}, execFn: ${execFn}, pressKey: ${pressKey}`);
            break;
        }

        // ✅ CORRIGIDO: Verificar se este nó já foi processado (exceto para Input que está aguardando resposta)
        const nodeId = nodeSelected.id;
        if (processedNodes.has(nodeId) && nodeSelected.type !== "input") {
            console.log(`[FLOW - FACEBOOK] ⚠️ Nó ${nodeId} (tipo: ${nodeSelected.type}) já foi processado nesta execução - pulando para evitar loop`);
            
            // ✅ CORRIGIDO: Seguir as conexões até encontrar um nó não processado ou até o final
            let currentNext = nodeId;
            let foundNext = false;
            let iterations = 0;
            const maxIterations = 20; // Limite de segurança para evitar loop infinito
            
            while (iterations < maxIterations && !foundNext) {
                const nextConnection = connects.filter(
                    connect => connect.source === currentNext && connect.sourceHandle === "a"
                )[0] || connects.filter(
                    connect => connect.source === currentNext
                )[0];
                
                if (!nextConnection) {
                    console.log(`[FLOW - FACEBOOK] Não há mais conexões após ${currentNext} - encerrando fluxo`);
                    next = "";
                    break;
                }
                
                const potentialNextId = nextConnection.target;
                const potentialNextNode = nodes.filter(node => node.id === potentialNextId)[0];
                
                if (!potentialNextNode) {
                    console.log(`[FLOW - FACEBOOK] Nó ${potentialNextId} não encontrado - encerrando fluxo`);
                    next = "";
                    break;
                }
                
                // Se é um Input, verificar se já foi respondido
                if (potentialNextNode.type === "input") {
                    // ✅ CORRIGIDO: Fazer type assertion para acessar variableName do Input node
                    const nextInputData = potentialNextNode.data as any;
                    const nextInputVar = nextInputData?.variableName;
                    const nextAlwaysAsk = nextInputData?.alwaysAsk || false;
                    if (nextInputVar && ticket) {
                        const nextInputIdentifier = `${ticket.id}_${nextInputVar}`;
                        const nextInputResponded = global.flowVariables?.[nextInputIdentifier];
                        // Só pular se já foi respondido E alwaysAsk não estiver ativado
                        if (nextInputResponded && !nextAlwaysAsk) {
                            // Input já foi respondido, continuar buscando
                            console.log(`[FLOW - FACEBOOK] Input ${potentialNextId} já foi respondido, buscando próximo nó`);
                            currentNext = potentialNextId;
                            iterations++;
                            continue;
                        }
                    }
                }
                
                // Se o nó não foi processado, usar ele
                // Para Inputs, verificar se já foi respondido antes de usar
                if (potentialNextNode.type === "input") {
                    // Verificar se este Input já foi respondido
                    const nextInputData = potentialNextNode.data as any;
                    const nextInputVar = nextInputData?.variableName;
                    const nextAlwaysAsk = nextInputData?.alwaysAsk || false;
                    if (nextInputVar && ticket) {
                        const nextInputIdentifier = `${ticket.id}_${nextInputVar}`;
                        const nextInputResponded = global.flowVariables?.[nextInputIdentifier];
                        // Se alwaysAsk está ativado OU Input não foi respondido, pode usar
                        if ((nextAlwaysAsk || !nextInputResponded) && !processedNodes.has(potentialNextId)) {
                            // Input pode ser processado (alwaysAsk ou não foi respondido) e não foi processado, usar ele
                            next = potentialNextId;
                            foundNext = true;
                            console.log(`[FLOW - FACEBOOK] Próximo Input não processado encontrado: ${next} (alwaysAsk: ${nextAlwaysAsk})`);
                            break;
                        } else if (nextInputResponded && !nextAlwaysAsk) {
                            // Input já foi respondido e alwaysAsk não está ativado, continuar buscando
                            console.log(`[FLOW - FACEBOOK] Input ${potentialNextId} já foi respondido, continuando busca`);
                            currentNext = potentialNextId;
                            iterations++;
                            continue;
                        }
                    }
                }
                
                if (!processedNodes.has(potentialNextId)) {
                    next = potentialNextId;
                    foundNext = true;
                    console.log(`[FLOW - FACEBOOK] Próximo nó não processado encontrado: ${next} (tipo: ${potentialNextNode.type})`);
                    break;
                }
                
                // Se foi processado, continuar buscando
                console.log(`[FLOW - FACEBOOK] Nó ${potentialNextId} também foi processado, continuando busca`);
                currentNext = potentialNextId;
                iterations++;
            }
            
            if (!foundNext && iterations >= maxIterations) {
                console.log(`[FLOW - FACEBOOK] Limite de iterações atingido ao buscar próximo nó - encerrando fluxo`);
                next = "";
            }
            
            if (next === "") {
                break;
            }
            
            continue;
        }

        // ✅ CORRIGIDO: NÃO marcar Input como processado aqui - será marcado apenas quando realmente processado
        // Inputs serão marcados como processados apenas após serem respondidos ou enviados
        if (nodeSelected.type !== "input") {
            processedNodes.add(nodeId);
            console.log(`[FLOW - FACEBOOK] Nó ${nodeId} (tipo: ${nodeSelected.type}) marcado como processado`);
        }

        // ✅ CORRIGIDO: Garantir que o ticket esteja disponível se necessário
        if (!ticket && idTicket) {
            ticket = await Ticket.findOne({
                where: { id: idTicket, companyId }
            });
            if (!ticket) {
                console.error(`[FLOW - FACEBOOK] ❌ Ticket ${idTicket} não encontrado`);
                break;
            }
        }

        if (nodeSelected.type === "ticket") {
            const queue = await ShowQueueService(nodeSelected.data.data.id, companyId)

            console.clear()
            console.log("====================================")
            console.log("              TICKET                ")
            console.log("====================================")

            selectedQueueid = queue.id;
            if (ticket) {
                await updateQueueId(ticket, companyId, queue.id)
            }

        }

        if (nodeSelected.type === "singleBlock") {
            // ✅ CORRIGIDO: Garantir que ticket esteja disponível antes de processar singleBlock
            if (!ticket && idTicket) {
                ticket = await Ticket.findOne({
                    where: { id: idTicket, companyId }
                });
                if (!ticket) {
                    console.error(`[FLOW - FACEBOOK] ❌ Ticket ${idTicket} não encontrado ao processar singleBlock`);
                    break;
                }
            }

            for (var iLoc = 0; iLoc < nodeSelected.data.seq.length; iLoc++) {
                const elementNowSelected = nodeSelected.data.seq[iLoc];

                if (elementNowSelected.includes("message")) {
                    // await SendMessageFlow(whatsapp, {
                    //   number: numberClient,
                    //   body: nodeSelected.data.elements.filter(
                    //     item => item.number === elementNowSelected
                    //   )[0].value
                    // });
                    const bodyFor = nodeSelected.data.elements.filter(
                        item => item.number === elementNowSelected
                    )[0].value;

                    if (!ticket) {
                        console.error(`[FLOW - FACEBOOK] ❌ Ticket não disponível ao processar mensagem no singleBlock`);
                        continue;
                    }

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);

                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    // ✅ CORRIGIDO: Processar variáveis de global.flowVariables antes de formatBody
                    const bodyForProcessed = processVariableValue(bodyFor, ticket?.id);
                    const bodyBot: string = formatBody(
                        `${bodyForProcessed}`,
                        ticket
                    );

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    await intervalWhats("5");

                    // ✅ NOVO: Usar MESSAGE_TAG quando fluxo foi ativado por comentário
                    // Isso permite enviar mensagens diretas para usuários que comentaram
                    const messageTag = isFromComment ? "ACCOUNT_UPDATE" : null;
                    
                    const sentMessage = await sendText(
                        contact.number,
                        bodyBot,
                        getSession.facebookUserToken,
                        messageTag,
                        commentId || null // ✅ NOVO: Passar commentId para fallback
                    );

                    // ✅ NOVO: Salvar mensagem no banco de dados
                    if (sentMessage && ticket) {
                        try {
                            const wid = sentMessage.message_id || sentMessage.id || `fb-flow-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                            
                            // ✅ NOVO: Verificar se mensagem já existe (evitar duplicação)
                            const existingMessage = await Message.findOne({
                                where: {
                                    wid: wid,
                                    ticketId: ticket.id,
                                    companyId: companyId,
                                    fromMe: true
                                }
                            });
                            
                            if (existingMessage) {
                                console.log(`[FLOW TEXT - FACEBOOK] ⚠️ Mensagem já existe (wid: ${wid}) - ignorando duplicata`);
                            } else {
                                const messageData = {
                                    wid: wid,
                                    ticketId: ticket.id,
                                    contactId: contact.id,
                                    body: bodyBot,
                                    fromMe: true,
                                    read: true,
                                    ack: 3,
                                    dataJson: JSON.stringify(sentMessage),
                                    channel: ticket.channel || "facebook"
                                };
                                await CreateMessageService({ messageData, companyId });
                                console.log(`[FLOW TEXT - FACEBOOK] ✅ Mensagem de texto salva no banco`);
                            }
                        } catch (saveError) {
                            console.error(`[FLOW TEXT - FACEBOOK] ⚠️ Erro ao salvar mensagem no banco:`, saveError);
                        }
                    }

                    await ticketDetails.update({
                        lastMessage: formatBody(bodyFor, ticket.contact)
                    });

                    if (ticket) {
                        await updateQueueId(ticket, companyId, selectedQueueid)
                    }

                    await intervalWhats("1");

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );

                }

                if (elementNowSelected.includes("interval")) {
                    await intervalWhats(
                        nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0].value
                    );
                }

                if (elementNowSelected.includes("img")) {
                    try {
                        // ✅ CORRIGIDO: Caminho correto com company{companyId}/flow/
                        const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
                        const fileName = nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0].value;
                        const mediaPath = path.join(publicFolder, `company${companyId}/flow`, fileName);

                        // ✅ CORRIGIDO: Verificar se arquivo existe antes de enviar
                        if (!fs.existsSync(mediaPath)) {
                            console.error(`[FLOW IMAGE - FACEBOOK] ❌ Arquivo de imagem não encontrado: ${mediaPath}`);
                            continue;
                        }

                        const contact = await Contact.findOne({
                            where: { number: numberPhrase.number, companyId }
                        });

                        if (!contact) {
                            console.error(`[FLOW IMAGE - FACEBOOK] ❌ Contato não encontrado: ${numberPhrase.number}`);
                            continue;
                        }

                        // Obtendo o tipo do arquivo
                        const fileExtension = path.extname(mediaPath);

                        //Obtendo o nome do arquivo sem a extensão
                        const fileNameWithoutExtension = path.basename(mediaPath, fileExtension);

                        //Obtendo o tipo do arquivo
                        const mimeType = getMimeType(mediaPath);

                        // ✅ CORRIGIDO: Domain com caminho correto incluindo company{companyId}/flow/
                        const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileName}`

                        console.log(`[FLOW IMAGE - FACEBOOK] Enviando imagem: ${domain}`);

                        await showTypingIndicator(
                            contact.number,
                            getSession.facebookUserToken,
                            "typing_on"
                        );

                        await intervalWhats("5");

                        // ✅ NOVO: Tentar enviar imagem normalmente
                        // Se falhar e for comentário, o erro será logado mas o fluxo continuará
                        const sendMessage = await sendAttachmentFromUrl(
                            contact.number,
                            domain,
                            "image",
                            getSession.facebookUserToken
                        );
                        
                        // ✅ NOVO: Se falhar e for comentário, tentar enviar link como texto com tag
                        if (!sendMessage && isFromComment) {
                            try {
                                    const imageTextMessage = `🖼️ Imagem: ${domain}`;
                                    const fallbackMessage = await sendText(
                                        contact.number,
                                        imageTextMessage,
                                        getSession.facebookUserToken,
                                        "ACCOUNT_UPDATE",
                                        commentId || null
                                    );
                                console.log(`[FLOW IMAGE - FACEBOOK] ✅ Imagem enviada como link de texto para comentário`);
                                // Usar fallbackMessage como sendMessage para salvar no banco
                                if (fallbackMessage && ticket) {
                                    const wid = fallbackMessage.message_id || fallbackMessage.id || `fb-flow-img-text-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                    const messageData = {
                                        wid: wid,
                                        ticketId: ticket.id,
                                        contactId: contact.id,
                                        body: imageTextMessage,
                                        fromMe: true,
                                        read: true,
                                        ack: 3,
                                        dataJson: JSON.stringify(fallbackMessage),
                                        channel: ticket.channel || "facebook"
                                    };
                                    await CreateMessageService({ messageData, companyId });
                                }
                            } catch (fallbackError) {
                                console.error(`[FLOW IMAGE - FACEBOOK] ⚠️ Erro ao enviar imagem como texto:`, fallbackError);
                            }
                        }

                        if (!ticket) {
                            console.error(`[FLOW IMAGE - FACEBOOK] ❌ Ticket não disponível ao processar imagem no singleBlock`);
                            continue;
                        }

                        const ticketDetails = await ShowTicketService(ticket.id, companyId);

                        // ✅ NOVO: Salvar mensagem de imagem no banco de dados
                        if (sendMessage && ticket) {
                            try {
                                const wid = sendMessage.message_id || sendMessage.id || `fb-flow-img-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                
                                // ✅ NOVO: Verificar se mensagem já existe (evitar duplicação)
                                // Verificar por wid primeiro
                                let existingMessage = await Message.findOne({
                                    where: {
                                        wid: wid,
                                        ticketId: ticket.id,
                                        companyId: companyId,
                                        fromMe: true
                                    }
                                });
                                
                                // ✅ NOVO: Se não encontrou por wid, verificar por conteúdo e timestamp recente (últimos 10 segundos)
                                // Isso evita duplicação quando o Facebook envia echo com mid diferente
                                if (!existingMessage) {
                                    const messageBody = `${fileNameWithoutExtension}${fileExtension}`;
                                    existingMessage = await Message.findOne({
                                        where: {
                                            body: messageBody,
                                            ticketId: ticket.id,
                                            companyId: companyId,
                                            fromMe: true,
                                            mediaType: "image",
                                            createdAt: {
                                                [Op.gte]: new Date(Date.now() - 10000) // Últimos 10 segundos
                                            }
                                        },
                                        order: [["createdAt", "DESC"]],
                                        limit: 1
                                    });
                                }
                                
                                if (existingMessage) {
                                    console.log(`[FLOW IMAGE - FACEBOOK] ⚠️ Mensagem já existe (wid: ${existingMessage.wid}) - ignorando duplicata`);
                                } else {
                                    // ✅ CORRIGIDO: Salvar mediaUrl com caminho relativo incluindo "flow/"
                                    // Os arquivos do fluxo ficam em public/company{companyId}/flow/
                                    // O modelo Message vai construir: ${BACKEND_URL}/public/company${companyId}/flow/${fileName}
                                    const messageData = {
                                        wid: wid,
                                        ticketId: ticket.id,
                                        contactId: contact.id,
                                        body: `${fileNameWithoutExtension}${fileExtension}`,
                                        fromMe: true,
                                        mediaType: "image",
                                        mediaUrl: `flow/${fileName}`, // ✅ CORRIGIDO: Incluir "flow/" no caminho
                                        read: true,
                                        ack: 3,
                                        dataJson: JSON.stringify(sendMessage),
                                        channel: ticket.channel || "facebook"
                                    };
                                    await CreateMessageService({ messageData, companyId });
                                    console.log(`[FLOW IMAGE - FACEBOOK] ✅ Mensagem de imagem salva no banco com mediaUrl: flow/${fileName}`);
                                }
                            } catch (saveError) {
                                console.error(`[FLOW IMAGE - FACEBOOK] ⚠️ Erro ao salvar mensagem no banco:`, saveError);
                            }
                        }

                        await ticketDetails.update({
                            lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                        });

                        await showTypingIndicator(
                            contact.number,
                            getSession.facebookUserToken,
                            "typing_off"
                        );

                        console.log(`[FLOW IMAGE - FACEBOOK] ✅ Imagem enviada com sucesso`);
                    } catch (error) {
                        console.error(`[FLOW IMAGE - FACEBOOK] ❌ Erro ao enviar imagem:`, error);
                        // ✅ CORRIGIDO: Continuar o fluxo mesmo se houver erro ao enviar imagem
                        // O erro não deve interromper o fluxo, apenas logar e continuar
                        // Não usar continue aqui, pois isso interromperia o loop do singleBlock
                    }
                }

                if (elementNowSelected.includes("audio")) {
                    // ✅ CORRIGIDO: Caminho correto com company{companyId}/flow/
                    const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
                    const fileName = nodeSelected.data.elements.filter(
                        item => item.number === elementNowSelected
                    )[0].value;
                    const mediaDirectory = path.join(publicFolder, `company${companyId}/flow`, fileName);

                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    // Obtendo o tipo do arquivo
                    const fileExtension = path.extname(mediaDirectory);

                    //Obtendo o nome do arquivo sem a extensão
                    const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

                    //Obtendo o tipo do arquivo
                    const mimeType = getMimeType(mediaDirectory);

                    const fileNotExists = path.resolve(__dirname, "..", "..", "..", "..", "public", `company${companyId}/flow`, fileNameWithoutExtension + ".mp4");

                    if (!fs.existsSync(fileNotExists)) {
                        const folder = path.resolve(__dirname, "..", "..", "..", "..", "public", `company${companyId}/flow`, fileNameWithoutExtension + fileExtension);
                        await convertAudio(folder)
                    }

                    // ✅ CORRIGIDO: Domain com caminho correto incluindo company{companyId}/flow/
                    const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileNameWithoutExtension}.mp4`


                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    await intervalWhats("5");

                    const sendMessage = await sendAttachmentFromUrl(
                        contact.number,
                        domain,
                        "audio",
                        getSession.facebookUserToken
                    );

                    if (!ticket) {
                        console.error(`[FLOW AUDIO - FACEBOOK] ❌ Ticket não disponível ao processar áudio no singleBlock`);
                        continue;
                    }

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);

                    await ticketDetails.update({
                        lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                    });

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );

                }

                if (elementNowSelected.includes("video")) {
                    // ✅ CORRIGIDO: Caminho correto com company{companyId}/flow/
                    const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
                    const fileName = nodeSelected.data.elements.filter(
                        item => item.number === elementNowSelected
                    )[0].value;
                    const mediaDirectory = path.join(publicFolder, `company${companyId}/flow`, fileName);

                    // ✅ CORRIGIDO: Verificar se arquivo existe antes de enviar
                    if (!fs.existsSync(mediaDirectory)) {
                        console.error(`[FLOW VIDEO - FACEBOOK] ❌ Arquivo de vídeo não encontrado: ${mediaDirectory}`);
                        continue;
                    }

                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    // Obtendo o tipo do arquivo
                    const fileExtension = path.extname(mediaDirectory);

                    //Obtendo o nome do arquivo sem a extensão
                    const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

                    //Obtendo o tipo do arquivo
                    const mimeType = getMimeType(mediaDirectory);

                    // ✅ CORRIGIDO: Domain com caminho correto incluindo company{companyId}/flow/
                    const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileName}`


                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    const sendMessage = await sendAttachmentFromUrl(
                        contact.number,
                        domain,
                        "video",
                        getSession.facebookUserToken
                    );

                    if (!ticket) {
                        console.error(`[FLOW VIDEO - FACEBOOK] ❌ Ticket não disponível ao processar vídeo no singleBlock`);
                        continue;
                    }

                    const ticketDetails = await ShowTicketService(ticket.id, companyId);

                    await ticketDetails.update({
                        lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                    });

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );
                }

                // ✅ NOVO: Tratar documentos/PDFs no singleBlock
                if (elementNowSelected.includes("document") || elementNowSelected.includes("file") || elementNowSelected.includes("pdf")) {
                    try {
                        // ✅ NOVO: Verificar se é Instagram - Instagram não suporta documentos/PDFs
                        if (!ticket && idTicket) {
                            ticket = await Ticket.findByPk(idTicket);
                        }
                        
                        // Se ainda não tiver ticket, tentar carregar do ticketInit
                        if (!ticket && ticketInit) {
                            ticket = ticketInit;
                        }
                        
                        const channel = ticket?.channel || "facebook";
                        
                        if (channel === "instagram") {
                            console.log(`[FLOW DOCUMENT - INSTAGRAM] ⚠️ Instagram não suporta documentos/PDFs. Pulando envio do arquivo.`);
                            
                            // ✅ NOVO: Enviar mensagem de texto informando que o documento não pode ser enviado
                            const contact = await Contact.findOne({
                                where: { number: numberPhrase.number, companyId }
                            });
                            
                            if (contact && ticket) {
                                const fallbackMessage = "📎 Desculpe, o Instagram não suporta o envio de documentos. Por favor, entre em contato através do Facebook Messenger para receber este arquivo.";
                                
                                try {
                                    // ✅ NOVO: Usar tag quando for comentário
                                    const messageTag = isFromComment ? "ACCOUNT_UPDATE" : null;
                                    const sentMessage = await sendText(
                                        contact.number,
                                        fallbackMessage,
                                        getSession.facebookUserToken,
                                        messageTag,
                                        commentId || null
                                    );
                                    
                                    if (sentMessage && ticket) {
                                        try {
                                            const wid = sentMessage.message_id || sentMessage.id || `fb-flow-msg-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                            
                                            const existingMessage = await Message.findOne({
                                                where: {
                                                    wid: wid,
                                                    ticketId: ticket.id,
                                                    companyId: companyId,
                                                    fromMe: true
                                                }
                                            });
                                            
                                            if (!existingMessage) {
                                                const messageData = {
                                                    wid: wid,
                                                    ticketId: ticket.id,
                                                    contactId: contact.id,
                                                    body: fallbackMessage,
                                                    fromMe: true,
                                                    read: true,
                                                    ack: 3,
                                                    dataJson: JSON.stringify(sentMessage),
                                                    channel: channel
                                                };
                                                await CreateMessageService({ messageData, companyId });
                                                console.log(`[FLOW DOCUMENT - INSTAGRAM] ✅ Mensagem de fallback enviada`);
                                            }
                                        } catch (saveError) {
                                            console.error(`[FLOW DOCUMENT - INSTAGRAM] ⚠️ Erro ao salvar mensagem de fallback:`, saveError);
                                        }
                                    }
                                } catch (error) {
                                    console.error(`[FLOW DOCUMENT - INSTAGRAM] ⚠️ Erro ao enviar mensagem de fallback:`, error);
                                }
                            }
                            
                            // Continuar o fluxo normalmente
                            continue;
                        }
                        
                        const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
                        const fileName = nodeSelected.data.elements.filter(
                            item => item.number === elementNowSelected
                        )[0].value;
                        const mediaPath = path.join(publicFolder, `company${companyId}/flow`, fileName);

                        if (!fs.existsSync(mediaPath)) {
                            console.error(`[FLOW DOCUMENT - FACEBOOK] ❌ Arquivo não encontrado: ${mediaPath}`);
                            continue;
                        }

                        const contact = await Contact.findOne({
                            where: { number: numberPhrase.number, companyId }
                        });

                        if (!contact) {
                            console.error(`[FLOW DOCUMENT - FACEBOOK] ❌ Contato não encontrado: ${numberPhrase.number}`);
                            continue;
                        }

                        const fileExtension = path.extname(mediaPath);
                        const fileNameWithoutExtension = path.basename(mediaPath, fileExtension);
                        const mimeType = getMimeType(mediaPath);

                        // Determinar tipo de attachment baseado na extensão
                        let attachmentType = "file";
                        if (fileExtension.toLowerCase() === ".pdf") {
                            attachmentType = "file"; // Facebook usa "file" para PDFs
                        }

                        const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileName}`;

                        console.log(`[FLOW DOCUMENT - FACEBOOK] Enviando documento: ${domain}`);

                        await showTypingIndicator(
                            contact.number,
                            getSession.facebookUserToken,
                            "typing_on"
                        );

                        await intervalWhats("5");

                        let sendMessage = null;
                        try {
                            sendMessage = await sendAttachmentFromUrl(
                                contact.number,
                                domain,
                                attachmentType,
                                getSession.facebookUserToken
                            );
                            
                            if (!sendMessage) {
                                console.error(`[FLOW DOCUMENT - FACEBOOK] ⚠️ Erro ao enviar documento - sendMessage é null`);
                                // ✅ CORRIGIDO: Continuar o fluxo mesmo se o envio falhar
                                continue;
                            }
                        } catch (error) {
                            console.error(`[FLOW DOCUMENT - FACEBOOK] ⚠️ Erro ao enviar documento:`, error);
                            // ✅ CORRIGIDO: Continuar o fluxo mesmo se o envio falhar
                            continue;
                        }

                        if (!ticket) {
                            console.error(`[FLOW DOCUMENT - FACEBOOK] ❌ Ticket não disponível ao processar documento no singleBlock`);
                            continue;
                        }

                        const ticketDetails = await ShowTicketService(ticket.id, companyId);

                        // ✅ NOVO: Salvar mensagem de documento no banco de dados
                        // ✅ CORRIGIDO: Verificar se sendMessage não é null (pode ser null em caso de erro)
                        if (sendMessage && ticket) {
                            try {
                                const wid = sendMessage.message_id || sendMessage.id || `fb-flow-doc-${Date.now()}-${Math.random().toString(36).substring(7)}`;
                                
                                // ✅ NOVO: Verificar se mensagem já existe (evitar duplicação)
                                // Verificar por wid primeiro
                                let existingMessage = await Message.findOne({
                                    where: {
                                        wid: wid,
                                        ticketId: ticket.id,
                                        companyId: companyId,
                                        fromMe: true
                                    }
                                });
                                
                                // ✅ NOVO: Se não encontrou por wid, verificar por conteúdo e timestamp recente (últimos 10 segundos)
                                // Isso evita duplicação quando o Facebook envia echo com mid diferente
                                if (!existingMessage) {
                                    const messageBody = `${fileNameWithoutExtension}${fileExtension}`;
                                    existingMessage = await Message.findOne({
                                        where: {
                                            body: messageBody,
                                            ticketId: ticket.id,
                                            companyId: companyId,
                                            fromMe: true,
                                            mediaType: attachmentType,
                                            createdAt: {
                                                [Op.gte]: new Date(Date.now() - 10000) // Últimos 10 segundos
                                            }
                                        },
                                        order: [["createdAt", "DESC"]],
                                        limit: 1
                                    });
                                }
                                
                                if (existingMessage) {
                                    console.log(`[FLOW DOCUMENT - FACEBOOK] ⚠️ Mensagem já existe (wid: ${existingMessage.wid}) - ignorando duplicata`);
                                } else {
                                    // ✅ CORRIGIDO: Salvar mediaUrl com caminho relativo incluindo "flow/"
                                    // Os arquivos do fluxo ficam em public/company{companyId}/flow/
                                    // O modelo Message vai construir: ${BACKEND_URL}/public/company${companyId}/flow/${fileName}
                                    const messageData = {
                                        wid: wid,
                                        ticketId: ticket.id,
                                        contactId: contact.id,
                                        body: `${fileNameWithoutExtension}${fileExtension}`,
                                        fromMe: true,
                                        mediaType: attachmentType,
                                        mediaUrl: `flow/${fileName}`, // ✅ CORRIGIDO: Incluir "flow/" no caminho
                                        read: true,
                                        ack: 3,
                                        dataJson: JSON.stringify(sendMessage),
                                        channel: ticket.channel || "facebook"
                                    };
                                    await CreateMessageService({ messageData, companyId });
                                    console.log(`[FLOW DOCUMENT - FACEBOOK] ✅ Mensagem de documento salva no banco com mediaUrl: flow/${fileName}`);
                                }
                            } catch (saveError) {
                                console.error(`[FLOW DOCUMENT - FACEBOOK] ⚠️ Erro ao salvar mensagem no banco:`, saveError);
                            }
                        }

                        await ticketDetails.update({
                            lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
                        });

                        await showTypingIndicator(
                            contact.number,
                            getSession.facebookUserToken,
                            "typing_off"
                        );

                        console.log(`[FLOW DOCUMENT - FACEBOOK] ✅ Documento enviado com sucesso`);
                    } catch (error) {
                        console.error(`[FLOW DOCUMENT - FACEBOOK] ❌ Erro ao enviar documento:`, error);
                        // Continuar o fluxo mesmo se houver erro
                    }
                }

            }
        }

        if (nodeSelected.type === "img") {
            // ✅ CORRIGIDO: Caminho correto com company{companyId}/flow/
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
            const fileName = nodeSelected.data.url;
            const mediaPath = path.join(publicFolder, `company${companyId}/flow`, fileName);

            // ✅ CORRIGIDO: Verificar se arquivo existe antes de enviar
            if (!fs.existsSync(mediaPath)) {
                console.error(`[FLOW IMAGE - FACEBOOK] ❌ Arquivo de imagem não encontrado: ${mediaPath}`);
                continue;
            }

            // Obtendo o tipo do arquivo
            const fileExtension = path.extname(mediaPath);

            //Obtendo o nome do arquivo sem a extensão
            const fileNameWithoutExtension = path.basename(mediaPath, fileExtension);

            //Obtendo o tipo do arquivo
            const mimeType = getMimeType(mediaPath);

            // ✅ CORRIGIDO: Domain com caminho correto incluindo company{companyId}/flow/
            const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileName}`

            const contact = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });

            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_on"
            );

            await intervalWhats("5");

            const sendMessage = await sendAttachmentFromUrl(
                contact.number,
                domain,
                "image",
                getSession.facebookUserToken
            );

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await ticketDetails.update({
                lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
            });

            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_off"
            );
        }

        if (nodeSelected.type === "audio") {
            // ✅ CORRIGIDO: Caminho correto com company{companyId}/flow/
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
            const fileName = nodeSelected.data.url;
            const mediaDirectory = path.join(publicFolder, `company${companyId}/flow`, fileName);

            // ✅ CORRIGIDO: Verificar se arquivo existe antes de enviar
            if (!fs.existsSync(mediaDirectory)) {
                console.error(`[FLOW AUDIO - FACEBOOK] ❌ Arquivo de áudio não encontrado: ${mediaDirectory}`);
                continue;
            }

            const contact = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });

            // Obtendo o tipo do arquivo
            const fileExtension = path.extname(mediaDirectory);

            //Obtendo o nome do arquivo sem a extensão
            const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

            //Obtendo o tipo do arquivo
            const mimeType = getMimeType(mediaDirectory);

            // ✅ CORRIGIDO: Domain com caminho correto incluindo company{companyId}/flow/
            const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileName}`


            const sendMessage = await sendAttachmentFromUrl(
                contact.number,
                domain,
                "audio",
                getSession.facebookUserToken
            );

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await ticketDetails.update({
                lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact)
            });

            await intervalWhats("1");
        }

        if (nodeSelected.type === "interval") {
            await intervalWhats(nodeSelected.data.sec);
        }

        // ✅ CORRIGIDO: Implementação do Input node para Facebook/Instagram
        if (nodeSelected.type === "input") {
            try {
                console.log(`[INPUT NODE - FACEBOOK] Processando Input node - Ticket: ${idTicket}, pressKey: ${pressKey}`);
                
                // Garantir que o ticket esteja disponível
                if (!ticket && idTicket) {
                    ticket = await Ticket.findOne({
                        where: { id: idTicket, companyId }
                    });

                    if (!ticket) {
                        console.error(`[INPUT NODE - FACEBOOK] ❌ Ticket ${idTicket} não encontrado`);
                        continue;
                    }
                }

                let question = nodeSelected.data.question || "";
                const variableName = nodeSelected.data.variableName || "";

                if (!variableName) {
                    console.error(`[INPUT NODE - FACEBOOK] ❌ VariableName não definido`);
                    continue;
                }

                // Verifica se este input específico já foi respondido
                const inputIdentifier = `${ticket.id}_${variableName}`;
                global.flowVariables = global.flowVariables || {};
                const thisInputResponded = global.flowVariables[inputIdentifier];
                const alwaysAsk = nodeSelected.data?.alwaysAsk || false;

                console.log(`[INPUT NODE - FACEBOOK] Debug - Ticket ${ticket.id}, Variable: ${variableName}, InputIdentifier: ${inputIdentifier}`);
                console.log(`[INPUT NODE - FACEBOOK] Debug - pressKey: ${pressKey}, thisInputResponded: ${thisInputResponded}, alwaysAsk: ${alwaysAsk}`);

                // ✅ CORRIGIDO: Se pressKey é "999", verificar se este Input está aguardando resposta
                // Se não estiver aguardando e não foi respondido, processar normalmente
                // EXCETO se alwaysAsk estiver ativado
                if (pressKey === "999" && thisInputResponded && !alwaysAsk) {
                    console.log(`[INPUT NODE - FACEBOOK] pressKey é 999 e Input já foi respondido - pulando e continuando fluxo`);
                    // Buscar próximo nó da conexão
                    const outputConnection = connects.filter(
                        connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
                    )[0];
                    if (outputConnection) {
                        next = outputConnection.target;
                        pressKey = undefined;
                        processedNodes.add(nodeSelected.id); // Marcar como processado
                        continue;
                    } else {
                        console.error(`[INPUT NODE - FACEBOOK] ❌ Nenhuma conexão encontrada após Input com pressKey 999`);
                        break;
                    }
                }
                
                // Se pressKey é "999" mas Input não foi respondido, limpar pressKey para processar como novo Input
                if (pressKey === "999") {
                    console.log(`[INPUT NODE - FACEBOOK] pressKey é 999 mas Input não foi respondido - processando como novo Input`);
                    pressKey = undefined;
                }

                // ✅ CORRIGIDO: Se há pressKey, só processar se for uma resposta para este Input específico
                // Verificar se o ticket está aguardando resposta deste Input específico
                // Se não estiver aguardando, não processar o pressKey - pode ser uma resposta de outro Input
                const ticketWaitingInput = (ticket.dataWebhook as any)?.waitingInput === true;
                const ticketInputVariable = (ticket.dataWebhook as any)?.inputVariableName;
                const isThisInputWaiting = ticketWaitingInput && ticketInputVariable === variableName;
                
                // Se há pressKey mas este Input não está aguardando resposta, limpar pressKey para processar como novo Input
                if (pressKey && !isThisInputWaiting && !thisInputResponded) {
                    console.log(`[INPUT NODE - FACEBOOK] pressKey presente mas este Input (${variableName}) não está aguardando resposta - limpando pressKey para processar como novo Input`);
                    pressKey = undefined;
                }
                
                if (pressKey && !thisInputResponded && isThisInputWaiting) {
                    console.log(`[INPUT NODE - FACEBOOK] Processando resposta do input - Variable: ${variableName}, Valor: ${pressKey}`);
                    
                    // Salvar o valor da resposta na variável
                    global.flowVariables[variableName] = pressKey;
                    global.flowVariables[inputIdentifier] = pressKey;
                    console.log(`[INPUT NODE - FACEBOOK] Variável salva: ${variableName} = ${pressKey}, ${inputIdentifier} = ${pressKey}`);

                    // ✅ CORRIGIDO: Buscar o próximo nó da conexão de saída do Input
                    const outputConnection = connects.filter(
                        connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
                    )[0];
                    
                    if (outputConnection) {
                        next = outputConnection.target;
                        console.log(`[INPUT NODE - FACEBOOK] Continuando para próximo nó da conexão: ${next}`);
                    } else {
                        // Fallback: usar savedNext se conexão não existir
                        const savedNext = global.flowVariables[`${inputIdentifier}_next`] || 
                                         (dataWebhook as any)?.nextNodeId;
                        if (savedNext) {
                            next = savedNext;
                            console.log(`[INPUT NODE - FACEBOOK] Usando savedNext como fallback: ${next}`);
                        } else {
                            console.error(`[INPUT NODE - FACEBOOK] ❌ Próximo nó não encontrado!`);
                        }
                    }

                    await ticket.update({
                        dataWebhook: {
                            ...ticket.dataWebhook,
                            waitingInput: false,
                            inputProcessed: true
                        }
                    });

                    // ✅ CORRIGIDO: Marcar Input como processado APÓS ser respondido
                    processedNodes.add(nodeSelected.id);
                    console.log(`[INPUT NODE - FACEBOOK] Input ${nodeSelected.id} marcado como processado após resposta`);

                    // ✅ CORRIGIDO: Marcar que o Input foi processado e continuar o fluxo
                    // Limpar pressKey e usar continue para processar o próximo nó
                    pressKey = undefined;
                    console.log(`[INPUT NODE - FACEBOOK] Input processado, continuando fluxo para nó: ${next}`);
                    continue; // Continuar para próxima iteração processando o próximo nó
                }

                // Se este input já foi respondido, continuar para o próximo nó
                // EXCETO se alwaysAsk estiver ativado
                if (thisInputResponded && !alwaysAsk) {
                    console.log(`[INPUT NODE - FACEBOOK] Input já respondido anteriormente - pulando - Ticket ${ticket.id}`);
                    
                    // ✅ CORRIGIDO: Buscar o próximo nó da conexão de saída do Input, não do savedNext
                    // O savedNext pode estar desatualizado
                    const outputConnection = connects.filter(
                        connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
                    )[0];
                    
                    if (outputConnection) {
                        next = outputConnection.target;
                        console.log(`[INPUT NODE - FACEBOOK] Continuando para próximo nó da conexão: ${next}`);
                        // ✅ CORRIGIDO: Marcar Input como processado e continuar
                        processedNodes.add(nodeSelected.id);
                    } else {
                        // Fallback: tentar usar savedNext se conexão não existir
                        const savedNext = global.flowVariables[`${inputIdentifier}_next`] || 
                                         (dataWebhook as any)?.nextNodeId;
                        if (savedNext) {
                            next = savedNext;
                            console.log(`[INPUT NODE - FACEBOOK] Usando savedNext como fallback: ${next}`);
                            processedNodes.add(nodeSelected.id);
                        } else {
                            console.error(`[INPUT NODE - FACEBOOK] ❌ Próximo nó não encontrado para Input já respondido`);
                            break;
                        }
                    }
                    
                    // Limpar a variável após uso
                    delete global.flowVariables[`${inputIdentifier}_next`];
                    
                    await ticket.update({
                        dataWebhook: {
                            ...ticket.dataWebhook,
                            waitingInput: false
                        }
                    });
                    
                    continue;
                } else {
                    console.log(`[INPUT NODE - FACEBOOK] Processando novo input - Ticket ${ticket.id}`);

                    // ✅ CORRIGIDO: Verificar se o ticket está "open" antes de enviar mensagem do Input
                    if (idTicket) {
                        const currentTicket = await Ticket.findByPk(idTicket);
                        if (currentTicket && currentTicket.status === "open") {
                            console.log(`[INPUT NODE - FACEBOOK] ⚠️ Ticket ${idTicket} está OPEN - Parando fluxo e não enviando mensagem do Input`);
                            await currentTicket.update({
                                dataWebhook: {
                                    ...currentTicket.dataWebhook,
                                    waitingInput: false,
                                    inputVariableName: null,
                                    inputIdentifier: null,
                                    nextNodeId: null
                                }
                            });
                            return "stopped_by_open_ticket";
                        }
                        ticket = currentTicket;
                    }

                    // Enviar a pergunta e aguardar resposta
                    await intervalWhats("1");

                    if (!numberPhrase || !numberPhrase.number) {
                        console.error(`[INPUT NODE - FACEBOOK] ❌ numberPhrase não definido`);
                        continue;
                    }

                    const contact = await Contact.findOne({
                        where: { number: numberPhrase.number, companyId }
                    });

                    if (!contact) {
                        console.error(`[INPUT NODE - FACEBOOK] ❌ Contato não encontrado: ${numberPhrase.number}`);
                        continue;
                    }

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_on"
                    );

                    await intervalWhats("2");

                    // ✅ NOVO: Usar tag quando for comentário
                    const messageTag = isFromComment ? "ACCOUNT_UPDATE" : null;
                    await sendText(
                        contact.number,
                        question,
                        getSession.facebookUserToken,
                        messageTag,
                        commentId || null
                    );

                    await showTypingIndicator(
                        contact.number,
                        getSession.facebookUserToken,
                        "typing_off"
                    );

                    // Salvar a conexão de saída para ser usada quando o fluxo for retomado
                    const outputConnection = connects.filter(
                        connect => connect.source === nodeSelected.id && connect.sourceHandle === "a"
                    )[0];

                    const nextNodeId = outputConnection ? outputConnection.target : next;

                    console.log(`[INPUT NODE - FACEBOOK] Preparando ticket ${ticket.id} para aguardar input - Variable: ${variableName}, NextNodeId: ${nextNodeId}`);

                    await ticket.update({
                        status: "pending",
                        lastFlowId: nodeSelected.id,
                        flowWebhook: true,
                        hashFlowId: hashWebhookId || "",
                        flowStopped: idFlowDb.toString(),
                        dataWebhook: {
                            ...ticket.dataWebhook,
                            flowId: idFlowDb,
                            waitingInput: true,
                            inputVariableName: variableName,
                            inputIdentifier: inputIdentifier,
                            nextNodeId: nextNodeId
                        }
                    });

                    console.log(`[INPUT NODE - FACEBOOK] ✅ Ticket ${ticket.id} configurado para aguardar input - Variable: ${variableName}, NextNodeId: ${nextNodeId}`);

                    global.flowVariables[`${inputIdentifier}_next`] = nextNodeId;

                    // ✅ CORRIGIDO: NÃO marcar Input como processado aqui - ele está aguardando resposta
                    // O Input só será marcado como processado quando for respondido
                    
                    break; // Parar o fluxo para aguardar a resposta
                }
            } catch (error) {
                console.error(`[INPUT NODE - FACEBOOK] ❌ Erro ao processar Input node:`, error);
            }
        }

        if (nodeSelected.type === "video") {
            // ✅ CORRIGIDO: Caminho correto com company{companyId}/flow/
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "..", "public");
            const fileName = nodeSelected.data.url;
            const mediaDirectory = path.join(publicFolder, `company${companyId}/flow`, fileName);

            // ✅ CORRIGIDO: Verificar se arquivo existe antes de enviar
            if (!fs.existsSync(mediaDirectory)) {
                console.error(`[FLOW VIDEO - FACEBOOK] ❌ Arquivo de vídeo não encontrado: ${mediaDirectory}`);
                continue;
            }

            const contact = await Contact.findOne({
                where: { number: numberPhrase.number, companyId }
            });

            // Obtendo o tipo do arquivo
            const fileExtension = path.extname(mediaDirectory);

            //Obtendo o nome do arquivo sem a extensão
            const fileNameWithoutExtension = path.basename(mediaDirectory, fileExtension);

            //Obtendo o tipo do arquivo
            const mimeType = getMimeType(mediaDirectory);

            // ✅ CORRIGIDO: Domain com caminho correto incluindo company{companyId}/flow/
            const domain = `${process.env.BACKEND_URL}/public/company${companyId}/flow/${fileName}`


            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_on"
            );

            const sendMessage = await sendAttachmentFromUrl(
                contact.number,
                domain,
                "video",
                getSession.facebookUserToken
            );

            const ticketDetails = await ShowTicketService(ticket.id, companyId);

            await ticketDetails.update({
                lastMessage: formatBody(`${fileNameWithoutExtension}${fileExtension}`, ticket.contact),
            });

            await showTypingIndicator(
                contact.number,
                getSession.facebookUserToken,
                "typing_off"
            );
        }

        let isSwitchFlow: boolean;
        if (nodeSelected.type === "switchFlow") {
            console.log(`[SWITCH FLOW - FACEBOOK] ========== ACIONANDO OUTRO FLUXO ==========`);
            console.log(`[SWITCH FLOW - FACEBOOK] Nó ID: ${nodeSelected.id}`);
            console.log(`[SWITCH FLOW - FACEBOOK] Ticket ID: ${ticket?.id || idTicket}`);

            const data = nodeSelected.data?.flowSelected;
            
            console.log(`[SWITCH FLOW - FACEBOOK] Dados do fluxo selecionado: ${JSON.stringify(data)}`);

            if (!data) {
                console.error(`[SWITCH FLOW - FACEBOOK] ❌ Nenhum fluxo foi selecionado no nó!`);
                break;
            }

            if (ticket) {
                ticket = await Ticket.findOne({
                    where: {
                        id: ticket.id
                    },
                    include: [
                        { model: Contact, as: "contact", attributes: ["id", "name"] }
                    ]
                });
            } else {
                ticket = await Ticket.findOne({
                    where: {
                        id: idTicket
                    },
                    include: [
                        { model: Contact, as: "contact", attributes: ["id", "name"] }
                    ]
                });
            }

            if (!ticket) {
                console.error(`[SWITCH FLOW - FACEBOOK] ❌ Ticket não encontrado!`);
                break;
            }

            console.log(`[SWITCH FLOW - FACEBOOK] Fluxo de destino: ${data?.name || 'N/A'} (ID: ${data?.id || 'N/A'})`);
            console.log(`[SWITCH FLOW - FACEBOOK] Resetando estado do ticket antes de mudar de fluxo`);

            // ✅ CORRIGIDO: Resetar o fluxo atual antes de iniciar o novo
            await ticket.update({
                flowWebhook: false,
                lastFlowId: null,
                hashFlowId: null,
                flowStopped: null,
                dataWebhook: null
            });

            console.log(`[SWITCH FLOW - FACEBOOK] Ticket resetado - iniciando novo fluxo`);

            isSwitchFlow = true;

            // ✅ CORRIGIDO: Chamar switchFlow corretamente com await
            await switchFlow(data, companyId, ticket, getSession);
            break;
        }

        let isRandomizer: boolean;
        if (nodeSelected.type === "randomizer") {
            const selectedRandom = randomizarCaminho(nodeSelected.data.percent / 100);

            const resultConnect = connects.filter(
                connect => connect.source === nodeSelected.id
            );
            if (selectedRandom === "A") {
                next = resultConnect.filter(item => item.sourceHandle === "a")[0]
                    .target;
                noAlterNext = true;
            } else {
                next = resultConnect.filter(item => item.sourceHandle === "b")[0]
                    .target;
                noAlterNext = true;
            }
            isRandomizer = true;
        }

        let isMenu: boolean;
        if (nodeSelected.type === "menu") {
            if (pressKey) {
                // ✅ CORRIGIDO: Verificar se ticket está "open" antes de processar resposta do menu
                if (idTicket) {
                    const currentTicket = await Ticket.findByPk(idTicket);
                    if (currentTicket && currentTicket.status === "open") {
                        console.log(`[MENU NODE - FACEBOOK] ⚠️ Ticket ${idTicket} está OPEN - Parando fluxo e não processando Menu`);
                        await currentTicket.update({
                            flowWebhook: false,
                            lastFlowId: null,
                            hashFlowId: null,
                            flowStopped: null,
                            dataWebhook: null
                        });
                        return "stopped_by_open_ticket";
                    }
                    ticket = currentTicket;
                }

                const filterOne = connectStatic.filter(confil => confil.source === next)
                const filterTwo = filterOne.filter(filt2 => filt2.sourceHandle === "a" + pressKey)
                if (filterTwo.length > 0) {
                    execFn = filterTwo[0].target
                } else {
                    execFn = undefined
                }
                // execFn =
                //   connectStatic
                //     .filter(confil => confil.source === next)
                //     .filter(filt2 => filt2.sourceHandle === "a" + pressKey)[0]?.target ??
                //   undefined;
                if (execFn === undefined) {
                    break;
                }
                pressKey = "999";

                const isNodeExist = nodes.filter(item => item.id === execFn);

                if (isNodeExist.length > 0) {
                    isMenu = isNodeExist[0].type === "menu" ? true : false;
                } else {
                    isMenu = false;
                }
            } else {
                // ✅ CORRIGIDO: Verificar se ticket está "open" antes de enviar menu
                if (idTicket) {
                    const currentTicket = await Ticket.findByPk(idTicket);
                    if (currentTicket && currentTicket.status === "open") {
                        console.log(`[MENU NODE - FACEBOOK] ⚠️ Ticket ${idTicket} está OPEN - Parando fluxo e não enviando Menu`);
                        await currentTicket.update({
                            flowWebhook: false,
                            lastFlowId: null,
                            hashFlowId: null,
                            flowStopped: null,
                            dataWebhook: null
                        });
                        return "stopped_by_open_ticket";
                    }
                    ticket = currentTicket;
                }

                let optionsMenu = "";
                nodeSelected.data.arrayOption.map(item => {
                    optionsMenu += `[${item.number}] ${item.value}\n`;
                });

                const menuCreate = `${nodeSelected.data.message}\n\n${optionsMenu}`;

                let msg;


                const ticketDetails = await ShowTicketService(ticket.id, companyId);


                //await CreateMessageService({ messageData: messageData, companyId });

                //await SendWhatsAppMessage({ body: bodyFor, ticket: ticketDetails, quotedMsg: null })

                // await SendMessage(whatsapp, {
                //   number: numberClient,
                //   body: msg.body
                // });


                await ticketDetails.update({
                    lastMessage: formatBody(menuCreate, ticket.contact)
                });

                const contact = await Contact.findOne({
                    where: { number: numberPhrase.number, companyId }
                });


                await showTypingIndicator(
                    contact.number,
                    getSession.facebookUserToken,
                    "typing_on"
                );

                await intervalWhats("5");

                // ✅ NOVO: Usar tag quando for comentário
                const messageTag = isFromComment ? "ACCOUNT_UPDATE" : null;
                await sendText(
                    numberPhrase.number,
                    menuCreate,
                    getSession.facebookUserToken,
                    messageTag,
                    commentId || null
                );


                await showTypingIndicator(
                    contact.number,
                    getSession.facebookUserToken,
                    "typing_off"
                );

                ticket = await Ticket.findOne({
                    where: { id: idTicket, companyId: companyId }
                });

                if (ticket) {
                    await ticket.update({
                        status: "pending",
                        queueId: ticket.queueId ? ticket.queueId : null,
                        userId: null,
                        companyId: companyId,
                        flowWebhook: true,
                        lastFlowId: nodeSelected.id,
                        dataWebhook: dataWebhook,
                        hashFlowId: hashWebhookId,
                        flowStopped: idFlowDb.toString()
                    });
                } else {
                    logger.warn(`[ActionsWebhook - Facebook] Ticket ${idTicket} não encontrado ao configurar menu`);
                }

                break;
            }
        }

        let isContinue = false;

        if (pressKey === "999" && execCount > 0) {
            pressKey = undefined;
            let result = connects.filter(connect => connect.source === execFn)[0];
            if (typeof result === "undefined") {
                next = "";
            } else {
                if (!noAlterNext) {
                    if (ticket) {
                        await ticket.reload();
                    }
                    next = result.target;
                }
            }
        } else {
            let result;

            if (isMenu) {
                result = { target: execFn };
                isContinue = true;
                pressKey = undefined;
            } else if (isRandomizer) {
                isRandomizer = false;
                result = next;
            } else {
                // ✅ CORRIGIDO: Buscar conexão usando nodeSelected.id como source (nó atual processado)
                // Isso garante que mesmo após erros, o fluxo continue para o próximo nó
                const sourceId = nodeSelected?.id || next;
                result = connects.filter(connect => connect.source === sourceId && connect.sourceHandle === "a")[0] ||
                         connects.filter(connect => connect.source === sourceId)[0];
                console.log(512, "ActionsWebhookFacebookService", `Buscando conexão para source: ${sourceId}, Resultado: ${result ? result.target : 'undefined'}`)
            }

            if (typeof result === "undefined") {
                console.log(517, "ActionsWebhookFacebookService", `Nenhuma conexão encontrada para source: ${nodeSelected?.id || next}`)
                // ✅ CORRIGIDO: Verificar se há conexões antes de parar o fluxo
                const allConnections = connects.filter(connect => connect.source === (nodeSelected?.id || next));
                if (allConnections.length === 0) {
                    console.log(518, "ActionsWebhookFacebookService", `Nenhuma conexão de saída encontrada para o nó ${nodeSelected?.id || next} - finalizando fluxo`)
                    next = "";
                } else {
                    // Tentar usar a primeira conexão disponível
                    result = allConnections[0];
                    console.log(519, "ActionsWebhookFacebookService", `Usando primeira conexão disponível: ${result.target}`)
                }
            }
            
            if (typeof result !== "undefined") {
                if (!noAlterNext) {
                    console.log(520, "ActionsWebhookFacebookService", `Atualizando next para: ${result.target}`)
                    next = result.target;
                }
            } else {
                next = "";
            }
        }

        if (!pressKey && !isContinue) {
            const nextNode = connects.filter(
                connect => connect.source === nodeSelected.id
            ).length;
            console.log(530, "ActionsWebhookFacebookService")
            if (nextNode === 0) {
                console.log(532, "ActionsWebhookFacebookService")

                const ticket = await Ticket.findOne({
                    where: { id: idTicket, companyId: companyId }
                });

                if (ticket) {
                    await ticket.update({
                        lastFlowId: null,
                        dataWebhook: {
                            status: "process",
                        },
                        queueId: ticket.queueId ? ticket.queueId : null,
                        hashFlowId: null,
                        flowWebhook: false,
                        flowStopped: idFlowDb.toString()
                    });

                    await ticket.reload();
                } else {
                    logger.warn(`[ActionsWebhook] Ticket ${idTicket} não encontrado ao finalizar fluxo.`);
                }

                break;
            }
        }

        isContinue = false;

        if (next === "") {
            break;
        }

        ticket = await Ticket.findOne({
            where: { id: idTicket, companyId: companyId }
        });

        if (ticket) {
            await ticket.update({
                queueId: null,
                userId: null,
                companyId: companyId,
                flowWebhook: true,
                lastFlowId: nodeSelected.id,
                dataWebhook: dataWebhook,
                hashFlowId: hashWebhookId,
                flowStopped: idFlowDb.toString()
            });
        } else {
            logger.warn(`[ActionsWebhook] Ticket ${idTicket} não encontrado ao atualizar fluxo.`);
            break;
        }

        noAlterNext = false;
        execCount++;
    }

    return "ds";
};

const constructJsonLine = (line: string, json: any) => {
    let valor = json
    const chaves = line.split(".")

    if (chaves.length === 1) {
        return valor[chaves[0]]
    }

    for (const chave of chaves) {
        valor = valor[chave]
    }
    return valor
};

function removerNaoLetrasNumeros(texto: string) {
    // Substitui todos os caracteres que não são letras ou números por vazio
    return texto.replace(/[^a-zA-Z0-9]/g, "");
}

const intervalWhats = (time: string) => {
    const seconds = parseInt(time) * 1000;
    return new Promise(resolve => setTimeout(resolve, seconds));
};

// ✅ CORRIGIDO: Função para processar variáveis de global.flowVariables
const processVariableValue = (text: string, ticketId?: number): string => {
    if (!text) return "";
    
    global.flowVariables = global.flowVariables || {};
    
    if (text.includes("${")) {
        const regex = /\$\{([^}]+)\}/g;
        let processedText = text;
        let match;
        
        while ((match = regex.exec(text)) !== null) {
            const variableName = match[1];
            let variableValue = null;
            
            // Se temos um ticketId, verificar primeiro a variável específica do ticket
            if (ticketId) {
                const ticketSpecificVar = `${ticketId}_${variableName}`;
                variableValue = global.flowVariables[ticketSpecificVar];
            }
            
            // Se não encontrou, tentar variável global
            if (variableValue === null || variableValue === undefined) {
                variableValue = global.flowVariables[variableName];
            }
            
            if (variableValue !== null && variableValue !== undefined) {
                processedText = processedText.replace(
                    match[0],
                    variableValue.toString()
                );
            }
        }
        
        return processedText;
    }
    
    return text;
};

const replaceMessages = (
    message: string,
    details: any,
    dataWebhook: any,
    dataNoWebhook?: any,
    ticketId?: number
) => {
    if (!message) return "";
    
    global.flowVariables = global.flowVariables || {};
    
    // ✅ CORRIGIDO: Primeiro processar variáveis ${variavel}
    let processedMessage = processVariableValue(message, ticketId);
    
    // Depois processar placeholders {nome}, {numero}, {email}
    const matches = processedMessage.match(/\{([^}]+)\}/g);
    
    if (dataWebhook && dataNoWebhook) {
        let newTxt = processedMessage;
        if (dataNoWebhook.nome) {
            newTxt = newTxt.replace(/{+nome}+/g, dataNoWebhook.nome);
        }
        if (dataNoWebhook.numero) {
            newTxt = newTxt.replace(/{+numero}+/g, dataNoWebhook.numero);
        }
        if (dataNoWebhook.email) {
            newTxt = newTxt.replace(/{+email}+/g, dataNoWebhook.email);
        }
        return newTxt;
    }
    
    if (matches && matches.includes("inputs")) {
        const placeholders = matches.map(match => match.replace(/\{|\}/g, ""));
        let newText = processedMessage;
        placeholders.map(item => {
            const value = details["inputs"].find(
                itemLocal => itemLocal.keyValue === item
            );
            if (value) {
                const lineToData = details["keysFull"].find(itemLocal =>
                    itemLocal.endsWith(`.${value.data}`)
                );
                if (lineToData) {
                    const createFieldJson = constructJsonLine(lineToData, dataWebhook);
                    newText = newText.replace(`{${item}}`, createFieldJson);
                }
            }
        });
        return newText;
    } else {
        return processedMessage;
    }
}

async function updateQueueId(ticket: Ticket, companyId: number, queueId: number) {
    await ticket.update({
        status: 'pending',
        queueId: queueId,
        userId: ticket.userId,
        companyId: companyId,
    });

    await FindOrCreateATicketTrakingService({
        ticketId: ticket.id,
        companyId,
        whatsappId: ticket.whatsappId,
        userId: ticket.userId
    })



    await UpdateTicketService({
        ticketData: {
            status: "pending",
            queueId: queueId
        },
        ticketId: ticket.id,
        companyId
    })


    await CreateLogTicketService({
        ticketId: ticket.id,
        type: "queue",
        queueId: queueId
    });

}

function convertAudio(inputFile: string): Promise<string> {
    let outputFile: string;

    if (inputFile.endsWith(".mp3")) {
        outputFile = inputFile.replace(".mp3", ".mp4");
    }

    console.log("output", outputFile);


    return new Promise((resolve, reject) => {
        ffmpeg(inputFile)
            .toFormat('mp4')
            .save(outputFile)
            .on('end', () => {
                resolve(outputFile);
            })
            .on('error', (err) => {
                console.error('Error during conversion:', err);
                reject(err);
            });
    });

}

const switchFlow = async (data: any, companyId: number, ticket: Ticket, getSession: Whatsapp) => {
    console.log(`[SWITCH FLOW FUNC - FACEBOOK] ========== FUNÇÃO switchFlow INICIADA ==========`);
    console.log(`[SWITCH FLOW FUNC - FACEBOOK] Ticket ID: ${ticket?.id}`);
    console.log(`[SWITCH FLOW FUNC - FACEBOOK] Company ID: ${companyId}`);
    console.log(`[SWITCH FLOW FUNC - FACEBOOK] Fluxo de destino: ${data?.name} (ID: ${data?.id})`);

    try {
        // Verificar se 'data' é o fluxo completo ou apenas o ID
        let flowData = data;
        
        // Se 'data' for um número ou string, buscar o fluxo
        if (typeof data === 'number' || typeof data === 'string') {
            console.log(`[SWITCH FLOW FUNC - FACEBOOK] Buscando fluxo com ID: ${data}`);
            const flow = await FlowBuilderModel.findOne({
                where: {
                    id: data,
                    company_id: companyId,
                    active: true
                }
            });
            
            if (!flow) {
                console.error(`[SWITCH FLOW FUNC - FACEBOOK] ❌ Fluxo ${data} não encontrado ou inativo!`);
                return;
            }
            
            flowData = flow;
        } else if (!data?.flow || !data?.flow?.nodes) {
            console.error(`[SWITCH FLOW FUNC - FACEBOOK] ❌ Dados do fluxo inválidos!`);
            return;
        }

        console.log(`[SWITCH FLOW FUNC - FACEBOOK] ✅ Fluxo obtido: ${flowData.name || flowData.id}`);

        const contact = await Contact.findOne({
            where: {
                id: ticket?.contactId,
                companyId: companyId
            }
        });

        if (!contact) {
            console.error(`[SWITCH FLOW FUNC - FACEBOOK] ❌ Contato não encontrado! ContactId: ${ticket?.contactId}`);
            return;
        }

        console.log(`[SWITCH FLOW FUNC - FACEBOOK] ✅ Contato obtido - Nome: ${contact.name}, Número: ${contact.number}`);

        const nodes: INodes[] = flowData.flow["nodes"];
        const connections: IConnections[] = flowData.flow["connections"];

        if (!nodes || nodes.length === 0) {
            console.error(`[SWITCH FLOW FUNC - FACEBOOK] ❌ Fluxo não possui nós válidos!`);
            return;
        }

        const mountDataContact = {
            number: contact.number,
            name: contact.name,
            email: contact.email
        };

        console.log(`[SWITCH FLOW FUNC - FACEBOOK] Chamando ActionsWebhookFacebookService para iniciar o novo fluxo...`);
        console.log(`[SWITCH FLOW FUNC - FACEBOOK] Total de nós: ${nodes.length}, Primeiro nó: ${nodes[0].id}`);

        // ✅ CORRIGIDO: Chamar ActionsWebhookFacebookService diretamente para iniciar um NOVO fluxo
        await ActionsWebhookFacebookService(
            getSession,
            flowData.id,
            companyId,
            nodes,
            connections,
            nodes[0].id, // Começar pelo primeiro nó
            null,
            "",
            "",
            null, // Sem pressKey pois não há mensagem do usuário
            ticket.id,
            mountDataContact
        );
        
        console.log(`[SWITCH FLOW FUNC - FACEBOOK] ✅ Novo fluxo iniciado com sucesso!`);
    } catch (error) {
        console.error(`[SWITCH FLOW FUNC - FACEBOOK] ❌ Erro na função switchFlow:`, error);
        throw error;
    }
};