import { HttpStatus, Injectable, Logger } from '@nestjs/common';
import { PrismaService } from 'src/@core/infra/database/prisma.service';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import { SocketService } from 'src/@core/infra/socket/socket.service';
import { AppError } from 'src/@core/infra/errors/app.error';

@Injectable()
export class OfficialCallsService {
  private logger: Logger = new Logger(`${OfficialCallsService.name}`);

  constructor(
    private readonly prisma: PrismaService,
    private readonly metaService: MetaService,
    private readonly socketService: SocketService,
  ) {}

  private mask(value: any) {
    const text = String(value || '');
    if (!text) return '';

    if (text.length <= 12) {
      return `${text.slice(0, 3)}...`;
    }

    return `${text.slice(0, 8)}...${text.slice(-6)}`;
  }

  private looksLikeMetaToken(value: any): boolean {
    const token = String(value || '').trim();

    if (!token) return false;

    // Tokens da Meta normalmente começam com EA..., como EAA, EAF etc.
    if (/^EA[A-Z0-9]/i.test(token) && token.length > 30) return true;

    // Fallback para tokens longos, evitando tokens curtos internos do sistema.
    if (token.length > 80) return true;

    return false;
  }

  private resolveMetaToken(whats: any, body: any): string {
    const candidates = [
      body?.meta_token,
      body?.metaToken,
      body?.access_token,
      body?.accessToken,

      whats?.send_token,
      whats?.sendToken,
      whats?.access_token,
      whats?.accessToken,
      whats?.token_meta,
      whats?.tokenMeta,
      whats?.meta_token,
      whats?.metaToken,
      whats?.token_whatsapp,
      whats?.tokenWhatsapp,
      whats?.token_api,
      whats?.tokenApi,
      whats?.bearer_token,
      whats?.bearerToken,
      whats?.token,

      process.env.META_ACCESS_TOKEN,
      process.env.META_TOKEN,
      process.env.WHATSAPP_META_TOKEN,
      process.env.WHATSAPP_ACCESS_TOKEN,
    ]
      .map((item) => String(item || '').trim())
      .filter(Boolean);

    const metaToken = candidates.find((item) => this.looksLikeMetaToken(item));

    const possibleKeys = Object.keys(whats || {}).filter((key) =>
      /token|access|meta|bearer|phone/i.test(key),
    );

    const possibleMaskedValues = possibleKeys.reduce((acc: any, key) => {
      const value = whats?.[key];

      if (
        typeof value === 'string' ||
        typeof value === 'number' ||
        typeof value === 'boolean'
      ) {
        acc[key] = this.mask(value);
      } else {
        acc[key] = typeof value;
      }

      return acc;
    }, {});

    this.logger.warn(
      `[OFFICIAL CALL TOKEN DEBUG] possibleKeys=${JSON.stringify(
        possibleKeys,
      )} values=${JSON.stringify(possibleMaskedValues)} tokenFound=${!!metaToken}`,
    );

    return metaToken || '';
  }

  async sendAction(companyId: number, conexaoId: number, body: any) {
    try {
      const finalCompanyId = Number(companyId);
      const finalConexaoId = Number(conexaoId);

      const callId = String(
        body?.call_id || body?.callId || body?.id || '',
      ).trim();

      const action = String(body?.action || '').trim().toLowerCase();

      if (!finalCompanyId || !finalConexaoId) {
        throw new Error('companyId/conexaoId inválidos.');
      }

      const isConnectAction = action === 'connect';
      const isPermissionAction = [
        'request_permission',
        'call_permission_request',
        'send_call_permission_request',
      ].includes(action);

      const to = String(
        body?.to || body?.phone_to || body?.phone || body?.number || '',
      ).replace(/\D/g, '');

      if (!isConnectAction && !isPermissionAction && !callId) {
        throw new Error('call_id não informado.');
      }

      if ((isConnectAction || isPermissionAction) && !to) {
        throw new Error('Número de destino não informado.');
      }

      if (
        ![
          'connect',
          'request_permission',
          'call_permission_request',
          'send_call_permission_request',
          'reject',
          'terminate',
          'pre_accept',
          'accept',
        ].includes(action)
      ) {
        throw new Error(`Ação inválida para chamada oficial: ${action}`);
      }

      const requestDirection = String(body?.direction || '').toUpperCase();

      if (
        requestDirection === 'BUSINESS_INITIATED' &&
        ['reject', 'pre_accept', 'accept'].includes(action)
      ) {
        throw new Error(
          'Ação não permitida para chamada iniciada pela empresa. Use terminate para encerrar.',
        );
      }

      const bodyPhoneNumberId = String(
        body?.phone_number_id || body?.phoneNumberId || '',
      ).trim();

      const bodyTokenMult100 = String(
        body?.token || body?.token_mult100 || body?.connectionToken || '',
      ).trim();

      const bodyDisplayNumber = String(
        body?.display_phone_number ||
          body?.phone_number ||
          body?.from ||
          '',
      ).replace(/\\D/g, '');

      let whats: any = null;

      if (bodyPhoneNumberId) {
        whats = await this.prisma.whatsappOficial.findFirst({
          where: {
            companyId: finalCompanyId,
            phone_number_id: bodyPhoneNumberId,
            deleted_at: null,
          },
        });

        if (whats) {
          this.logger.warn(
            `[OFFICIAL CALL ACTION CONFIG BY PHONE_NUMBER_ID] companyId=${finalCompanyId} routeConexaoId=${finalConexaoId} resolvedConexaoId=${(whats as any)?.id} phone_number_id=${bodyPhoneNumberId}`,
          );
        }
      }

      if (!whats && bodyTokenMult100) {
        whats = await this.prisma.whatsappOficial.findFirst({
          where: {
            companyId: finalCompanyId,
            token_mult100: bodyTokenMult100,
            deleted_at: null,
          },
        });
      }

      if (!whats && bodyDisplayNumber) {
        whats = await this.prisma.whatsappOficial.findFirst({
          where: {
            companyId: finalCompanyId,
            phone_number: bodyDisplayNumber,
            deleted_at: null,
          },
        });
      }

      if (!whats) {
        whats = await this.prisma.whatsappOficial.findFirst({
          where: {
            id: finalConexaoId,
            companyId: finalCompanyId,
            deleted_at: null,
          },
        });
      }

      if (!whats) {
        this.logger.error(
          `[OFFICIAL CALL ACTION CONFIG NOT FOUND] companyId=${finalCompanyId} conexaoId=${finalConexaoId} bodyPhoneNumberId=${bodyPhoneNumberId || 'N/A'} bodyDisplayNumber=${bodyDisplayNumber || 'N/A'} token=${bodyTokenMult100 ? 'SIM' : 'NAO'}`,
        );

        throw new Error('Configuração da API Oficial não encontrada.');
      }

      const token = this.resolveMetaToken(whats, body);

      const phoneNumberId = String(
        body?.phone_number_id || (whats as any).phone_number_id || '',
      ).trim();

      if (!token) {
        throw new Error(
          'Token da Meta não encontrado na conexão API Oficial. Veja o log [OFFICIAL CALL TOKEN DEBUG] para identificar o nome da coluna correta.',
        );
      }

      if (!phoneNumberId) {
        throw new Error('phone_number_id não encontrado na conexão API Oficial.');
      }

      this.logger.warn(
        `[OFFICIAL CALL ACTION] companyId=${finalCompanyId} conexaoId=${finalConexaoId} action=${action} call_id=${isConnectAction ? "" : callId} phone_number_id=${phoneNumberId}`,
      );

      if (isPermissionAction) {
        const result = await this.metaService.sendOfficialCallPermissionRequest(
          phoneNumberId,
          token,
          {
            to,
            text:
              body?.text ||
              body?.message ||
              'Olá! Podemos ligar para você pelo WhatsApp para dar continuidade ao atendimento?',
          },
        );

        return {
          success: true,
          action: 'request_permission',
          to,
          result,
        };
      }

      const result = await this.metaService.sendOfficialCallAction(
        phoneNumberId,
        token,
        {
          ...(!isConnectAction && callId ? { call_id: callId } : {}),
          ...(isConnectAction ? { to } : {}),
          action,
          ...(body?.session ? { session: body.session } : {}),
        },
      );

      const resultCallId = String(
        result?.call_id ||
          result?.id ||
          result?.calls?.[0]?.id ||
          result?.call?.id ||
          result?.data?.call_id ||
          result?.data?.id ||
          callId ||
          '',
      ).trim();

      const actionStatus =
        action === 'connect'
          ? 'calling'
          : action === 'reject'
            ? 'rejected'
            : action === 'terminate'
              ? 'ended'
              : action;

      const finalCallId = resultCallId || callId;

      const actionUserId =
        Number(
          body?.user_id ||
            body?.userId ||
            body?.attendantId ||
            body?.attendant_id ||
            0,
        ) || null;

      this.socketService.sendOfficialCall(({
        user_id: actionUserId,
        userId: actionUserId,
        attendantId: actionUserId,
        token: (whats as any)?.token_mult100 || '',
        companyId: finalCompanyId,
        conexaoId: finalConexaoId,
        whatsappOficialId: (whats as any)?.id || finalConexaoId,
        phone_number_id: phoneNumberId,
        display_phone_number:
          body?.display_phone_number || (whats as any)?.phone_number || null,
        field: 'calls',
        calls: [
          {
            id: finalCallId,
            call_id: finalCallId,
            user_id: actionUserId,
            userId: actionUserId,
            attendantId: actionUserId,
            event: actionStatus,
            status: actionStatus,
            direction: body?.direction || (isConnectAction ? 'BUSINESS_INITIATED' : 'USER_INITIATED'),
            from:
              body?.from ||
              body?.display_phone_number ||
              (whats as any)?.phone_number ||
              null,
            to:
              to ||
              body?.to ||
              body?.display_phone_number ||
              (whats as any)?.phone_number ||
              null,
            timestamp: Math.floor(Date.now() / 1000),
            raw: {
              source: 'official-call-action',
              action,
              result,
            },
          } as any,
        ],
        raw: {
          source: 'official-call-action',
          action,
        },
      }) as any);

      return {
        success: true,
        action,
        call_id: finalCallId,
        result,
      };
    } catch (error: any) {
      this.logger.error(
        `[OFFICIAL CALL ACTION] ${error?.message || String(error)}`,
      );

      throw new AppError(
        error?.message || 'Erro ao executar ação da chamada oficial',
        HttpStatus.BAD_REQUEST,
      );
    }
  }
}
