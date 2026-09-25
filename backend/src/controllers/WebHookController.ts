import { Request, Response } from "express";
import Whatsapp from "../models/Whatsapp";
import { handleMessage, handleChange } from "../services/FacebookServices/facebookMessageListener";

export const index = async (req: Request, res: Response): Promise<Response> => {
  const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "whaticket";

  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token) {
    if (mode === "subscribe" && token === VERIFY_TOKEN) {
      return res.status(200).send(challenge);
    }
  }

  return res.status(403).json({
    message: "Forbidden"
  });
};

export const webHook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  try {
    const { body } = req;

    // ✅ NOVO: Log completo do body recebido para debug
    console.log(`[WEBHOOK] 📨 Webhook recebido - object: ${body.object}`);
    console.log(`[WEBHOOK] 📋 Body completo:`, JSON.stringify(body, null, 2));

    if (body.object === "page" || body.object === "instagram") {
      let channel: string;

      if (body.object === "page") {
        channel = "facebook";
      } else {
        channel = "instagram";
      }

      body.entry?.forEach(async (entry: any) => {
        console.log(`[WEBHOOK] 📥 Entry recebida - ID: ${entry.id}, Channel: ${channel}`);
        console.log(`[WEBHOOK] 📊 Estrutura COMPLETA do entry:`, JSON.stringify(entry, null, 2));
        console.log(`[WEBHOOK] 📊 Resumo do entry:`, JSON.stringify({
          id: entry.id,
          time: entry.time,
          hasMessaging: !!entry.messaging,
          messagingCount: entry.messaging?.length || 0,
          hasChanges: !!entry.changes,
          changesCount: entry.changes?.length || 0,
          // ✅ NOVO: Verificar outros campos possíveis do Instagram
          allKeys: Object.keys(entry)
        }, null, 2));

        // ✅ NOVO: Log específico para Instagram - verificar se há outros campos além de messaging e changes
        if (channel === "instagram") {
          console.log(`[WEBHOOK] [INSTAGRAM] 🔍 Verificando campos específicos do Instagram:`);
          console.log(`[WEBHOOK] [INSTAGRAM] - entry.messaging existe?`, !!entry.messaging);
          console.log(`[WEBHOOK] [INSTAGRAM] - entry.changes existe?`, !!entry.changes);
          console.log(`[WEBHOOK] [INSTAGRAM] - entry.comments existe?`, !!entry.comments);
          console.log(`[WEBHOOK] [INSTAGRAM] - entry.comment existe?`, !!entry.comment);
          console.log(`[WEBHOOK] [INSTAGRAM] - Todos os campos do entry:`, Object.keys(entry));

          // Verificar se há dados em outros campos
          if (entry.comments) {
            console.log(`[WEBHOOK] [INSTAGRAM] ✅ ENCONTRADO entry.comments:`, JSON.stringify(entry.comments, null, 2));
          }
          if (entry.comment) {
            console.log(`[WEBHOOK] [INSTAGRAM] ✅ ENCONTRADO entry.comment:`, JSON.stringify(entry.comment, null, 2));
          }
        }

        const getTokenPage = await Whatsapp.findOne({
          where: {
            facebookPageUserId: entry.id,
            channel
          }
        });

        if (getTokenPage) {
          console.log(`[WEBHOOK] ✅ Conexão encontrada - ID: ${getTokenPage.id}, Nome: ${getTokenPage.name}`);

          for (const data of entry.messaging || []) {
            console.log(`[WEBHOOK] 💬 Processando evento messaging:`, JSON.stringify({
              sender: data.sender?.id,
              recipient: data.recipient?.id,
              hasMessage: !!data.message,
              hasReaction: !!data.reaction
            }, null, 2));

            try {
              await handleMessage(getTokenPage, data, channel, getTokenPage.companyId);
            } catch (err) {
              console.error("[WEBHOOK] Erro ao processar messaging:", err);
            }
          }

          for (const change of entry.changes || []) {
            console.log(`[WEBHOOK] 🔄 Processando evento change:`, JSON.stringify({
              field: change.field,
              value: change.value ? {
                item: change.value.item,
                from: change.value.from?.id,
                hasMessage: !!change.value.message,
                hasText: !!change.value.text
              } : null
            }, null, 2));
            console.log(`[WEBHOOK] 🔄 Estrutura COMPLETA do change:`, JSON.stringify(change, null, 2));

            try {
              await handleChange(getTokenPage, change, channel, getTokenPage.companyId);
            } catch (err) {
              console.error("[WEBHOOK] Erro ao processar change:", err);
            }
          }

          // ✅ NOVO: Para Instagram, verificar se há comentários em outros lugares além de changes
          if (channel === "instagram" && entry.comments) {
            console.log(`[WEBHOOK] [INSTAGRAM] 📝 Processando entry.comments diretamente:`, JSON.stringify(entry.comments, null, 2));
            // Criar um pseudo-change para processar
            const pseudoChange = {
              field: "comments",
              value: entry.comments
            };
            handleChange(getTokenPage, pseudoChange, channel, getTokenPage.companyId);
          }

          if (channel === "instagram" && entry.comment) {
            console.log(`[WEBHOOK] [INSTAGRAM] 📝 Processando entry.comment diretamente:`, JSON.stringify(entry.comment, null, 2));
            // Criar um pseudo-change para processar
            const pseudoChange = {
              field: "comment",
              value: entry.comment
            };
            handleChange(getTokenPage, pseudoChange, channel, getTokenPage.companyId);
          }
        } else {
          console.warn(`[WEBHOOK] ⚠️ Conexão não encontrada para entry.id: ${entry.id}, channel: ${channel}`);
        }
      });

      return res.status(200).json({
        message: "EVENT_RECEIVED"
      });
    }

    return res.status(404).json({
      message: body
    });
  } catch (error) {
    return res.status(500).json({
      message: error
    });
  }
};