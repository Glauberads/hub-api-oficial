import { Request, Response } from 'express';
import FloupService from './service';
import AppError from '../../errors/AppError';
import logger from '../../utils/logger';

export default class FloupController {
  static async index(req: Request, res: Response): Promise<Response> {
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] index → companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const floups = await FloupService.listarFloups(companyId);
    logger.info(`[FLOUP] index ✓ count=${floups.length}`);
    return res.status(200).json(floups);
  }

  static async store(req: Request, res: Response): Promise<Response> {
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] store → companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const { name, description, isActive, steps, stopConditions, pauseConditions, condition, conditionValue } = req.body;
    if (!name) throw new AppError('ERR_NOME_OBRIGATORIO', 400);
    
    // Log dos steps recebidos para debug
    if (steps && steps.length > 0) {
      logger.info(`[FLOUP] store → Steps recebidos: ${steps.length} passos`);
      steps.forEach((step: any, idx: number) => {
        if (step.mediaUrl) {
          logger.info(`[FLOUP] store → Passo ${idx + 1} tem mediaUrl: ${step.mediaUrl.substring(0, 100)}...`);
        }
      });
    }
    
    const novoFloup = await FloupService.criarFloup({ companyId, name, description, isActive, steps, stopConditions, pauseConditions, condition, conditionValue });
    logger.info(`[FLOUP] store ✓ id=${novoFloup.id}`);
    return res.status(201).json(novoFloup);
  }

  static async duplicate(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] duplicate → id=${id}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const floupDuplicado = await FloupService.duplicarFloup(Number(id), companyId);
    if (!floupDuplicado) throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    logger.info(`[FLOUP] duplicate ✓ newId=${floupDuplicado.id}`);
    return res.status(201).json(floupDuplicado);
  }

  static async update(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] update → id=${id}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const { name, description, isActive, steps, stopConditions, pauseConditions, condition, conditionValue } = req.body;
    
    // Log dos steps recebidos para debug
    if (steps && steps.length > 0) {
      logger.info(`[FLOUP] update → Steps recebidos: ${steps.length} passos`);
      steps.forEach((step: any, idx: number) => {
        if (step.mediaUrl) {
          logger.info(`[FLOUP] update → Passo ${idx + 1} tem mediaUrl: ${step.mediaUrl.substring(0, 100)}...`);
        }
      });
    }
    
    const floupAtualizado = await FloupService.atualizarFloup(Number(id), companyId, { name, description, isActive, steps, stopConditions, pauseConditions, condition, conditionValue });
    if (!floupAtualizado) throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    logger.info(`[FLOUP] update ✓ id=${id}`);
    return res.status(200).json(floupAtualizado);
  }

  static async destroy(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] destroy → id=${id}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const sucesso = await FloupService.removerFloup(Number(id), companyId);
    if (!sucesso) throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    logger.info(`[FLOUP] destroy ✓ id=${id}`);
    return res.status(200).json({ message: 'Floup removido com sucesso' });
  }

  static async schedule(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    const { ticketId } = req.body;
    logger.info(`[FLOUP] schedule → floupId=${id}, ticketId=${ticketId}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    if (!ticketId) throw new AppError('ERR_TICKET_ID_OBRIGATORIO', 400);
    const agendamento = await FloupService.agendarFloup(Number(id), companyId, ticketId);
    if (!agendamento) throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    logger.info(`[FLOUP] schedule ✓ scheduleId=${agendamento.id}`);
    return res.status(201).json(agendamento);
  }

  static async unschedule(req: Request, res: Response): Promise<Response> {
    const { scheduleId } = req.params;
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] unschedule → scheduleId=${scheduleId}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const sucesso = await FloupService.cancelarAgendamento(Number(scheduleId), companyId);
    if (!sucesso) throw new AppError('ERR_AGENDAMENTO_NAO_ENCONTRADO', 404);
    logger.info(`[FLOUP] unschedule ✓ scheduleId=${scheduleId}`);
    return res.status(200).json({ message: 'Agendamento cancelado com sucesso' });
  }

  static async listSchedules(req: Request, res: Response): Promise<Response> {
    const { companyId } = (req as any).user || {};
    const { ticketId } = req.query;
    logger.info(`[FLOUP] listSchedules → companyId=${companyId}, ticketId=${ticketId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const agendamentos = await FloupService.listarAgendamentos(companyId, ticketId ? Number(ticketId) : undefined);
    return res.status(200).json(agendamentos);
  }

  static async listSchedulesByFloup(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] listSchedulesByFloup → floupId=${id}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const agendamentos = await FloupService.listarAgendamentosPorFloup(Number(id), companyId);
    return res.status(200).json(agendamentos);
  }

  static async assignToContact(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    const { contactId, ticketId } = req.body;
    logger.info(`[FLOUP] assignToContact → floupId=${id}, contactId=${contactId}, ticketId=${ticketId}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    if (!contactId) throw new AppError('ERR_CONTACT_ID_OBRIGATORIO', 400);
    const resultado = await FloupService.atrelarFloupAContato(Number(id), companyId, contactId, ticketId);
    if (!resultado) throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    logger.info(`[FLOUP] assignToContact ✓ floupId=${id}, schedules=${resultado.schedules?.length}`);
    return res.status(201).json({ message: 'Floup atrelado ao contato com sucesso', floup: resultado.floup, schedules: resultado.schedules });
  }

  static async stopForContact(req: Request, res: Response): Promise<Response> {
    const { id } = req.params;
    const { companyId } = (req as any).user || {};
    const { contactId } = req.body;
    logger.info(`[FLOUP] stopForContact → floupId=${id}, contactId=${contactId}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    if (!contactId) throw new AppError('ERR_CONTACT_ID_OBRIGATORIO', 400);
    
    // Verificar se existe algum schedule do floup para este contato
    const FloupSchedule = (await import('../../models/FloupSchedule')).default;
    const todosSchedules = await FloupSchedule.findAll({ 
      where: { floupId: Number(id), contactId, companyId },
      attributes: ['id', 'status']
    });
    
    if (!todosSchedules || todosSchedules.length === 0) {
      throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    }
    
    // Verificar se há schedules PENDING (estes devem ser cancelados sempre)
    const schedulesPendentes = todosSchedules.filter(s => s.status === 'PENDING');
    const algumConcluido = todosSchedules.some(s => s.status === 'COMPLETED');
    const todosCanceladosOuConcluidos = todosSchedules.every(s => s.status === 'COMPLETED' || s.status === 'CANCELLED');
    
    logger.info(`[FLOUP] stopForContact → Schedules encontrados: PENDING=${schedulesPendentes.length}, COMPLETED=${algumConcluido}, total=${todosSchedules.length}`);
    
    // Se há schedules PENDING, cancelá-los sempre (mesmo que haja schedules COMPLETED)
    if (schedulesPendentes.length > 0) {
      logger.info(`[FLOUP] stopForContact → Cancelando ${schedulesPendentes.length} schedules pendentes`);
      // Tentar parar o floup (vai cancelar todos os schedules pendentes)
      const sucesso = await FloupService.pararFloupParaContato(Number(id), companyId, contactId);
      if (!sucesso) {
        logger.warn(`[FLOUP] stopForContact → Não foi possível parar o floup floupId=${id}, contactId=${contactId}`);
        throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
      }
      
      // Verificar novamente se realmente foi cancelado
      const schedulesAposCancelar = await FloupSchedule.findAll({ 
        where: { floupId: Number(id), contactId, companyId, status: 'PENDING' },
        attributes: ['id', 'status']
      });
      
      if (schedulesAposCancelar.length > 0) {
        logger.error(`[FLOUP] stopForContact → AINDA HÁ ${schedulesAposCancelar.length} SCHEDULES PENDENTES após cancelar!`);
        // Tentar cancelar novamente de forma mais agressiva
        await FloupSchedule.update(
          { status: 'CANCELLED' }, 
          { where: { floupId: Number(id), contactId, companyId, status: 'PENDING' } }
        );
        logger.info(`[FLOUP] stopForContact → Cancelamento forçado executado`);
      }
      
      logger.info(`[FLOUP] stopForContact ✓ floupId=${id}, contactId=${contactId} - Schedules pendentes cancelados`);
      return res.status(200).json({ message: 'Floup interrompido para o contato com sucesso' });
    }
    
    // Se não há schedules PENDING, verificar o status geral
    if (algumConcluido) {
      logger.info(`[FLOUP] stopForContact → Floup já foi concluído para floupId=${id}, contactId=${contactId}`);
      return res.status(200).json({ message: 'Floup já foi concluído para este contato' });
    }
    
    if (todosCanceladosOuConcluidos && !algumConcluido) {
      logger.info(`[FLOUP] stopForContact → Floup já foi cancelado para floupId=${id}, contactId=${contactId}`);
      return res.status(200).json({ message: 'Floup já foi cancelado para este contato' });
    }
    
    // Caso não esperado
    logger.warn(`[FLOUP] stopForContact → Estado inesperado para floupId=${id}, contactId=${contactId}`);
    return res.status(200).json({ message: 'Floup processado' });
  }

  static async getActiveFloup(req: Request, res: Response): Promise<Response> {
    const { contactId } = req.params;
    const { companyId } = (req as any).user || {};
    logger.info(`[FLOUP] getActiveFloup → contactId=${contactId}, companyId=${companyId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    const floupAtivo = await FloupService.obterFloupAtivoDoContato(Number(contactId), companyId);
    logger.info(`[FLOUP] getActiveFloup ✓ found=${!!floupAtivo}`);
    return res.status(200).json(floupAtivo);
  }

  static async dashboard(req: Request, res: Response): Promise<Response> {
    const { companyId: userCompanyId } = (req as any).user || {};
    const { channel, status, search } = req.query;

    logger.info(`[FLOUP] dashboard → userCompanyId=${userCompanyId}, filters=${JSON.stringify(req.query)}`);

    if (!userCompanyId) {
      throw new AppError('ERR_NO_COMPANY', 400);
    }

    // Sempre usar o companyId do usuário logado - não permitir filtrar por outra empresa
    const filters: any = {
      companyId: userCompanyId
    };

    if (channel) filters.channel = channel as string;
    if (status) filters.status = status as string;
    if (search) filters.search = search as string;

    const dados = await FloupService.obterDadosDashboard(filters);
    logger.info(`[FLOUP] dashboard ✓ count=${dados.length}`);
    return res.status(200).json(dados);
  }

  static async dashboardByFloup(req: Request, res: Response): Promise<Response> {
    const { companyId: userCompanyId } = (req as any).user || {};
    const { floupId } = req.params;
    const { channel, search } = req.query;

    logger.info(`[FLOUP] dashboardByFloup → floupId=${floupId}, userCompanyId=${userCompanyId}, filters=${JSON.stringify(req.query)}`);

    if (!userCompanyId) {
      throw new AppError('ERR_NO_COMPANY', 400);
    }

    if (!floupId) {
      throw new AppError('ERR_FLOUP_ID_OBRIGATORIO', 400);
    }

    const filters: any = {};
    if (channel) filters.channel = channel as string;
    if (search) filters.search = search as string;

    const dados = await FloupService.obterDadosDashboardPorFloup(Number(floupId), userCompanyId, filters);
    
    if (!dados) {
      throw new AppError('ERR_FLOUP_NAO_ENCONTRADO', 404);
    }

    logger.info(`[FLOUP] dashboardByFloup ✓ floupId=${floupId}, totalContacts=${dados.totalContacts}`);
    return res.status(200).json(dados);
  }

  static async uploadFile(req: Request, res: Response): Promise<Response> {
    const { companyId } = (req as any).user || {};
    const file = req.file as Express.Multer.File;
    const { typeArch, floupId } = req.body;

    logger.info(`[FLOUP] uploadFile → companyId=${companyId}, typeArch=${typeArch}, floupId=${floupId}`);
    if (!companyId) throw new AppError('ERR_NO_COMPANY', 400);
    
    if (!file) {
      logger.error(`[FLOUP] uploadFile → Nenhum arquivo recebido`);
      throw new AppError('ERR_NO_FILE', 400);
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const publicFolder = path.resolve(__dirname, '..', '..', '..', 'public');
      
      // Definir pasta de destino: backend/public/companyID/floup/{floupId} ou temp se não tiver floupId
      const floupFolderName = floupId ? floupId : 'temp';
      const targetFolder = path.join(publicFolder, `company${companyId}`, 'floup', floupFolderName);
      const targetPath = path.join(targetFolder, file.filename);
      
      // Criar pasta floup se não existir (com todas as pastas pai se necessário)
      if (!fs.existsSync(targetFolder)) {
        fs.mkdirSync(targetFolder, { recursive: true });
        fs.chmodSync(targetFolder, 0o777);
        logger.info(`[FLOUP] uploadFile → Pasta criada: ${targetFolder}`);
      }
      
      // O arquivo foi salvo pelo multer (pode estar em company{companyId} ou company{companyId}/floup)
      const currentPath = file.path; // Caminho onde o multer salvou o arquivo
      
      // Se o arquivo não está na pasta floup, movê-lo
      if (currentPath !== targetPath) {
        // Se o arquivo existe no caminho atual e não é o caminho de destino
        if (fs.existsSync(currentPath)) {
          // Se já existe no destino, remover o arquivo da pasta errada
          if (fs.existsSync(targetPath)) {
            fs.unlinkSync(currentPath);
            logger.info(`[FLOUP] uploadFile → Arquivo já existe no destino, removido duplicado de ${currentPath}`);
          } else {
            // Mover o arquivo para a pasta correta
            fs.renameSync(currentPath, targetPath);
            logger.info(`[FLOUP] uploadFile → Arquivo movido de ${currentPath} para ${targetPath}`);
          }
        } else if (!fs.existsSync(targetPath)) {
          // Se o arquivo não existe em nenhum lugar, erro
          logger.error(`[FLOUP] uploadFile → Arquivo não encontrado em ${currentPath} nem em ${targetPath}`);
          throw new AppError('ERR_FILE_NOT_SAVED', 500);
        }
      }
      
      // Verificar se o arquivo existe na pasta correta
      if (!fs.existsSync(targetPath)) {
        logger.error(`[FLOUP] uploadFile → Arquivo não encontrado em: ${targetPath}`);
        throw new AppError('ERR_FILE_NOT_SAVED', 500);
      }
      
      logger.info(`[FLOUP] uploadFile → Arquivo confirmado em: ${targetPath}`);

      // Retornar o caminho relativo para acesso (mesmo formato usado no sistema)
      const filePath = `company${companyId}/floup/${floupFolderName}/${file.filename}`;
      
      // Construir URL completa para acesso via HTTP (usando mesma lógica dos outros serviços)
      const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
      const proxyPort = process.env.PROXY_PORT;
      const baseUrl = proxyPort ? `${backendUrl}:${proxyPort}` : backendUrl;
      const fileUrl = `${baseUrl}/public/${filePath}`;
      
      logger.info(`[FLOUP] uploadFile ✓ filename=${file.filename}, path=${filePath}, url=${fileUrl}, size=${file.size}, floupId=${floupId || 'temp'}`);
      
      // Verificar se o arquivo realmente existe antes de retornar
      if (!fs.existsSync(targetPath)) {
        logger.error(`[FLOUP] uploadFile → Arquivo não encontrado após processamento: ${targetPath}`);
        throw new AppError('ERR_FILE_NOT_SAVED', 500);
      }
      
      const responseData = { 
        url: fileUrl,
        path: filePath,
        filename: file.filename,
        originalname: file.originalname,
        mimetype: file.mimetype,
        size: file.size
      };
      
      logger.info(`[FLOUP] uploadFile → Retornando resposta:`, responseData);
      return res.status(200).json(responseData);
    } catch (err: any) {
      logger.error(`[FLOUP] uploadFile → Erro:`, err);
      throw new AppError(err.message || 'ERR_UPLOAD_FAILED', 500);
    }
  }

  static async deleteFile(req: Request, res: Response): Promise<Response> {
    const { companyId } = (req as any).user || {};
    const { fileUrl } = req.body;

    logger.info(`[FLOUP] deleteFile → companyId=${companyId}, fileUrl=${fileUrl}`);
    
    if (!companyId) {
      throw new AppError('ERR_NO_COMPANY', 400);
    }

    if (!fileUrl) {
      throw new AppError('ERR_NO_FILE_URL', 400);
    }

    try {
      const fs = require('fs');
      const path = require('path');
      const publicFolder = path.resolve(__dirname, '..', '..', '..', 'public');

      // Extrair o caminho do arquivo da URL
      // Exemplo: http://localhost:8080/public/company1/floup/1762563420956_Videoturbina_Eolica.mp4
      // Deve extrair: company1/floup/1762563420956_Videoturbina_Eolica.mp4
      const urlPath = fileUrl.split('/public/')[1];
      if (!urlPath) {
        logger.error(`[FLOUP] deleteFile → Não foi possível extrair o caminho da URL: ${fileUrl}`);
        throw new AppError('ERR_INVALID_FILE_URL', 400);
      }

      // Construir o caminho completo do arquivo
      const filePath = path.join(publicFolder, urlPath);

      logger.info(`[FLOUP] deleteFile → Tentando deletar arquivo: ${filePath}`);

      // Verificar se o arquivo existe
      if (!fs.existsSync(filePath)) {
        logger.warn(`[FLOUP] deleteFile → Arquivo não encontrado: ${filePath}`);
        // Retornar sucesso mesmo se o arquivo não existir (já foi deletado ou nunca existiu)
        return res.status(200).json({ message: 'Arquivo removido com sucesso (já não existia)' });
      }

      // Verificar se o arquivo pertence à empresa correta (segurança)
      if (!filePath.includes(`company${companyId}`)) {
        logger.error(`[FLOUP] deleteFile → Tentativa de deletar arquivo de outra empresa: ${filePath}`);
        throw new AppError('ERR_UNAUTHORIZED', 403);
      }

      // Deletar o arquivo
      fs.unlinkSync(filePath);
      logger.info(`[FLOUP] deleteFile → Arquivo deletado com sucesso: ${filePath}`);

      return res.status(200).json({ message: 'Arquivo removido com sucesso' });
    } catch (err: any) {
      logger.error(`[FLOUP] deleteFile → Erro:`, err);
      if (err instanceof AppError) {
        throw err;
      }
      throw new AppError(err.message || 'ERR_DELETE_FAILED', 500);
    }
  }
}


