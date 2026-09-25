import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import { WhatsAppOficial } from 'src/@core/domain/entities/whatsappOficial.model';
import { AppError } from 'src/@core/infra/errors/app.error';
import { RedisService } from 'src/@core/infra/redis/RedisService.service';
import { RabbitMQService } from 'src/@core/infra/rabbitmq/RabbitMq.service';
import { IWebhookWhatsApp } from './interfaces/IWebhookWhatsApp.inteface';
import { SocketService } from 'src/@core/infra/socket/socket.service';
import {
  IMessageReceived,
  IReceivedWhatsppOficial,
} from 'src/@core/interfaces/IWebsocket.interface';
import { MetaService } from 'src/@core/infra/meta/meta.service';

@Injectable()
export class WebhookService {
  private logger: Logger = new Logger(`${WebhookService.name}`);
  private messagesPermitidas = [
    'text',
    'image',
    'audio',
    'document',
    'video',
    'location',
    'contacts',
    'order',
    'interactive',
    'referral',
    'sticker',
    'unsupported',
    'button',
  ];

  constructor(
    private readonly rabbit: RabbitMQService,
    private readonly whatsAppService: WhatsappOficialService,
    private readonly redis: RedisService,
    private readonly socket: SocketService,
    private readonly meta: MetaService,
  ) { }

  private normalizeString(value: any): string | null {
    const normalized = String(value ?? '').trim();
    return normalized ? normalized : null;
  }

  private normalizeUsername(value: any): string | null {
    const normalized = this.normalizeString(value);
    return normalized ? normalized.replace(/^@+/, '').toLowerCase() : null;
  }

  private resolveRemoteIdentifier(
    identifiers: {
      bsuid?: string | null;
      username?: string | null;
      phone?: string | null;
      waId?: string | null;
    },
  ): { type: string | null; value: string | null } {
    if (identifiers.bsuid) {
      return { type: 'bsuid', value: identifiers.bsuid };
    }

    if (identifiers.username) {
      return { type: 'username', value: identifiers.username };
    }

    if (identifiers.phone) {
      return { type: 'phone_e164', value: identifiers.phone };
    }

    if (identifiers.waId) {
      return { type: 'wa_id', value: identifiers.waId };
    }

    return { type: null, value: null };
  }

  private extractIncomingContactIdentifiers(
    value: any,
    message: any,
    fallbackContact?: any,
  ) {
    const contacts = Array.isArray(value?.contacts) ? value.contacts : [];
    const messageFrom = this.normalizeString(message?.from);

    const matchedContact =
      contacts.find((c: any) => {
        const waId = this.normalizeString(c?.wa_id);
        const userId = this.normalizeString(c?.user_id);
        return waId === messageFrom || userId === messageFrom;
      }) ||
      fallbackContact ||
      contacts[0] ||
      {};

    const profile = matchedContact?.profile || {};

    const waId =
      this.normalizeString(matchedContact?.wa_id) || messageFrom || null;

    const bsuid =
      this.normalizeString(matchedContact?.user_id) ||
      this.normalizeString(message?.user_id) ||
      this.normalizeString(profile?.user_id) ||
      null;

    const username =
      this.normalizeUsername(matchedContact?.username) ||
      this.normalizeUsername(profile?.username) ||
      this.normalizeUsername(message?.username) ||
      this.normalizeUsername(message?.profile?.username) ||
      null;

    const phone =
      this.normalizeString(matchedContact?.phone_number) ||
      this.normalizeString(matchedContact?.wa_id) ||
      messageFrom ||
      null;

    const name =
      this.normalizeString(profile?.name) ||
      this.normalizeString(matchedContact?.name) ||
      messageFrom ||
      'Contato';

    return {
      name,
      phone,
      waId,
      bsuid,
      username,
      rawContact: matchedContact,
    };
  }

  private extractReferral(message: any) {
    const referral = message?.referral;

    if (!referral) {
      return null;
    }

    return {
      sourceId: referral.source_id ?? null,
      sourceUrl: referral.source_url ?? null,
      sourceType: referral.source_type ?? null,
      headline: referral.headline ?? null,
      body: referral.body ?? null,
      imageUrl: referral.image_url ?? null,
      mediaType: referral.media_type ?? null,
      ctwaClid: referral.ctwa_clid ?? null,
    };
  }

  private extractPhoneNumberId(data: any): string | null {
    const body = data?.body || data;

    for (const entry of body?.entry || []) {
      for (const change of entry?.changes || []) {
        const phoneNumberId = this.normalizeString(
          change?.value?.metadata?.phone_number_id,
        );

        if (phoneNumberId) {
          return phoneNumberId;
        }
      }
    }

    return null;
  }

  private safeStringify(obj: any, maxDepth: number = 5): string {
    try {
      const safeCopy = this.createSafeCopy(obj, maxDepth);
      return JSON.stringify(safeCopy);
    } catch (error: any) {
      this.logger.error(`Erro ao serializar objeto: ${error.message}`);
      return JSON.stringify({
        error: 'Failed to stringify object',
        type: typeof obj,
      });
    }
  }

  private createSafeCopy(
    obj: any,
    maxDepth: number,
    currentDepth: number = 0,
    seen: WeakSet<any> = new WeakSet(),
  ): any {
    if (currentDepth >= maxDepth) {
      return '[Max Depth Reached]';
    }

    if (obj === null || obj === undefined) {
      return obj;
    }

    if (typeof obj !== 'object') {
      return obj;
    }

    if (seen.has(obj)) {
      return '[Circular Reference]';
    }

    seen.add(obj);

    try {
      if (Array.isArray(obj)) {
        const maxArrayLength = 100;
        const arraySlice = obj.slice(0, maxArrayLength);
        const result = arraySlice.map((item) =>
          this.createSafeCopy(item, maxDepth, currentDepth + 1, seen),
        );

        if (obj.length > maxArrayLength) {
          result.push(
            `[Array truncated: ${obj.length - maxArrayLength} more items]`,
          );
        }

        return result;
      }

      const result: any = {};
      const keys = Object.keys(obj);
      const maxKeys = 50;
      const keysToProcess = keys.slice(0, maxKeys);

      for (const key of keysToProcess) {
        try {
          const value = obj[key];

          if (typeof value === 'function') {
            continue;
          }

          if (typeof value === 'string' && value.length > 10000) {
            result[key] = `[String too large: ${value.length} chars]`;
            continue;
          }

          result[key] = this.createSafeCopy(
            value,
            maxDepth,
            currentDepth + 1,
            seen,
          );
        } catch (error) {
          result[key] = '[Error accessing property]';
        }
      }

      if (keys.length > maxKeys) {
        result['_truncated'] = `${keys.length - maxKeys} more properties`;
      }

      return result;
    } finally {
      seen.delete(obj);
    }
  }

  private createSafeLogObject(body: any): any {
    try {
      return {
        object: body?.object,
        entry: body?.entry?.map((e: any) => ({
          id: e?.id,
          changes: e?.changes?.map((c: any) => ({
            field: c?.field,
            value: {
              messaging_product: c?.value?.messaging_product,
              metadata: c?.value?.metadata,
              messages_count: c?.value?.messages?.length || 0,
              message_echoes_count:
                c?.value?.message_echoes?.length || 0,
              statuses_count: c?.value?.statuses?.length || 0,
              calls_count: c?.value?.calls?.length || 0,
            },
          })),
        })),
      };
    } catch (error) {
      return { error: 'Could not create safe log object' };
    }
  }

  private isUnsupportedInteractive(message: any): boolean {
    return (
      message?.type === 'unsupported' &&
      message?.unsupported?.type === 'interactive'
    );
  }

  private buildUnsupportedInteractiveText(message: any): string {
    const details =
      message?.errors
        ?.map((err: any) => {
          const detail = err?.error_data?.details || err?.message || err?.title;
          return detail ? String(detail) : null;
        })
        ?.filter(Boolean)
        ?.join(' | ') || '';

    return [
      '💳 PIX / mensagem interativa recebida.',
      '',
      'O WhatsApp Cloud API informou esse conteúdo como interativo não suportado no webhook.',
      'Por isso a chave PIX não veio detalhada pela API oficial.',
      details ? `Detalhe da Meta: ${details}` : null,
    ]
      .filter(Boolean)
      .join('\n');
  }

  private buildGoogleMapsUrl(latitude: number, longitude: number): string {
    return `https://maps.google.com/maps?q=${encodeURIComponent(
      `${latitude},${longitude}`,
    )}&z=17&hl=pt-BR`;
  }

  private buildLocationPreviewUrl(latitude: number, longitude: number): string {
    const lat = encodeURIComponent(String(latitude));
    const lng = encodeURIComponent(String(longitude));

    return `https://staticmap.openstreetmap.de/staticmap.php?center=${lat},${lng}&zoom=17&size=600x300&markers=${lat},${lng},red-pushpin`;
  }

  private buildLocationSocketText(location: any): string {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return JSON.stringify(location || {});
    }

    const previewUrl = this.buildLocationPreviewUrl(latitude, longitude);
    const googleMapsUrl = this.buildGoogleMapsUrl(latitude, longitude);
    const coordsText = `${latitude}, ${longitude}`;

    return `${previewUrl} | ${googleMapsUrl}|${coordsText}`;
  }

  private buildLocationPayload(
    location: any,
  ): IMessageReceived['location'] | undefined {
    const latitude = Number(location?.latitude);
    const longitude = Number(location?.longitude);

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return undefined;
    }

    return {
      latitude,
      longitude,
      name: location?.name || null,
      address: location?.address || null,
      url: this.buildGoogleMapsUrl(latitude, longitude),
    };
  }

  async forwardToWebhook(whats: WhatsAppOficial, body: any) {
    try {
      const {
        n8n_webhook_url,
        auth_token_n8n,
        chatwoot_webhook_url,
        auth_token_chatwoot,
        typebot_webhook_url,
        auth_token_typebot,
        crm_webhook_url,
        auth_token_crm,
      } = whats;

      try {
        if (!!n8n_webhook_url) {
          this.sendToWebhook(n8n_webhook_url, auth_token_n8n, body);
        }

        if (!!chatwoot_webhook_url) {
          this.sendToWebhook(chatwoot_webhook_url, auth_token_chatwoot, body);
        }

        if (!!typebot_webhook_url) {
          this.sendToWebhook(typebot_webhook_url, auth_token_typebot, body);
        }

        if (!!crm_webhook_url) {
          this.sendToWebhook(crm_webhook_url, auth_token_crm, body);
        }
      } catch (error: any) {
        this.logger.error(
          `forwardToWebhook - Erro ao enviar webhook - ${error.message}`,
        );
        throw new AppError(error.message, HttpStatus.BAD_REQUEST);
      }
    } catch (error: any) {
      this.logger.error(
        `forwardToWebhook - Erro nos webhook - ${error.message}`,
      );
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async sendToWebhook(webhook_url: string, token: string, body: any) {
    try {
      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      const response = await fetch(webhook_url, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const responseData = await response.json();
      this.logger.log('Resposta do encaminhamento do webhook', {
        webhook_url,
        status: response.status,
        hasData: !!responseData,
      });
    } catch (error: any) {
      this.logger.error('Erro ao encaminhar para o webhook', {
        erro: error.message,
        webhook_url,
      });
      return null;
    }
  }


  private async handleOfficialCallWebhook(
    companyId: number,
    conexaoId: number,
    whats: WhatsAppOficial,
    change: any,
    originalBody: any,
  ) {
    const value = change?.value || {};
    const metadata = value?.metadata || {};
    const calls = Array.isArray(value?.calls) ? value.calls : [];

    const normalizedCalls = calls.map((call: any) => ({
      id: call?.id || call?.call_id || null,
      call_id: call?.call_id || call?.id || null,
      event: call?.event || call?.status || null,
      status: call?.status || call?.event || null,
      direction: call?.direction || 'inbound',
      from: call?.from || null,
      to: call?.to || metadata?.display_phone_number || null,
      timestamp: call?.timestamp || null,
      hasSession: !!call?.session,
      hasSdp: !!call?.session?.sdp || !!call?.connection?.sdp,
      sessionSdpType: call?.session?.sdp_type || call?.connection?.type || null,
    }));

    this.logger.warn(
      `[OFFICIAL CALL WEBHOOK] companyId=${companyId} conexaoId=${conexaoId} phone_number_id=${
        metadata?.phone_number_id || whats?.phone_number_id || 'N/A'
      } calls=${this.safeStringify(normalizedCalls)}`,
    );

    this.logger.warn(
      `[OFFICIAL CALL WEBHOOK RAW] ${this.safeStringify(
        {
          companyId,
          conexaoId,
          whatsappOficialId: whats?.id,
          phone_number_id: metadata?.phone_number_id || whats?.phone_number_id || null,
          display_phone_number: metadata?.display_phone_number || null,
          field: change?.field || 'calls',
          calls,
        },
        8,
      )}`,
    );

    this.socket.sendOfficialCall({
      token: whats?.token_mult100 || '',
      companyId,
      conexaoId,
      connectionId: conexaoId,
      whatsapp_id: conexaoId,
      whatsappId: conexaoId,
      whatsappOficialId: whats?.id || null,
      phone_number_id: metadata?.phone_number_id || whats?.phone_number_id || null,
      display_phone_number: metadata?.display_phone_number || null,
      field: change?.field || 'calls',
      calls: calls.map((call: any) => ({
        id: call?.id || call?.call_id || null,
        call_id: call?.call_id || call?.id || null,
        whatsapp_id: conexaoId,
        whatsappId: conexaoId,
        connectionId: conexaoId,
        conexaoId,
        event: call?.event || call?.status || null,
        status: call?.status || call?.event || null,
        direction: call?.direction || 'inbound',
        from: call?.from || null,
        to: call?.to || metadata?.display_phone_number || null,
        timestamp: call?.timestamp || null,
        session: call?.session || null,
        connection: call?.connection || null,
        raw: call,
      })),
      raw: {
        metadata,
        field: change?.field || 'calls',
      },
    } as any);

    await this.forwardToWebhook(whats, originalBody);

    return true;
  }

  async webhookCompanyConexao(companyId: number, conexaoId: number, data: any) {
    try {
      const company = await this.whatsAppService.prisma.company.findUnique({
        where: { id: companyId },
      });

      if (!company) throw new Error('Empresa não encontrada');

      const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst({
        where: { id: conexaoId, companyId, deleted_at: null },
        include: { company: true },
      });

      if (!whats) throw new Error('Configuração não encontrada');

      const body: IWebhookWhatsApp = data?.body || data;

      this.logger.warn(
        `[WEBHOOK RAW] companyId=${companyId} conexaoId=${conexaoId} payload=${this.safeStringify(
          this.createSafeLogObject(body),
        )}`,
      );

      this.logger.warn(`[WEBHOOK RAW FULL] ${this.safeStringify(body, 8)}`);

      if (body.object === 'whatsapp_business_account') {
        const { entry } = body;

        for (const e of entry || []) {
          for (const change of e.changes || []) {
            const changeAny = change as any;
            const { value } = changeAny;
            const calls = Array.isArray(value?.calls) ? value.calls : [];

            if (changeAny.field === 'calls' || calls.length > 0) {
              await this.handleOfficialCallWebhook(
                companyId,
                conexaoId,
                whats,
                changeAny,
                body,
              );
              continue;
            }

            const isCoexistenceEcho =
              changeAny.field === 'smb_message_echoes';

            if (
              changeAny.field !== 'messages' &&
              !isCoexistenceEcho
            ) {
              this.logger.log(
                `[WEBHOOK FIELD IGNORADO] companyId=${companyId} conexaoId=${conexaoId} field=${changeAny.field || 'N/A'}`,
              );
              continue;
            }

            const normalizedMessages = isCoexistenceEcho
              ? (Array.isArray(value?.message_echoes)
                ? value.message_echoes.map((echo: any) => ({
                    ...echo,
                    from:
                      echo?.to ||
                      value?.contacts?.[0]?.wa_id ||
                      echo?.to_user_id ||
                      echo?.from ||
                      '',
                  }))
                : [])
              : (Array.isArray(value?.messages) ? value.messages : []);

            if (isCoexistenceEcho) {
              this.logger.warn(
                `[COEXISTENCE ECHO] companyId=${companyId} conexaoId=${conexaoId} mensagens=${normalizedMessages.length}`,
              );

              if (normalizedMessages.length === 0) {
                this.logger.warn(
                  `[COEXISTENCE ECHO] Evento ignorado sem message_echoes. companyId=${companyId} conexaoId=${conexaoId}`,
                );
                continue;
              }
            }

            if (value?.statuses != null) {
              this.logger.log('Webhook recebido (status):', {
                companyId,
                statuses: value.statuses.map((s) => ({
                  id: s.id,
                  status: s.status,
                })),
              });

              for (const status of value.statuses || []) {
                const statusAny = status as any;
                const normalizedStatus = String(statusAny?.status || '')
                  .trim()
                  .toLowerCase();

                this.logger.warn(
                  `[WEBHOOK STATUS] companyId=${companyId} conexaoId=${conexaoId} messageId=${statusAny?.id || 'N/A'
                  } status=${normalizedStatus || 'N/A'}`,
                );

                if (statusAny?.errors) {
                  this.logger.error(
                    `[WEBHOOK STATUS ERROR DETAIL] messageId=${statusAny?.id || 'N/A'} errors=${JSON.stringify(
                      statusAny.errors,
                    )}`,
                  );
                }

                const detailedError =
                  statusAny?.error_data?.details ||
                  statusAny?.errors?.[0]?.error_data?.details ||
                  statusAny?.errors?.[0]?.message ||
                  statusAny?.errors?.[0]?.title ||
                  null;

                if (detailedError) {
                  this.logger.error(
                    `[WEBHOOK STATUS ERROR MESSAGE] messageId=${statusAny?.id || 'N/A'} detail=${detailedError}`,
                  );
                }

                if (!statusAny?.id) {
                  this.logger.warn(
                    `[WEBHOOK STATUS] Ignorado por falta de id. status=${this.safeStringify(
                      statusAny,
                    )}`,
                  );
                  continue;
                }

                if (normalizedStatus !== 'read') {
                  this.logger.log(
                    `[WEBHOOK STATUS] Não será enviado evento de leitura para status "${normalizedStatus}" do messageId=${statusAny.id}`,
                  );
                  continue;
                }

                this.socket.readMessage({
                  companyId: company.idEmpresaMult100,
                  messageId: statusAny.id,
                  token: whats.token_mult100,
                  status: normalizedStatus,
                } as any);
              }

              continue;
            }

            const webhookContact = value?.contacts?.[0] || {
              profile: {
                name: normalizedMessages?.[0]?.from || 'Contato',
              },
              wa_id: normalizedMessages?.[0]?.from || '',
            };

            for (const message of normalizedMessages) {
              const interactiveUnsupported = this.isUnsupportedInteractive(message);
              const interactiveType =
                message?.interactive?.type || message?.unsupported?.type || 'N/A';

              const referralData = this.extractReferral(message);

              const contactIdentifiers = this.extractIncomingContactIdentifiers(
                value,
                message,
                webhookContact,
              );

              const remoteIdentifier = this.resolveRemoteIdentifier({
                bsuid: contactIdentifiers.bsuid,
                username: contactIdentifiers.username,
                phone: contactIdentifiers.phone,
                waId: contactIdentifiers.waId,
              });

              this.logger.warn(
                `[CONTACT IDENTIFIERS] messageId=${message.id} from=${message.from} wa_id=${contactIdentifiers.waId || 'null'
                } user_id=${contactIdentifiers.bsuid || 'null'} username=${contactIdentifiers.username || 'null'
                } phone=${contactIdentifiers.phone || 'null'}`,
              );

              if (referralData) {
                this.logger.warn(
                  `[CTWA REFERRAL] messageId=${message.id} from=${message.from} referral=${JSON.stringify(referralData)}`,
                );
              }

              this.logger.warn(
                `[WEBHOOK MESSAGE DETAIL] type=${message.type} interactiveType=${interactiveType} messageId=${message.id}`,
              );

              if (
                !this.messagesPermitidas.some((m) => m === message.type) &&
                !interactiveUnsupported
              ) {
                this.logger.warn(
                  `[WEBHOOK IGNORADO] type=${message.type} payload=${this.safeStringify(
                    message,
                  )}`,
                );
                continue;
              }

              this.logger.log('Webhook recebido (mensagem):', {
                companyId,
                messageType: message.type,
                messageId: message.id,
                from: message.from,
              });

              if (!!whats.use_rabbitmq) {
                const exchange = companyId;
                const queue = `${whats.phone_number}`.replace('+', '');
                const routingKey = whats.rabbitmq_routing_key;

                await this.rabbit.sendToRabbitMQ(whats, body);
                this.logger.log(
                  `Enviado para o RabbitMQ com sucesso. Vinculando fila '${queue}' à exchange '${exchange}' ${!!routingKey ? `com routing key '${routingKey}` : ''
                  } '...`,
                );
              }

              const messages = await this.redis.get(
                `messages:${companyId}:${conexaoId}`,
              );

              if (!!messages) {
                try {
                  const messagesStored: Array<any> = JSON.parse(
                    messages,
                  ) as Array<any>;

                  messagesStored.push(body);

                  await this.redis.set(
                    `messages:${companyId}:${conexaoId}`,
                    this.safeStringify(messagesStored),
                  );
                } catch (error: any) {
                  this.logger.error(
                    `Erro ao processar mensagens do Redis: ${error.message}`,
                  );
                  await this.redis.set(
                    `messages:${companyId}:${conexaoId}`,
                    this.safeStringify([body]),
                  );
                }
              } else {
                await this.redis.set(
                  `messages:${companyId}:${conexaoId}`,
                  this.safeStringify([body]),
                );
              }

              this.logger.log('Enviando mensagem para o servidor do websocket');

              let file: any = null;
              let fileMetadata: any = null;
              let idFile: string | undefined = undefined;
              let bodyMessage: any = null;
              let quoteMessageId: string | undefined = message?.context?.id;
              let typeToSend: IMessageReceived['type'] = 'text';
              let locationPayload: IMessageReceived['location'] | undefined =
                undefined;

              let isAnimatedSticker = false;
              let fileName: string | null = null;
              let filePath: string | null = null;
              let fileExtension: string | null = null;
              let mediaType: string | null = null;

              switch (message.type) {
                case 'button':
                  typeToSend = 'text';
                  mediaType = 'button';
                  file = null;
                  bodyMessage =
                    (message as any).button?.text ||
                    (message as any).button?.payload ||
                    '[Botão]';
                  quoteMessageId = message?.context?.id || quoteMessageId;
                  break;

                case 'video':
                  typeToSend = 'video';
                  mediaType = 'video';
                  bodyMessage = message.video?.caption || '';
                  idFile = message.video?.id;
                  this.logger.warn(
                    `[VIDEO] Obtendo URL do vídeo ${idFile} - Backend irá baixar diretamente da Meta`,
                  );
                  fileMetadata = await this.meta.getFileMetadata(
                    idFile,
                    change.value.metadata.phone_number_id,
                    whats.send_token,
                  );
                  this.logger.log(
                    `[VIDEO] URL obtida - Tamanho: ${(
                      fileMetadata.fileSize /
                      1024 /
                      1024
                    ).toFixed(2)} MB`,
                  );
                  break;

                case 'document':
                  typeToSend = 'document';
                  mediaType = 'document';
                  bodyMessage =
                    message.document?.caption ||
                    message.document?.filename ||
                    '';
                  idFile = message.document?.id;
                  this.logger.warn(
                    `[DOCUMENT] Obtendo URL do documento ${idFile} - Backend irá baixar diretamente da Meta`,
                  );
                  fileMetadata = await this.meta.getFileMetadata(
                    idFile,
                    change.value.metadata.phone_number_id,
                    whats.send_token,
                  );
                  this.logger.log(
                    `[DOCUMENT] URL obtida - Tamanho: ${(
                      fileMetadata.fileSize /
                      1024 /
                      1024
                    ).toFixed(2)} MB`,
                  );
                  break;

                case 'image':
                  typeToSend = 'image';
                  mediaType = 'image';
                  bodyMessage = message.image?.caption || '';
                  idFile = message.image?.id;
                  this.logger.log(
                    `[IMAGE] Baixando imagem ${idFile} - base64 será enviado pelo socket`,
                  );
                  file = await this.meta.downloadFileMeta(
                    idFile,
                    change.value.metadata.phone_number_id,
                    whats.send_token,
                    company.id,
                    whats.id,
                  );

                  if (file) {
                    fileName = file.fileName || null;
                    filePath = file.filePath || null;
                    fileExtension = file.extension || null;
                  }
                  break;

                case 'audio':
                  typeToSend = 'audio';
                  mediaType = 'audio';
                  idFile = message.audio?.id;
                  this.logger.log(
                    `[AUDIO] Baixando áudio ${idFile} - base64 será enviado pelo socket`,
                  );
                  file = await this.meta.downloadFileMeta(
                    idFile,
                    change.value.metadata.phone_number_id,
                    whats.send_token,
                    company.id,
                    whats.id,
                  );

                  if (file) {
                    fileName = file.fileName || null;
                    filePath = file.filePath || null;
                    fileExtension = file.extension || null;
                  }
                  break;

                case 'interactive':
                  typeToSend = 'interactive';
                  mediaType = 'interactive';
                  file = null;

                  if (message.interactive?.button_reply) {
                    bodyMessage =
                      message.interactive.button_reply.id ||
                      message.interactive.button_reply.title ||
                      '';
                    break;
                  }

                  if (message.interactive?.list_reply) {
                    bodyMessage =
                      message.interactive.list_reply.id ||
                      message.interactive.list_reply.title ||
                      '';
                    break;
                  }

                  if (message.interactive?.nfm_reply) {
                    bodyMessage =
                      message.interactive.nfm_reply.body ||
                      message.interactive.nfm_reply.response_json ||
                      JSON.stringify(message.interactive.nfm_reply);
                    break;
                  }

                  bodyMessage = JSON.stringify(message.interactive || {});
                  break;

                case 'location':
                  typeToSend = 'location';
                  mediaType = 'location';
                  bodyMessage = this.buildLocationSocketText(message.location);
                  locationPayload = this.buildLocationPayload(message.location);
                  break;

                case 'contacts':
                  typeToSend = 'contacts';
                  mediaType = 'contacts';
                  bodyMessage = JSON.stringify({
                    contacts: message.contacts,
                  });
                  break;

                case 'sticker':
                  typeToSend = 'sticker';
                  mediaType = 'sticker';
                  idFile = message.sticker?.id;
                  isAnimatedSticker = Boolean(message.sticker?.animated);
                  bodyMessage = '[figurinha]';

                  this.logger.log(
                    `[STICKER] Baixando sticker ${idFile} - base64 será enviado pelo socket`,
                  );

                  if (idFile) {
                    file = await this.meta.downloadFileMeta(
                      idFile,
                      change.value.metadata.phone_number_id,
                      whats.send_token,
                      company.id,
                      whats.id,
                    );

                    if (file) {
                      fileName = file.fileName || `${idFile}.webp`;
                      filePath = file.filePath || null;
                      fileExtension = file.extension || 'webp';
                    }
                  }
                  break;

                case 'order':
                  typeToSend = 'order';
                  mediaType = 'order';
                  bodyMessage = JSON.stringify(message.order);
                  break;

                case 'referral':
                  typeToSend = 'referral';
                  mediaType = 'referral';
                  bodyMessage = JSON.stringify(message.referral || {});
                  break;

                case 'unsupported':
                  if (interactiveUnsupported) {
                    typeToSend = 'text';
                    mediaType = 'text';
                    bodyMessage = this.buildUnsupportedInteractiveText(message);

                    this.logger.warn(
                      `[WEBHOOK UNSUPPORTED INTERACTIVE] messageId=${message.id} from=${message.from} textoFallback="${bodyMessage}"`,
                    );
                  } else {
                    this.logger.warn(
                      `[WEBHOOK IGNORADO] unsupported não tratado: ${this.safeStringify(
                        message,
                      )}`,
                    );
                    continue;
                  }
                  break;

                case 'text':
                default:
                  typeToSend = 'text';
                  mediaType = 'text';
                  file = null;
                  bodyMessage = message.text?.body || '';
                  break;
              }

              const msg = {
                timestamp: +message.timestamp,
                type: typeToSend,
                text: bodyMessage,
                file: !!file ? file.base64 : null,
                mimeType: !!file
                  ? file.mimeType
                  : !!fileMetadata
                    ? fileMetadata.mimeType
                    : null,
                idFile,
                idMessage: message.id,
                quoteMessageId,
                fileUrl: !!fileMetadata ? fileMetadata.url : null,
                fileSize: !!fileMetadata ? fileMetadata.fileSize : null,
                location: locationPayload,
                fileName,
                filePath,
                fileExtension,
                isAnimatedSticker,
                mediaType,
                referral: referralData,
                button:
                  message.type === 'button'
                    ? {
                      text: (message as any).button?.text || null,
                      payload: (message as any).button?.payload || null,
                      context: message.context || null,
                    }
                    : null,
                rawMetaPayload: {
                  contact: contactIdentifiers.rawContact || null,
                  message,
                },
                remoteIdentifierType: remoteIdentifier.type,
                remoteIdentifierValue: remoteIdentifier.value,
                remoteUsername: contactIdentifiers.username,
                remoteWaId: contactIdentifiers.waId,
                remotePhone: contactIdentifiers.phone,
                remoteUserId: contactIdentifiers.bsuid,
                remoteBsuid: contactIdentifiers.bsuid,
              } as any as IMessageReceived;

              if (!!fileMetadata) {
                this.logger.log(
                  `[SOCKET] Preparando envio - Tipo: ${typeToSend}, Método: URL DA META (${(
                    fileMetadata.fileSize /
                    1024 /
                    1024
                  ).toFixed(2)} MB), IdFile: ${idFile}`,
                );
              } else if (!!file) {
                this.logger.log(
                  `[SOCKET] Preparando envio - Tipo: ${typeToSend}, Método: BASE64, IdFile: ${idFile || 'N/A'
                  }`,
                );
              } else {
                this.logger.log(
                  `[SOCKET] Preparando envio - Tipo: ${typeToSend} (sem mídia)`,
                );
              }

              const dataToSocket = {
                companyId: company.idEmpresaMult100,
                nameContact: contactIdentifiers.name || message.from,
                message: msg,
                token: whats.token_mult100,
                fromMe: isCoexistenceEcho,
                source: isCoexistenceEcho
                  ? 'coexistence_mobile'
                  : 'meta_webhook',
                fromNumber: contactIdentifiers.phone || message.from,
                fromWaId: contactIdentifiers.waId || null,
                fromUserId: contactIdentifiers.bsuid || null,
                fromBsuid: contactIdentifiers.bsuid || null,
                fromUsername: contactIdentifiers.username || null,
                remoteIdentifierType: remoteIdentifier.type,
                remoteIdentifierValue: remoteIdentifier.value,
              } as any as IReceivedWhatsppOficial;

              this.socket.sendMessage(dataToSocket);

              await this.forwardToWebhook(whats, body);
              this.logger.log('Enviado para o Webhook com sucesso.');
            }
          }
        }

        return true;
      } else {
        this.logger.error(`Evento não tratado: ${JSON.stringify(body)}`);
      }

      return true;
    } catch (error: any) {
      this.logger.error(
        `Erro no POST /webhook/:companyId/:conexaoId - ${error.message}`,
      );
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }

  async webhookMeta(data: any) {
    const phoneNumberId = this.extractPhoneNumberId(data);

    if (!phoneNumberId) {
      throw new AppError(
        'phone_number_id não encontrado no webhook da Meta.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst({
      where: {
        phone_number_id: phoneNumberId,
        deleted_at: null,
      },
    });

    if (!whats) {
      throw new AppError(
        `Configuração não encontrada para phone_number_id=${phoneNumberId}.`,
        HttpStatus.NOT_FOUND,
      );
    }

    return this.webhookCompanyConexao(whats.companyId, whats.id, data);
  }

  async webhookMetaVerification(
    mode: string,
    verifyToken: string,
    challenge: string,
  ) {
    if (mode !== 'subscribe' || !verifyToken) {
      throw new AppError(
        'Parâmetros de verificação do webhook inválidos.',
        HttpStatus.BAD_REQUEST,
      );
    }

    const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst({
      where: {
        token_mult100: verifyToken,
        deleted_at: null,
      },
    });

    if (!whats) {
      throw new AppError(
        'Token de verificação do webhook inválido.',
        HttpStatus.BAD_REQUEST,
      );
    }

    this.logger.log(
      `[WEBHOOK META VERIFICADO] companyId=${whats.companyId} conexaoId=${whats.id}`,
    );

    return challenge;
  }

  async webhookCompany(
    companyId: number,
    conexaoId: number,
    mode: string,
    verify_token: string,
    challenge: string,
  ) {
    try {
      const whats = await this.whatsAppService.prisma.whatsappOficial.findFirst({
        where: { id: conexaoId, companyId, deleted_at: null },
      });

      if (!whats) throw new Error('Configuração não encontrada');

      if (mode === 'subscribe' && verify_token === whats.token_mult100) {
        this.logger.log('WEBHOOK VERIFICADO para a empresa:', companyId);
        return challenge;
      } else {
        this.logger.error(
          'Falha na verificação do webhook para a empresa:',
          companyId,
        );
        throw new Error(
          `Falha na verificação do webhook para a empresa: ${companyId}`,
        );
      }
    } catch (error: any) {
      this.logger.error(`webhookCompany - ${error.message}`);
      throw new AppError(error.message, HttpStatus.BAD_REQUEST);
    }
  }
}
