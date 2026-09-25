import { Request, Response } from "express";

import * as ProductService from "../services/RenewalServices/RenewalProductService";
import * as CustomerService from "../services/RenewalServices/RenewalCustomerService";
import * as SubscriptionService from "../services/RenewalServices/RenewalSubscriptionService";
import * as PaymentService from "../services/RenewalServices/RenewalPaymentService";
import * as FailureService from "../services/RenewalServices/RenewalFailureService";

// ============================================================
// PRODUTOS
// ============================================================

export const listProducts = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const {
    searchParam,
    active
  } = req.query as Record<string, string>;

  const products = await ProductService.list(
    companyId,
    searchParam,
    active
  );

  return res.json({
    products,
    count: products.length
  });
};

export const showProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const product = await ProductService.show(
    req.params.id,
    companyId
  );

  return res.json(product);
};

export const createProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const product = await ProductService.create(
    req.body,
    companyId
  );

  return res.status(201).json(product);
};

export const updateProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const product = await ProductService.update(
    req.params.id,
    req.body,
    companyId
  );

  return res.json(product);
};

export const removeProduct = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  await ProductService.remove(
    req.params.id,
    companyId
  );

  return res.json({
    message: "Produto excluído definitivamente com sucesso."
  });
};


// ============================================================
// CLIENTES
// ============================================================

export const listCustomers = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const {
    searchParam,
    active
  } = req.query as Record<string, string>;

  const customers = await CustomerService.list(
    companyId,
    searchParam,
    active
  );

  return res.json({
    customers,
    count: customers.length
  });
};

export const showCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const customer = await CustomerService.show(
    req.params.id,
    companyId
  );

  return res.json(customer);
};

export const createCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const customer = await CustomerService.create(
    req.body,
    companyId
  );

  return res.status(201).json(customer);
};

export const updateCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const customer = await CustomerService.update(
    req.params.id,
    req.body,
    companyId
  );

  return res.json(customer);
};

export const removeCustomer = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  await CustomerService.remove(
    req.params.id,
    companyId
  );

  return res.json({
    message: "Cliente excluído definitivamente com sucesso."
  });
};


// ============================================================
// ASSINATURAS
// ============================================================

export const listSubscriptions = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const {
    searchParam,
    status
  } = req.query as Record<string, string>;

  const subscriptions =
    await SubscriptionService.list(
      companyId,
      searchParam,
      status
    );

  return res.json({
    subscriptions,
    count: subscriptions.length
  });
};

export const showSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const subscription =
    await SubscriptionService.show(
      req.params.id,
      companyId
    );

  return res.json(
    subscription
  );
};

export const createSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const subscription =
    await SubscriptionService.create(
      req.body,
      companyId
    );

  return res
    .status(201)
    .json(subscription);
};

export const updateSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const subscription =
    await SubscriptionService.update(
      req.params.id,
      req.body,
      companyId
    );

  return res.json(
    subscription
  );
};

export const removeSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  await SubscriptionService.remove(
    req.params.id,
    companyId
  );

  return res.json({
    message:
      "Assinatura excluída definitivamente com sucesso."
  });
};

export const previewNextDueDate = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const paymentDate =
    req.query.paymentDate
      ? String(req.query.paymentDate)
      : undefined;

  const preview =
    await SubscriptionService.previewNextDueDate(
      req.params.id,
      companyId,
      paymentDate
    );

  return res.json(preview);
};


// ============================================================
// BAIXA / RENOVAÇÃO
// ============================================================

export const renewSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const userId = Number(
    req.user.id
  );

  const result =
    await PaymentService.renew(
      req.params.id,
      req.body,
      companyId,
      userId
    );

  return res.json(result);
};


export const listPayments = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const subscriptionId =
    req.query.subscriptionId
      ? String(req.query.subscriptionId)
      : undefined;

  const payments =
    await PaymentService.listPayments(
      companyId,
      subscriptionId
    );

  return res.json({
    payments,
    count: payments.length
  });
};


// ============================================================
// FALHAS / RETRIES DE ENVIO
// ============================================================

export const listNotificationFailures = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const notifications =
    await FailureService.listFailures(
      companyId
    );

  return res.json({
    notifications,
    count:
      notifications.length
  });
};


export const retryNotificationNow = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const notification =
    await FailureService.retryNow(
      req.params.id,
      companyId
    );

  return res.json({
    message:
      "Notificação liberada para reenvio.",
    notification
  });
};


export const cancelNotificationFailure = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(
    req.user.companyId
  );

  const notification =
    await FailureService.cancelFailure(
      req.params.id,
      companyId
    );

  return res.json({
    message:
      "Tentativa de envio cancelada.",
    notification
  });
};

