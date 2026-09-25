import { Request, Response } from "express";
import { Op } from "sequelize";
import moment from "moment-timezone";

import CampaignShipping from "../models/CampaignShipping";

export const handleSendGridEvents = async (
    req: Request,
    res: Response
): Promise<Response> => {
    const events = Array.isArray(req.body) ? req.body : [];

    for (const event of events) {
        const sgMessageId = event.sg_message_id;
        const email = event.email;
        const eventType = event.event;

        if (!eventType || !email) continue;

        const campaignShippingId = event.campaignShippingId || event.custom_args?.campaignShippingId;

        const shipping = campaignShippingId
            ? await CampaignShipping.findByPk(campaignShippingId)
            : await CampaignShipping.findOne({
                where: {
                    [Op.or]: [
                        { emailMessageId: sgMessageId },
                        { email }
                    ]
                },
                order: [["createdAt", "DESC"]]
            });

        if (!shipping) continue;

        const updateData: any = {};

        if (eventType === "delivered") {
            updateData.emailStatus = "sent";
            updateData.emailSentAt = moment();
            updateData.deliveredAt = moment();
        }

        if (eventType === "open") {
            updateData.emailStatus = "opened";
            updateData.emailOpenedAt = moment();
        }

        if (eventType === "click") {
            updateData.emailStatus = "clicked";
            updateData.emailClickedAt = moment();
        }

        if (eventType === "bounce" || eventType === "dropped") {
            updateData.emailStatus = "bounced";
            updateData.emailBouncedAt = moment();
            updateData.emailError = event.reason || event.response || null;
        }

        if (
            eventType === "unsubscribe" ||
            eventType === "group_unsubscribe"
        ) {
            updateData.emailStatus = "unsubscribed";
            updateData.emailUnsubscribedAt = moment();
        }

        if (Object.keys(updateData).length > 0) {
            await shipping.update(updateData);
        }
    }

    return res.status(200).json({ received: true });
};