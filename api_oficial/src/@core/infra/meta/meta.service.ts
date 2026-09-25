import { Logger } from '@nestjs/common';
import {
  IBodyReadMessage,
  IMetaMessage,
  IResultTemplates,
  IReturnAuthMeta,
  IReturnMessageFile,
  IReturnMessageMeta,
} from './interfaces/IMeta.interfaces';
import { existsSync, mkdirSync, readFileSync, writeFileSync, statSync } from 'fs';
import { convertMimeTypeToExtension } from 'src/@core/common/utils/convertMimeTypeToExtension';
import axios from 'axios';
import { lookup } from 'mime-types';
import { deleteFile } from 'src/@core/common/utils/files.utils';

export class MetaService {
  private readonly logger: Logger = new Logger(`${MetaService.name}`);
  urlMeta = `https://graph.facebook.com/v20.0`;

  path = `./public`;

  constructor() { }

  /**
   * Retry com backoff exponencial para falhas temporárias de rede.
   * Retenta apenas erros de rede/timeout (sem response da Meta = falha de conexão).
   * Erros 4xx da Meta NÃO são retentados (ex: token inválido, payload errado).
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    label: string,
    maxRetries: number = 3,
    baseDelayMs: number = 1000,
  ): Promise<T> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        return await fn();
      } catch (error: any) {
        const isNetworkError = !error?.response; // sem response = falha de rede/timeout
        const isRetryableStatus = error?.response?.status >= 500; // 5xx da Meta

        if ((isNetworkError || isRetryableStatus) && attempt < maxRetries) {
          const delay = baseDelayMs * Math.pow(2, attempt - 1); // 1s, 2s, 4s
          this.logger.warn(
            `[RETRY] ${label} - Tentativa ${attempt}/${maxRetries} falhou (${error?.code || error?.message}). Retentando em ${delay}ms...`,
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
        } else {
          throw error; // erro não retentável ou última tentativa
        }
      }
    }
    throw new Error(`[RETRY] ${label} - Todas as ${maxRetries} tentativas falharam`);
  }

  async send<T>(
    url: string,
    token: string,
    existFile: boolean = false,
  ): Promise<T | any> {
    const headers = {
      'Content-Type': !!existFile ? 'arraybuffer' : 'application/json',
      Authorization: `Bearer ${token}`,
      'User-Agent': 'curl/7.64.1',
    };

    const result = await axios.get(url, {
      headers,
      timeout: 30000,
    });

    return result.data as T;
  }

  async authFileMeta(
    idMessage: string,
    phone_number_id: string,
    token: string,
  ): Promise<IReturnAuthMeta> {
    try {
      const url = `https://graph.facebook.com/v20.0/${idMessage}?phone_number_id=${phone_number_id}`;

      return await this.send<IReturnAuthMeta>(url, token);
    } catch (error: any) {
      this.logger.error(`authDownloadFile - ${error.message}`);
      throw Error('Erro ao converter o arquivo');
    }
  }

  /**
   * ✅ NOVO: Retorna apenas os metadados do arquivo (URL, mimeType, tamanho)
   * sem baixar o arquivo completo. Útil para vídeos e documentos grandes.
   */
  async getFileMetadata(
    idMessage: string,
    phone_number_id: string,
    token: string,
  ): Promise<{ url: string; mimeType: string; fileSize: number }> {
    try {
      const auth = await this.authFileMeta(idMessage, phone_number_id, token);

      this.logger.log(`[GET METADATA] Arquivo ${idMessage} - URL obtida, tamanho: ${auth.file_size} bytes`);

      return {
        url: auth.url,
        mimeType: auth.mime_type,
        fileSize: auth.file_size,
      };
    } catch (error: any) {
      this.logger.error(`getFileMetadata - ${error.message}`);
      throw Error('Erro ao obter metadados do arquivo');
    }
  }

  async downloadFileMeta(
    idMessage: string,
    phone_number_id: string,
    token: string,
    companyId: number,
    conexao: number,
  ): Promise<{ base64: string; mimeType: string; extension: string; fileName: string; filePath: string }> {
    try {
      const auth = await this.authFileMeta(idMessage, phone_number_id, token);

      if (!existsSync(this.path)) mkdirSync(this.path);
      if (!existsSync(`${this.path}/${companyId}`))
        mkdirSync(`${this.path}/${companyId}`);
      if (!existsSync(`${this.path}/${companyId}/${conexao}`))
        mkdirSync(`${this.path}/${companyId}/${conexao}`);

      const pathFile = `${this.path}/${companyId}/${conexao}`;

      const extension = convertMimeTypeToExtension(auth.mime_type);
      const fileName = `${idMessage}.${extension}`;
      const filePath = `${pathFile}/${fileName}`;

      const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
        'User-Agent': 'curl/7.64.1',
      };

      const result = await axios.get(auth.url, {
        headers,
        responseType: 'arraybuffer',
      });

      if (result.status != 200)
        throw new Error('Falha em baixar o arquivo da meta');

      const base64 = result.data.toString('base64');

      writeFileSync(filePath, result.data);

      return {
        base64,
        mimeType: auth.mime_type,
        extension,
        fileName,
        filePath,
      };
    } catch (error: any) {
      console.log(error);
      this.logger.error(`authDownloadFile - ${error.message}`);
      throw Error('Erro ao converter o arquivo');
    }
  }

  async sendFileToMeta(
    numberId: string,
    token: string,
    pathFile: string,
  ): Promise<IReturnMessageFile | null> {
    try {
      // Verificar se o arquivo existe antes de tentar ler
      if (!existsSync(pathFile)) {
        throw new Error(`Arquivo não encontrado no caminho: ${pathFile}`);
      }

      const fileStats = statSync(pathFile);
      this.logger.log(`sendFileToMeta - Arquivo: ${pathFile}, Tamanho: ${fileStats.size} bytes`);

      if (fileStats.size === 0) {
        throw new Error(`Arquivo está vazio: ${pathFile}`);
      }

      const file = readFileSync(pathFile);

      const mimeType = lookup(pathFile);
      if (!mimeType) {
        // Tentar detectar pelo nome original ou usar fallback
        this.logger.warn(`sendFileToMeta - Não foi possível detectar MIME type para: ${pathFile}, usando application/octet-stream`);
      }

      const finalMimeType = mimeType || 'application/octet-stream';
      this.logger.log(`sendFileToMeta - MIME type: ${finalMimeType}, numberId: ${numberId}`);

      const FormData = require('form-data');
      const formData = new FormData();
      formData.append('messaging_product', 'whatsapp');
      formData.append('type', finalMimeType);
      formData.append('file', file, {
        filename: pathFile.split('/').pop(),
        contentType: finalMimeType,
      });

      const result = await this.withRetry(
        () =>
          axios.post(`${this.urlMeta}/${numberId}/media`, formData, {
            headers: {
              Authorization: `Bearer ${token}`,
              ...formData.getHeaders(),
            },
            timeout: 120000,
            maxContentLength: Infinity,
            maxBodyLength: Infinity,
          }),
        `sendFileToMeta(${numberId})`,
        3,
        2000,
      );

      return result.data as IReturnMessageFile;
    } catch (error: any) {
      try { deleteFile(pathFile); } catch (e) { /* ignore cleanup error */ }
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);
      this.logger.error(`sendFileToMeta - ERRO DETALHADO: ${detail}`);
      this.logger.error(`sendFileToMeta - Status HTTP: ${error?.response?.status || 'N/A'}`);
      this.logger.error(`sendFileToMeta - Path arquivo: ${pathFile}`);
      throw Error(`Erro ao enviar o arquivo para a meta: ${detail}`);
    }
  }

  /**
   * Upload de mídia para template usando o endpoint de uploads da Meta
   * @param token Token de acesso da Meta
   * @param appId ID do aplicativo da Meta (META_APP_ID)
   * @param pathFile Caminho do arquivo a ser enviado
   * @returns Handle da mídia para usar no template
   */
  async uploadTemplateMediaHandle(
    token: string,
    appId: string,
    pathFile: string,
  ): Promise<string> {
    try {
      if (!existsSync(pathFile)) {
        throw new Error(`Arquivo não encontrado no caminho: ${pathFile}`);
      }

      const fileStats = statSync(pathFile);
      const fileLength = fileStats.size;
      const fileName = pathFile.split('/').pop() || `template-${Date.now()}`;
      const fileType = lookup(pathFile) || 'application/octet-stream';

      if (!fileLength || fileLength <= 0) {
        throw new Error(`Arquivo está vazio: ${pathFile}`);
      }

      this.logger.log(
        `uploadTemplateMediaHandle - Iniciando upload: ${fileName}, tamanho: ${fileLength} bytes, tipo: ${fileType}, appId=${appId}`,
      );

      const session = await axios.post(
        `${this.urlMeta}/${appId}/uploads`,
        null,
        {
          params: {
            file_name: fileName,
            file_length: fileLength,
            file_type: fileType,
          },
          headers: {
            Authorization: `OAuth ${token}`,
          },
          timeout: 60000,
        },
      );

      const uploadSessionId = session.data?.id;

      if (!uploadSessionId) {
        throw new Error(
          `A Meta não retornou o ID da sessão de upload: ${JSON.stringify(session.data)}`,
        );
      }

      this.logger.log(
        `uploadTemplateMediaHandle - Sessão criada: ${uploadSessionId}`,
      );

      const fileBuffer = readFileSync(pathFile);

      const uploaded = await axios.post(
        `${this.urlMeta}/${uploadSessionId}`,
        fileBuffer,
        {
          headers: {
            Authorization: `OAuth ${token}`,
            file_offset: '0',
            'Content-Type': fileType,
          },
          timeout: 120000,
          maxContentLength: Infinity,
          maxBodyLength: Infinity,
        },
      );

      this.logger.log(
        `[TEMPLATE MEDIA] upload response=${JSON.stringify(uploaded.data)}`,
      );

      if (!uploaded.data?.h) {
        throw new Error(
          `A Meta não retornou o handle da mídia do template: ${JSON.stringify(uploaded.data)}`,
        );
      }

      this.logger.log(
        `uploadTemplateMediaHandle - Upload concluído, handle: ${uploaded.data.h}`,
      );

      return uploaded.data.h;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);

      this.logger.error(`uploadTemplateMediaHandle - Erro: ${detail}`);

      throw Error(`Erro ao fazer upload da mídia para template: ${detail}`);
    }
  }

  private compactObject<T = any>(value: T): T {
    if (Array.isArray(value)) {
      return value
        .map((item) => this.compactObject(item))
        .filter((item) => item !== undefined && item !== null) as unknown as T;
    }

    if (value && typeof value === 'object') {
      const output: Record<string, any> = {};

      Object.entries(value as Record<string, any>).forEach(([key, item]) => {
        const normalized = this.compactObject(item);

        if (normalized !== undefined && normalized !== null) {
          output[key] = normalized;
        }
      });

      return output as T;
    }

    return value;
  }

  private normalizeTemplateParameter(parameter: any): any {
    const parsed = this.compactObject(parameter);

    if (!parsed || typeof parsed !== 'object') {
      return parsed;
    }

    const type = String(parsed.type || '').trim().toLowerCase();

    const normalized: any = {
      ...parsed,
      ...(type ? { type } : {}),
    };

    if (type === 'text') {
      normalized.text = String(normalized.text ?? '');
    }

    if (type === 'payload') {
      normalized.payload = String(normalized.payload ?? '');
    }

    return this.compactObject(normalized);
  }

  private normalizeOutgoingMessage(message: IMetaMessage): IMetaMessage {
    const baseMessage: any = this.compactObject({
      ...message,
      to: String(message?.to || '').replace(/\D/g, ''),
      type: String(message?.type || '').trim().toLowerCase(),
    });

    if (baseMessage.type !== 'template' || !baseMessage.template) {
      return baseMessage as IMetaMessage;
    }

    const template = baseMessage.template;

    const components = Array.isArray(template.components)
      ? template.components.map((component: any, index: number) => {
        const type = String(component?.type || '').trim().toLowerCase();

        const normalized: any = {
          type,
        };

        if (
          Array.isArray(component?.parameters) &&
          component.parameters.length
        ) {
          normalized.parameters = component.parameters.map((parameter: any) =>
            this.normalizeTemplateParameter(parameter),
          );
        }

        if (type === 'button') {
          if (
            component?.sub_type !== undefined &&
            component?.sub_type !== null &&
            component?.sub_type !== ''
          ) {
            normalized.sub_type = String(component.sub_type)
              .trim()
              .toLowerCase();
          }

          normalized.index = String(component?.index ?? index);
        }

        return this.compactObject(normalized);
      })
      : [];

    const normalizedMessage = {
      ...baseMessage,
      template: this.compactObject({
        name: String(template?.name || ''),
        language: this.compactObject({
          code: String(template?.language?.code || 'pt_BR'),
          ...(template?.language?.policy
            ? { policy: String(template.language.policy) }
            : {}),
        }),
        ...(components.length ? { components } : {}),
      }),
    };

    return normalizedMessage as IMetaMessage;
  }

  async sendMessage(numberId: string, token: string, message: IMetaMessage) {
    try {
      const normalizedMessage = this.normalizeOutgoingMessage(message);

      this.logger.log(
        `sendMessage - payload final: ${JSON.stringify(normalizedMessage)}`,
      );

      const result = await this.withRetry(
        () =>
          axios.post(
            `${this.urlMeta}/${numberId}/messages`,
            normalizedMessage,
            {
              headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${token}`,
              },
              timeout: 60000,
            },
          ),
        `sendMessage(${numberId})`,
      );

      return result.data as IReturnMessageMeta;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);

      this.logger.error(`sendMessage - ${detail}`);
      throw Error('Erro ao enviar a mensagem');
    }
  }

  async getListTemplates(wabaId: string, token: string) {
    try {
      const result = await axios.get(
        `${this.urlMeta}/${wabaId}/message_templates`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      return result.data as IResultTemplates;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);
      this.logger.error(`getListTemplates - ${detail}`);

      const metaError = error?.response?.data?.error;
      const isTokenError =
        error?.response?.status === 401 ||
        metaError?.code === 190 ||
        metaError?.error_subcode === 463 ||
        metaError?.error_subcode === 467;

      if (isTokenError) {
        throw Error(
          'TOKEN_EXPIRED: O token de acesso da Meta expirou ou é inválido. Atualize o token na configuração da conexão.'
        );
      }

      throw Error('Erro ao listar templates');
    }
  }

  async createTemplate(
    wabaId: string,
    token: string,
    data: { name: string; language: string; category: string; components: any[] },
    filePath?: string,
    metaAppId?: string,
  ) {
    try {
      this.logger.log(
        `[CREATE TEMPLATE DEBUG] filePath=${filePath || 'SEM_ARQUIVO'} metaAppId=${metaAppId || 'SEM_META_APP_ID'} components=${JSON.stringify(data.components)}`,
      );

      if (filePath) {
        const headerComponent = data.components?.find(
          component =>
            String(component?.type || '').toUpperCase() === 'HEADER' &&
            ['IMAGE', 'VIDEO', 'DOCUMENT'].includes(
              String(component?.format || '').toUpperCase(),
            ),
        );

        if (!headerComponent) {
          throw new Error(
            'Arquivo enviado, mas o template não possui HEADER do tipo IMAGE, VIDEO ou DOCUMENT.',
          );
        }

        const appId = String(metaAppId || process.env.META_APP_ID || '').trim();

        if (!appId || appId === 'SEU_APP_ID_DA_META') {
          throw new Error(
            'ID do aplicativo da Meta não configurado nesta conexão. Informe o App ID nas configurações da API Oficial.',
          );
        }

        const mediaHandle = await this.uploadTemplateMediaHandle(
          token,
          appId,
          filePath,
        );

        this.logger.log(`[TEMPLATE MEDIA] appId=${appId}`);
        this.logger.log(`[TEMPLATE MEDIA] mediaHandle=${mediaHandle}`);
        this.logger.log(`[TEMPLATE MEDIA] filePath=${filePath}`);

        headerComponent.format = String(headerComponent.format).toUpperCase();
        headerComponent.example = {
          header_handle: [mediaHandle],
        };
      }

      this.logger.log(`[CREATE TEMPLATE PAYLOAD] ${JSON.stringify(data)}`);

      const result = await axios.post(
        `${this.urlMeta}/${wabaId}/message_templates`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      return result.data;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);

      this.logger.error(`createTemplate - ${detail}`);

      const metaError = error?.response?.data?.error;

      const isTokenError =
        error?.response?.status === 401 ||
        metaError?.code === 190 ||
        metaError?.error_subcode === 463 ||
        metaError?.error_subcode === 467;

      if (isTokenError) {
        throw Error(
          'TOKEN_EXPIRED: O token de acesso da Meta expirou ou é inválido. Atualize o token na configuração da conexão.',
        );
      }

      const userMessage =
        metaError?.error_user_msg ||
        metaError?.message ||
        error?.message ||
        'Erro ao criar o template';

      throw Error(userMessage);
    }
  }

  async deleteTemplate(wabaId: string, token: string, templateName: string) {
    try {
      const result = await axios.delete(
        `${this.urlMeta}/${wabaId}/message_templates?name=${templateName}`,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      return result.data;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);
      this.logger.error(`deleteTemplate - ${detail}`);

      const metaError = error?.response?.data?.error;
      const isTokenError =
        error?.response?.status === 401 ||
        metaError?.code === 190 ||
        metaError?.error_subcode === 463 ||
        metaError?.error_subcode === 467;

      if (isTokenError) {
        throw Error(
          'TOKEN_EXPIRED: O token de acesso da Meta expirou ou é inválido. Atualize o token na configuração da conexão.',
        );
      }

      throw Error(metaError?.message || 'Erro ao deletar o template');
    }
  }



  async sendOfficialCallPermissionRequest(
    numberId: string,
    token: string,
    data: {
      to: string;
      text?: string;
    },
  ) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        recipient_type: 'individual',
        to: data.to,
        type: 'interactive',
        interactive: {
          type: 'call_permission_request',
          action: {
            name: 'call_permission_request',
          },
          body: {
            text:
              data.text ||
              'Olá! Podemos ligar para você pelo WhatsApp para dar continuidade ao atendimento?',
          },
        },
      };

      this.logger.log(
        `[OFFICIAL CALL PERMISSION] numberId=${numberId} to=${data.to}`,
      );

      const result = await axios.post(
        `${this.urlMeta}/${numberId}/messages`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      return result.data;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);

      this.logger.error(`sendOfficialCallPermissionRequest - ${detail}`);

      const metaError = error?.response?.data?.error;
      const userMessage =
        metaError?.error_user_msg ||
        metaError?.message ||
        error?.message ||
        'Erro ao solicitar permissão de ligação';

      throw Error(userMessage);
    }
  }

  async sendOfficialCallAction(
    numberId: string,
    token: string,
    data: {
      call_id?: string;
      to?: string;
      action: 'connect' | 'reject' | 'terminate' | 'pre_accept' | 'accept' | string;
      session?: any;
    },
  ) {
    try {
      const payload = {
        messaging_product: 'whatsapp',
        action: data.action,
        ...(data.call_id ? { call_id: data.call_id } : {}),
        ...(data.to ? { to: data.to } : {}),
        ...(data.session ? { session: data.session } : {}),
      };

      this.logger.log(
        `[OFFICIAL CALL ACTION] numberId=${numberId} action=${data.action} call_id=${data.call_id}`,
      );

      const result = await axios.post(
        `${this.urlMeta}/${numberId}/calls`,
        payload,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      return result.data;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);

      this.logger.error(`sendOfficialCallAction - ${detail}`);

      const metaError = error?.response?.data?.error;
      const userMessage =
        metaError?.error_user_msg ||
        metaError?.message ||
        error?.message ||
        'Erro ao executar ação da chamada oficial';

      throw Error(userMessage);
    }
  }

  async sendReadMessage(
    numberId: string,
    token: string,
    data: IBodyReadMessage,
  ) {
    try {
      this.logger.log(`sendReadMessage - ${JSON.stringify(data)}`);

      const result = await axios.post(
        `${this.urlMeta}/${numberId}/messages`,
        data,
        {
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
          timeout: 30000,
        },
      );

      return result.data as IResultTemplates;
    } catch (error: any) {
      const detail = error?.response?.data
        ? JSON.stringify(error.response.data)
        : error?.message || String(error);
      this.logger.error(`sendReadMessage - ${detail}`);
      throw Error('Erro ao marcar a mensagem como lida');
    }
  }
}