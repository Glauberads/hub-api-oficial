import { Injectable } from '@nestjs/common';
import { CreateSendMessageWhatsappDto } from './dto/create-send-message-whatsapp.dto';
import { BaseService } from 'src/@core/base/base.service';
import { SendMessageWhatsApp } from 'src/@core/domain/entities/sendMessageWhatsApp.entity';
import { AppError } from 'src/@core/infra/errors/app.error';
import { checkPasteFiles, savedFile } from 'src/@core/common/utils/files.utils';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import {
  IBodyReadMessage,
  IMetaMessage,
  IMetaMessageAudio,
  IMetaMessageContacts,
  IMetaMessageDocument,
  IMetaMessageImage,
  IMetaMessageLocation,
  IMetaMessageReaction,
  IMetaMessageSticker,
  IMetaMessageTemplate,
  IMetaMessageText,
  IMetaMessageVideo,
  IMetaMessageinteractive,
} from 'src/@core/infra/meta/interfaces/IMeta.interfaces';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import * as path from 'path';
import { execFile } from 'child_process';
import { promisify } from 'util';
import { existsSync, unlinkSync } from 'fs';

const execFileAsync = promisify(execFile);

@Injectable()
export class SendMessageWhatsappService extends BaseService<SendMessageWhatsApp> {
  constructor(
    private metaService: MetaService,
    private whatsAppService: WhatsappOficialService,
  ) {
    super('sendMessageWhatsApp', SendMessageWhatsappService.name);
  }

  private safeString(value: any): string {
    if (value === null || value === undefined) return '';
    return String(value);
  }

  private escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  }

  private normalizeTemplateKey(value: string): string {
    const clean = String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[{}]/g, '')
      .replace(/[^a-zA-Z0-9\s_]/g, ' ')
      .trim();

    if (!clean) return '';

    return clean
      .split(/\s+/)
      .filter(Boolean)
      .map((part, index) => {
        const lower = part.toLowerCase();
        if (index === 0) return lower;
        return lower.charAt(0).toUpperCase() + lower.slice(1);
      })
      .join('');
  }

  private buildMessageVariables(data: any): Record<string, string> {
    const rootVars =
      typeof data?.variables === 'object' && data?.variables !== null
        ? data.variables
        : {};

    const templateVars =
      typeof data?.body_template?.variables === 'object' &&
        data?.body_template?.variables !== null
        ? data.body_template.variables
        : {};

    const merged = {
      ...rootVars,
      ...templateVars,
    };

    const parsed: Record<string, string> = {};

    Object.entries(merged).forEach(([key, value]) => {
      parsed[key] = this.safeString(value);

      const normalizedKey = this.normalizeTemplateKey(key);
      if (normalizedKey && !parsed[normalizedKey]) {
        parsed[normalizedKey] = this.safeString(value);
      }
    });

    return parsed;
  }

  private renderTemplateString(
    content: string,
    variables: Record<string, string> = {},
  ): string {
    let result = this.safeString(content);

    if (!result || !result.includes('{{')) {
      return result;
    }

    Object.entries(variables).forEach(([key, value]) => {
      const regex = new RegExp(
        `{{\\s*${this.escapeRegExp(key)}\\s*}}`,
        'gi',
      );
      result = result.replace(regex, this.safeString(value));
    });

    return result;
  }

  private renderTemplateObject<T = any>(
    payload: T,
    variables: Record<string, string> = {},
  ): T {
    if (payload === null || payload === undefined) {
      return payload;
    }

    if (typeof payload === 'string') {
      return this.renderTemplateString(payload, variables) as unknown as T;
    }

    if (Array.isArray(payload)) {
      return payload.map(item =>
        this.renderTemplateObject(item, variables),
      ) as unknown as T;
    }

    if (typeof payload === 'object') {
      const clone: any = {};

      Object.keys(payload as any).forEach(key => {
        clone[key] = this.renderTemplateObject(
          (payload as any)[key],
          variables,
        );
      });

      return clone;
    }

    return payload;
  }

  private readTemplateString(obj: any, keys: string[]): string {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        return String(value).trim();
      }
    }
    return "";
  }

  private readTemplateNumber(
    obj: any,
    keys: string[],
    fallback = 0
  ): number {
    for (const key of keys) {
      const value = obj?.[key];
      if (value !== undefined && value !== null && String(value).trim() !== "") {
        const parsed = Number(value);
        if (!Number.isNaN(parsed)) {
          return parsed;
        }
      }
    }
    return fallback;
  }

  private normalizeOfficialTemplatePayload(templatePayload: any): any {
    if (!templatePayload || typeof templatePayload !== "object") {
      return templatePayload;
    }

    const normalized: any = {
      name: templatePayload.name,
      language: templatePayload.language
    };

    if (!Array.isArray(templatePayload.components)) {
      return normalized;
    }

    const components = templatePayload.components
      .map((comp: any) => {
        const componentType = this.readTemplateString(comp, [
          "type",
          "componentType",
          "component_type"
        ]).toLowerCase();

        if (!componentType) {
          return null;
        }

        if (componentType === "button") {
          const subType = this.readTemplateString(comp, [
            "sub_type",
            "subType",
            "buttonType",
            "button_type"
          ]).toLowerCase();

          const buttonIndex = this.readTemplateNumber(
            comp,
            ["index", "buttonIndex", "button_index", "position"],
            0
          );

          if (!subType) {
            this.logger.warn(
              `[SendMessageWhatsappService] Button ignorado por falta de sub_type. comp=${JSON.stringify(comp)}`
            );
            return null;
          }

          const buttonComponent: any = {
            type: "button",
            sub_type: subType,
            index: String(buttonIndex)
          };

          if (Array.isArray(comp.parameters) && comp.parameters.length > 0) {
            buttonComponent.parameters = comp.parameters;
          }

          return buttonComponent;
        }

        if (
          ["header", "body", "footer"].includes(componentType) &&
          Array.isArray(comp.parameters) &&
          comp.parameters.length > 0
        ) {
          return {
            type: componentType,
            parameters: comp.parameters
          };
        }

        return null;
      })
      .filter(Boolean);

    if (components.length > 0) {
      normalized.components = components;
    }

    return normalized;
  }

  private normalizeRecipientNumber(value: string): string {
    return String(value || '').replace(/\D/g, '');
  }

  private buildRecipientCandidates(value: string): string[] {
    const digits = this.normalizeRecipientNumber(value);

    if (!digits) return [];

    const candidates = [digits];

    if (digits.startsWith('521')) {
      candidates.push(digits.replace(/^521/, '52'));
    } else if (digits.startsWith('52')) {
      candidates.push(digits.replace(/^52/, '521'));
    }

    return [...new Set(candidates)].filter(number => /^\d{8,15}$/.test(number));
  }

  private async createFile(
    file: Express.Multer.File,
    fileName: string,
    empresaId: number,
    conexaoId: number,
  ) {
    try {
      const data = new Date();

      const year = data.getFullYear();
      let month = String(data.getMonth() + 1);
      month = month.length == 1 ? `0${month}` : month;
      const day = data.getDate();
      let path = `${year}-${month}-${day}`;

      checkPasteFiles(path);
      path += `/${empresaId}`;
      checkPasteFiles(path);
      path += `/${conexaoId}`;
      checkPasteFiles(path);

      return await savedFile(file, path, fileName);
    } catch (error: any) {
      this.logger.error(`createMessage - ${error.message}`);
      throw new Error(`Falha ao salvar o arquivo`);
    }
  }

  private getAudioExtensionByMime(mimetype?: string): string {
    const mime = String(mimetype || '').toLowerCase();

    if (mime.includes('ogg')) return 'ogg';
    if (mime.includes('webm')) return 'webm';
    if (mime.includes('mpeg') || mime.includes('mp3')) return 'mp3';
    if (mime.includes('mp4') || mime.includes('m4a')) return 'm4a';
    if (mime.includes('wav')) return 'wav';

    return 'audio';
  }

  private ensureFileNameWithExtension(
    fileName: string,
    mimetype?: string,
    fallbackName = 'audio'
  ): string {
    const cleanName = String(fileName || fallbackName).trim() || fallbackName;

    if (path.extname(cleanName)) {
      return cleanName;
    }

    const ext = this.getAudioExtensionByMime(mimetype);

    return `${cleanName}.${ext}`;
  }

  private async convertAudioToOfficialVoice(inputPath: string): Promise<string> {
    const parsed = path.parse(inputPath);

    const outputPath = path.join(
      parsed.dir,
      `${parsed.name || 'audio'}-official-voice-${Date.now()}.ogg`
    );

    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,
          '-vn',
          '-acodec',
          'libopus',
          '-b:a',
          '32k',
          '-ac',
          '1',
          '-ar',
          '48000',
          '-application',
          'voip',
          outputPath
        ],
        {
          timeout: 120000
        }
      );

      this.logger.log(
        `convertAudioToOfficialVoice - Áudio convertido para voz oficial: ${outputPath}`
      );

      return outputPath;
    } catch (error: any) {
      this.logger.error(
        `convertAudioToOfficialVoice - Erro ao converter áudio: ${error?.message || error}`
      );

      throw new Error(
        'Falha ao converter áudio para o formato oficial do WhatsApp. Verifique se o ffmpeg está instalado.'
      );
    }
  }

  private async prepareVideoForOfficialApi(
    inputPath: string,
  ): Promise<string> {
    try {
      const { stdout } = await execFileAsync(
        'ffprobe',
        [
          '-v',
          'error',
          '-show_entries',
          'stream=codec_type,codec_name,pix_fmt,width,height',
          '-of',
          'json',
          inputPath
        ],
        {
          timeout: 30000,
          maxBuffer: 10 * 1024 * 1024
        }
      );

      const probeData = JSON.parse(String(stdout || '{}'));
      const streams = Array.isArray(probeData?.streams)
        ? probeData.streams
        : [];

      const videoStream = streams.find(
        (stream: any) => stream.codec_type === 'video'
      );

      const audioStream = streams.find(
        (stream: any) => stream.codec_type === 'audio'
      );

      if (!videoStream) {
        throw new Error('O arquivo enviado não possui uma faixa de vídeo válida');
      }

      const videoCodec = String(
        videoStream.codec_name || ''
      ).toLowerCase();

      const pixelFormat = String(
        videoStream.pix_fmt || ''
      ).toLowerCase();

      const audioCodec = audioStream
        ? String(audioStream.codec_name || '').toLowerCase()
        : '';

      const videoCompatible =
        videoCodec === 'h264' &&
        pixelFormat === 'yuv420p';

      const audioCompatible =
        !audioStream || audioCodec === 'aac';

      this.logger.log(
        `prepareVideoForOfficialApi - codecVídeo=${videoCodec || 'desconhecido'}, ` +
        `pixelFormat=${pixelFormat || 'desconhecido'}, ` +
        `codecÁudio=${audioCodec || 'sem áudio'}, ` +
        `resolução=${videoStream.width || '?'}x${videoStream.height || '?'}`
      );

      if (videoCompatible && audioCompatible) {
        this.logger.log(
          'prepareVideoForOfficialApi - Vídeo já compatível; conversão dispensada'
        );

        return inputPath;
      }

      const parsed = path.parse(inputPath);
      const outputPath = path.join(
        parsed.dir,
        `${parsed.name || 'video'}-official-h264-${Date.now()}.mp4`
      );

      this.logger.warn(
        `prepareVideoForOfficialApi - Convertendo vídeo para H.264/AAC: ${outputPath}`
      );

      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-i',
          inputPath,

          '-map',
          '0:v:0',
          '-map',
          '0:a:0?',

          '-c:v',
          'libx264',
          '-preset',
          'fast',
          '-crf',
          '23',
          '-profile:v',
          'high',
          '-level',
          '4.1',
          '-pix_fmt',
          'yuv420p',

          '-vf',
          'scale=1920:1920:force_original_aspect_ratio=decrease:force_divisible_by=2',

          '-maxrate',
          '4M',
          '-bufsize',
          '8M',

          '-c:a',
          'aac',
          '-b:a',
          '128k',
          '-ar',
          '48000',
          '-ac',
          '2',

          '-movflags',
          '+faststart',
          outputPath
        ],
        {
          timeout: 10 * 60 * 1000,
          maxBuffer: 20 * 1024 * 1024
        }
      );

      if (!existsSync(outputPath)) {
        throw new Error('O FFmpeg não gerou o vídeo convertido');
      }

      this.logger.log(
        `prepareVideoForOfficialApi - Conversão concluída: ${outputPath}`
      );

      return outputPath;
    } catch (error: any) {
      this.logger.error(
        `prepareVideoForOfficialApi - Falha: ${error?.message || error}`
      );

      throw new Error(
        `Não foi possível preparar o vídeo para a API Oficial: ` +
        `${error?.message || error}`
      );
    }
  }

  private async getIdMetaMedia(
    whatsId: number,
    phone_number_id: string,
    token: string,
    idCompany: number,
    file: Express.Multer.File,
    fileName: string,
    forceOfficialVoiceAudio = false,
    forceOfficialVideo = false,
  ) {
    try {
      if (!file) throw new Error('Necessário informar um arquivo');

      this.logger.log(
        `getIdMetaMedia - File recebido: originalname=${file.originalname}, mimetype=${file.mimetype}, size=${file.size}, path=${file.path || 'N/A'}, hasBuffer=${!!file.buffer}`,
      );

      let pathFile: string;
      let finalFileName = file.originalname || fileName || 'audio';

      if (forceOfficialVoiceAudio) {
        finalFileName = this.ensureFileNameWithExtension(
          fileName || file.originalname || 'audio',
          file.mimetype,
          'audio'
        );
      }

      if (file.path) {
        pathFile = file.path;

        this.logger.log(
          `getIdMetaMedia - Usando arquivo já salvo pelo multer: ${pathFile}`,
        );
      } else if (
        file.buffer &&
        Buffer.isBuffer(file.buffer) &&
        file.buffer.length > 0
      ) {
        pathFile = await this.createFile(
          file,
          finalFileName,
          idCompany,
          whatsId
        );
      } else {
        throw new Error('Arquivo recebido sem path nem buffer válido');
      }

      if (forceOfficialVoiceAudio) {
        pathFile = await this.convertAudioToOfficialVoice(pathFile);
        finalFileName = path.basename(pathFile);
      }

      const originalPathFile = pathFile;
      let metaUploadPath = pathFile;
      let temporaryConvertedVideo: string | null = null;

      if (forceOfficialVideo) {
        metaUploadPath = await this.prepareVideoForOfficialApi(pathFile);

        if (metaUploadPath !== pathFile) {
          temporaryConvertedVideo = metaUploadPath;
        }
      }

      let uploadCompleted = false;

      try {
        const metaFile = await this.metaService.sendFileToMeta(
          phone_number_id,
          token,
          metaUploadPath,
        );

        if (!metaFile?.id) {
          throw new Error('A Meta não retornou o ID da mídia');
        }

        uploadCompleted = true;

        // Quando houve conversão, o H.264 passa a ser o arquivo oficial
        // do histórico. O HEVC original não é mais necessário.
        if (
          temporaryConvertedVideo &&
          originalPathFile !== temporaryConvertedVideo &&
          existsSync(originalPathFile)
        ) {
          try {
            unlinkSync(originalPathFile);

            this.logger.log(
              `getIdMetaMedia - Vídeo original incompatível removido: ` +
              `${originalPathFile}`
            );
          } catch (cleanupError: any) {
            this.logger.warn(
              `getIdMetaMedia - Não foi possível remover o vídeo original: ` +
              `${cleanupError?.message || cleanupError}`
            );
          }
        }

        return {
          pathFile: metaUploadPath,
          mediaMetaId: metaFile.id,
          fileName: finalFileName,
        };
      } finally {
        // Em caso de falha, não deixe uma conversão temporária órfã.
        // Em caso de sucesso, ela é preservada para o player do sistema.
        if (
          !uploadCompleted &&
          temporaryConvertedVideo &&
          existsSync(temporaryConvertedVideo)
        ) {
          try {
            unlinkSync(temporaryConvertedVideo);
          } catch (cleanupError: any) {
            this.logger.warn(
              `getIdMetaMedia - Falha ao limpar conversão incompleta: ` +
              `${cleanupError?.message || cleanupError}`
            );
          }
        }
      }
    } catch (error: any) {
      this.logger.error(`getIdMetaMedia - ${error.message}`);
      throw new Error(error.message);
    }
  }

  private parsePayload(
    dados_mensagem: any,
  ): CreateSendMessageWhatsappDto {
    if (
      dados_mensagem === undefined ||
      dados_mensagem === null ||
      dados_mensagem === ''
    ) {
      throw new Error('Necessário informar os dados da mensagem');
    }

    let rawPayload = dados_mensagem;

    if (
      typeof rawPayload === 'object' &&
      rawPayload !== null &&
      rawPayload.data !== undefined
    ) {
      rawPayload = rawPayload.data;
    }

    if (
      typeof rawPayload === 'object' &&
      rawPayload !== null &&
      rawPayload.dados_mensagem !== undefined
    ) {
      rawPayload = rawPayload.dados_mensagem;
    }

    if (typeof rawPayload === 'string') {
      const trimmed = rawPayload.trim();

      if (!trimmed) {
        throw new Error('Necessário informar os dados da mensagem');
      }

      try {
        return JSON.parse(trimmed) as CreateSendMessageWhatsappDto;
      } catch (error) {
        this.logger.error(
          `createMessage - Falha ao fazer parse do payload: ${trimmed}`,
        );
        throw new Error('Payload da mensagem inválido');
      }
    }

    if (typeof rawPayload === 'object' && rawPayload !== null) {
      return rawPayload as CreateSendMessageWhatsappDto;
    }

    throw new Error('Payload da mensagem inválido');
  }

  async createMessage(
    token: string,
    dados_mensagem: any,
    file: Express.Multer.File,
  ) {
    try {
      const data: CreateSendMessageWhatsappDto =
        this.parsePayload(dados_mensagem);

      const rawData = data as any;
      const templateVariables = this.buildMessageVariables(rawData);

      if (!data?.to) {
        throw new Error('Necessário informar o número do destinatario');
      }

      const recipientCandidates = this.buildRecipientCandidates(data.to);

      if (!recipientCandidates.length) {
        throw new Error('o número não está no padrão do whatsapp');
      }

      if (!data?.type) {
        throw new Error('Necessário informar o tipo da mensagem');
      }

      const whats = await this.prisma.whatsappOficial.findFirst({
        where: { token_mult100: token },
      });

      if (!whats) throw new Error('Conexão não encontrada');

      const company = await this.prisma.company.findFirst({
        where: { id: whats.companyId },
      });

      if (!company) {
        throw new Error('Nenhuma empresa cadastrada para este usuário');
      }

      const entity: SendMessageWhatsApp = {
        type: data.type,
        whatsappOficialId: whats.id,
        to: recipientCandidates[0],
      };

      const {
        body_text,
        body_video,
        body_document,
        body_image,
        body_location,
        body_reaction,
        body_contacts,
        body_interactive,
        body_sticket,
        body_template,
      } = data as any;

      let resMedia: { pathFile: string; mediaMetaId: string; fileName: string };
      let dataMessage: any;

      switch (data.type) {
        case 'text':
          if (!body_text?.body) {
            throw new Error(
              'Necessário informar um texto para enviar a mensagem',
            );
          }

          entity.text = {
            body: this.renderTemplateString(body_text.body, templateVariables),
            preview_url: body_text?.preview_url,
          };

          dataMessage = {
            body: this.renderTemplateString(body_text.body, templateVariables),
            preview_url: body_text?.preview_url,
          } as IMetaMessageText;
          break;

        case 'audio':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName || file?.originalname || 'audio',
            true,
          );

          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.audio = {
            id: resMedia.mediaMetaId,
            voice: true
          } as any;

          dataMessage = {
            id: resMedia.mediaMetaId,
            voice: true
          } as any;
          break;

        case 'video':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName || file?.originalname || 'video',
            false,
            true,
          );

          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.video = {
            id: resMedia.mediaMetaId,
            caption: body_video?.caption
              ? this.renderTemplateString(body_video.caption, templateVariables)
              : null,
          };

          dataMessage = {
            id: resMedia.mediaMetaId,
            caption: body_video?.caption
              ? this.renderTemplateString(body_video.caption, templateVariables)
              : null,
          } as IMetaMessageVideo;
          break;

        case 'document':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName || file?.originalname || 'documento',
          );

          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.document = {
            filename: resMedia.fileName,
            id: resMedia.mediaMetaId,
            caption: body_document?.caption
              ? this.renderTemplateString(body_document.caption, templateVariables)
              : null,
          };

          dataMessage = {
            filename: resMedia.fileName,
            id: resMedia.mediaMetaId,
            caption: body_document?.caption
              ? this.renderTemplateString(body_document.caption, templateVariables)
              : null,
          } as IMetaMessageDocument;
          break;

        case 'image':
          resMedia = await this.getIdMetaMedia(
            whats.id,
            whats.phone_number_id,
            whats.send_token,
            company.id,
            file,
            data.fileName || file?.originalname || 'imagem',
          );

          if (!resMedia) throw new Error('Erro ao gravar a mensagem');

          entity.idFileMeta = resMedia.mediaMetaId;
          entity.pathFile = resMedia.pathFile;

          entity.image = {
            id: resMedia.mediaMetaId,
            caption: body_image?.caption
              ? this.renderTemplateString(body_image.caption, templateVariables)
              : null,
          };

          dataMessage = {
            id: resMedia.mediaMetaId,
            caption: body_image?.caption
              ? this.renderTemplateString(body_image.caption, templateVariables)
              : null,
          } as IMetaMessageImage;
          break;

        case 'location':
          if (
            body_location?.latitude === undefined ||
            body_location?.latitude === null ||
            body_location?.longitude === undefined ||
            body_location?.longitude === null
          ) {
            throw new Error('Necessário informar a latitude e longitude');
          }

          entity.location = {
            latitude: body_location.latitude,
            longitude: body_location.longitude,
            name: body_location?.name ? body_location.name : null,
            address: body_location?.address ? body_location.address : null,
          };

          dataMessage = {
            latitude: body_location.latitude,
            longitude: body_location.longitude,
            name: body_location?.name ? body_location.name : null,
            address: body_location?.address ? body_location.address : null,
          } as IMetaMessageLocation;
          break;

        case 'reaction':
          if (!body_reaction?.message_id || !body_reaction?.emoji) {
            throw new Error('Necessário informar o id da mensagem e o emoji');
          }

          entity.reaction = {
            message_id: body_reaction.message_id,
            emoji: body_reaction.emoji,
          };

          dataMessage = {
            message_id: body_reaction.message_id,
            emoji: body_reaction.emoji,
          } as IMetaMessageReaction;
          break;

        case 'contacts':
          if (!body_contacts) {
            throw new Error('Necessário informar os contatos');
          }

          entity.contacts = [body_contacts] as any;
          dataMessage = [body_contacts] as IMetaMessageContacts[];
          break;

        case 'interactive':
          this.logger.log(
            `createMessage - body_interactive: ${JSON.stringify(
              body_interactive,
              null,
              2,
            )}`,
          );

          if (!body_interactive?.type) {
            throw new Error('Necessário informar o body_interactive');
          }

          if (
            body_interactive.type === 'button' ||
            body_interactive.type === 'list'
          ) {
            const interactiveParsed = this.renderTemplateObject(
              body_interactive,
              templateVariables,
            );

            entity.interactive = interactiveParsed as any;
            dataMessage = interactiveParsed as IMetaMessageinteractive;
          } else {
            throw new Error('O tipo de mensagem esta incorreto');
          }
          break;

        case 'sticker':
          if (!body_sticket?.id) {
            throw new Error('Necessário informar o id do sticker');
          }

          entity.sticker = { id: body_sticket.id };
          dataMessage = { id: body_sticket.id } as IMetaMessageSticker;
          break;

        case 'template':
          if (!body_template) {
            throw new Error('Necessário informar o template');
          }

          const parsedTemplate = this.renderTemplateObject(
            body_template,
            templateVariables,
          );

          // Normaliza os componentes do template para o formato que a Meta espera
          const normalizedTemplate = this.normalizeOfficialTemplatePayload(parsedTemplate);

          this.logger.log(
            `createMessage - Template normalizado: ${JSON.stringify(normalizedTemplate)}`
          );

          // Aplica a renderização dos parâmetros de texto após a normalização
          if (
            normalizedTemplate?.components &&
            Array.isArray(normalizedTemplate.components)
          ) {
            normalizedTemplate.components = normalizedTemplate.components.map(component => {
              if (
                component?.parameters &&
                Array.isArray(component.parameters)
              ) {
                return {
                  ...component,
                  parameters: component.parameters.map(parameter => {
                    if (parameter?.type === 'text') {
                      return {
                        ...parameter,
                        text: this.renderTemplateString(
                          parameter.text || '',
                          templateVariables,
                        ),
                      };
                    }

                    return this.renderTemplateObject(parameter, templateVariables);
                  }),
                };
              }

              return this.renderTemplateObject(component, templateVariables);
            });
          }

          entity.template = normalizedTemplate as any;
          dataMessage = normalizedTemplate as IMetaMessageTemplate;
          break;

        default:
          throw new Error('Este tipo não é suportado pela meta');
      }

      let res: any = null;
      let usedRecipient = recipientCandidates[0];
      let lastError: any = null;

      for (const recipient of recipientCandidates) {
        try {
          const message: IMetaMessage = {
            to: recipient,
            type: data.type,
            messaging_product: 'whatsapp',
            recipient_type: 'individual',
            ...(data.quotedId && { context: { message_id: data.quotedId } }),
          };

          message[data.type] = dataMessage;

          res = await this.metaService.sendMessage(
            whats.phone_number_id,
            whats.send_token,
            message,
          );

          usedRecipient = recipient;
          break;
        } catch (error: any) {
          lastError = error;
          this.logger.warn(
            `createMessage - tentativa falhou para ${recipient}: ${error.message}`,
          );
        }
      }

      if (!res) {
        throw lastError || new Error('Falha ao enviar mensagem');
      }

      entity.to = usedRecipient;
      entity.idMessageWhatsApp = res.messages.map((m) => m.id);

      return await this.prisma.sendMessageWhatsApp.create({ data: entity });
    } catch (error: any) {
      this.logger.error(`createMessage - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async readMessage(token: string, messageId: string) {
    try {
      if (!token) {
        throw new Error("Token não informado");
      }

      if (!messageId) {
        throw new Error("MessageId não informado");
      }

      const body = {
        message_id: messageId,
        messaging_product: "whatsapp",
        status: "read",
      } as IBodyReadMessage;

      const whats =
        await this.whatsAppService.prisma.whatsappOficial.findUnique({
          where: { token_mult100: token },
        });

      if (!whats) {
        throw new Error("Nenhum número configurado para este token");
      }

      return await this.metaService.sendReadMessage(
        whats.phone_number_id,
        whats.send_token,
        body,
      );
    } catch (error: any) {
      const message =
        error?.response?.data?.error?.message ||
        error?.message ||
        "Erro ao marcar mensagem como lida";

      const isIgnorableReadError =
        message.includes("Mensagem não encontrada") ||
        message.includes("Message not found") ||
        message.includes("(#100) Invalid parameter") ||
        message.toLowerCase().includes("invalid parameter");

      if (isIgnorableReadError) {
        this.logger.warn(
          `readMessage - ignorando erro de leitura para messageId=${messageId}: ${message}`,
        );

        return {
          success: false,
          ignored: true,
          reason: message,
          messageId,
        };
      }

      this.logger.error(`readMessage - ${message}`);
      throw new AppError(message);
    }
  }
}