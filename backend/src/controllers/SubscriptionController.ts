import { Request, Response } from "express";
import * as Yup from "yup";
import Gerencianet from "gn-api-sdk-typescript";
import AppError from "../errors/AppError";
import path from "path";
import fs from "fs";
import util from "util";

import options from "../config/Gn";
import Company from "../models/Company";
import Invoices from "../models/Invoices";
import { getIO } from "../libs/socket";
import Setting from "../models/Setting";
import UpdateUserService from "../services/UserServices/UpdateUserService";
import Stripe from "stripe";
var axios = require("axios");
import Plan from "../models/Plan";
import logger from "../utils/logger";
import ListWhatsAppsService from "../services/WhatsappService/ListWhatsAppsService";
import { StartWhatsAppSession } from "../services/WbotServices/StartWhatsAppSession";
import * as Sentry from "@sentry/node";

const getSettingValue = async (companyId: number, key: string) => {
  const setting = await Setting.findOne({
    where: { companyId, key }
  });

  return setting?.value || null;
};

const resolveEfiCertificatePath = (certificate: string | null) => {
  if (!certificate) return null;

  const normalized = String(certificate).trim().replace(/\\/g, "/");

  if (path.isAbsolute(normalized)) {
    logger.info(`[EFÍ] Resolvendo caminho do certificado: ${normalized}`);
    return normalized;
  }

  const withoutPublicPrefix = normalized
    .replace(/^\/+/, "")
    .replace(/^public\//, "");

  const resolvedPath = path.resolve(
    __dirname,
    "..",
    "..",
    "public",
    withoutPublicPrefix
  );

  logger.info(`[EFÍ] Resolvendo caminho do certificado: ${resolvedPath}`);

  return resolvedPath;
};

const getGerencianetOptions = async (companyId = 1) => {
  const clientId = await getSettingValue(companyId, "eficlientid");
  const clientSecret = await getSettingValue(companyId, "eficlientsecret");
  const certificate = await getSettingValue(companyId, "eficertificado");
  const certPassword = await getSettingValue(companyId, "eficertificadopass");

  const certificatePath = resolveEfiCertificatePath(certificate);

  if (certificatePath && fs.existsSync(certificatePath)) {
    logger.info(`[EFÍ] Usando certificado em: ${certificatePath}`);
    logger.info(`[EFÍ] Tamanho do arquivo: ${fs.statSync(certificatePath).size} bytes`);
  } else if (certificatePath) {
    logger.warn(`[EFÍ] Certificado não encontrado em: ${certificatePath}`);
  }

  const gerencianetConfig: any = {
    ...(options as any),
    sandbox: process.env.GERENCIANET_SANDBOX === "true",
    client_id: clientId || (options as any).client_id,
    client_secret: clientSecret || (options as any).client_secret,
    pix_cert: certificatePath || (options as any).pix_cert,
    certificate:
      certificatePath ||
      (options as any).certificate ||
      (options as any).pix_cert,
    cert_base64: false
  };

  if (certPassword && String(certPassword).trim() !== "") {
    gerencianetConfig.cert_password = String(certPassword).trim();
  }

  return gerencianetConfig;
};

export const index = async (req: Request, res: Response): Promise<Response> => {
  const gerencianetOptions = await getGerencianetOptions(1);
  const gerencianet = new Gerencianet(gerencianetOptions);

  return res.json(gerencianet.getSubscriptions());
};

const formatEfiPixValue = (value: any): string => {
  const numberValue = Number(
    String(value)
      .replace(/\./g, "")
      .replace(",", ".")
      .replace(/[^\d.]/g, "")
  );

  if (Number.isNaN(numberValue) || numberValue <= 0) {
    return "0.00";
  }

  return numberValue.toFixed(2);
};

const getEfiWebhookUrl = (): string => {
  const backendUrl = String(process.env.BACKEND_URL || "").replace(/\/+$/, "");

  if (!backendUrl) {
    throw new AppError("BACKEND_URL não configurado no .env", 500);
  }

  return `${backendUrl}/subscription/webhook`;
};

export const createSubscription = async (
  req: Request,
  res: Response
): Promise<Response> => {
  let stripeURL;
  let pix;
  let qrcode;
  let asaasURL;

  let key_STRIPE_PRIVATE = null;
  let key_MP_ACCESS_TOKEN = null;
  let key_GERENCIANET_PIX_KEY = null;
  let key_ASAAS_TOKEN = null;

  try {
    const buscacompanyId = 1;

    const getasaastoken = await Setting.findOne({
      where: { companyId: buscacompanyId, key: "asaastoken" }
    });
    key_ASAAS_TOKEN = getasaastoken?.value;

    const getmptoken = await Setting.findOne({
      where: { companyId: buscacompanyId, key: "mpaccesstoken" }
    });
    key_MP_ACCESS_TOKEN = getmptoken?.value;

    const getstripetoken = await Setting.findOne({
      where: { companyId: buscacompanyId, key: "stripeprivatekey" }
    });
    key_STRIPE_PRIVATE = getstripetoken?.value;

    key_GERENCIANET_PIX_KEY = await getSettingValue(
      buscacompanyId,
      "efichavepix"
    );

    logger.info(
      `[SUBSCRIPTION] Chave PIX encontrada: ${key_GERENCIANET_PIX_KEY ? "Sim" : "Não"
      }`
    );
  } catch (error) {
    console.error("Error retrieving settings:", error);
  }

  const gerencianetOptions = await getGerencianetOptions(1);

  logger.info(
    `[SUBSCRIPTION] Gerencianet Options - client_id: ${gerencianetOptions.client_id ? "Presente" : "Ausente"
    }`
  );
  logger.info(
    `[SUBSCRIPTION] Gerencianet Options - client_secret: ${gerencianetOptions.client_secret ? "Presente" : "Ausente"
    }`
  );
  logger.info(
    `[SUBSCRIPTION] Gerencianet Options - certificate: ${gerencianetOptions.certificate || gerencianetOptions.pix_cert
      ? "Presente"
      : "Ausente"
    }`
  );
  logger.info(
    `[SUBSCRIPTION] Gerencianet Options - cert_base64: ${gerencianetOptions.cert_base64}`
  );
  logger.info(
    `[SUBSCRIPTION] Gerencianet Options - cert_password: ${gerencianetOptions.cert_password ? "Presente" : "Ausente"
    }`
  );
  logger.info(
    `[SUBSCRIPTION] Gerencianet Options - sandbox: ${gerencianetOptions.sandbox}`
  );

  const gerencianet = new Gerencianet(gerencianetOptions);
  const { companyId } = req.user;

  const schema = Yup.object().shape({
    price: Yup.string().required(),
    users: Yup.string().required(),
    connections: Yup.string().required()
  });

  if (!(await schema.isValid(req.body))) {
    logger.warn("[SUBSCRIPTION] Dados incorretos na criação de assinatura");
    throw new AppError("Dados Incorretos - Contate o Suporte!", 400);
  }

  const {
    firstName,
    users,
    connections,
    address2,
    city,
    state,
    zipcode,
    country,
    plan,
    invoiceId
  } = req.body;

  const invoice = await Invoices.findOne({
    where: { id: invoiceId, companyId }
  });

  if (!invoice) {
    throw new AppError("Fatura não encontrada para esta empresa", 404);
  }

  const currency = ["BRL", "COP", "USD"].includes(String(invoice.currency).toUpperCase())
    ? String(invoice.currency).toUpperCase()
    : "BRL";
  const isBrazilianCurrency = currency === "BRL";

  // O valor cobrado deve vir da fatura persistida, nunca do navegador.
  const price = Number(invoice.value);

  const valor = price;
  const valorext = price;

  async function createMercadoPagoPreference() {
    if (key_MP_ACCESS_TOKEN && isBrazilianCurrency) {
      const mercadopago = require("mercadopago");
      mercadopago.configure({
        access_token: key_MP_ACCESS_TOKEN
      });

      let preference = {
        external_reference: String(invoiceId),
        notification_url: String(process.env.MP_NOTIFICATION_URL),
        items: [
          {
            title: `#Fatura:${invoiceId}`,
            unit_price: valor,
            quantity: 1
          }
        ]
      };

      try {
        const response = await mercadopago.preferences.create(preference);
        return response.body.init_point;
      } catch (error) {
        logger.error(`[SUBSCRIPTION] Erro MercadoPago: ${error}`);
        return null;
      }
    }

    return null;
  }

  const mercadopagoURL = await createMercadoPagoPreference();

  if (key_ASAAS_TOKEN && isBrazilianCurrency && valor > 10) {
    const optionsGetAsaas = {
      method: "POST",
      url: `https://api.asaas.com/v3/paymentLinks`,
      headers: {
        "Content-Type": "application/json",
        access_token: key_ASAAS_TOKEN
      },
      data: {
        name: `#Fatura:${invoiceId}`,
        description: `#Fatura:${invoiceId}`,
        value: price
          .toLocaleString("pt-br", { minimumFractionDigits: 2 })
          .replace(",", "."),
        billingType: "UNDEFINED",
        chargeType: "DETACHED",
        dueDateLimitDays: 1,
        subscriptionCycle: null,
        maxInstallmentCount: 1,
        notificationEnabled: true
      }
    };

    while (asaasURL === undefined) {
      try {
        const response = await axios.request(optionsGetAsaas);
        asaasURL = response.data.url;
        logger.info(`[SUBSCRIPTION] Asaas URL gerada: ${asaasURL}`);
      } catch (error) {
        console.error("Error:", error);
        break;
      }
    }
  }

  if (key_STRIPE_PRIVATE) {
    const stripe = new Stripe(key_STRIPE_PRIVATE, {});

    const sessionStripe = await stripe.checkout.sessions.create({
      payment_method_types: ["card"],
      line_items: [
        {
          price_data: {
            currency: currency.toLowerCase(),
            product_data: {
              name: `#Fatura:${invoiceId}`
            },
            unit_amount: Math.round(price * 100)
          },
          quantity: 1
        }
      ],
      mode: "payment",
      success_url: process.env.STRIPE_OK_URL,
      cancel_url: process.env.STRIPE_CANCEL_URL
    });

    const invoicesX = await Invoices.findByPk(invoiceId);
    if (invoicesX) {
      await invoicesX.update({
        id: invoiceId,
        stripe_id: sessionStripe.id
      });
    }

    stripeURL = sessionStripe.url;
  }

  if (key_GERENCIANET_PIX_KEY && isBrazilianCurrency) {
    const efiPixValue = formatEfiPixValue(price);

    const body = {
      calendario: {
        expiracao: 3600
      },
      valor: {
        original: efiPixValue
      },
      chave: key_GERENCIANET_PIX_KEY,
      solicitacaoPagador: `#Fatura:${invoiceId}`
    };

    try {
      logger.info("[SUBSCRIPTION] Tentando criar cobrança PIX Efí...");

      pix = await gerencianet.pixCreateImmediateCharge(null, body);

      logger.info(
        `[SUBSCRIPTION] Cobrança PIX Efí criada com sucesso. Txid: ${pix.txid}`
      );

      qrcode = await gerencianet.pixGenerateQRCode({
        id: pix.loc.id
      });

      const invoicePix = await Invoices.findByPk(invoiceId);

      if (invoicePix) {
        await invoicePix.update({
          txid: pix.txid,
          status: "processing"
        });
      }

      logger.info("[SUBSCRIPTION] QR Code PIX Efí gerado com sucesso");
    } catch (error: any) {
      logger.error(
        `[SUBSCRIPTION] Erro Gerencianet PIX detalhado: ${util.inspect(error, {
          depth: 10,
          colors: false
        })}`
      );

      if (error?.response?.data) {
        logger.error(
          `[SUBSCRIPTION] Efí response data: ${util.inspect(error.response.data, {
            depth: 10,
            colors: false
          })}`
        );
      }

      if (error?.error) {
        logger.error(
          `[SUBSCRIPTION] Efí error: ${util.inspect(error.error, {
            depth: 10,
            colors: false
          })}`
        );
      }

      if (error?.error_description) {
        logger.error(
          `[SUBSCRIPTION] Efí error_description: ${error.error_description}`
        );
      }

      if (error?.mensagem) {
        logger.error(`[SUBSCRIPTION] Efí mensagem: ${error.mensagem}`);
      }

      if (error?.message) {
        logger.error(`[SUBSCRIPTION] Efí message: ${error.message}`);
      }

      pix = null;
      qrcode = null;

      logger.error(
        "[SUBSCRIPTION] Efí falhou ao gerar PIX. Mercado Pago/Stripe/Asaas continuarão disponíveis."
      );
    }
  } else if (isBrazilianCurrency) {
    logger.warn("[SUBSCRIPTION] Chave PIX não configurada. Pular geração de PIX.");
  }

  if (!isBrazilianCurrency && !stripeURL) {
    throw new AppError(
      `Planos em ${currency} exigem que o Stripe esteja configurado`,
      400
    );
  }

  return res.json({
    ...pix,
    valorext,
    qrcode,
    stripeURL,
    mercadopagoURL,
    asaasURL,
    currency
  });
};

export const createWebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const schema = Yup.object().shape({
    chave: Yup.string().required()
  });

  logger.info("[WEBHOOK] createWebhook Efí chamado");

  try {
    await schema.validate(req.body, { abortEarly: false });
  } catch (err) {
    if (err instanceof Yup.ValidationError) {
      const errors = err.errors.join("\n");
      throw new AppError(`Validation error(s):\n${errors}`, 400);
    }

    throw err;
  }

  const { chave } = req.body;

  const webhookUrl = getEfiWebhookUrl();

  const body = {
    webhookUrl
  };

  const params = {
    chave
  };

  try {
    const gerencianetOptions = await getGerencianetOptions(1);
    const gerencianet = new Gerencianet(gerencianetOptions);

    const create = await gerencianet.pixConfigWebhook(params, body);

    logger.info(`[WEBHOOK] Webhook Efí configurado com sucesso: ${webhookUrl}`);

    return res.json({
      ...create,
      webhookUrl
    });
  } catch (error: any) {
    logger.error(
      `[WEBHOOK] Erro ao criar webhook Efí: ${util.inspect(error, {
        depth: 10,
        colors: false
      })}`
    );

    throw error;
  }
};

export const webhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { evento } = req.body;

  if (evento === "teste_webhook") {
    return res.json({ ok: true });
  }

  if (req.body.pix) {
    const gerencianetOptions = await getGerencianetOptions(1);
    const gerencianet = new Gerencianet(gerencianetOptions);

    for (const pixItem of req.body.pix) {
      try {
        const detahe = await gerencianet.pixDetailCharge({
          txid: pixItem.txid
        });

        if (detahe.status === "CONCLUIDA") {
          const { solicitacaoPagador } = detahe;
          const invoiceID = solicitacaoPagador.replace("#Fatura:", "");
          const invoices = await Invoices.findByPk(invoiceID);

          if (invoices && invoices.status !== "paid") {
            const companyId = invoices.companyId;
            const company = await Company.findByPk(companyId);

            if (company) {
              const expiresAt = new Date(company.dueDate);
              expiresAt.setDate(expiresAt.getDate() + 30);
              const date = expiresAt.toISOString().split("T")[0];

              await company.update({
                dueDate: date
              });

              await invoices.update({
                id: invoiceID,
                txid: pixItem.txid,
                status: "paid"
              });

              await company.reload();

              const io = getIO();
              const companyUpdate = await Company.findOne({
                where: { id: companyId }
              });

              try {
                const whatsapps = await ListWhatsAppsService({ companyId });
                if (whatsapps.length > 0) {
                  for (const whatsapp of whatsapps) {
                    await StartWhatsAppSession(whatsapp, companyId);
                  }
                }
              } catch (e) {
                Sentry.captureException(e);
              }

              io.emit(`company-${companyId}-payment`, {
                action: detahe.status,
                company: companyUpdate
              });
            }
          }
        }
      } catch (error: any) {
        logger.error(
          `[WEBHOOK] Erro ao processar PIX Efí: ${util.inspect(error, {
            depth: 10,
            colors: false
          })}`
        );
      }
    }
  }

  return res.json({ ok: true });
};

export const stripewebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  if (
    req.body.data?.object?.id &&
    req.body.type === "checkout.session.completed"
  ) {
    const stripe_id = req.body.data.object.id;
    const invoices = await Invoices.findOne({ where: { stripe_id } });

    if (!invoices) {
      logger.warn(`[WEBHOOK] Fatura Stripe não encontrada: ${stripe_id}`);
      return res.status(404).json({ error: "Invoice not found" });
    }

    if (invoices.status === "paid") {
      return res.json({ ok: true });
    }

    const invoiceID = invoices.id;
    const companyId = invoices.companyId;
    const company = await Company.findByPk(companyId);

    if (!company) {
      logger.warn(`[WEBHOOK] Empresa não encontrada: ${companyId}`);
      return res.status(404).json({ error: "Company not found" });
    }

    const expiresAt = new Date(company.dueDate);
    expiresAt.setDate(expiresAt.getDate() + 30);
    const date = expiresAt.toISOString().split("T")[0];

    await company.update({ dueDate: date });
    await invoices.update({ id: invoiceID, status: "paid" });
    await company.reload();

    const io = getIO();

    try {
      const whatsapps = await ListWhatsAppsService({ companyId });
      if (whatsapps.length > 0) {
        for (const whatsapp of whatsapps) {
          await StartWhatsAppSession(whatsapp, companyId);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
    }

    io.emit(`company-${companyId}-payment`, {
      action: "CONCLUIDA",
      company
    });
  }

  return res.json({ ok: true });
};

export const mercadopagowebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  logger.info(
    `[WEBHOOK] MercadoPago webhook recebido - action: ${req.body?.action}`
  );

  let key_MP_ACCESS_TOKEN = null;

  try {
    const buscacompanyId = 1;
    const getmptoken = await Setting.findOne({
      where: { companyId: buscacompanyId, key: "mpaccesstoken" }
    });
    key_MP_ACCESS_TOKEN = getmptoken?.value;
  } catch (error) {
    console.error("Error retrieving settings:", error);
  }

  const mercadopago = require("mercadopago");
  mercadopago.configure({
    access_token: key_MP_ACCESS_TOKEN
  });

  if (req.body.action === "payment.updated") {
    try {
      const payment = await mercadopago.payment.get(req.body.data.id);
      logger.info(
        `[WEBHOOK] Pagamento MP processado - fatura: ${payment.body.external_reference}`
      );

      if (!payment.body.transaction_details.transaction_id) {
        logger.info(
          `[WEBHOOK] Sem transação para fatura: ${payment.body.external_reference}`
        );
        return res.json({ ok: true });
      }

      const invoices = await Invoices.findOne({
        where: { id: payment.body.external_reference }
      });

      if (!invoices) {
        logger.warn(
          `[WEBHOOK] Fatura MP não encontrada: ${payment.body.external_reference}`
        );
        return res.json({ ok: true });
      }

      if (invoices.status === "paid") {
        logger.info(
          `[WEBHOOK] Fatura já paga: ${payment.body.external_reference}`
        );
        return res.json({ ok: true });
      }

      const companyId = invoices.companyId;
      const company = await Company.findByPk(companyId);

      if (!company) {
        logger.warn(`[WEBHOOK] Empresa não encontrada: ${companyId}`);
        return res.json({ ok: true });
      }

      const expiresAt = new Date(company.dueDate);
      expiresAt.setDate(expiresAt.getDate() + 30);
      const date = expiresAt.toISOString().split("T")[0];

      await company.update({ dueDate: date });
      await invoices.update({
        id: invoices.id,
        txid: payment.body.transaction_details.transaction_id,
        status: "paid"
      });
      await company.reload();

      const io = getIO();

      try {
        const whatsapps = await ListWhatsAppsService({ companyId });
        if (whatsapps.length > 0) {
          for (const whatsapp of whatsapps) {
            await StartWhatsAppSession(whatsapp, companyId);
          }
        }
      } catch (e) {
        Sentry.captureException(e);
      }

      io.emit(`company-${companyId}-payment`, {
        action: "CONCLUIDA",
        company
      });

      return res.status(200).json({ ok: true });
    } catch (error) {
      console.error("Erro ao tentar ler o pagamento:", error);
      return res.status(500).json({ error: "Erro ao identificar o pagamento" });
    }
  }

  return res.json({ ok: true });
};

export const asaaswebhook = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { event } = req.body;
  logger.info(`[WEBHOOK] Asaas webhook recebido - event: ${event}`);

  if (event === "PAYMENT_RECEIVED") {
    const paymentId = req.body.payment?.description?.replace("#Fatura:", "");

    if (!paymentId) {
      logger.warn("[WEBHOOK] Não foi possível extrair o ID da fatura");
      return res.json({ received: true });
    }

    logger.info(`[WEBHOOK] Asaas pagamento recebido - fatura: ${paymentId}`);

    const invoices = await Invoices.findOne({ where: { id: paymentId } });

    if (!invoices) {
      logger.warn(`[WEBHOOK] Fatura Asaas não encontrada: ${paymentId}`);
      return res.json({ received: true });
    }

    if (invoices.status === "paid") {
      return res.json({ received: true });
    }

    const companyId = invoices.companyId;
    const company = await Company.findByPk(companyId);

    if (!company) {
      logger.warn(`[WEBHOOK] Empresa não encontrada: ${companyId}`);
      return res.json({ received: true });
    }

    const expiresAt = new Date(company.dueDate);
    expiresAt.setDate(expiresAt.getDate() + 30);
    const date = expiresAt.toISOString().split("T")[0];

    await company.update({ dueDate: date });
    await invoices.update({ id: paymentId, status: "paid" });
    await company.reload();

    const io = getIO();

    try {
      const whatsapps = await ListWhatsAppsService({ companyId });
      if (whatsapps.length > 0) {
        for (const whatsapp of whatsapps) {
          await StartWhatsAppSession(whatsapp, companyId);
        }
      }
    } catch (e) {
      Sentry.captureException(e);
    }

    io.emit(`company-${companyId}-payment`, {
      action: "CONCLUIDA",
      company
    });

    return res.status(200).json({ ok: true });
  }

  return res.status(200).json({ ok: false });
};
