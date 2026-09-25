import { WAMessage } from "@whiskeysockets/baileys";
import * as Sentry from "@sentry/node";
import AppError from "../../errors/AppError";
import GetTicketWbot from "../../helpers/GetTicketWbot";
import Ticket from "../../models/Ticket";
import Contact from "../../models/Contact";
import CreateMessageService from "../MessageServices/CreateMessageService";
import formatBody from "../../helpers/Mustache";
import logger from "../../utils/logger";
import { getJidOf } from "./getJidOf";
import {
  sendInteractiveButtons,
  sendInteractiveList,
  sendInteractiveCTAUrl,
  sendInteractiveCTACall,
  sendInteractiveCTACopy,
  sendInteractivePaymentInfo,
  sendInteractiveReviewAndPay,
  sendInteractiveCarousel,
} from "../../helpers/SendInteractiveMsg";
import SendWhatsAppOficialMessage from "../WhatsAppOficial/SendWhatsAppOficialMessage";
import { IMetaMessageinteractive } from "../../libs/whatsAppOficial/IWhatsAppOficial.interfaces";
import fs from "fs";
import path from "path";
import mime from "mime-types";

interface InteractiveButton {
  displayText: string;
  id?: string;
  type?: "quick_reply" | "cta_url" | "cta_copy" | "cta_call";
  url?: string;
  copyCode?: string;
  phoneNumber?: string;
}

interface InteractiveListRow {
  header?: string;
  title: string;
  description?: string;
  id: string;
}

interface InteractiveSection {
  title: string;
  rows: InteractiveListRow[];
}

interface InteractiveRequest {
  ticket: Ticket;
  interactiveType: "button" | "list" | "poll" | "location" | "url" | "call" | "pix" | "offer" | "carousel" | "catalog" | "cobranca";
  bodyText: string;
  footerText?: string;
  headerText?: string;
  headerImage?: string;
  headerImageFullPath?: string;
  buttons?: InteractiveButton[];
  listButtonText?: string;
  sections?: InteractiveSection[];
  latitude?: number;
  longitude?: number;
  locationName?: string;
  locationAddress?: string;
  urlText?: string;
  url?: string;
  callText?: string;
  callNumber?: string;
  pixKey?: string;
  pixName?: string;
  pixCity?: string;
  pixAmount?: number;
  pollQuestion?: string;
  pollOptions?: string[];
  offerTitle?: string;
  offerPrice?: string;
  offerDescription?: string;
  offerImageUrl?: string;
  carouselCards?: {
    title: string;
    body: string;
    imageUrl?: string;
    buttons?: InteractiveButton[];
  }[];
  cobrancaNumber?: string;
  cobrancaDescription?: string;
  cobrancaQuantity?: number;
  cobrancaAmount?: number;
  cobrancaMessage?: string;
  cobrancaPaymentUrl?: string;
  cobrancaButtonText?: string;
  cobrancaPdfPath?: string;
}

const isValidLatitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -90 && value <= 90;

const isValidLongitude = (value: number): boolean =>
  Number.isFinite(value) && value >= -180 && value <= 180;

const buildGoogleMapsUrl = (latitude: number, longitude: number): string =>
  `https://maps.google.com/maps?q=${encodeURIComponent(
    `${latitude},${longitude}`
  )}&z=17&hl=pt-BR`;

const buildLocationPreviewUrl = (latitude: number, longitude: number): string => {
  const lat = encodeURIComponent(String(latitude));
  const lng = encodeURIComponent(String(longitude));

  return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=600x300&markers=${lat},${lng},red-pushpin`;
};

const buildLocationBodyText = (latitude: number, longitude: number): string => {
  const previewUrl = buildLocationPreviewUrl(latitude, longitude);
  const googleMapsUrl = buildGoogleMapsUrl(latitude, longitude);
  const coordsText = `${latitude}, ${longitude}`;

  return `${previewUrl} | ${googleMapsUrl}|${coordsText}`;
};

const buildLocationDataJson = (
  latitude: number,
  longitude: number,
  locationName?: string,
  locationAddress?: string
) => ({
  latitude,
  longitude,
  name: locationName || null,
  address: locationAddress || null,
  url: buildGoogleMapsUrl(latitude, longitude)
});

const SendWhatsAppInteractive = async (request: InteractiveRequest): Promise<any> => {
  const { ticket, interactiveType, bodyText, footerText } = request;

  const contact = await Contact.findByPk(ticket.contactId);
  if (!contact) {
    throw new AppError("Contato do ticket não encontrado");
  }

  // ========== BAILEYS ==========
  if (ticket.channel === "whatsapp") {
    const wbot = await GetTicketWbot(ticket);
    const jid = getJidOf(contact);

    logger.info(
      `[INTERACTIVE-TICKET] Destino resolvido: ` +
      `contactId=${contact.id} ` +
      `number=${contact.number} ` +
      `remoteJid=${contact.remoteJid || "null"} ` +
      `lid=${contact.lid || "null"} ` +
      `jid=${jid}`
    );

    const formattedBody = formatBody(bodyText, ticket);
    const formattedFooter = footerText ? formatBody(footerText, ticket) : undefined;
    let sentMsg: WAMessage;
    let mediaType = "interactive";
    let bodyToSave = formattedBody;
    let dataJson: string | null = null;
    let mediaUrl: string | null = null;

    try {
      switch (interactiveType) {
        case "button": {
          const btns = (request.buttons || []).slice(0, 3).map((b, i) => ({
            displayText: b.displayText,
            id: b.id || String(i + 1),
            type: b.type || "quick_reply",
            url: b.url,
            copyCode: b.copyCode,
            phoneNumber: b.phoneNumber,
          }));
          sentMsg = await sendInteractiveButtons({
            wbot,
            jid,
            bodyText: formattedBody,
            footerText: formattedFooter,
            buttons: btns,
            headerImageUrl: request.headerImage,
            headerImageFullPath: request.headerImageFullPath,
          });
          bodyToSave = `${formattedBody}\n\n${btns.map((b, i) => `*[ ${i + 1} ]* - ${b.displayText}`).join("\n")}`;
          dataJson = JSON.stringify({
            type: "template",
            body: formattedBody,
            templateButtons: btns.map((button, index) => ({
              type:
                button.type === "cta_url"
                  ? "URL"
                  : button.type === "cta_call"
                    ? "PHONE_NUMBER"
                    : button.type === "cta_copy"
                      ? "COPY_CODE"
                      : "QUICK_REPLY",
              text: button.displayText,
              title: button.displayText,
              id: String(button.id || index + 1),
              payload: String(button.id || index + 1),
              url: button.url || null,
              phone_number: button.phoneNumber || null,
              example: button.copyCode ? [button.copyCode] : []
            }))
          });

          const headerImageSource =
            request.headerImageFullPath || request.headerImage || null;

          if (headerImageSource) {
            const normalizedImagePath = String(headerImageSource).replace(/\\/g, "/");
            const publicMarker = "/public/";
            const publicIndex = normalizedImagePath.lastIndexOf(publicMarker);

            mediaType = "image";
            mediaUrl = publicIndex >= 0
              ? normalizedImagePath.substring(publicIndex + publicMarker.length)
              : normalizedImagePath.startsWith("public/")
                ? normalizedImagePath.substring("public/".length)
                : normalizedImagePath;
          }

          break;
        }

        case "list": {
          const secs = (request.sections || []).map(sec => ({
            title: sec.title,
            rows: sec.rows.map(r => ({
              title: r.title,
              description: r.description || "",
              id: r.id,
            })),
          }));
          sentMsg = await sendInteractiveList({
            wbot, jid, bodyText: formattedBody, footerText: formattedFooter,
            buttonText: request.listButtonText || "Selecionar", sections: secs,
          });
          const allRows = secs.flatMap(s => s.rows);
          bodyToSave = `${formattedBody}\n\n${allRows.map((r, i) => `*[ ${i + 1} ]* - ${r.title}`).join("\n")}`;
          break;
        }

        case "url": {
          const urlDisplayText = request.urlText || "Acessar link";
          sentMsg = await sendInteractiveCTAUrl({
            wbot, jid, bodyText: formattedBody, footerText: formattedFooter,
            displayText: urlDisplayText, url: request.url || "",
          });
          bodyToSave = `${formattedBody}\n\n🔗 ${urlDisplayText}: ${request.url}`;
          break;
        }

        case "call": {
          const callDisplayText = request.callText || "Ligar";
          sentMsg = await sendInteractiveCTACall({
            wbot, jid, bodyText: formattedBody, footerText: formattedFooter,
            displayText: callDisplayText, phoneNumber: request.callNumber || "",
          });
          bodyToSave = `${formattedBody}\n\n📞 ${callDisplayText}: ${request.callNumber}`;
          break;
        }

        case "pix": {
          const pixBodyText = `${formattedBody}\n\n💰 *Chave PIX:* ${request.pixKey}\n👤 *Nome:* ${request.pixName || ""}\n🏙️ *Cidade:* ${request.pixCity || ""}\n💵 *Valor:* R$ ${request.pixAmount ? request.pixAmount.toFixed(2) : "A definir"}`;

          sentMsg = await sendInteractivePaymentInfo({
            wbot, jid,
            bodyText: pixBodyText,
            footerText: formattedFooter,
            pixKey: request.pixKey || "",
            pixMerchantName: request.pixName || "Pagamento",
          });
          bodyToSave = pixBodyText;
          break;
        }

        case "location": {
          const latitude = Number(request.latitude);
          const longitude = Number(request.longitude);

          if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
            throw new AppError("Latitude/longitude inválidas para envio de localização");
          }

          sentMsg = await (wbot as any).sendMessage(jid, {
            location: {
              degreesLatitude: latitude,
              degreesLongitude: longitude,
              name: request.locationName || "Localização",
              address: request.locationAddress || buildGoogleMapsUrl(latitude, longitude),
            },
          }) as WAMessage;

          mediaType = "location";
          bodyToSave = buildLocationBodyText(latitude, longitude);
          dataJson = JSON.stringify(
            buildLocationDataJson(
              latitude,
              longitude,
              request.locationName,
              request.locationAddress
            )
          );
          break;
        }

        case "poll": {
          const pollOpts = (request.pollOptions || []).filter(o => o.trim());
          sentMsg = await (wbot as any).sendMessage(jid, {
            poll: {
              name: request.pollQuestion || formattedBody,
              values: pollOpts,
              selectableCount: 1,
            },
          }) as WAMessage;
          mediaType = "pollCreationMessage";
          bodyToSave = `📊 ${request.pollQuestion || formattedBody}\n${pollOpts.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
          break;
        }

        case "offer": {
          const offerBody = `${request.offerTitle ? `*${request.offerTitle}*\n` : ""}${formattedBody}\n\n💰 *Preço:* ${request.offerPrice || "Consulte"}${request.offerDescription ? `\n📝 ${request.offerDescription}` : ""}`;
          const priceMatch = (request.offerPrice || "").replace(/[^\d,\.]/g, "").replace(",", ".");
          const priceValue = parseFloat(priceMatch) || 0;
          const priceCents = Math.round(priceValue * 100);

          sentMsg = await sendInteractiveReviewAndPay({
            wbot, jid,
            bodyText: offerBody,
            footerText: formattedFooter,
            totalAmountValue: priceCents,
            referenceId: `OFFER_${Date.now()}`,
            items: [{
              retailer_id: "offer_001",
              name: request.offerTitle || "Oferta",
              amount: { value: priceCents, offset: 100 },
              quantity: 1,
            }],
          });
          bodyToSave = offerBody;
          break;
        }

        case "carousel":
        case "catalog": {
          const cards = request.carouselCards || [];
          if (cards.length > 1) {
            sentMsg = await sendInteractiveCarousel({
              wbot, jid,
              cards: cards.map((card) => ({
                bodyText: `*${card.title}*\n${card.body}`,
                buttons: (card.buttons || []).slice(0, 3).map((btn) => ({
                  name: "quick_reply",
                  buttonParamsJson: JSON.stringify({
                    display_text: btn.displayText,
                    id: btn.id || "1",
                  }),
                })),
              })),
            });
          } else if (cards.length === 1) {
            const card = cards[0];
            const cardBody = `*${card.title}*\n${card.body}`;
            const cardBtns = (card.buttons || [])
              .slice(0, 3)
              .map((btn, index) => ({
                ...btn,
                id: btn.id || String(index + 1)
              }));
            if (cardBtns.length > 0) {
              sentMsg = await sendInteractiveButtons({
                wbot, jid, bodyText: cardBody, buttons: cardBtns,
              });
            } else {
              sentMsg = await (wbot as any).sendMessage(jid, { text: cardBody }) as WAMessage;
            }
          } else {
            sentMsg = { key: { id: `carousel_${Date.now()}` } } as WAMessage;
          }
          bodyToSave = (cards || []).map(c => `*${c.title}*\n${c.body}`).join("\n---\n");
          break;
        }

        case "cobranca": {
          const cNum = request.cobrancaNumber || "";
          const cDesc = request.cobrancaDescription || "";
          const cQty = request.cobrancaQuantity || 1;
          const cAmount = request.cobrancaAmount || 0;
          const cMsg = request.cobrancaMessage || formattedBody;
          const cUrl = request.cobrancaPaymentUrl || "";
          const cBtnText = request.cobrancaButtonText || "Revisar e pagar";
          const cAmountCents = Math.round(cAmount * 100);
          const cPdfPath = request.cobrancaPdfPath || "";

          const cobrancaBody = `*Nº DA COBRANÇA:* ${cNum}\n\n${cDesc}\nQuantidade: ${cQty}\n\n*Total*          *BRL ${cAmount.toFixed(2).replace(".", ",")}*\n\n${cMsg}`;

          if (cPdfPath) {
            const publicFolder = path.resolve(__dirname, "..", "..", "..", "public");
            const fullPath = path.resolve(publicFolder, cPdfPath);
            if (fs.existsSync(fullPath)) {
              const mimetype = mime.lookup(fullPath) || "application/pdf";
              const fileName = path.basename(fullPath);
              await (wbot as any).sendMessage(jid, {
                document: fs.readFileSync(fullPath),
                mimetype,
                fileName,
                caption: `📄 Boleto/Comprovante - Cobrança ${cNum}`,
              });
            }
          }

          if (cUrl) {
            sentMsg = await sendInteractiveCTAUrl({
              wbot, jid, bodyText: cobrancaBody, footerText: formattedFooter,
              displayText: cBtnText, url: cUrl,
            });
          } else {
            sentMsg = await sendInteractiveReviewAndPay({
              wbot, jid,
              bodyText: cobrancaBody,
              footerText: formattedFooter,
              totalAmountValue: cAmountCents,
              referenceId: cNum || `COB_${Date.now()}`,
              items: [{
                retailer_id: cNum || "cob_001",
                name: cDesc || "Cobrança",
                amount: { value: cAmountCents, offset: 100 },
                quantity: cQty,
              }],
              additionalNote: cMsg,
            });
          }
          bodyToSave = `${cobrancaBody}\n\n🔗 ${cBtnText}${cUrl ? `: ${cUrl}` : ""}`;
          break;
        }

        default:
          throw new AppError(`Tipo interativo '${interactiveType}' não suportado`);
      }

      const messageData = {
        wid: sentMsg?.key?.id || `interactive_${Date.now()}`,
        ticketId: ticket.id,
        contactId: contact.id,
        body: bodyToSave,
        fromMe: true,
        mediaType,
        mediaUrl,
        read: true,
        quotedMsgId: null,
        ack: 2,
        remoteJid: jid,
        participant: null,
        dataJson,
        ticketTrakingId: null,
        isPrivate: false,
      };

      await CreateMessageService({ messageData, companyId: ticket.companyId });
      await ticket.update({ lastMessage: interactiveType === "location" ? "📍 Localização" : bodyToSave, unreadMessages: 0 });

      logger.info(`[INTERACTIVE-TICKET] ${interactiveType} enviado para ${jid} no ticket ${ticket.id}`);
      return sentMsg;

    } catch (err) {
      logger.error(`[INTERACTIVE-TICKET] Erro ao enviar ${interactiveType}: ${err?.message}`);
      Sentry.captureException(err);
      throw new AppError(err?.message || "ERR_SENDING_INTERACTIVE_MSG");
    }
  }

  // ========== API OFICIAL ==========
  if (ticket.channel === "whatsapp_oficial") {
    try {
      switch (interactiveType) {
        case "button": {
          const btns = (request.buttons || []).slice(0, 3);
          const interative: IMetaMessageinteractive = {
            type: "button",
            body: { text: bodyText },
            footer: footerText ? { text: footerText } : undefined,
            action: {
              buttons: btns.map((b, i) => ({
                type: "reply",
                reply: { id: b.id || String(i + 1), title: b.displayText.substring(0, 20) },
              })),
            },
          } as any;
          const bodyToSave = `${bodyText}\n\n${btns.map((b, i) => `*[ ${i + 1} ]* - ${b.displayText}`).join("\n")}`;
          return await SendWhatsAppOficialMessage({
            body: bodyText, ticket, type: "interactive", media: null, interative, bodyToSave,
          });
        }

        case "list": {
          const secs = (request.sections || []).map(sec => ({
            title: sec.title,
            rows: sec.rows.map(r => ({
              id: r.id,
              title: r.title.substring(0, 24),
              description: (r.description || "").substring(0, 72),
            })),
          }));
          const interative: IMetaMessageinteractive = {
            type: "list",
            body: { text: bodyText },
            footer: footerText ? { text: footerText } : undefined,
            action: {
              button: request.listButtonText || "Selecionar",
              sections: secs,
            },
          } as any;
          const allRows = secs.flatMap(s => s.rows);
          const bodyToSave = `${bodyText}\n\n${allRows.map((r, i) => `*[ ${i + 1} ]* - ${r.title}`).join("\n")}`;
          return await SendWhatsAppOficialMessage({
            body: bodyText, ticket, type: "interactive", media: null, interative, bodyToSave,
          });
        }

        case "url": {
          const interative: IMetaMessageinteractive = {
            type: "cta_url",
            body: { text: bodyText },
            footer: footerText ? { text: footerText } : undefined,
            action: {
              name: "cta_url",
              parameters: {
                display_text: request.urlText || "Acessar link",
                url: request.url || "",
              },
            },
          } as any;
          return await SendWhatsAppOficialMessage({
            body: bodyText, ticket, type: "interactive", media: null, interative,
            bodyToSave: `${bodyText}\n\n🔗 ${request.urlText || request.url}\n${request.url}`,
          });
        }

        case "location": {
          const latitude = Number(request.latitude);
          const longitude = Number(request.longitude);

          if (!isValidLatitude(latitude) || !isValidLongitude(longitude)) {
            throw new AppError("Latitude/longitude inválidas para envio de localização");
          }

          const locationBody = JSON.stringify({
            latitude,
            longitude,
            locationName: request.locationName || "Localização",
            locationAddress: request.locationAddress || buildGoogleMapsUrl(latitude, longitude)
          });

          return await SendWhatsAppOficialMessage({
            body: locationBody as any,
            ticket,
            type: "location",
            media: null,
          });
        }

        case "cobranca": {
          const cNum = request.cobrancaNumber || "";
          const cDesc = request.cobrancaDescription || "";
          const cQty = request.cobrancaQuantity || 1;
          const cAmount = request.cobrancaAmount || 0;
          const cMsg = request.cobrancaMessage || bodyText;
          const cUrl = request.cobrancaPaymentUrl || "";
          const cBtnText = request.cobrancaButtonText || "Revisar e pagar";

          const cobrancaBody = `*Nº DA COBRANÇA:* ${cNum}\n\n${cDesc}\nQuantidade: ${cQty}\n\n*Total*          *BRL ${cAmount.toFixed(2).replace(".", ",")}*\n\n${cMsg}`;

          if (cUrl) {
            const interative: IMetaMessageinteractive = {
              type: "cta_url",
              body: { text: cobrancaBody },
              footer: footerText ? { text: footerText } : undefined,
              action: {
                name: "cta_url",
                parameters: { display_text: cBtnText, url: cUrl },
              },
            } as any;
            return await SendWhatsAppOficialMessage({
              body: bodyText, ticket, type: "interactive", media: null, interative,
              bodyToSave: `${cobrancaBody}\n\n🔗 ${cBtnText}: ${cUrl}`,
            });
          }
          return await SendWhatsAppOficialMessage({
            body: cobrancaBody, ticket, type: "text", media: null,
          });
        }

        default: {
          let fallbackBody = bodyText;
          if (interactiveType === "call") {
            fallbackBody = `${bodyText}\n\n📞 ${request.callText || "Ligar"}: ${request.callNumber}`;
          } else if (interactiveType === "pix") {
            fallbackBody = `${bodyText}\n\n💰 *Chave PIX:* ${request.pixKey}\n👤 *Nome:* ${request.pixName || ""}\n🏙️ *Cidade:* ${request.pixCity || ""}\n💵 *Valor:* R$ ${request.pixAmount ? request.pixAmount.toFixed(2) : "A definir"}`;
          } else if (interactiveType === "poll") {
            const opts = (request.pollOptions || []).filter(o => o.trim());
            fallbackBody = `📊 *${request.pollQuestion || bodyText}*\n\n${opts.map((o, i) => `${i + 1}. ${o}`).join("\n")}`;
          } else if (interactiveType === "offer") {
            fallbackBody = `${request.offerTitle ? `*${request.offerTitle}*\n` : ""}${bodyText}\n\n💰 *Preço:* ${request.offerPrice || "Consulte"}`;
          }
          return await SendWhatsAppOficialMessage({
            body: fallbackBody, ticket, type: "text", media: null,
          });
        }
      }
    } catch (err) {
      logger.error(`[INTERACTIVE-OFICIAL] Erro: ${err?.message}`);
      Sentry.captureException(err);
      throw new AppError(err?.message || "ERR_SENDING_INTERACTIVE_OFICIAL");
    }
  }

  throw new AppError("Canal não suportado para mensagens interativas");
};

export default SendWhatsAppInteractive;
