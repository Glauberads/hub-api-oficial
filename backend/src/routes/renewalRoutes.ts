import { Router } from "express";
import isAuth from "../middleware/isAuth";
import * as RenewalController from "../controllers/RenewalController";

const renewalRoutes = Router();

// Produtos
renewalRoutes.get(
  "/renewals/products",
  isAuth,
  RenewalController.listProducts
);

renewalRoutes.get(
  "/renewals/products/:id",
  isAuth,
  RenewalController.showProduct
);

renewalRoutes.post(
  "/renewals/products",
  isAuth,
  RenewalController.createProduct
);

renewalRoutes.put(
  "/renewals/products/:id",
  isAuth,
  RenewalController.updateProduct
);

renewalRoutes.delete(
  "/renewals/products/:id",
  isAuth,
  RenewalController.removeProduct
);

// Clientes
renewalRoutes.get(
  "/renewals/customers",
  isAuth,
  RenewalController.listCustomers
);

renewalRoutes.get(
  "/renewals/customers/:id",
  isAuth,
  RenewalController.showCustomer
);

renewalRoutes.post(
  "/renewals/customers",
  isAuth,
  RenewalController.createCustomer
);

renewalRoutes.put(
  "/renewals/customers/:id",
  isAuth,
  RenewalController.updateCustomer
);

renewalRoutes.delete(
  "/renewals/customers/:id",
  isAuth,
  RenewalController.removeCustomer
);


// Assinaturas
renewalRoutes.get(
  "/renewals/subscriptions",
  isAuth,
  RenewalController.listSubscriptions
);

renewalRoutes.get(
  "/renewals/subscriptions/:id",
  isAuth,
  RenewalController.showSubscription
);

renewalRoutes.post(
  "/renewals/subscriptions",
  isAuth,
  RenewalController.createSubscription
);

renewalRoutes.put(
  "/renewals/subscriptions/:id",
  isAuth,
  RenewalController.updateSubscription
);

renewalRoutes.delete(
  "/renewals/subscriptions/:id",
  isAuth,
  RenewalController.removeSubscription
);

renewalRoutes.get(
  "/renewals/subscriptions/:id/preview-next-due-date",
  isAuth,
  RenewalController.previewNextDueDate
);


// Pagamentos / baixas
renewalRoutes.get(
  "/renewals/payments",
  isAuth,
  RenewalController.listPayments
);

renewalRoutes.post(
  "/renewals/subscriptions/:id/renew",
  isAuth,
  RenewalController.renewSubscription
);

// Falhas / retries
renewalRoutes.get(
  "/renewals/notifications/failures",
  isAuth,
  RenewalController.listNotificationFailures
);

renewalRoutes.post(
  "/renewals/notifications/:id/retry",
  isAuth,
  RenewalController.retryNotificationNow
);

renewalRoutes.post(
  "/renewals/notifications/:id/cancel",
  isAuth,
  RenewalController.cancelNotificationFailure
);


export default renewalRoutes;
