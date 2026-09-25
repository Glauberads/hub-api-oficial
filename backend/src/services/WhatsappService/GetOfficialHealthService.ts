import axios from "axios";
import Whatsapp from "../../models/Whatsapp";
import logger from "../../utils/logger";

const graphVersion = process.env.META_GRAPH_VERSION || "v20.0";
const graphBase = `https://graph.facebook.com/${graphVersion}`;

const tierLimits: Record<string, number> = {
  TIER_50: 50,
  TIER_250: 250,
  TIER_1K: 1000,
  TIER_10K: 10000,
  TIER_100K: 100000,
  TIER_UNLIMITED: -1,
  UNLIMITED: -1
};

const parseLimit = (tier?: string | null): number | null => {
  if (!tier) return null;
  const key = String(tier).toUpperCase().trim();
  if (tierLimits[key] !== undefined) return tierLimits[key];
  const match = key.match(/(\d+)(K|M)?/);
  if (!match) return null;
  const multiplier = match[2] === "M" ? 1000000 : match[2] === "K" ? 1000 : 1;
  return Number(match[1]) * multiplier;
};

const graphGet = async (path: string, token: string, params?: object): Promise<any> => {
  const { data } = await axios.get(`${graphBase}/${path}`, {
    headers: { Authorization: `Bearer ${token}` },
    params,
    timeout: 15000
  });
  return data;
};

const errorMessage = (error: any): string =>
  error?.response?.data?.error?.message || error?.message || "Falha desconhecida";

export const GetOfficialHealthService = async (companyId: number): Promise<any[]> => {
  const connections = await Whatsapp.findAll({
    where: { companyId, channel: "whatsapp_oficial" },
    order: [["name", "ASC"]]
  });

  return Promise.all(connections.map(async connection => {
    const token = connection.send_token || connection.tokenMeta;
    const phoneNumberId = connection.phone_number_id;
    const wabaId = connection.waba_id;
    const result: any = {
      whatsappId: connection.id,
      name: connection.name,
      phone_number: connection.phone_number || null,
      phone_number_id: phoneNumberId || null,
      waba_id: wabaId || null,
      verified_name: null,
      display_phone_number: null,
      quality_rating: null,
      messaging_limit_tier: null,
      platform_type: null,
      code_verification_status: null,
      name_status: null,
      throughput: null,
      account_review_status: null,
      business_verification_status: null,
      waba_name: null,
      sent_24h: null,
      delivered_24h: null,
      limit_24h: null,
      fetchedAt: new Date().toISOString(),
      errors: [] as string[]
    };

    if (!token || !phoneNumberId) {
      result.errors.push("MISSING_TOKEN_OR_PHONE_NUMBER_ID");
      return result;
    }

    try {
      const phone = await graphGet(phoneNumberId, token, {
        fields: "verified_name,display_phone_number,quality_rating,messaging_limit_tier,platform_type,code_verification_status,name_status,throughput"
      });
      Object.assign(result, {
        verified_name: phone.verified_name || null,
        display_phone_number: phone.display_phone_number || null,
        quality_rating: phone.quality_rating || null,
        messaging_limit_tier: phone.messaging_limit_tier || null,
        platform_type: phone.platform_type || null,
        code_verification_status: phone.code_verification_status || null,
        name_status: phone.name_status || null,
        throughput: phone.throughput || null
      });
      result.limit_24h = parseLimit(result.messaging_limit_tier);
    } catch (error) {
      result.errors.push(`phone_number: ${errorMessage(error)}`);
    }

    if (wabaId) {
      try {
        const waba = await graphGet(wabaId, token, {
          fields: "name,account_review_status,business_verification_status"
        });
        result.waba_name = waba.name || null;
        result.account_review_status = waba.account_review_status || null;
        result.business_verification_status = waba.business_verification_status || null;
      } catch (error) {
        result.errors.push(`waba: ${errorMessage(error)}`);
      }

      try {
        const end = Math.floor(Date.now() / 1000);
        const start = end - 86400;
        const fields = `analytics.start(${start}).end(${end}).granularity(DAY).phone_numbers(["${phoneNumberId}"])`;
        const analytics = await graphGet(wabaId, token, { fields });
        const points = analytics?.analytics?.data_points || [];
        result.sent_24h = points.reduce((sum: number, point: any) => sum + Number(point.sent || 0), 0);
        result.delivered_24h = points.reduce((sum: number, point: any) => sum + Number(point.delivered || 0), 0);
      } catch (error) {
        result.errors.push(`analytics: ${errorMessage(error)}`);
      }
    }

    result.error = result.errors.length ? result.errors.join(" | ") : null;
    if (result.error) logger.warn(`[OFFICIAL HEALTH] whatsapp=${connection.id}: ${result.error}`);
    return result;
  }));
};

export default GetOfficialHealthService;
