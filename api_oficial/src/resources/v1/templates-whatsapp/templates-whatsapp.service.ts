import { Injectable, Logger } from '@nestjs/common';
import { MetaService } from 'src/@core/infra/meta/meta.service';
import { WhatsappOficialService } from '../whatsapp-oficial/whatsapp-oficial.service';
import { AppError } from 'src/@core/infra/errors/app.error';

@Injectable()
export class TemplatesWhatsappService {
  logger = new Logger(`${TemplatesWhatsappService}`);

  constructor(
    private readonly whatsappOficial: WhatsappOficialService,
    private readonly metaService: MetaService,
  ) { }

  async findAll(token: string) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findFirst({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      return await this.metaService.getListTemplates(
        conexao.waba_id,
        conexao.send_token,
      );
    } catch (error: any) {
      this.logger.error(`findAll - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async create(
    token: string,
    data: { name: string; language: string; category: string; components: any[] },
    filePath?: string,
  ) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findFirst({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      return await this.metaService.createTemplate(
        conexao.waba_id,
        conexao.send_token,
        data,
        filePath,
        conexao.meta_app_id,
      );
    } catch (error: any) {
      this.logger.error(`create - ${error.message}`);
      throw new AppError(error.message);
    }
  }

  async remove(token: string, templateName: string) {
    try {
      const conexao =
        await this.whatsappOficial.prisma.whatsappOficial.findFirst({
          where: {
            token_mult100: token,
            deleted_at: null,
          },
        });

      if (!conexao) {
        this.logger.error(`Nenhuma conexão existente com este token ${token}`);
        throw new Error(`Nenhuma conexão existente com este token ${token}`);
      }

      return await this.metaService.deleteTemplate(
        conexao.waba_id,
        conexao.send_token,
        templateName,
      );
    } catch (error: any) {
      this.logger.error(`remove - ${error.message}`);
      throw new AppError(error.message);
    }
  }
}
