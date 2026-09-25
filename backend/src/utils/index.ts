import logger from "../utils/logger";
import { ENABLE_LID_DEBUG } from "../config/debug";

export function normalizeJid(jid: string): string {
  if (!jid) return jid;

  if (ENABLE_LID_DEBUG) {
    logger.info(`[RDS-LID] normalizeJid - Entrada: ${jid}`);
  }

  // Preservar LID: nunca converter um identificador @lid em telefone.
  if (jid.includes("@lid@s.whatsapp.net")) {
    const base = jid.split("@")[0];

    if (/^\d+$/.test(base)) {
      const normalized = `${base}@lid`;

      if (ENABLE_LID_DEBUG) {
        logger.info(
          `[RDS-LID] normalizeJid - Corrigido formato duplicado para LID: ${normalized}`
        );
      }

      return normalized;
    }
  }

  if (jid.includes('@s.whatsapp.net@s.whatsapp.net')) {
    const normalized = jid.replace('@s.whatsapp.net@s.whatsapp.net', '@s.whatsapp.net');
    if (ENABLE_LID_DEBUG) logger.info(`[RDS-LID] normalizeJid - Corrigido duplicado: ${normalized}`);
    return normalized;
  }
  if (jid.includes('@g.us@g.us')) {
    const normalized = jid.replace('@g.us@g.us', '@g.us');
    if (ENABLE_LID_DEBUG) logger.info(`[RDS-LID] normalizeJid - Corrigido duplicado: ${normalized}`);
    return normalized;
  }

  if (jid.includes("@s.whatsapp.net")) {
    const normalized = jid.replace(/:(\d+)@s\.whatsapp\.net$/, "@s.whatsapp.net");

    if (normalized !== jid) {
      if (ENABLE_LID_DEBUG) {
        logger.info(`[RDS-LID] normalizeJid - Removido sufixo de device: ${normalized}`);
      }
      return normalized;
    }

    if (ENABLE_LID_DEBUG) {
      logger.info(`[RDS-LID] normalizeJid - JID já normalizado: ${jid}`);
    }
    return jid;
  }

  if (jid.includes("@g.us")) {
    if (ENABLE_LID_DEBUG) {
      logger.info(`[RDS-LID] normalizeJid - Grupo já normalizado: ${jid}`);
    }
    return jid;
  }

  if (jid.includes("@lid")) {
    const base = jid.split("@")[0];

    if (!/^\d+$/.test(base)) {
      if (ENABLE_LID_DEBUG) {
        logger.warn(
          `[RDS-LID] normalizeJid - Formato inválido para @lid: ${jid}`
        );
      }

      return jid;
    }

    const normalized = `${base}@lid`;

    if (ENABLE_LID_DEBUG) {
      logger.info(
        `[RDS-LID] normalizeJid - LID preservado: ${normalized}`
      );
    }

    return normalized;
  }

  if (!jid.includes('@')) {
    const normalized = jid + '@s.whatsapp.net';
    if (ENABLE_LID_DEBUG) logger.info(`[RDS-LID] normalizeJid - Adicionado @s.whatsapp.net: ${normalized}`);
    return normalized;
  }

  if (ENABLE_LID_DEBUG) logger.info(`[RDS-LID] normalizeJid - Sem alteração: ${jid}`);
  return jid;
}
