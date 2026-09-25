import CallHistory from "../../models/CallHistory";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";
import User from "../../models/User";

interface CallHistorical {
  user_id?: number;
  token_wavoip?: string;
  whatsapp_id?: number;
  contact_id?: number;
  company_id?: number;
  phone_to?: string;
  name?: string;
  url?: string;

  direction?: "incoming" | "outgoing" | string;
  status?: string;
  source?: string;
  duration?: number;
  call_id?: string;
  whatsapp_call_id?: string;
  started_at?: string | Date;
  ended_at?: string | Date;

  recordingUrl?: string;
  recording_url?: string;
  callSaveUrl?: string;
}


const extractWavoipTokenFromUrl = (url?: string): string => {
  const value = String(url || "");

  if (!value) return "";

  const match = value.match(/[?&]token=([^&]+)/);

  if (!match?.[1]) return "";

  try {
    return decodeURIComponent(match[1]);
  } catch {
    return match[1];
  }
};

const onlyNumbers = (value?: string): string => {
  return String(value || "").replace(/\D/g, "");
};

const parseDateOrNull = (value?: string | Date): Date | null => {
  if (!value) return null;

  const date = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date;
};

const numberOrNull = (value?: number | string): number | null => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return null;
  }

  return parsed;
};

const isRecordingUrl = (url?: string): boolean => {
  const value = String(url || "").toLowerCase();

  return (
    value.includes("storage.wavoip.com") ||
    value.includes("/official-call-recordings/") ||
    value.endsWith(".mp3") ||
    value.endsWith(".ogg") ||
    value.endsWith(".wav") ||
    value.endsWith(".webm") ||
    value.includes("/recording") ||
    value.includes("/records")
  );
};


const normalizeSource = ({
  source,
  url,
  status
}: {
  source?: string;
  url?: string;
  status?: string;
}): string => {
  const rawSource = String(source || "").toLowerCase();
  const rawUrl = String(url || "").toLowerCase();
  const rawStatus = String(status || "").toLowerCase();

  if (rawSource === "meta_official") {
    return "meta_official";
  }

  if (
    rawSource.startsWith("socket.call") ||
    rawSource.includes("wavoip") ||
    rawUrl.includes("storage.wavoip.com")
  ) {
    if (
      rawSource === "widget_app_url" &&
      !["ended", "finished", "finish", "completed"].includes(rawStatus)
    ) {
      return "widget_app_url";
    }

    return "wavoip";
  }

  return source || "wavoip-widget";
};

const normalizeStatus = (status?: string): string => {
  return String(status || "created").toLowerCase();
};

const shouldGenerateRecordingUrl = (
  status: string,
  duration: number,
  callId: string
): boolean => {
  return (
    !!callId &&
    duration > 0 &&
    ["ended", "finish", "finished", "completed"].includes(status)
  );
};

const resolveUserId = async ({
  userId,
  companyId
}: {
  userId?: number | null;
  companyId: number;
}): Promise<number> => {
  if (userId) return userId;

  const firstUser = await User.findOne({
    where: {
      companyId
    } as any,
    order: [["id", "ASC"]]
  });

  if (firstUser?.id) {
    return firstUser.id;
  }

  throw new Error(
    `Não foi possível localizar um usuário para companyId ${companyId}.`
  );
};

const resolveWhatsappId = async ({
  whatsappId,
  companyId,
  tokenWavoip,
  source
}: {
  whatsappId?: number | null;
  companyId: number;
  tokenWavoip?: string;
  source?: string;
}): Promise<number> => {
  const normalizedSource = String(source || "").toLowerCase();

  if (normalizedSource === "meta_official") {
    const officialWhatsapp = await Whatsapp.findOne({
      where: {
        companyId,
        channel: "whatsapp_oficial"
      } as any,
      order: [["id", "ASC"]]
    });

    if (officialWhatsapp?.id) {
      return officialWhatsapp.id;
    }
  }

  if (whatsappId) return whatsappId;

  if (tokenWavoip) {
    const whatsappByToken = await Whatsapp.findOne({
      where: {
        companyId,
        wavoip: tokenWavoip
      } as any
    });

    if (whatsappByToken?.id) {
      return whatsappByToken.id;
    }
  }

  const firstWhatsapp = await Whatsapp.findOne({
    where: {
      companyId
    } as any,
    order: [["id", "ASC"]]
  });

  if (firstWhatsapp?.id) {
    return firstWhatsapp.id;
  }

  throw new Error(
    `Não foi possível localizar uma conexão WhatsApp para companyId ${companyId}.`
  );
};

const resolveContactId = async ({
  contactId,
  companyId,
  phone,
  name
}: {
  contactId?: number | null;
  companyId: number;
  phone: string;
  name?: string;
}): Promise<number> => {
  if (contactId) return contactId;

  if (!phone) {
    throw new Error("Número da chamada não informado para localizar/criar contato.");
  }

  const contact = await Contact.findOne({
    where: {
      companyId,
      number: phone
    } as any
  });

  if (contact?.id) {
    return contact.id;
  }

  const newContact = await Contact.create({
    name: name || phone,
    number: phone,
    email: "",
    companyId
  } as any);

  if (newContact?.id) {
    return newContact.id;
  }

  throw new Error(`Não foi possível criar contato para o número ${phone}.`);
};

const createCallHistorical = async (body: CallHistorical) => {
  try {
    const companyId = numberOrNull(body.company_id);

    if (!companyId) {
      throw new Error("company_id não informado para salvar histórico de chamada.");
    }

    const phone = onlyNumbers(body.phone_to);
    const status = normalizeStatus(body.status);
    const duration = Number(body.duration || 0);
    const callId = String(body.call_id || body.whatsapp_call_id || "").trim();

    const explicitUserId = numberOrNull(body.user_id);
    const isMetaOfficialCallForUser =
      String(body.source || "").trim().toLowerCase() === "meta_official";

    const userId =
      isMetaOfficialCallForUser && !explicitUserId
        ? null
        : await resolveUserId({
            userId: explicitUserId,
            companyId
          });

    const explicitWhatsappId = numberOrNull(body.whatsapp_id);
    const isMetaOfficialCall =
      String(body.source || "").trim().toLowerCase() === "meta_official";

    const whatsappId =
      isMetaOfficialCall && !explicitWhatsappId
        ? null
        : await resolveWhatsappId({
            whatsappId: explicitWhatsappId,
            companyId,
            source: body.source,
            tokenWavoip:
              body.token_wavoip ||
              extractWavoipTokenFromUrl(body.url) ||
              extractWavoipTokenFromUrl(body.callSaveUrl) ||
              extractWavoipTokenFromUrl(body.recordingUrl) ||
              extractWavoipTokenFromUrl(body.recording_url)
          });

    const contactId = await resolveContactId({
      contactId: numberOrNull(body.contact_id),
      companyId,
      phone,
      name: body.name
    });

    const recordingUrl =
      body.recordingUrl ||
      body.recording_url ||
      body.callSaveUrl ||
      "";

    let finalUrl = body.url || "";

    if (isRecordingUrl(recordingUrl)) {
      finalUrl = recordingUrl;
    }

    if (!finalUrl && shouldGenerateRecordingUrl(status, duration, callId)) {
      finalUrl = `https://storage.wavoip.com/${callId}`;
    }

    const payload: any = {
      user_id: userId,
      company_id: companyId,
      whatsapp_id: whatsappId,
      contact_id: contactId,

      token_wavoip: body.token_wavoip || "",
      phone_to: phone,
      name: body.name || phone || "Número desconhecido",
      url: finalUrl,

      direction: body.direction || "outgoing",
      status,
      source: normalizeSource({
        source: body.source,
        url: finalUrl,
        status
      }),
      duration,
      call_id: callId,
      started_at: parseDateOrNull(body.started_at) || new Date(),
      ended_at: parseDateOrNull(body.ended_at),
      updatedAt: new Date()
    };

    if ((!payload.duration || payload.duration <= 0) && payload.started_at && payload.ended_at) {
      const startTime = new Date(payload.started_at).getTime();
      const endTime = new Date(payload.ended_at).getTime();

      if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime) {
        payload.duration = Math.round((endTime - startTime) / 1000);
      }
    }

    if (callId) {
      const existingCall: any = await CallHistory.findOne({
        where: {
          company_id: companyId,
          call_id: callId
        } as any
      });

      if (existingCall) {
        const currentDuration = Number(existingCall.duration || 0);
        let finalDuration = Number(payload.duration || 0);

        const existingStatus = String(existingCall.status || "").toLowerCase();
        const incomingStatus = String(payload.status || "").toLowerCase();

        const preserveRejectedStatus =
          ["rejected", "reject", "missed"].includes(existingStatus) &&
          ["ended", "completed", "finish", "finished"].includes(incomingStatus);

        const finalStatus = preserveRejectedStatus
          ? existingCall.status
          : payload.status || existingCall.status;

        const finalEndedAt = payload.ended_at || existingCall.ended_at;
        const existingStartedAt = existingCall.started_at || payload.started_at;

        if ((!finalDuration || finalDuration <= 0) && existingStartedAt && finalEndedAt) {
          const startTime = new Date(existingStartedAt).getTime();
          const endTime = new Date(finalEndedAt).getTime();

          if (Number.isFinite(startTime) && Number.isFinite(endTime) && endTime > startTime) {
            finalDuration = Math.round((endTime - startTime) / 1000);
          }
        }

        await existingCall.update({
          user_id: payload.user_id || existingCall.user_id,
          whatsapp_id: payload.whatsapp_id || existingCall.whatsapp_id,
          contact_id: payload.contact_id || existingCall.contact_id,
          token_wavoip: payload.token_wavoip || existingCall.token_wavoip,
          phone_to: payload.phone_to || existingCall.phone_to,
          name: payload.name || existingCall.name,

          url: payload.url || existingCall.url,
          direction: payload.direction || existingCall.direction,
          status: finalStatus,
          source: payload.source || existingCall.source,
          duration: Math.max(currentDuration, finalDuration || 0),
          started_at: existingCall.started_at || payload.started_at,
          ended_at: payload.ended_at || existingCall.ended_at,
          updatedAt: new Date()
        } as any);

        return existingCall;
      }
    }

    return await CallHistory.create(payload);
  } catch (error: any) {
    console.log("createCallHistorical", error);
    throw new Error(error?.message || String(error));
  }
};

export default createCallHistorical;