import { Op } from "sequelize";
import moment from "moment-timezone";

import RenewalProduct from "../../models/RenewalProduct";
import RenewalSubscription from "../../models/RenewalSubscription";
import RenewalCustomer from "../../models/RenewalCustomer";
import RenewalNotification from "../../models/RenewalNotification";

import {
  buildCycleNotifications
} from "./RenewalNotificationService";

const SyncRenewalProductNotificationsService =
  async (
    product: RenewalProduct,
    companyId: number
  ): Promise<number> => {
    const subscriptions =
      await RenewalSubscription.findAll({
        where: {
          companyId,
          productId: product.id,
          active: true,
          status: {
            [Op.ne]: "canceled"
          }
        }
      });

    const today =
      moment()
        .tz("America/Sao_Paulo")
        .format("YYYY-MM-DD");

    let totalCreated = 0;

    for (const subscription of subscriptions) {
      const customer =
        await RenewalCustomer.findOne({
          where: {
            id: subscription.customerId,
            companyId
          }
        });

      if (!customer) {
        continue;
      }

      await RenewalNotification.destroy({
        where: {
          companyId,
          subscriptionId:
            subscription.id,
          cycleDueDate:
            subscription.dueDate,
          status: {
            [Op.in]: [
              "pending",
              "failed"
            ]
          }
        }
      });

      totalCreated +=
        await buildCycleNotifications({
          companyId,
          subscriptionId:
            subscription.id,
          whatsappId:
            subscription.whatsappId,
          dueDate:
            subscription.dueDate,
          product,
          customer,
          minimumDate: today
        });
    }

    return totalCreated;
  };

export default SyncRenewalProductNotificationsService;
