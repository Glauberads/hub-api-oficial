import {
  jidNormalizedUser,
  proto,
  WASocket
} from "@whiskeysockets/baileys";
import logger from "../../utils/logger";
import { Session } from "../../libs/wbot";
import { IMe } from "./messageUtils";
import { normalizeJid } from "../../utils";

export const getMeSocket = (wbot: Session): IMe => {
  return {
    id: jidNormalizedUser((wbot as WASocket).user.id),
    name: (wbot as WASocket).user.name
  };
};

export const getSenderMessage = (
  msg: proto.IWebMessageInfo,
  wbot: Session
): string => {
  const me = getMeSocket(wbot);
  if (msg.key.fromMe) return me.id;
  const senderId = msg.key.participant || msg.key.remoteJid || undefined;
  return senderId && jidNormalizedUser(senderId);
};

export const normalizeContactIdentifier = (msg: proto.IWebMessageInfo): string => {
  return normalizeJid(msg.key.remoteJid);
};

export const getContactMessage = async (msg: proto.IWebMessageInfo, wbot: Session): Promise<IMe> => {
  const isGroup = msg.key.remoteJid.includes("g.us");
  const rawNumber = msg.key.remoteJid.replace(/\D/g, "");
  const isLidJid = msg.key.remoteJid?.includes("@lid");
  let lid: string | null = null;
  let resolvedJid: string = msg.key.remoteJid;

  if (isLidJid) {
    lid = msg.key.remoteJid;
    try {
      const pn = await (wbot as any).signalRepository?.lidMapping?.getPNForLID?.(msg.key.remoteJid);
      if (pn) {
        resolvedJid = pn;
        logger.info(`[LID-V7] Resolvido LID ${msg.key.remoteJid} → PN ${pn}`);
      } else {
        logger.warn(`[LID-V7] Não foi possível resolver LID ${msg.key.remoteJid} via lidMapping`);
      }
    } catch (e) {
      logger.warn(`[LID-V7] Erro ao resolver LID ${msg.key.remoteJid}: ${e.message}`);
    }
  }

  if (isGroup) {
    const participantJid = msg.key.participant;
    let participantLid: string | null = null;
    let resolvedParticipant = participantJid;

    if (participantJid?.includes("@lid")) {
      participantLid = participantJid;
      try {
        const pn = await (wbot as any).signalRepository?.lidMapping?.getPNForLID?.(participantJid);
        if (pn) {
          resolvedParticipant = pn;
          logger.info(`[LID-V7] Resolvido participant LID ${participantJid} → PN ${pn}`);
        }
      } catch (e) {
        logger.warn(`[LID-V7] Erro ao resolver participant LID: ${e.message}`);
      }
    }

    return {
      id: resolvedParticipant ? jidNormalizedUser(resolvedParticipant) : getSenderMessage(msg, wbot),
      name: msg.pushName,
      lid: participantLid || lid
    };
  }

  return {
    id: resolvedJid,
    name: msg.key.fromMe ? rawNumber : msg.pushName,
    lid: lid
  };
};

export const checkLIDStatus = async (wbot: Session): Promise<boolean> => {
  try {
    const isLIDEnabled = wbot.user?.lid;
    return !!isLIDEnabled;
  } catch (error) {
    return false;
  }
};
