import CallHistory from "../../models/CallHistory";
import Company from "../../models/Company";
import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";
import Contact from "../../models/Contact";

interface GetHistoricalRequest {
    user_id?: number;
    company_id: number;
}

const normalizeDirection = (direction?: string): "incoming" | "outgoing" => {
    const value = String(direction || "").toLowerCase();

    if (value === "incoming" || value === "in" || value === "received") {
        return "incoming";
    }

    return "outgoing";
};

const normalizeStatus = (status?: string): string => {
    return String(status || "created").toLowerCase();
};

const getDeviceDirection = (direction?: string): "INCOMING" | "OUTCOMING" => {
    return normalizeDirection(direction) === "incoming" ? "INCOMING" : "OUTCOMING";
};

const getHistorical = async (body: GetHistoricalRequest) => {
    try {
        const historicalDB: any[] = await CallHistory.findAll({
            raw: true,
            nest: true,
            include: [
                {
                    model: User,
                    attributes: ["id", "name"]
                },
                {
                    model: Company,
                    attributes: ["id", "name"]
                },
                {
                    model: Whatsapp,
                    attributes: ["id", "name", "wavoip"]
                },
                {
                    model: Contact,
                    attributes: ["id", "name", "number"]
                }
            ],
            where: {
                company_id: body.company_id
            },
            order: [["createdAt", "DESC"]],
            limit: 1000
        });

        let total = 0;
        let totalReject = 0;
        let totalServed = 0;
        let totalFinish = 0;
        let totalIncoming = 0;
        let totalOutgoing = 0;
        let totalMissed = 0;

        const visibleHistoricalDB = historicalDB.filter((item: any) => {
            const status = String(item.status || "").toLowerCase();
            const callId = String(item.call_id || "").trim();
            const duration = Number(item.duration || 0);
            const url = String(item.url || "").toLowerCase();
            const source = String(item.source || "").toLowerCase();

            const isWavoipGhostRecord =
                ["opened", "created", "calling", "ringing"].includes(status) &&
                !callId &&
                duration <= 0 &&
                (
                    url.includes("app.wavoip.com/call") ||
                    source === "widget_app_url" ||
                    source === "wavoip-widget"
                );

            return !isWavoipGhostRecord;
        });

        const resultFinal = visibleHistoricalDB.map((item) => {
            const direction = normalizeDirection(item.direction);
            const status = normalizeStatus(item.status);
            const duration = Number(item.duration || 0);

            total += 1;

            if (direction === "incoming") {
                totalIncoming += 1;
            } else {
                totalOutgoing += 1;
            }

            if (
                status === "answered" ||
                status === "served" ||
                status === "completed" ||
                duration > 0
            ) {
                totalServed += 1;
            }

            if (
                status === "ended" ||
                status === "finish" ||
                status === "finished" ||
                status === "completed"
            ) {
                totalFinish += 1;
            }

            if (status === "rejected" || status === "reject") {
                totalReject += 1;
            }

            if (
                status === "missed" ||
                status === "unanswered" ||
                status === "timeout"
            ) {
                totalMissed += 1;
            }

            const createdDate =
                item.started_at ||
                item.createdAt ||
                item.ended_at ||
                new Date();

            const isRecordingUrl = (url?: string): boolean => {
                const value = String(url || "").toLowerCase();

                return (
                    value.includes("storage.wavoip.com") ||
                    value.endsWith(".mp3") ||
                    value.endsWith(".ogg") ||
                    value.endsWith(".wav") ||
                    value.includes("/recording") ||
                    value.includes("/records")
                );
            };

            const callSaveUrl = isRecordingUrl(item.url) ? item.url : "";

            return {
                ...item,
                callSaveUrl,
                devices: {
                    id: item.call_id || item.id,
                    direction: getDeviceDirection(item.direction),
                    status: String(item.status || "CREATED").toUpperCase(),
                    duration,
                    caller: item.phone_to,
                    phone: item.phone_to,
                    name: item.name,
                    token: item.token_wavoip,
                    source: item.source,
                    created_date: createdDate,
                    started_at: item.started_at,
                    ended_at: item.ended_at,
                    whatsapp_call_id: item.call_id
                }
            };
        });

        return {
            resultFinal,
            total,
            totalReject,
            totalServed,
            totalFinish,
            totalIncoming,
            totalOutgoing,
            totalMissed
        };
    } catch (error: any) {
        const msg = error?.message || String(error);
        console.error("[getHistorical local] Erro geral:", msg);
        throw new Error(msg);
    }
};

export default getHistorical;