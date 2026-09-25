import { WAMessage } from "@whiskeysockets/baileys";
import AppError from "../../errors/AppError";
import { getWbot } from "../../libs/wbot";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import GetDefaultWhatsApp from "../../helpers/GetDefaultWhatsApp";
import { normalizeJid } from "../../utils";
import logger from "../../utils/logger";
import {
  sendInteractiveButtons,
  sendInteractiveList,
  sendInteractiveCTAUrl,
  sendInteractiveCTACall,
  sendInteractiveCTACopy,
  sendInteractivePaymentInfo,
  sendInteractiveReviewAndPay,
  sendInteractiveCarousel,
  sendInteractiveMixedButtons,
  sendLocation,
  sendLiveLocation,
} from "../../helpers/SendInteractiveMsg";
import cacheLayer from "../../libs/cache";

interface InteractiveRequest {
  companyId: number;
  whatsappId?: number;
  jid: string;
  type:
    | "buttons"
    | "list"
    | "url"
    | "call"
    | "pix"
    | "payment"
    | "copy"
    | "carousel"
    | "cobranca"
    | "location"
    | "live_location"
    | "mixed";
  data: any;
}

const InteractiveMessageService = async ({
  companyId,
  whatsappId,
  jid,
  type,
  data,
}: InteractiveRequest): Promise<WAMessage> => {
  // Resolve whatsapp connection
  let wId = whatsappId;
  if (!wId) {
    const defaultWa = await GetDefaultWhatsApp(companyId);
    wId = defaultWa.id;
  }

  // Validate connection belongs to company
  const whatsapp = await Whatsapp.findOne({
    where: { id: wId, companyId },
  });

  if (!whatsapp) {
    throw new AppError("ERR_WBOT_NOT_FOUND", 404);
  }

  if (whatsapp.status !== "CONNECTED") {
    throw new AppError("ERR_WBOT_NOT_CONNECTED", 400);
  }

  const wbot = getWbot(wId);
  const normalizedJid = normalizeJid(jid);

  let sentMsg: WAMessage;

  switch (type) {
    // ── Botões ──
    case "buttons": {
      const rawButtons = (data.buttons || []).slice(0, 3);
      const buttons = rawButtons.map((b: any, i: number) => ({
        displayText: b.text || b.displayText || `Opção ${i + 1}`,
        id: b.id || String(i + 1),
      }));
      sentMsg = await sendInteractiveButtons({
        wbot,
        jid: normalizedJid,
        bodyText: data.text || data.bodyText || "",
        footerText: data.footer || data.footerText,
        buttons,
      });

      // Salvar mapeamento botão → fila no Redis (se algum botão tiver queueId)
      // Salvar mapeamento botão → fila/atendente no Redis
      const queueMapping: Record<string, number> = {};
      const userMapping: Record<string, number> = {};
      let hasMapping = false;
      rawButtons.forEach((b: any, i: number) => {
        const btnId = b.id || String(i + 1);
        const displayText = (b.text || b.displayText || `Opção ${i + 1}`).toLowerCase().trim();
        if (b.queueId) {
          queueMapping[btnId] = Number(b.queueId);
          queueMapping[displayText] = Number(b.queueId);
          hasMapping = true;
        }
        if (b.userId) {
          userMapping[btnId] = Number(b.userId);
          userMapping[displayText] = Number(b.userId);
          hasMapping = true;
        }
      });

      if (hasMapping && sentMsg?.key?.id) {
        const cacheKey = `interactive:queueMap:${sentMsg.key.id}`;
        const payload = JSON.stringify({ queues: queueMapping, users: userMapping });
        await cacheLayer.set(cacheKey, payload, "EX", 86400 * 7);
        logger.info(`[INTERACTIVE-QUEUE] Mapeamento salvo: msgId=${sentMsg.key.id}, mapping=${payload}`);
      }
      break;
    }

    // ── Lista ──
    case "list": {
      const sections = (data.sections || []).map((sec: any) => ({
        title: sec.title || "Opções",
        rows: (sec.rows || []).map((row: any) => ({
          title: row.title,
          description: row.description || "",
          id: row.id,
        })),
      }));
      sentMsg = await sendInteractiveList({
        wbot,
        jid: normalizedJid,
        bodyText: data.text || data.bodyText || "",
        footerText: data.footer || data.footerText,
        buttonText: data.buttonText || "Ver opções",
        sections,
      });
      break;
    }

    // ── CTA URL ──
    case "url": {
      sentMsg = await sendInteractiveCTAUrl({
        wbot,
        jid: normalizedJid,
        bodyText: data.text || data.bodyText || "",
        footerText: data.footer || data.footerText,
        displayText: data.buttonText || data.displayText || "Abrir link",
        url: data.url || "",
      });
      break;
    }

    // ── CTA Ligação ──
    case "call": {
      sentMsg = await sendInteractiveCTACall({
        wbot,
        jid: normalizedJid,
        bodyText: data.text || data.bodyText || "",
        footerText: data.footer || data.footerText,
        displayText: data.buttonText || data.displayText || "Ligar agora",
        phoneNumber: data.phone || data.phoneNumber || "",
      });
      break;
    }

    // ── CTA Copy (PIX copia-e-cola) ──
    case "copy": {
      sentMsg = await sendInteractiveCTACopy({
        wbot,
        jid: normalizedJid,
        bodyText: data.text || data.bodyText || "",
        footerText: data.footer || data.footerText,
        displayText: data.buttonText || data.displayText || "Copiar código",
        copyCode: data.copyCode || data.code || "",
      });
      break;
    }

    // ── PIX (payment_info) ──
    case "pix": {
      const pixBody = `${data.text || ""}\n\n💰 *Chave PIX:* ${data.pixKey || ""}\n👤 *Nome:* ${data.pixName || ""}\n💵 *Valor:* R$ ${data.value ? Number(data.value).toFixed(2) : "A definir"}`;
      sentMsg = await sendInteractivePaymentInfo({
        wbot,
        jid: normalizedJid,
        bodyText: pixBody,
        footerText: data.footer || data.footerText,
        pixKey: data.pixKey || "",
        pixMerchantName: data.pixName || "Pagamento",
      });
      break;
    }

    // ── Cobrança / Pagamento ──
    case "payment":
    case "cobranca": {
      const amount = Number(data.value || data.amount || 0);
      const refId = data.reference || data.referenceId || `PAY_${Date.now()}`;
      const desc = data.description || data.name || "Pagamento";

      // Alguns clientes exibem review_and_pay apenas como card estático.
      // Por padrão, enviamos quick_reply para garantir botão interativo clicável.
      if (data.useReviewAndPay === true) {
        const amountCents = Math.round(amount * 100);
        sentMsg = await sendInteractiveReviewAndPay({
          wbot,
          jid: normalizedJid,
          bodyText: data.text || data.bodyText || desc,
          footerText: data.footer || data.footerText,
          totalAmountValue: amountCents,
          referenceId: refId,
          items: [
            {
              retailer_id: refId,
              name: desc,
              amount: { value: amountCents, offset: 100 },
              quantity: data.quantity || 1,
            },
          ],
          additionalNote: data.note || data.additionalNote || "",
        });
        break;
      }

      const fallbackButtonsRaw = data.buttons || data.action?.buttons;
      const fallbackButtons = (Array.isArray(fallbackButtonsRaw) ? fallbackButtonsRaw : [
        {
          text: data.buttonText || "Pagar agora",
          id: data.buttonId || refId,
        },
      ])
        .slice(0, 3)
        .map((b: any, i: number) => ({
          displayText: b.text || b.displayText || `Opção ${i + 1}`,
          id: b.id || `${refId}_${i + 1}`,
        }));

      const paymentText = data.text || data.bodyText || [
        `Nº DA COBRANÇA: ${refId}`,
        "",
        desc,
        `Quantidade: ${data.quantity || 1}`,
        "",
        `Total: BRL ${amount.toFixed(2).replace(".", ",")}`,
        "",
        data.note || data.additionalNote || "",
      ].filter(Boolean).join("\n");

      sentMsg = await sendInteractiveButtons({
        wbot,
        jid: normalizedJid,
        bodyText: paymentText,
        footerText: data.footer || data.footerText,
        buttons: fallbackButtons,
      });
      break;
    }

    // ── Carousel ──
    case "carousel": {
      const cards = (data.cards || []).map((card: any) => ({
        bodyText: `${card.title ? `*${card.title}*\n` : ""}${card.body || card.text || ""}`,
        buttons: (card.buttons || []).slice(0, 3).map((btn: any) => ({
          name: btn.name || "quick_reply",
          buttonParamsJson: JSON.stringify({
            display_text: btn.text || btn.displayText || "Opção",
            id: btn.id || "1",
            ...(btn.url ? { url: btn.url } : {}),
          }),
        })),
      }));

      sentMsg = await sendInteractiveCarousel({
        wbot,
        jid: normalizedJid,
        cards,
      });
      break;
    }

    // ── Localização estática ──
    case "location": {
      if (!data.latitude || !data.longitude) {
        throw new AppError("Latitude e longitude são obrigatórios", 400);
      }
      sentMsg = await sendLocation({
        wbot,
        jid: normalizedJid,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        name: data.name || data.locationName || "",
        address: data.address || "",
        bodyText: data.text || data.bodyText || "",
      });
      break;
    }

    // ── Localização em tempo real ──
    case "live_location": {
      if (!data.latitude || !data.longitude) {
        throw new AppError("Latitude e longitude são obrigatórios", 400);
      }
      sentMsg = await sendLiveLocation({
        wbot,
        jid: normalizedJid,
        latitude: Number(data.latitude),
        longitude: Number(data.longitude),
        accuracyInMeters: data.accuracy ? Number(data.accuracy) : undefined,
        speed: data.speed ? Number(data.speed) : undefined,
        caption: data.caption || data.name || "",
        bodyText: data.text || data.bodyText || "",
      });
      break;
    }

    // ── Botões Mistos (quick_reply + URL + copy + call) ──
    case "mixed": {
      const mixedButtons = (data.buttons || []).map((btn: any, i: number) => ({
        type: btn.type || "quick_reply",
        text: btn.text || btn.displayText || `Opção ${i + 1}`,
        id: btn.id || String(i + 1),
        url: btn.url || undefined,
        copyCode: btn.copyCode || btn.code || undefined,
        phoneNumber: btn.phone || btn.phoneNumber || undefined,
      }));

      sentMsg = await sendInteractiveMixedButtons({
        wbot,
        jid: normalizedJid,
        bodyText: data.text || data.bodyText || "",
        footerText: data.footer || data.footerText,
        buttons: mixedButtons,
      });
      break;
    }

    default:
      throw new AppError(`INVALID_INTERACTIVE_TYPE: ${type}`, 400);
  }

  logger.info(
    `[INTERACTIVE-API] ${type} enviado para ${normalizedJid} (company ${companyId})`
  );

  return sentMsg;
};

export default InteractiveMessageService;
