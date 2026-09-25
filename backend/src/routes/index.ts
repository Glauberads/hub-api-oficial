import { Router } from "express";

import asaasRoutes from "./asaasRoutes";
import manifestRoutes from "./manifestRoutes";
import userRoutes from "./userRoutes";
import authRoutes from "./authRoutes";
import settingRoutes from "./settingRoutes";
import contactRoutes from "./contactRoutes";
import ticketRoutes from "./ticketRoutes";
import whatsappRoutes from "./whatsappRoutes";
import messageRoutes from "./messageRoutes";
import whatsappSessionRoutes from "./whatsappSessionRoutes";
import queueRoutes from "./queueRoutes";
import companyRoutes from "./companyRoutes";
import planRoutes from "./planRoutes";
import ticketNoteRoutes from "./ticketNoteRoutes";
import quickMessageRoutes from "./quickMessageRoutes";
import helpRoutes from "./helpRoutes";
import dashboardRoutes from "./dashboardRoutes";
import scheduleRoutes from "./scheduleRoutes";
import tarefaRoutes from "./tarefaRoutes";
import tagRoutes from "./tagRoutes";
import contactListRoutes from "./contactListRoutes";
import contactListItemRoutes from "./contactListItemRoutes";
import campaignRoutes from "./campaignRoutes";
import campaignSettingRoutes from "./campaignSettingRoutes";
import announcementRoutes from "./announcementRoutes";
import chatRoutes from "./chatRoutes";
import queueIntegrationRoutes from "./queueIntegrationRoutes";
import chatBotRoutes from "./chatBotRoutes";
import webHookRoutes from "./webHookRoutes";
import subScriptionRoutes from "./subScriptionRoutes";
import invoiceRoutes from "./invoicesRoutes";
import apiRoutes from "./apiRoutes";
import versionRouter from "./versionRoutes";
import filesRoutes from "./filesRoutes";
import queueOptionRoutes from "./queueOptionRoutes";
import ticketTagRoutes from "./ticketTagRoutes";
import apiCompanyRoutes from "./api/apiCompanyRoutes";
import apiContactRoutes from "./api/apiContactRoutes";
import apiMessageRoutes from "./api/apiMessageRoutes";
import companySettingsRoutes from "./companySettingsRoutes";
import ticketFinalizationReasonRoutes from "./ticketFinalizationReasonRoutes";
import presetWebhookRoutes from "./presetWebhookRoutes";
import birthdayRoutes from "./birthdayRoutes";
import promptRoutes from "./promptRouter";
import statisticsRoutes from "./statisticsRoutes";
import scheduleMessageRoutes from "./ScheduledMessagesRoutes";
import flowDefaultRoutes from "./flowDefaultRoutes";
import flowBuilderRoutes from "./flowBuilderRoutes";
import flowCampaignRoutes from "./flowCampaignRoutes";
import callRoutes from "./callRoutes";
import companyKanbanRoutes from "./companyKanbanRoutes";
import floupApp from "../plugins/floup";
import backupRoutes from "./backupRoutes";
import pushNotificationRoutes from "./pushNotificationRoutes";
import n8nCallbackRoutes from "./n8nCallbackRoutes";
import interactiveTemplateRoutes from "./interactiveTemplateRoutes";
import interactiveRoutes from "./interactiveRoutes";
import passwordResetRoutes from "./passwordResetRoutes";
import embeddedSignupRoutes from "./embeddedSignupRoutes";
import warmupRoutes from "./warmupRoutes";
import landingWebhookConfigRoutes from "./landingWebhookConfigRoutes";
import landingWebhookPublicRoutes from "./landingWebhookPublicRoutes";
import telegramRoutes from "./telegramRoutes";
import landingWebhookLogRoutes from "./landingWebhookLogRoutes";
import emailSettingRoutes from "./emailSettingRoutes";
import aiSuggestionRoutes from "./aiSuggestionRoutes";
import serverReportRoutes from "./serverReportRoutes";
import aiSdrRoutes from "./aiSdrRoutes";
import renewalRoutes from "./renewalRoutes";

import ChatController from "../controllers/ChatController";
import { handleSendGridEvents } from "../controllers/SendGridWebhookController";
import officialCallRecordingRoutes from "./officialCallRecordingRoutes";
import callHistoryRoutes from "./callHistoryRoutes";
import telegramPersonalRoutes from "./telegramPersonalRoutes";

const routes = Router();

/**
 * Rota pública do Manifest PWA.
 * Precisa ficar antes das demais rotas para evitar autenticação/interceptação.
 * URL final:
 * GET /manifest.json?tenantId=1
 */
routes.use(manifestRoutes);

/**
 * Rota pública para receber leads de Landing Pages / WordPress / Elementor.
 * Precisa ficar sem autenticação.
 * URL final:
 * POST /webhook/landing/:token
 */
routes.use(landingWebhookPublicRoutes);
routes.use(telegramRoutes);

routes.use(passwordResetRoutes);
routes.use(userRoutes);
routes.use("/auth", authRoutes);
routes.use("/api/messages", apiRoutes);
routes.use(settingRoutes);
routes.use(contactRoutes);
routes.use(ticketRoutes);
routes.use(whatsappRoutes);
routes.use(messageRoutes);
routes.use(aiSuggestionRoutes);
routes.use(serverReportRoutes);
routes.use(aiSdrRoutes);
routes.use(renewalRoutes);
routes.use(whatsappSessionRoutes);
routes.use(queueRoutes);
routes.use(companyRoutes);
routes.use(planRoutes);
routes.use(ticketNoteRoutes);
routes.use(quickMessageRoutes);
routes.use(helpRoutes);
routes.use(dashboardRoutes);
routes.use(birthdayRoutes);
routes.use(scheduleRoutes);
routes.use(tarefaRoutes);
routes.use(tagRoutes);
routes.use(contactListRoutes);
routes.use(contactListItemRoutes);
routes.use(campaignRoutes);
routes.use(campaignSettingRoutes);
routes.use(announcementRoutes);
routes.use(chatRoutes);
routes.use(chatBotRoutes);
routes.use("/webhook", webHookRoutes);
routes.use(subScriptionRoutes);
routes.use(invoiceRoutes);
routes.use(versionRouter);
routes.use(filesRoutes);
routes.use(queueOptionRoutes);
routes.use(queueIntegrationRoutes);
routes.use(ticketTagRoutes);
routes.use("/api", apiCompanyRoutes);
routes.use("/api", apiContactRoutes);
routes.use("/api", apiMessageRoutes);
routes.use(presetWebhookRoutes);
routes.use(promptRoutes);
routes.use(statisticsRoutes);
routes.use(companySettingsRoutes);
routes.use(ticketFinalizationReasonRoutes);
routes.use(scheduleMessageRoutes);
routes.use(embeddedSignupRoutes);
routes.use(warmupRoutes);
routes.use(flowDefaultRoutes);
routes.use(flowBuilderRoutes);
routes.use(flowCampaignRoutes);
routes.use("/call", callRoutes);
routes.use(companyKanbanRoutes);
routes.use(emailSettingRoutes);
routes.use(landingWebhookConfigRoutes);
routes.use(landingWebhookLogRoutes);
routes.use(asaasRoutes);

// Plugins
routes.use(floupApp);

routes.use(backupRoutes);
routes.use(pushNotificationRoutes);
routes.use(n8nCallbackRoutes);
routes.use(interactiveTemplateRoutes);
routes.use(interactiveRoutes);

routes.post("/chats/backfill", ChatController.backfillChats);
routes.post("/webhooks/sendgrid/events", handleSendGridEvents);

routes.use(officialCallRecordingRoutes);

routes.use(callHistoryRoutes);

routes.use(telegramPersonalRoutes);

export default routes;