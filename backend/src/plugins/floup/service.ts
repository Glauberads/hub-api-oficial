import { getIO } from '../../libs/socket';
import Floup from '../../models/Floup';
import FloupSchedule from '../../models/FloupSchedule';
import Contact from '../../models/Contact';
import logger from '../../utils/logger';
import { QueryTypes } from 'sequelize';

// Helper para executar queries do Floup com fallback se colunas não existirem
const safeFloupQuery = async <T = any>(
  queryFn: () => any,
  fallbackQueryFn?: () => any
): Promise<T> => {
  try {
    const result = await queryFn();
    return result as T;
  } catch (error: any) {
    if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
      logger.warn(`[FLOUP] Colunas condition/conditionValue não existem. Usando fallback.`);
      if (fallbackQueryFn) {
        const result = await fallbackQueryFn();
        return result as T;
      }
      // Se não houver fallback, tentar novamente excluindo as colunas problemáticas
      throw error;
    }
    throw error;
  }
};

export default class FloupService {
  static async listarFloups(companyId: number) {
    logger.info(`[FLOUP] service.listarFloups → companyId=${companyId}`);
    try {
      // Tentar buscar com todas as colunas primeiro
      const floups = await Floup.findAll({ 
        where: { companyId }, 
        order: [['name', 'ASC']],
        attributes: {
          exclude: [] // Tentar buscar todas as colunas
        }
      });
      logger.info(`[FLOUP] service.listarFloups ✓ count=${floups.length}`);
      return floups;
    } catch (error: any) {
      // Se der erro por colunas não existentes, buscar sem as colunas condition e conditionValue
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        logger.warn(`[FLOUP] Colunas condition/conditionValue não existem ainda. Buscando sem elas.`);
        const floups = await Floup.findAll({ 
          where: { companyId }, 
          order: [['name', 'ASC']],
          attributes: {
            exclude: ['condition', 'conditionValue']
          }
        });
        logger.info(`[FLOUP] service.listarFloups ✓ count=${floups.length} (sem condition/conditionValue)`);
        return floups;
      }
      throw error;
    }
  }

  // Buscar dados de um Floup específico agrupados por etapa (para Kanban de etapas)
  static async obterDadosDashboardPorFloup(floupId: number, companyId: number, filters?: { channel?: string, search?: string }) {
    logger.info(`[FLOUP] service.obterDadosDashboardPorFloup → floupId=${floupId}, companyId=${companyId}, filters=${JSON.stringify(filters)}`);
    try {
      const Ticket = (await import('../../models/Ticket')).default;
      
      // Buscar o Floup
      let floup;
      try {
        floup = await Floup.findOne({
          where: { id: floupId, companyId }
        });
      } catch (error: any) {
        if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
          logger.warn(`[FLOUP] Colunas condition/conditionValue não existem. Buscando sem elas.`);
          floup = await Floup.findOne({
            where: { id: floupId, companyId },
            attributes: {
              exclude: ['condition', 'conditionValue']
            }
          });
        } else {
          throw error;
        }
      }
      
      if (!floup) {
        logger.warn(`[FLOUP] obterDadosDashboardPorFloup → Floup ${floupId} não encontrado`);
        return null;
      }
      
      // Buscar todos os schedules ativos (PENDING) deste Floup
      const activeSchedules = await FloupSchedule.findAll({
        where: {
          floupId,
          companyId,
          status: 'PENDING'
        },
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'name', 'number', 'profilePicUrl'],
            required: true
          },
          {
            model: Ticket,
            as: 'ticket',
            attributes: ['id', 'uuid', 'channel', 'status'],
            required: false
          }
        ],
        order: [['nextRunAt', 'ASC']]
      });
      
      // Agrupar contatos por etapa (currentStepIndex)
      const stepsMap = new Map();
      const steps = floup.steps || [];
      
      // Inicializar todas as etapas
      steps.forEach((step, index) => {
        stepsMap.set(index, {
          stepIndex: index,
          stepOrder: step.order || (index + 1),
          stepMessage: step.message || `Etapa ${index + 1}`,
          contacts: []
        });
      });
      
      // Processar cada schedule e adicionar aos contatos da etapa correspondente
      for (const schedule of activeSchedules) {
        if (!schedule.contact) continue;
        
        const stepIndex = schedule.currentStepIndex || 0;
        
        // Buscar canal do ticket
        let channel = 'N/A';
        if (schedule.ticket) {
          channel = schedule.ticket.channel || 'N/A';
        } else if (schedule.ticketId) {
          try {
            const ticket = await Ticket.findByPk(schedule.ticketId, { attributes: ['channel'] });
            if (ticket) channel = ticket.channel || 'N/A';
          } catch (e) {
            // Ignorar erro
          }
        }
        
        // Aplicar filtros
        if (filters?.channel && channel !== filters.channel && channel !== 'N/A') {
          continue;
        }
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const contactName = (schedule.contact.name || '').toLowerCase();
          const contactNumber = (schedule.contact.number || '').toLowerCase();
          if (!contactName.includes(searchLower) && !contactNumber.includes(searchLower)) {
            continue;
          }
        }
        
        // Verificar erros recentes
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        const hasRecentError = schedule.status === 'ERROR' && new Date(schedule.updatedAt) >= twentyFourHoursAgo;
        
        const contactData = {
          contactId: schedule.contact.id,
          contactName: schedule.contact.name || 'Sem nome',
          contactNumber: schedule.contact.number || '',
          contactProfilePicUrl: schedule.contact.profilePicUrl || null,
          scheduleId: schedule.id,
          ticketId: schedule.ticketId,
          ticketUuid: schedule.ticket?.uuid || null,
          ticketStatus: schedule.ticket?.status || null,
          nextRunAt: schedule.nextRunAt,
          channel,
          hasRecentError
        };
        
        // Adicionar à etapa correspondente
        if (!stepsMap.has(stepIndex)) {
          stepsMap.set(stepIndex, {
            stepIndex,
            stepOrder: stepIndex + 1,
            stepMessage: `Etapa ${stepIndex + 1}`,
            contacts: []
          });
        }
        
        stepsMap.get(stepIndex).contacts.push(contactData);
      }
      
      // Converter para array ordenado por stepIndex
      const stepsData = Array.from(stepsMap.values())
        .sort((a, b) => a.stepIndex - b.stepIndex)
        .map(stepData => ({
          stepIndex: stepData.stepIndex,
          stepOrder: stepData.stepOrder,
          stepMessage: stepData.stepMessage,
          contactsCount: stepData.contacts.length,
          contacts: stepData.contacts
        }));
      
      return {
        floupId: floup.id,
        floupName: floup.name,
        floupDescription: floup.description,
        totalSteps: steps.length,
        steps: stepsData,
        totalContacts: activeSchedules.length
      };
    } catch (error: any) {
      logger.error(`[FLOUP] obterDadosDashboardPorFloup → Erro:`, error);
      if (error.code === 'ECONNRESET' || error.name === 'SequelizeDatabaseError') {
        logger.warn(`[FLOUP] obterDadosDashboardPorFloup → Erro de conexão com banco`);
        return null;
      }
      throw error;
    }
  }

  // Buscar dados consolidados para o Dashboard Kanban - Agora retorna CONTATOS que estão nos Floups
  static async obterDadosDashboard(filters?: { companyId?: number, channel?: string, status?: string, search?: string }) {
    logger.info(`[FLOUP] service.obterDadosDashboard → filters=${JSON.stringify(filters)}`);
    try {
      const { Op } = require('sequelize');
      const Ticket = (await import('../../models/Ticket')).default;
      
      // companyId é obrigatório
      if (!filters?.companyId) {
        throw new Error('companyId é obrigatório para obter dados do dashboard');
      }
      
      // Buscar todos os schedules ativos (PENDING) com seus contatos e Floups
      const whereSchedule: any = {
        companyId: filters.companyId,
        status: 'PENDING'
      };
      
      // Buscar schedules ativos com contatos e Floups
      const activeSchedules = await FloupSchedule.findAll({
        where: whereSchedule,
        include: [
          {
            model: Contact,
            as: 'contact',
            attributes: ['id', 'name', 'number', 'profilePicUrl'],
            required: true // Apenas schedules com contato
          },
          {
            model: Floup,
            as: 'floup',
            attributes: ['id', 'name', 'description', 'steps', 'isActive'],
            required: true
          },
          {
            model: Ticket,
            as: 'ticket',
            attributes: ['id', 'channel', 'status', 'uuid'],
            required: false
          }
        ],
        order: [['nextRunAt', 'ASC']]
      });

      // Agrupar por contato (um contato pode estar em múltiplos Floups)
      const contactsMap = new Map();
      
      for (const schedule of activeSchedules) {
        if (!schedule.contact || !schedule.floup) continue;
        
        const contactId = schedule.contact.id;
        const floupId = schedule.floup.id;
        
        // Buscar canal do ticket
        let channel = 'N/A';
        if (schedule.ticket) {
          channel = schedule.ticket.channel || 'N/A';
        } else if (schedule.ticketId) {
          try {
            const ticket = await Ticket.findByPk(schedule.ticketId, { attributes: ['channel'] });
            if (ticket) channel = ticket.channel || 'N/A';
          } catch (e) {
            // Ignorar erro
          }
        }
        
        // Verificar erros recentes para este schedule
        const twentyFourHoursAgo = new Date();
        twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
        const hasRecentError = schedule.status === 'ERROR' && new Date(schedule.updatedAt) >= twentyFourHoursAgo;
        
        // Determinar status do contato no Floup
        let status = 'running';
        if (hasRecentError) {
          status = 'error';
        } else if (!schedule.floup.isActive) {
          status = 'paused';
        } else {
          status = 'running';
        }
        
        // Aplicar filtros
        if (filters?.channel && channel !== filters.channel && channel !== 'N/A') {
          continue;
        }
        if (filters?.status && status !== filters.status) {
          continue;
        }
        if (filters?.search) {
          const searchLower = filters.search.toLowerCase();
          const contactName = (schedule.contact.name || '').toLowerCase();
          const contactNumber = (schedule.contact.number || '').toLowerCase();
          const floupName = (schedule.floup.name || '').toLowerCase();
          if (!contactName.includes(searchLower) && !contactNumber.includes(searchLower) && !floupName.includes(searchLower)) {
            continue;
          }
        }
        
        // Criar ou atualizar entrada do contato
        if (!contactsMap.has(contactId)) {
          contactsMap.set(contactId, {
            contactId: schedule.contact.id,
            contactName: schedule.contact.name || 'Sem nome',
            contactNumber: schedule.contact.number || '',
            contactProfilePicUrl: schedule.contact.profilePicUrl || null,
            floups: []
          });
        }
        
        const contactData = contactsMap.get(contactId);
        contactData.floups.push({
          floupId: schedule.floup.id,
          floupName: schedule.floup.name,
          floupDescription: schedule.floup.description,
          currentStepIndex: schedule.currentStepIndex,
          totalSteps: (schedule.floup.steps || []).length,
          nextRunAt: schedule.nextRunAt,
          channel,
          status,
          scheduleId: schedule.id,
          hasRecentError
        });
      }
      
      // Converter map para array e processar
      const contactsData = Array.from(contactsMap.values()).map(contactData => {
        // Determinar status geral do contato (se tem erro em algum Floup, é erro)
        let overallStatus = 'running';
        if (contactData.floups.some((f: any) => f.status === 'error')) {
          overallStatus = 'error';
        } else if (contactData.floups.some((f: any) => f.status === 'paused')) {
          overallStatus = 'paused';
        }
        
        // Próxima execução mais próxima
        const nextExecutions = contactData.floups
          .map((f: any) => new Date(f.nextRunAt).getTime())
          .filter((t: number) => !isNaN(t));
        const nextExecution = nextExecutions.length > 0 
          ? new Date(Math.min(...nextExecutions))
          : null;
        
        return {
          contactId: contactData.contactId,
          contactName: contactData.contactName,
          contactNumber: contactData.contactNumber,
          contactProfilePicUrl: contactData.contactProfilePicUrl,
          floups: contactData.floups,
          floupsCount: contactData.floups.length,
          status: overallStatus,
          nextExecution,
          channels: [...new Set(contactData.floups.map((f: any) => f.channel).filter((c: string) => c !== 'N/A'))]
        };
      });
      
      logger.info(`[FLOUP] service.obterDadosDashboard ✓ count=${contactsData.length} contatos`);
      return contactsData;
    } catch (error: any) {
      logger.error(`[FLOUP] service.obterDadosDashboard → Erro:`, error);
      // Se for erro de conexão, retornar array vazio em vez de quebrar
      if (error.code === 'ECONNRESET' || error.name === 'SequelizeDatabaseError') {
        logger.warn(`[FLOUP] service.obterDadosDashboard → Erro de conexão com banco, retornando array vazio`);
        return [];
      }
      throw error;
    }
  }

  static async criarFloup(config: any) {
    logger.info(`[FLOUP] service.criarFloup → companyId=${config.companyId}, name=${config.name}`);
    
    // Log dos steps recebidos para debug
    if (config.steps && config.steps.length > 0) {
      logger.info(`[FLOUP] service.criarFloup → Steps recebidos: ${config.steps.length} passos`);
      config.steps.forEach((step: any, idx: number) => {
        logger.info(`[FLOUP] service.criarFloup → Passo ${idx + 1}: order=${step.order}, mediaUrl=${step.mediaUrl ? step.mediaUrl.substring(0, 100) + '...' : 'VAZIO'}, mediaType=${step.mediaType || 'N/A'}`);
      });
    }
    
    // Garantir que os steps sejam um array válido
    const stepsToSave = config.steps && Array.isArray(config.steps) ? config.steps : [];
    
    // Log completo do JSON antes de salvar
    logger.info(`[FLOUP] service.criarFloup → JSON completo dos steps a serem salvos: ${JSON.stringify(stepsToSave, null, 2)}`);
    
    // Tentar criar com todas as colunas primeiro
    let novoFloup;
    try {
      novoFloup = await Floup.create({
        companyId: config.companyId,
        name: config.name,
        description: config.description || '',
        isActive: config.isActive !== undefined ? config.isActive : true,
        steps: stepsToSave,
        stopConditions: config.stopConditions || [],
        pauseConditions: config.pauseConditions || [],
        condition: config.condition || 'queue',
        conditionValue: config.conditionValue || ''
      });
    } catch (error: any) {
      // Se der erro por colunas não existentes, criar usando SQL direto
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        logger.warn(`[FLOUP] Colunas condition/conditionValue não existem. Criando usando SQL direto.`);
        const sequelize = Floup.sequelize;
        
        try {
          // Primeiro, verificar o nome exato da tabela
          const tableCheckResult: any = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND LOWER(table_name) = LOWER('Floups')
            LIMIT 1;
          `, { type: QueryTypes.SELECT });
          
          const actualTableName = tableCheckResult && tableCheckResult.length > 0 
            ? (tableCheckResult[0] as any).table_name 
            : 'Floups';
          
          logger.info(`[FLOUP] Usando nome da tabela: ${actualTableName}`);
          
          const stepsJson = JSON.stringify(stepsToSave);
          const stopConditionsJson = JSON.stringify(config.stopConditions || []);
          const pauseConditionsJson = JSON.stringify(config.pauseConditions || []);
          const now = new Date();
          
          const insertResult: any = await sequelize.query(`
            INSERT INTO "${actualTableName}" ("companyId", "name", "description", "isActive", "steps", "stopConditions", "pauseConditions", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
            RETURNING "id", "companyId", "name", "description", "isActive", "steps", "stopConditions", "pauseConditions", "templateType", "createdAt", "updatedAt";
          `, {
            bind: [
              config.companyId,
              config.name,
              config.description || '',
              config.isActive !== undefined ? config.isActive : true,
              stepsJson,
              stopConditionsJson,
              pauseConditionsJson,
              now,
              now
            ],
            type: QueryTypes.SELECT
          });
          
          logger.info(`[FLOUP] Resultado do INSERT:`, insertResult);
          
          if (insertResult && insertResult.length > 0 && (insertResult[0] as any).id) {
            const insertedId = (insertResult[0] as any).id;
            // ✅ CORRIGIDO: Buscar via SQL direto para evitar que Sequelize tente buscar colunas inexistentes
            const selectResult: any = await sequelize.query(`
              SELECT "id", "companyId", "name", "description", "isActive", "steps", "stopConditions", "pauseConditions", "templateType", "createdAt", "updatedAt"
              FROM "${actualTableName}"
              WHERE "id" = $1
            `, {
              bind: [insertedId],
              type: QueryTypes.SELECT
            });
            
            if (selectResult && selectResult.length > 0) {
              const row = selectResult[0];
              // Construir objeto Floup manualmente (sem usar o modelo para evitar busca de colunas inexistentes)
              novoFloup = {
                id: row.id,
                companyId: row.companyId,
                name: row.name,
                description: row.description || '',
                isActive: row.isActive,
                steps: row.steps || [],
                stopConditions: row.stopConditions || [],
                pauseConditions: row.pauseConditions || [],
                templateType: row.templateType || null,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                // Adicionar métodos necessários do Sequelize Model
                save: async () => novoFloup,
                update: async () => novoFloup,
                reload: async () => novoFloup,
                toJSON: () => ({
                  id: row.id,
                  companyId: row.companyId,
                  name: row.name,
                  description: row.description || '',
                  isActive: row.isActive,
                  steps: row.steps || [],
                  stopConditions: row.stopConditions || [],
                  pauseConditions: row.pauseConditions || [],
                  templateType: row.templateType || null,
                  createdAt: row.createdAt,
                  updatedAt: row.updatedAt
                })
              } as any;
              logger.info(`[FLOUP] Floup criado via SQL direto com sucesso. ID: ${novoFloup.id}`);
            } else {
              throw new Error(`Falha ao buscar Floup criado (ID: ${insertedId}) - nenhum resultado retornado`);
            }
          } else {
            logger.error(`[FLOUP] SQL direto não retornou resultados válidos:`, JSON.stringify(insertResult));
            throw new Error('Falha ao criar Floup via SQL direto - nenhum resultado retornado');
          }
        } catch (sqlError: any) {
          logger.error(`[FLOUP] Erro ao criar Floup via SQL direto:`, sqlError);
          logger.error(`[FLOUP] Stack trace:`, sqlError.stack);
          throw new Error(`Falha ao criar Floup via SQL direto: ${sqlError.message}`);
        }
      } else {
        throw error;
      }
    }

    // Recarregar o floup para garantir que os dados estão atualizados
    await novoFloup.reload();

    // Log dos steps salvos para verificar
    if (novoFloup.steps && novoFloup.steps.length > 0) {
      logger.info(`[FLOUP] service.criarFloup → Steps salvos: ${novoFloup.steps.length} passos`);
      novoFloup.steps.forEach((step: any, idx: number) => {
        logger.info(`[FLOUP] service.criarFloup → Passo ${idx + 1} salvo: order=${step.order}, mediaUrl=${step.mediaUrl ? step.mediaUrl.substring(0, 100) + '...' : 'VAZIO'}, mediaType=${step.mediaType || 'N/A'}`);
      });
    } else {
      logger.warn(`[FLOUP] service.criarFloup → Nenhum step encontrado após salvar!`);
    }

    // Mover arquivos de temp para a pasta do floup se houver
    try {
      const fs = require('fs');
      const path = require('path');
      const publicFolder = path.resolve(__dirname, '..', '..', '..', 'public');
      const tempFolder = path.join(publicFolder, `company${config.companyId}`, 'floup', 'temp');
      const floupFolder = path.join(publicFolder, `company${config.companyId}`, 'floup', String(novoFloup.id));
      
      if (fs.existsSync(tempFolder)) {
        // Criar pasta do floup se não existir
        if (!fs.existsSync(floupFolder)) {
          fs.mkdirSync(floupFolder, { recursive: true });
        }
        
        // Mover arquivos de temp para a pasta do floup
        const files = fs.readdirSync(tempFolder);
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
        const proxyPort = process.env.PROXY_PORT;
        const baseUrl = proxyPort ? `${backendUrl}:${proxyPort}` : backendUrl;
        
        // Atualizar URLs nos steps e mover arquivos
        const updatedSteps = stepsToSave.map((step: any) => {
          if (step.mediaUrl && step.mediaUrl.includes('/floup/temp/')) {
            // Extrair nome do arquivo da URL
            const fileName = step.mediaUrl.split('/').pop();
            const oldPath = path.join(tempFolder, fileName);
            const newPath = path.join(floupFolder, fileName);
            
            if (fs.existsSync(oldPath)) {
              // Mover arquivo
              fs.renameSync(oldPath, newPath);
              // Atualizar URL no step
              const newUrl = `${baseUrl}/public/company${config.companyId}/floup/${novoFloup.id}/${fileName}`;
              return { ...step, mediaUrl: newUrl };
            }
          }
          return step;
        });
        
        // Se houve atualizações, salvar novamente
        if (JSON.stringify(updatedSteps) !== JSON.stringify(stepsToSave)) {
          await novoFloup.update({ steps: updatedSteps });
          await novoFloup.reload();
        }
        
        // Remover pasta temp se estiver vazia
        try {
          const remainingFiles = fs.readdirSync(tempFolder);
          if (remainingFiles.length === 0) {
            fs.rmdirSync(tempFolder);
          }
        } catch {}
        
        logger.info(`[FLOUP] service.criarFloup → Arquivos movidos de temp para floup ${novoFloup.id}`);
      }
    } catch (err: any) {
      logger.warn(`[FLOUP] service.criarFloup → Erro ao mover arquivos: ${err.message}`);
    }
    
    try {
      const io = getIO();
      io.of(String(config.companyId)).emit(`company-${config.companyId}-floup`, { action: 'create', floup: novoFloup });
    } catch {}
    logger.info(`[FLOUP] service.criarFloup ✓ id=${novoFloup.id}`);
    return novoFloup;
  }

  static async duplicarFloup(id: number, companyId: number) {
    logger.info(`[FLOUP] service.duplicarFloup → id=${id}, companyId=${companyId}`);
    const original = await safeFloupQuery<Floup | null>(
      () => Floup.findByPk(id),
      () => Floup.findByPk(id, { attributes: { exclude: ['condition', 'conditionValue'] } })
    );
    if (!original || original.companyId !== companyId) return null;
    // Tentar criar com todas as colunas primeiro
    let floupDuplicado;
    try {
      floupDuplicado = await Floup.create({
        companyId,
        name: `${original.name} (Cópia)`,
        description: original.description,
        isActive: false,
        steps: original.steps,
        stopConditions: original.stopConditions || [],
        pauseConditions: original.pauseConditions || [],
        condition: (original as any).condition || 'queue',
        conditionValue: (original as any).conditionValue || ''
      });
    } catch (error: any) {
      // Se der erro por colunas não existentes, criar usando SQL direto
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        logger.warn(`[FLOUP] Colunas condition/conditionValue não existem. Criando duplicado usando SQL direto.`);
        const sequelize = Floup.sequelize;
        
        try {
          // Verificar o nome exato da tabela
          const tableCheckResult: any = await sequelize.query(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND LOWER(table_name) = LOWER('Floups')
            LIMIT 1;
          `, { type: QueryTypes.SELECT });
          
          const actualTableName = tableCheckResult && tableCheckResult.length > 0 
            ? (tableCheckResult[0] as any).table_name 
            : 'Floups';
          
          logger.info(`[FLOUP] Usando nome da tabela para duplicação: ${actualTableName}`);
          
          const stepsJson = JSON.stringify(original.steps);
          const stopConditionsJson = JSON.stringify(original.stopConditions || []);
          const pauseConditionsJson = JSON.stringify(original.pauseConditions || []);
          const now = new Date();
          
          const insertResult: any = await sequelize.query(`
            INSERT INTO "${actualTableName}" ("companyId", "name", "description", "isActive", "steps", "stopConditions", "pauseConditions", "createdAt", "updatedAt")
            VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, $9)
            RETURNING "id", "companyId", "name", "description", "isActive", "steps", "stopConditions", "pauseConditions", "templateType", "createdAt", "updatedAt";
          `, {
            bind: [
              companyId,
              `${original.name} (Cópia)`,
              original.description,
              false,
              stepsJson,
              stopConditionsJson,
              pauseConditionsJson,
              now,
              now
            ],
            type: QueryTypes.SELECT
          });
          
          logger.info(`[FLOUP] Resultado do INSERT (duplicação):`, insertResult);
          
          if (insertResult && insertResult.length > 0 && (insertResult[0] as any).id) {
            const insertedId = (insertResult[0] as any).id;
            // ✅ CORRIGIDO: Buscar via SQL direto para evitar que Sequelize tente buscar colunas inexistentes
            const selectResult: any = await sequelize.query(`
              SELECT "id", "companyId", "name", "description", "isActive", "steps", "stopConditions", "pauseConditions", "templateType", "createdAt", "updatedAt"
              FROM "${actualTableName}"
              WHERE "id" = $1
            `, {
              bind: [insertedId],
              type: QueryTypes.SELECT
            });
            
            if (selectResult && selectResult.length > 0) {
              const row = selectResult[0];
              // Construir objeto Floup manualmente (sem usar o modelo para evitar busca de colunas inexistentes)
              floupDuplicado = {
                id: row.id,
                companyId: row.companyId,
                name: row.name,
                description: row.description || '',
                isActive: row.isActive,
                steps: row.steps || [],
                stopConditions: row.stopConditions || [],
                pauseConditions: row.pauseConditions || [],
                templateType: row.templateType || null,
                createdAt: row.createdAt,
                updatedAt: row.updatedAt,
                // Adicionar métodos necessários do Sequelize Model
                save: async () => floupDuplicado,
                update: async () => floupDuplicado,
                reload: async () => floupDuplicado,
                toJSON: () => ({
                  id: row.id,
                  companyId: row.companyId,
                  name: row.name,
                  description: row.description || '',
                  isActive: row.isActive,
                  steps: row.steps || [],
                  stopConditions: row.stopConditions || [],
                  pauseConditions: row.pauseConditions || [],
                  templateType: row.templateType || null,
                  createdAt: row.createdAt,
                  updatedAt: row.updatedAt
                })
              } as any;
              logger.info(`[FLOUP] Floup duplicado criado via SQL direto com sucesso. ID: ${floupDuplicado.id}`);
            } else {
              throw new Error(`Falha ao buscar Floup duplicado criado (ID: ${insertedId}) - nenhum resultado retornado`);
            }
          } else {
            logger.error(`[FLOUP] SQL direto não retornou resultados válidos:`, JSON.stringify(insertResult));
            throw new Error('Falha ao criar Floup duplicado via SQL direto - nenhum resultado retornado');
          }
        } catch (sqlError: any) {
          logger.error(`[FLOUP] Erro ao criar Floup duplicado via SQL direto:`, sqlError);
          logger.error(`[FLOUP] Stack trace:`, sqlError.stack);
          throw new Error(`Falha ao criar Floup duplicado via SQL direto: ${sqlError.message}`);
        }
      } else {
        throw error;
      }
    }
    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-floup`, { action: 'create', floup: floupDuplicado });
    logger.info(`[FLOUP] service.duplicarFloup ✓ newId=${floupDuplicado.id}`);
    return floupDuplicado;
  }

  static async atualizarFloup(id: number, companyId: number, updates: any) {
    logger.info(`[FLOUP] service.atualizarFloup → id=${id}, companyId=${companyId}`);
    const floup = await safeFloupQuery<Floup | null>(
      () => Floup.findByPk(id),
      () => Floup.findByPk(id, { attributes: { exclude: ['condition', 'conditionValue'] } })
    );
    if (!floup || floup.companyId !== companyId) return null;
    
    // Log dos steps recebidos para debug
    if (updates.steps && updates.steps.length > 0) {
      logger.info(`[FLOUP] service.atualizarFloup → Steps recebidos: ${updates.steps.length} passos`);
      updates.steps.forEach((step: any, idx: number) => {
        logger.info(`[FLOUP] service.atualizarFloup → Passo ${idx + 1}: order=${step.order}, mediaUrl=${step.mediaUrl ? step.mediaUrl.substring(0, 100) + '...' : 'VAZIO'}, mediaType=${step.mediaType || 'N/A'}`);
      });
    }
    
    // Garantir que os steps sejam um array válido
    const stepsToSave = updates.steps && Array.isArray(updates.steps) ? updates.steps : floup.steps;
    
    // Log completo do JSON antes de salvar
    logger.info(`[FLOUP] service.atualizarFloup → JSON completo dos steps a serem salvos: ${JSON.stringify(stepsToSave, null, 2)}`);
    
    // Preparar dados para update
    const updateData: any = {
      name: updates.name || floup.name,
      description: updates.description !== undefined ? updates.description : floup.description,
      isActive: updates.isActive !== undefined ? updates.isActive : floup.isActive,
      steps: stepsToSave,
      stopConditions: updates.stopConditions !== undefined ? updates.stopConditions : floup.stopConditions,
      pauseConditions: updates.pauseConditions !== undefined ? updates.pauseConditions : floup.pauseConditions
    };
    
    // Tentar adicionar condition e conditionValue se existirem
    try {
      // Verificar se as colunas existem tentando acessá-las
      if ((floup as any).condition !== undefined || updates.condition !== undefined) {
        updateData.condition = updates.condition !== undefined ? updates.condition : ((floup as any).condition || 'queue');
      }
      if ((floup as any).conditionValue !== undefined || updates.conditionValue !== undefined) {
        updateData.conditionValue = updates.conditionValue !== undefined ? updates.conditionValue : ((floup as any).conditionValue || '');
      }
    } catch {
      // Se não conseguir acessar, não incluir essas colunas
    }
    
    // Tentar atualizar com todas as colunas primeiro
    try {
      await floup.update(updateData);
    } catch (error: any) {
      // Se der erro por colunas não existentes, atualizar sem essas colunas
      if (error.message && error.message.includes('column') && error.message.includes('does not exist')) {
        logger.warn(`[FLOUP] Colunas condition/conditionValue não existem. Atualizando sem elas.`);
        delete updateData.condition;
        delete updateData.conditionValue;
        await floup.update(updateData);
      } else {
        throw error;
      }
    }
    
    // Recarregar o floup para garantir que os dados estão atualizados
    await floup.reload();
    
    // Log dos steps salvos para verificar
    if (floup.steps && floup.steps.length > 0) {
      logger.info(`[FLOUP] service.atualizarFloup → Steps salvos: ${floup.steps.length} passos`);
      floup.steps.forEach((step: any, idx: number) => {
        logger.info(`[FLOUP] service.atualizarFloup → Passo ${idx + 1} salvo: order=${step.order}, mediaUrl=${step.mediaUrl ? step.mediaUrl.substring(0, 100) + '...' : 'VAZIO'}, mediaType=${step.mediaType || 'N/A'}`);
      });
    } else {
      logger.warn(`[FLOUP] service.atualizarFloup → Nenhum step encontrado após salvar!`);
    }
    
    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-floup`, { action: 'update', floup });
    logger.info(`[FLOUP] service.atualizarFloup ✓ id=${id}`);
    return floup;
  }

  static async removerFloup(id: number, companyId: number): Promise<boolean> {
    logger.info(`[FLOUP] service.removerFloup → id=${id}, companyId=${companyId}`);
    const floup = await safeFloupQuery<Floup | null>(
      () => Floup.findByPk(id),
      () => Floup.findByPk(id, { attributes: { exclude: ['condition', 'conditionValue'] } })
    );
    if (!floup || floup.companyId !== companyId) return false;
    
    // Deletar todas as mídias do floup
    try {
      const fs = require('fs');
      const path = require('path');
      const publicFolder = path.resolve(__dirname, '..', '..', '..', 'public');
      const floupFolder = path.join(publicFolder, `company${companyId}`, 'floup', String(id));
      
      if (fs.existsSync(floupFolder)) {
        // Deletar todos os arquivos na pasta do floup
        const files = fs.readdirSync(floupFolder);
        files.forEach((file: string) => {
          try {
            const filePath = path.join(floupFolder, file);
            if (fs.statSync(filePath).isFile()) {
              fs.unlinkSync(filePath);
              logger.info(`[FLOUP] service.removerFloup → Arquivo deletado: ${filePath}`);
            }
          } catch (err: any) {
            logger.warn(`[FLOUP] service.removerFloup → Erro ao deletar arquivo ${file}: ${err.message}`);
          }
        });
        
        // Remover a pasta do floup
        try {
          fs.rmdirSync(floupFolder);
          logger.info(`[FLOUP] service.removerFloup → Pasta deletada: ${floupFolder}`);
        } catch (err: any) {
          logger.warn(`[FLOUP] service.removerFloup → Erro ao deletar pasta: ${err.message}`);
        }
      }
      
      // Também deletar mídias que possam estar nos steps (URLs antigas)
      if (floup.steps && Array.isArray(floup.steps)) {
        const backendUrl = process.env.BACKEND_URL || 'http://localhost:8080';
        const proxyPort = process.env.PROXY_PORT;
        const baseUrl = proxyPort ? `${backendUrl}:${proxyPort}` : backendUrl;
        
        floup.steps.forEach((step: any) => {
          if (step.mediaUrl && step.mediaUrl.includes(`/floup/${id}/`)) {
            try {
              // Extrair caminho do arquivo da URL
              const urlPath = step.mediaUrl.split('/public/')[1];
              if (urlPath) {
                const filePath = path.join(publicFolder, urlPath);
                if (fs.existsSync(filePath)) {
                  fs.unlinkSync(filePath);
                  logger.info(`[FLOUP] service.removerFloup → Mídia deletada: ${filePath}`);
                }
              }
            } catch (err: any) {
              logger.warn(`[FLOUP] service.removerFloup → Erro ao deletar mídia do step: ${err.message}`);
            }
          }
        });
      }
    } catch (err: any) {
      logger.warn(`[FLOUP] service.removerFloup → Erro ao deletar mídias: ${err.message}`);
    }
    
    const removed = await FloupSchedule.destroy({ where: { floupId: id, companyId } });
    await floup.destroy();
    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-floup`, { action: 'delete', floupId: id });
    io.of(String(companyId)).emit(`company-${companyId}-floup-schedule`, { action: 'bulk_delete', floupId: id, removedCount: removed });
    logger.info(`[FLOUP] service.removerFloup ✓ id=${id}, removedSchedules=${removed}`);
    return true;
  }

  static async agendarFloup(floupId: number, companyId: number, ticketId: number) {
    logger.info(`[FLOUP] service.agendarFloup → floupId=${floupId}, ticketId=${ticketId}, companyId=${companyId}`);
    const floup = await safeFloupQuery<Floup | null>(
      () => Floup.findByPk(floupId),
      () => Floup.findByPk(floupId, { attributes: { exclude: ['condition', 'conditionValue'] } })
    );
    if (!floup || floup.companyId !== companyId) return null;
    const firstStep = (floup.steps || [])[0];
    if (!firstStep) throw new Error('Floup não possui passos configurados');
    const initialNextRunAt = this.calcularProximoHorario({ mode: 'fixedTime', time: firstStep.time || '08:00' });
    const agendamento = await FloupSchedule.create({ companyId, ticketId, floupId, currentStepIndex: 0, nextRunAt: initialNextRunAt, status: 'PENDING' });
    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-floup-schedule`, { action: 'create', agendamento });
    logger.info(`[FLOUP] service.agendarFloup ✓ scheduleId=${agendamento.id}`);
    return agendamento;
  }

  static async cancelarAgendamento(scheduleId: number, companyId: number): Promise<boolean> {
    logger.info(`[FLOUP] service.cancelarAgendamento → scheduleId=${scheduleId}, companyId=${companyId}`);
    const agendamento = await FloupSchedule.findByPk(scheduleId);
    if (!agendamento || agendamento.companyId !== companyId) return false;
    await agendamento.destroy();
    const io = getIO();
    io.of(String(companyId)).emit(`company-${companyId}-floup-schedule`, { action: 'delete', scheduleId });
    logger.info(`[FLOUP] service.cancelarAgendamento ✓ scheduleId=${scheduleId}`);
    return true;
  }

  static async listarAgendamentos(companyId: number, ticketId?: number) {
    logger.info(`[FLOUP] service.listarAgendamentos → companyId=${companyId}, ticketId=${ticketId}`);
    const where: any = { companyId };
    if (ticketId) where.ticketId = ticketId;
    const agendamentos = await FloupSchedule.findAll({ where, include: [{ model: Floup, as: 'floup', attributes: ['id', 'name', 'description', 'isActive'] }], order: [['nextRunAt', 'ASC']] });
    logger.info(`[FLOUP] service.listarAgendamentos ✓ count=${agendamentos.length}`);
    return agendamentos;
  }

  static async listarAgendamentosPorFloup(floupId: number, companyId: number) {
    logger.info(`[FLOUP] service.listarAgendamentosPorFloup → floupId=${floupId}, companyId=${companyId}`);
    return FloupSchedule.findAll({ where: { floupId, companyId }, order: [['nextRunAt', 'ASC']] });
  }

  static async verificarCondicoesParada(ticketId: number, companyId: number, stopConditions: any[]): Promise<boolean> {
    try {
      if (!stopConditions || stopConditions.length === 0) return false;
      const Ticket = (await import('../../models/Ticket')).default;
      const Message = (await import('../../models/Message')).default;
      const Contact = (await import('../../models/Contact')).default;
      const ContactTag = (await import('../../models/ContactTag')).default;
      const Tag = (await import('../../models/Tag')).default;
      const ticket = await Ticket.findByPk(ticketId, { include: [{ model: Contact, as: 'contact', include: [{ model: ContactTag, as: 'contactTags', include: [{ model: Tag, as: 'tag' }] }] }] });
      if (!ticket) return false;
      
      for (const condition of stopConditions) {
        if (!condition.enabled) continue;
        
        // 1. Caso o Contato responder qualquer mensagem
        if (condition.type === 'anyMessage') {
          // Verificar mensagens do contato nas últimas 24 horas
          const { Op } = require('sequelize');
          const twentyFourHoursAgo = new Date();
          twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24);
          
          const contactMessages = await Message.findAll({
            where: {
              ticketId,
              fromMe: false,
              createdAt: {
                [Op.gte]: twentyFourHoursAgo
              }
            },
            limit: 1,
            order: [['createdAt', 'DESC']]
          });
          if (contactMessages.length > 0) {
            logger.info(`[FLOUP] verificarCondicoesParada → Condição 'anyMessage' atendida para ticketId=${ticketId}`);
            return true;
          }
        }
        
        // 2. Caso o Contato responder uma Palavra chave
        if (condition.type === 'keyword' && condition.keyword) {
          const keyword = condition.keyword.trim().toLowerCase();
          if (keyword) {
            const contactMessages = await Message.findAll({
              where: {
                ticketId,
                fromMe: false
              },
              order: [['createdAt', 'DESC']],
              limit: 10 // Verificar últimas 10 mensagens do contato
            });
            for (const msg of contactMessages) {
              const messageBody = (msg.body || '').toLowerCase();
              if (messageBody.includes(keyword)) {
                logger.info(`[FLOUP] verificarCondicoesParada → Condição 'keyword' (${keyword}) atendida para ticketId=${ticketId}`);
                return true;
              }
            }
          }
        }
        
        // 3. Caso o Ticket for Fechado
        if (condition.type === 'ticketClosed') {
          if (ticket.status === 'closed') {
            logger.info(`[FLOUP] verificarCondicoesParada → Condição 'ticketClosed' atendida para ticketId=${ticketId}`);
            return true;
          }
        }
        
        // Manter compatibilidade com condições antigas (tag)
        if (condition.type === 'tag') {
          const contactTags = ticket.contact.contactTags || [];
          const hasTag = contactTags.some((ct: any) => ct.tag.name === condition.tagName);
          if ((condition.operator === 'equals' && hasTag) || (condition.operator === 'not_equals' && !hasTag)) return true;
        }
      }
      return false;
    } catch (error) {
      logger.error(`[FLOUP] verificarCondicoesParada → Erro:`, error);
      return false;
    }
  }

  static async verificarCondicoesPausa(ticketId: number, companyId: number, pauseConditions: any[]): Promise<boolean> {
    try {
      if (!pauseConditions || pauseConditions.length === 0) return false;
      const Ticket = (await import('../../models/Ticket')).default;
      const Contact = (await import('../../models/Contact')).default;
      const ContactTag = (await import('../../models/ContactTag')).default;
      const Tag = (await import('../../models/Tag')).default;
      const ticket = await Ticket.findByPk(ticketId, { include: [{ model: Contact, as: 'contact', include: [{ model: ContactTag, as: 'contactTags', include: [{ model: Tag, as: 'tag' }] }] }] });
      if (!ticket) return false;
      for (const condition of pauseConditions) {
        if (condition.type === 'tag') {
          const contactTags = ticket.contact.contactTags || [];
          const hasTag = contactTags.some((ct: any) => ct.tag.name === condition.tagName);
          if ((condition.operator === 'equals' && hasTag) || (condition.operator === 'not_equals' && !hasTag)) return true;
        }
      }
      return false;
    } catch {
      return false;
    }
  }

  static calcularProximoHorario(step: any, lastInteraction?: Date): Date {
    const now = new Date();
    
    // Se não tem mode, inferir baseado nas propriedades do step
    let mode = step.mode;
    if (!mode) {
      if (step.time) {
        mode = 'fixedTime';
      } else if (step.timeValue && step.timeUnit) {
        mode = 'interval';
      } else {
        mode = 'interval'; // Padrão: intervalo
      }
    }
    
    switch (mode) {
      case 'fixedTime': {
        const [hours, minutes] = (step.time || '08:00').split(':');
        const nextRun = new Date();
        nextRun.setHours(parseInt(hours) || 8);
        nextRun.setMinutes(parseInt(minutes) || 0);
        nextRun.setSeconds(0);
        nextRun.setMilliseconds(0);
        if (nextRun <= now) nextRun.setDate(nextRun.getDate() + 1);
        return nextRun;
      }
      case 'afterLastInteraction': {
        if (lastInteraction) {
          const timeValue = step.timeValue || step.afterMinutes || 0;
          const timeUnit = step.timeUnit || 'minutes';
          const minutesToAdd = this.convertTimeToMinutes(timeValue, timeUnit);
          const nextRunInteraction = new Date(lastInteraction);
          nextRunInteraction.setMinutes(nextRunInteraction.getMinutes() + minutesToAdd);
          return nextRunInteraction;
        }
        // Se não tem lastInteraction, usar timeValue/timeUnit como intervalo a partir de agora
        const timeValue = step.timeValue || 0;
        const timeUnit = step.timeUnit || 'minutes';
        return this.addTimeToDate(now, timeValue, timeUnit);
      }
      case 'afterLastAttendant': {
        if (lastInteraction) {
          const timeValue = step.timeValue || step.afterMinutes || 0;
          const timeUnit = step.timeUnit || 'minutes';
          const minutesToAdd = this.convertTimeToMinutes(timeValue, timeUnit);
          const nextRunAttendant = new Date(lastInteraction);
          nextRunAttendant.setMinutes(nextRunAttendant.getMinutes() + minutesToAdd);
          return nextRunAttendant;
        }
        // Se não tem lastInteraction, usar timeValue/timeUnit como intervalo a partir de agora
        const timeValue = step.timeValue || 0;
        const timeUnit = step.timeUnit || 'minutes';
        return this.addTimeToDate(now, timeValue, timeUnit);
      }
      case 'interval': {
        const timeValue = step.timeValue || step.intervalDays || 1;
        const timeUnit = step.timeUnit || 'days';
        return this.addTimeToDate(now, timeValue, timeUnit);
      }
      default: {
        // Fallback: usar timeValue/timeUnit se disponível
        if (step.timeValue && step.timeUnit) {
          return this.addTimeToDate(now, step.timeValue, step.timeUnit);
        }
        // Se não tem nada, executar imediatamente
        return now;
      }
    }
  }

  // Método auxiliar para converter tempo para minutos
  static convertTimeToMinutes(value: number, unit: string): number {
    switch (unit) {
      case 'minutes': return value;
      case 'hours': return value * 60;
      case 'days': return value * 24 * 60;
      case 'weeks': return value * 7 * 24 * 60;
      case 'months': return value * 30 * 24 * 60;
      case 'years': return value * 365 * 24 * 60;
      default: return value;
    }
  }

  // Método auxiliar para adicionar tempo a uma data
  static addTimeToDate(date: Date, value: number, unit: string): Date {
    const result = new Date(date);
    switch (unit) {
      case 'minutes':
        result.setMinutes(result.getMinutes() + value);
        break;
      case 'hours':
        result.setHours(result.getHours() + value);
        break;
      case 'days':
        result.setDate(result.getDate() + value);
        break;
      case 'weeks':
        result.setDate(result.getDate() + (value * 7));
        break;
      case 'months':
        result.setMonth(result.getMonth() + value);
        break;
      case 'years':
        result.setFullYear(result.getFullYear() + value);
        break;
      default:
        result.setMinutes(result.getMinutes() + value);
    }
    return result;
  }

  static async executarPasso(floupId: number, ticketId: number, stepIndex: number) {
    logger.info(`[FLOUP] service.executarPasso → floupId=${floupId}, ticketId=${ticketId}, stepIndex=${stepIndex}`);
    const floup = await safeFloupQuery<Floup | null>(
      () => Floup.findByPk(floupId),
      () => Floup.findByPk(floupId, { attributes: { exclude: ['condition', 'conditionValue'] } })
    );
    if (!floup || !floup.steps || stepIndex >= floup.steps.length) return false;
    const step = (floup.steps as any[])[stepIndex];
    const Ticket = (await import('../../models/Ticket')).default;
    const Contact = (await import('../../models/Contact')).default;
    const ticket = await Ticket.findByPk(ticketId, { include: [{ model: Contact, as: 'contact' }] });
    if (!ticket) return false;
    
    // Verificar condições de parada
    const shouldStop = await this.verificarCondicoesParada(ticketId, floup.companyId, floup.stopConditions || []);
    if (shouldStop) {
      logger.info(`[FLOUP] service.executarPasso → Condições de parada atendidas, cancelando`);
      return false;
    }
    
    // Verificar condições de pausa
    const shouldPause = await this.verificarCondicoesPausa(ticketId, floup.companyId, floup.pauseConditions || []);
    if (shouldPause) {
      logger.info(`[FLOUP] service.executarPasso → Condições de pausa atendidas, pausando`);
      return false;
    }
    let sent = false;
    if (ticket.channel === 'evolution') {
      // Fallback: canal evolution não implementado neste projeto
      sent = false;
    } else if (ticket.channel === 'whatsapp') {
      sent = await this.sendWhatsAppMessage(ticket, step);
    } else if (ticket.channel === 'whatsapp_oficial') {
      sent = await this.sendWhatsAppOficialMessage(ticket, step);
    } else if (["facebook", "instagram"].includes(ticket.channel)) {
      sent = await this.sendFacebookMessage(ticket, step);
    }
    if (sent && step.tagOnSend) {
      await this.applyTagToTicket(ticketId, step.tagOnSend, floup.companyId);
    }
    logger.info(`[FLOUP] service.executarPasso ✓ sent=${sent}`);
    return sent;
  }

  static async sendEvolutionMessage(ticket: any, step: any): Promise<boolean> { return false; }

  static async sendWhatsAppMessage(ticket: any, step: any): Promise<boolean> {
    try {
      if (step.mediaUrl) {
        const fs = require('fs');
        const path = require('path');
        const publicFolder = path.resolve(__dirname, '..', '..', '..', 'public');
        const companyFolder = path.join(publicFolder, `company${ticket.companyId}`);
        const floupFolder = path.join(companyFolder, 'floup');
        
        // Verificar se é uma data URI (data:image/jpeg;base64,...)
        if (step.mediaUrl.startsWith('data:')) {
          // Extrair mime type e dados base64
          const matches = step.mediaUrl.match(/^data:([^;]+);base64,(.+)$/);
          if (!matches || matches.length < 3) {
            throw new Error('Formato de data URI inválido');
          }
          
          const mimeType = matches[1];
          const base64Data = matches[2];
          
          // Converter base64 para buffer
          const buffer = Buffer.from(base64Data, 'base64');
          
          // Determinar extensão do arquivo baseado no mime type
          const extension = mimeType.split('/')[1]?.split(';')[0] || 'jpg';
          const timestamp = Date.now();
          const filename = `floup_${timestamp}.${extension}`;
          
          // Garantir que a pasta existe
          if (!fs.existsSync(floupFolder)) {
            fs.mkdirSync(floupFolder, { recursive: true });
          }
          
          // Salvar em arquivo temporário
          const tempPath = path.join(floupFolder, filename);
          fs.writeFileSync(tempPath, buffer);
          
          // O caminho deve ser relativo à pasta public
          const relativePath = `company${ticket.companyId}/floup/${filename}`;
          const defaultSendWhatsAppMedia = (await import('../../services/WbotServices/SendWhatsAppMedia')).default as any;
          await defaultSendWhatsAppMedia({ 
            media: { 
              filename, 
              path: relativePath, 
              mimetype: mimeType,
              originalname: filename
            } as any, 
            ticket, 
            body: step.message 
          });
          
          // Limpar arquivo temporário após envio
          setTimeout(() => {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          }, 5000);
        } else if (step.mediaUrl.startsWith('http://') || step.mediaUrl.startsWith('https://')) {
          // Para URLs, fazer download temporário
          const https = require('https');
          const http = require('http');
          
          if (!fs.existsSync(floupFolder)) {
            fs.mkdirSync(floupFolder, { recursive: true });
          }
          
          const filename = this.getFilenameFromUrl(step.mediaUrl) || `floup_${Date.now()}.jpg`;
          const timestamp = Date.now();
          const tempPath = path.join(floupFolder, `${timestamp}_${filename}`);
          
          // Download da URL
          await new Promise((resolve, reject) => {
            const protocol = step.mediaUrl.startsWith('https://') ? https : http;
            const file = fs.createWriteStream(tempPath);
            protocol.get(step.mediaUrl, (response: any) => {
              response.pipe(file);
              file.on('finish', () => {
                file.close();
                resolve(true);
              });
            }).on('error', (err: any) => {
              if (fs.existsSync(tempPath)) {
                fs.unlinkSync(tempPath);
              }
              reject(err);
            });
          });
          
          // Enviar mídia do arquivo baixado
          // O caminho deve ser relativo à pasta public (ex: company1/floup/1234567890_image.jpg)
          const relativePath = `company${ticket.companyId}/floup/${timestamp}_${filename}`;
          const defaultSendWhatsAppMedia = (await import('../../services/WbotServices/SendWhatsAppMedia')).default as any;
          await defaultSendWhatsAppMedia({ 
            media: { 
              filename, 
              path: relativePath, 
              mimetype: this.getMimeTypeFromUrl(step.mediaUrl),
              originalname: filename
            } as any, 
            ticket, 
            body: step.message 
          });
          
          // Limpar arquivo temporário após envio
          setTimeout(() => {
            if (fs.existsSync(tempPath)) {
              fs.unlinkSync(tempPath);
            }
          }, 5000);
        } else {
          // Arquivo local - pode ser caminho relativo (company1/floup/arquivo.jpg) ou URL completa do backend
          let mediaPath = step.mediaUrl;
          
          // Se for uma URL do backend (ex: http://localhost:3000/public/company1/floup/arquivo.jpg)
          // Extrair o caminho relativo
          if (mediaPath.includes('/public/')) {
            mediaPath = mediaPath.split('/public/')[1];
          }
          
          // Se não começar com "company", adicionar
          if (!mediaPath.startsWith('company')) {
            mediaPath = `company${ticket.companyId}/floup/${mediaPath}`;
          }
          
          const defaultSendWhatsAppMedia = (await import('../../services/WbotServices/SendWhatsAppMedia')).default as any;
          await defaultSendWhatsAppMedia({ 
            media: { 
              filename: this.getFilenameFromUrl(step.mediaUrl), 
              path: mediaPath, 
              mimetype: this.getMimeTypeFromUrl(step.mediaUrl),
              originalname: this.getFilenameFromUrl(step.mediaUrl)
            } as any, 
            ticket, 
            body: step.message 
          });
        }
      } else {
        const defaultSendWhatsAppMessage = (await import('../../services/WbotServices/SendWhatsAppMessage')).default as any;
        await defaultSendWhatsAppMessage({ body: step.message, ticket });
      }
      return true;
    } catch (error) {
      logger.error(`[FLOUP] service.sendWhatsAppMessage → Erro:`, error);
      return false;
    }
  }

  static async sendWhatsAppOficialMessage(ticket: any, step: any): Promise<boolean> {
    try {
      const SendWhatsAppOficialMessage = (await import('../../services/WhatsAppOficial/SendWhatsAppOficialMessage')).default as any;
      if (step.mediaUrl) {
        await SendWhatsAppOficialMessage({ body: step.message, ticket, type: 'document', media: { path: step.mediaUrl, mimetype: this.getMimeTypeFromUrl(step.mediaUrl), originalname: this.getFilenameFromUrl(step.mediaUrl) } });
      } else {
        await SendWhatsAppOficialMessage({ body: step.message, ticket, type: 'text', media: null });
      }
      return true;
    } catch {
      return false;
    }
  }

  static async sendFacebookMessage(ticket: any, step: any): Promise<boolean> {
    try {
      const mod = await import('../../services/FacebookServices/sendFacebookMessage');
      await mod.sendFacebookMessage({ body: step.message, ticket });
      return true;
    } catch {
      return false;
    }
  }

  static async applyTagToTicket(ticketId: number, tagName: string, companyId: number): Promise<void> {
    try {
      const Tag = (await import('../../models/Tag')).default;
      const TicketTag = (await import('../../models/TicketTag')).default;
      let tag = await Tag.findOne({ where: { name: tagName, companyId } });
      if (!tag) {
        tag = await Tag.create({ name: tagName, color: '#000000', companyId });
      }
      const existingTag = await TicketTag.findOne({ where: { ticketId, tagId: tag.id } });
      if (!existingTag) {
        await TicketTag.create({ ticketId, tagId: tag.id });
      }
    } catch {}
  }

  static getMimeTypeFromUrl(url: string): string {
    const extension = url.split('.').pop()?.toLowerCase();
    const mimeTypes: { [key: string]: string } = {
      jpg: 'image/jpeg',
      jpeg: 'image/jpeg',
      png: 'image/png',
      gif: 'image/gif',
      mp4: 'video/mp4',
      avi: 'video/avi',
      mp3: 'audio/mpeg',
      wav: 'audio/wav',
      pdf: 'application/pdf',
      doc: 'application/msword',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    };
    return mimeTypes[extension || ''] || 'application/octet-stream';
  }

  static getFilenameFromUrl(url: string): string {
    return url.split('/').pop() || `floup_media_${Date.now()}`;
  }
  // Atrelar floup a um contato
  static async atrelarFloupAContato(floupId: number, companyId: number, contactId: number, ticketId?: number) {
    logger.info(`[FLOUP] service.atrelarFloupAContato → floupId=${floupId}, contactId=${contactId}, ticketId=${ticketId}, companyId=${companyId}`);
    const floup = await safeFloupQuery<Floup | null>(
      () => Floup.findOne({ where: { id: floupId, companyId, isActive: true } }),
      () => Floup.findOne({ 
        where: { id: floupId, companyId, isActive: true },
        attributes: { exclude: ['condition', 'conditionValue'] }
      })
    );
    if (!floup) return null;
    const existing = await FloupSchedule.findOne({ where: { contactId, companyId, status: 'PENDING' } });
    if (existing) throw new Error('Já existe um floup ativo para este contato');
    const schedules: FloupSchedule[] = [] as any;
    const now = new Date();
    
    // Buscar última interação do contato se necessário
    let lastInteraction: Date | undefined;
    if (ticketId) {
      const Ticket = (await import('../../models/Ticket')).default;
      const Message = (await import('../../models/Message')).default;
      const lastMessage = await Message.findOne({
        where: { ticketId, fromMe: false },
        order: [['createdAt', 'DESC']]
      });
      if (lastMessage) {
        lastInteraction = lastMessage.createdAt;
      }
    }
    
    // Criar apenas um schedule inicial para o primeiro passo
    const firstStep = floup.steps[0];
    if (!firstStep) {
      throw new Error('Floup não possui passos configurados');
    }
    
    // Calcular horário do primeiro passo
    let nextRunAt = this.calcularProximoHorario(firstStep, lastInteraction);
    // Para modo interval sem valor, aplicar mínimo de 1 minuto.
    // Para fixedTime, respeitar o horário configurado.
    const isImmediateInterval = (firstStep.mode === 'interval' || !firstStep.mode) && 
                                 (!firstStep.timeValue || firstStep.timeValue === 0);
    if (isImmediateInterval && (nextRunAt <= now || (nextRunAt.getTime() - now.getTime()) < 60000)) {
      nextRunAt = new Date(now.getTime() + 60000); // 1 minuto a partir de agora
    } else if (firstStep.mode !== 'fixedTime' && nextRunAt <= now) {
      // Para outros modos que resultarem no passado, adicionar 1 minuto
      nextRunAt = new Date(now.getTime() + 60000);
    }
    
    const schedule = await FloupSchedule.create({
      floupId: floup.id,
      contactId,
      ticketId,
      stepOrder: firstStep.order || 1,
      stepData: firstStep,
      currentStepIndex: 0,
      nextRunAt,
      status: 'PENDING',
      companyId
    });
    schedules.push(schedule);
    logger.info(`[FLOUP] service.atrelarFloupAContato → Primeiro passo agendado para ${nextRunAt.toISOString()}`);
    
    // Emitir evento Socket.IO para atualizar o frontend imediatamente
    try {
      const io = getIO();
      // Buscar o schedule completo com relacionamentos para enviar ao frontend
      const scheduleWithRelations = await FloupSchedule.findByPk(schedule.id, {
        include: [
          { model: Floup, as: 'floup', attributes: ['id', 'name', 'description', 'isActive', 'steps'] },
          { model: Contact, as: 'contact', attributes: ['id', 'name', 'number'] }
        ]
      });
      
      // Emitir evento para o frontend atualizar imediatamente
      io.of(String(companyId)).emit(`company-${companyId}-floup-assigned`, {
        action: 'assign',
        contactId,
        floupId,
        ticketId,
        schedule: scheduleWithRelations,
        schedulesCount: schedules.length
      });
      
      // Também emitir evento de schedule criado (para compatibilidade)
      io.of(String(companyId)).emit(`company-${companyId}-floup-schedule`, {
        action: 'create',
        agendamento: scheduleWithRelations
      });
      
      logger.info(`[FLOUP] service.atrelarFloupAContato → Eventos Socket.IO emitidos: floup-assigned e floup-schedule`);
    } catch (socketError: any) {
      logger.error(`[FLOUP] service.atrelarFloupAContato → Erro ao emitir eventos Socket.IO: ${socketError.message}`);
    }
    
    logger.info(`[FLOUP] service.atrelarFloupAContato ✓ schedules=${schedules.length}`);
    return { floup, schedules };
  }

  // Parar floup para um contato
  static async pararFloupParaContato(floupId: number, companyId: number, contactId: number): Promise<boolean> {
    logger.info(`[FLOUP] service.pararFloupParaContato → floupId=${floupId}, contactId=${contactId}, companyId=${companyId}`);
    
    // Buscar TODOS os schedules (não apenas pendentes) para ter visibilidade completa
    const todosSchedules = await FloupSchedule.findAll({ 
      where: { floupId, contactId, companyId },
      attributes: ['id', 'status']
    });
    
    logger.info(`[FLOUP] service.pararFloupParaContato → Encontrados ${todosSchedules.length} schedules totais`);
    
    // Buscar schedules pendentes para cancelar
    const pendentes = todosSchedules.filter(s => s.status === 'PENDING');
    
    logger.info(`[FLOUP] service.pararFloupParaContato → Encontrados ${pendentes.length} schedules pendentes`);
    
    if (pendentes.length > 0) {
      // Se há schedules pendentes, cancelar TODOS eles de forma explícita
      const idsPendentes = pendentes.map(s => s.id);
      logger.info(`[FLOUP] service.pararFloupParaContato → Cancelando schedules com IDs: ${idsPendentes.join(', ')}`);
      
      const resultado = await FloupSchedule.update(
        { status: 'CANCELLED' }, 
        { where: { id: { [require('sequelize').Op.in]: idsPendentes } } }
      );
      
      logger.info(`[FLOUP] service.pararFloupParaContato → Update retornou: ${JSON.stringify(resultado)}`);
      
      // Verificar se realmente foram cancelados
      const pendentesAposUpdate = await FloupSchedule.findAll({ 
        where: { id: { [require('sequelize').Op.in]: idsPendentes }, status: 'PENDING' },
        attributes: ['id', 'status', 'floupId', 'contactId', 'companyId']
      });
      
      if (pendentesAposUpdate.length > 0) {
        logger.error(`[FLOUP] service.pararFloupParaContato → ERRO: Ainda há ${pendentesAposUpdate.length} schedules pendentes após update! IDs: ${pendentesAposUpdate.map(s => s.id).join(', ')}`);
        // Tentar novamente com where mais específico usando os IDs
        const idsParaForcar = pendentesAposUpdate.map(s => s.id);
        const resultadoForcado = await FloupSchedule.update(
          { status: 'CANCELLED' }, 
          { where: { id: { [require('sequelize').Op.in]: idsParaForcar } } }
        );
        logger.info(`[FLOUP] service.pararFloupParaContato → Cancelamento forçado: ${resultadoForcado[0]} schedules atualizados`);
        
        // Verificar uma última vez
        const pendentesAposForcar = await FloupSchedule.findAll({ 
          where: { id: { [require('sequelize').Op.in]: idsParaForcar }, status: 'PENDING' },
          attributes: ['id', 'status']
        });
        if (pendentesAposForcar.length > 0) {
          logger.error(`[FLOUP] service.pararFloupParaContato → ERRO CRÍTICO: Ainda há ${pendentesAposForcar.length} schedules pendentes após cancelamento forçado!`);
        }
      }
      
      try { 
        const io = getIO(); 
        io.of(String(companyId)).emit(`company-${companyId}-floup-stopped`, { 
          action: 'stop', 
          contactId, 
          floupId, 
          cancelledSchedules: pendentes.length 
        }); 
      } catch (err) {
        logger.error(`[FLOUP] service.pararFloupParaContato → Erro ao emitir socket event:`, err);
      }
      
      logger.info(`[FLOUP] service.pararFloupParaContato ✓ cancelled=${pendentes.length}`);
      return true;
    }
    
    // Verificar se existe algum schedule do floup para este contato (mesmo que já concluído)
    if (todosSchedules.length > 0) {
      // Se existe schedule mas não está pendente, significa que já foi concluído ou cancelado
      const statusCounts = todosSchedules.reduce((acc, s) => {
        acc[s.status] = (acc[s.status] || 0) + 1;
        return acc;
      }, {} as any);
      logger.info(`[FLOUP] service.pararFloupParaContato → Floup já foi processado. Status: ${JSON.stringify(statusCounts)}`);
      // Retornar true mesmo assim, pois tecnicamente o floup não está mais ativo
      return true;
    }
    
    // Se não encontrou nenhum schedule, retornar false
    logger.warn(`[FLOUP] service.pararFloupParaContato → Nenhum schedule encontrado para floupId=${floupId}, contactId=${contactId}`);
    return false;
  }

  // Verificar e cancelar Floups quando contato envia mensagem
  static async verificarECancelarFloupsAoReceberMensagem(ticketId: number, contactId: number, companyId: number, messageBody?: string): Promise<void> {
    try {
      if (!contactId) return;
      
      logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → ticketId=${ticketId}, contactId=${contactId}, companyId=${companyId}`);
      
      // Buscar todos os Floups ativos para este contato
      const schedulesAtivos = await FloupSchedule.findAll({
        where: { 
          contactId, 
          companyId, 
          status: 'PENDING' 
        },
        include: [
          {
            model: Floup,
            as: 'floup',
            attributes: ['id', 'name', 'stopConditions']
          }
        ]
      });
      
      if (schedulesAtivos.length === 0) {
        logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Nenhum Floup ativo para contato ${contactId}`);
        return;
      }
      
      logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Encontrados ${schedulesAtivos.length} Floups ativos`);
      
      // Para cada Floup ativo, verificar condições de parada
      for (const schedule of schedulesAtivos) {
        const floup = schedule.floup;
        if (!floup || !floup.stopConditions || floup.stopConditions.length === 0) {
          continue;
        }
        
        const stopConditions = floup.stopConditions || [];
        let shouldCancel = false;
        
        for (const condition of stopConditions) {
          if (!condition.enabled) continue;
          
          // 1. Caso o Contato responder qualquer mensagem
          if (condition.type === 'anyMessage') {
            logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Condição 'anyMessage' ativa para Floup ${floup.id}`);
            shouldCancel = true;
            break;
          }
          
          // 2. Caso o Contato responder uma Palavra chave
          if (condition.type === 'keyword' && condition.keyword && messageBody) {
            const keyword = condition.keyword.trim().toLowerCase();
            const body = messageBody.toLowerCase();
            if (keyword && body.includes(keyword)) {
              logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Condição 'keyword' (${keyword}) atendida para Floup ${floup.id}`);
              shouldCancel = true;
              break;
            }
          }
          
          // 3. Caso o Ticket for Fechado - verificar status do ticket
          if (condition.type === 'ticketClosed') {
            const Ticket = (await import('../../models/Ticket')).default;
            const ticket = await Ticket.findByPk(ticketId);
            if (ticket && ticket.status === 'closed') {
              logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Condição 'ticketClosed' atendida para Floup ${floup.id}`);
              shouldCancel = true;
              break;
            }
          }
        }
        
        if (shouldCancel) {
          // Cancelar todos os schedules pendentes deste Floup para este contato
          const cancelled = await FloupSchedule.update(
            { status: 'CANCELLED' }, 
            { 
              where: { 
                floupId: floup.id, 
                contactId, 
                companyId, 
                status: 'PENDING' 
              } 
            }
          );
          
          logger.info(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Floup ${floup.id} cancelado para contato ${contactId}. Schedules cancelados: ${cancelled[0]}`);
          
          try {
            const io = getIO();
            io.of(String(companyId)).emit(`company-${companyId}-floup-stopped`, { 
              action: 'stop', 
              contactId, 
              floupId: floup.id, 
              reason: 'stop_condition_met',
              cancelledSchedules: cancelled[0] 
            });
          } catch (ioError) {
            // Ignorar erros de socket
          }
        }
      }
    } catch (error) {
      logger.error(`[FLOUP] verificarECancelarFloupsAoReceberMensagem → Erro:`, error);
    }
  }

  // Verificar e iniciar Floups quando tag é adicionada ao contato
  static async verificarEIniciarFloupsAoAdicionarTag(contactId: number, companyId: number, tagName: string): Promise<void> {
    try {
      if (!contactId || !tagName) {
        logger.warn(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Parâmetros inválidos: contactId=${contactId}, tagName=${tagName}`);
        return;
      }
      
      logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → contactId=${contactId}, tagName="${tagName}", companyId=${companyId}`);
      
      // Buscar todos os Floups ativos da empresa
      const floupsAtivos = await safeFloupQuery<Floup[]>(
        () => Floup.findAll({
          where: { 
            companyId, 
            isActive: true 
          }
        }),
        () => Floup.findAll({
          where: { 
            companyId, 
            isActive: true 
          },
          attributes: { exclude: ['condition', 'conditionValue'] }
        })
      );
      
      if (floupsAtivos.length === 0) {
        logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Nenhum Floup ativo encontrado para companyId=${companyId}`);
        return;
      }
      
      logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Encontrados ${floupsAtivos.length} Floups ativos`);
      
      // Verificar se o contato já tem algum Floup ativo
      const floupAtivoExistente = await FloupSchedule.findOne({
        where: { 
          contactId, 
          companyId, 
          status: 'PENDING' 
        }
      });
      
      if (floupAtivoExistente) {
        logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Contato ${contactId} já possui Floup ativo (floupId=${floupAtivoExistente.floupId}, scheduleId=${floupAtivoExistente.id})`);
        return;
      }
      
      // Para cada Floup, verificar se a condição de ativação é "tag" e se corresponde à tag adicionada
      for (const floup of floupsAtivos) {
        // Verificar se o Floup tem passos (necessário para executar)
        if (!floup.steps || floup.steps.length === 0) {
          logger.debug(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Floup ${floup.id} não possui passos`);
          continue;
        }
        
        // Log detalhado da condição do Floup para debug
        logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Floup ${floup.id} (${floup.name}) - Condição: condition="${floup.condition}", conditionValue="${floup.conditionValue}", tagName procurada="${tagName}"`);
        
        // Verificar se a condição do Floup é "tag" e se corresponde à tag adicionada
        // Comparação case-insensitive e removendo espaços extras
        const conditionMatches = floup.condition === 'tag';
        const tagNameNormalized = (tagName || '').trim().toLowerCase();
        const conditionValueNormalized = (floup.conditionValue || '').trim().toLowerCase();
        const valueMatches = conditionValueNormalized === tagNameNormalized;
        
        logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Floup ${floup.id} - conditionMatches=${conditionMatches}, valueMatches=${valueMatches} (comparando "${conditionValueNormalized}" com "${tagNameNormalized}")`);
        
        if (conditionMatches && valueMatches) {
          logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → ✓ Floup ${floup.id} (${floup.name}) corresponde à tag "${tagName}", iniciando...`);
          
          // Buscar ticket mais recente do contato ou criar um novo se necessário
          const Ticket = (await import('../../models/Ticket')).default;
          let ticket = await Ticket.findOne({
            where: { contactId, companyId },
            order: [['updatedAt', 'DESC']]
          });
          
          // Se não tem ticket, não podemos iniciar o Floup (precisa de ticket para enviar mensagens)
          if (!ticket) {
            logger.warn(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Contato ${contactId} não possui ticket, não é possível iniciar Floup ${floup.id}`);
            continue;
          }
          
          logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Ticket encontrado: ticketId=${ticket.id}, channel=${ticket.channel}`);
          
          // Iniciar o Floup para o contato
          try {
            await this.atrelarFloupAContato(floup.id, companyId, contactId, ticket.id);
            logger.info(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → ✓✓✓ Floup ${floup.id} (${floup.name}) iniciado com sucesso para contato ${contactId}, ticket ${ticket.id}`);
          } catch (error) {
            logger.error(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Erro ao iniciar Floup ${floup.id}:`, error);
          }
        } else {
          logger.debug(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Floup ${floup.id} não corresponde: condition=${floup.condition}, conditionValue="${floup.conditionValue}"`);
        }
      }
    } catch (error) {
      logger.error(`[FLOUP] verificarEIniciarFloupsAoAdicionarTag → Erro geral:`, error);
    }
  }

  // Obter floup ativo de um contato
  static async obterFloupAtivoDoContato(contactId: number, companyId: number) {
    logger.info(`[FLOUP] service.obterFloupAtivoDoContato → contactId=${contactId}, companyId=${companyId}`);
    
    // Buscar todos os schedules do contato para debug
    const todosSchedulesDoContato = await FloupSchedule.findAll({
      where: { contactId, companyId },
      attributes: ['id', 'status', 'floupId', 'currentStepIndex', 'nextRunAt']
    });
    logger.info(`[FLOUP] service.obterFloupAtivoDoContato → Total de schedules do contato: ${todosSchedulesDoContato.length}, PENDING: ${todosSchedulesDoContato.filter(s => s.status === 'PENDING').length}`);
    
    const agendamentoAtivo = await FloupSchedule.findOne({
      where: { contactId, companyId, status: 'PENDING' },
      include: [{ model: Floup, as: 'floup', attributes: ['id', 'name', 'description', 'templateType', 'steps', 'stopConditions', 'pauseConditions'] }],
      order: [['nextRunAt', 'ASC']]
    });
    
    if (!agendamentoAtivo) {
      logger.info(`[FLOUP] service.obterFloupAtivoDoContato → Nenhum schedule PENDING encontrado`);
      return null;
    }
    
    logger.info(`[FLOUP] service.obterFloupAtivoDoContato → Schedule PENDING encontrado: id=${agendamentoAtivo.id}, floupId=${agendamentoAtivo.floupId}, nextRunAt=${agendamentoAtivo.nextRunAt?.toISOString()}`);
    const todosAgendamentos = await FloupSchedule.findAll({ where: { contactId, companyId, status: 'PENDING' }, order: [['nextRunAt', 'ASC']] });
    
    // Buscar todos os schedules do Floup (incluindo completados) para rastrear execuções
    const { Op } = require('sequelize');
    const todosSchedules = await FloupSchedule.findAll({
      where: {
        contactId,
        companyId,
        floupId: agendamentoAtivo.floupId,
        status: { [Op.in]: ['PENDING', 'COMPLETED'] }
      },
      order: [['createdAt', 'ASC']],
      attributes: ['id', 'currentStepIndex', 'status', 'updatedAt', 'createdAt', 'nextRunAt']
    });
    
    // Mapear quais passos foram executados e quando
    // Um passo foi executado se currentStepIndex > índice do passo
    const executedSteps = {};
    const currentIndex = agendamentoAtivo.currentStepIndex;
    
    // Para obter a data de execução correta, vamos buscar as mensagens enviadas pelo Floup
    // Cada passo executado cria uma mensagem, e podemos usar o createdAt da mensagem como data de execução
    const Message = (await import('../../models/Message')).default;
    const ticketId = agendamentoAtivo.ticketId;
    
    if (ticketId && agendamentoAtivo.floup.steps) {
      // Buscar mensagens enviadas pelo sistema (fromMe = true) neste ticket
      // que correspondem aos passos do Floup
      const messages = await Message.findAll({
        where: {
          ticketId,
          fromMe: true
        },
        order: [['createdAt', 'ASC']],
        attributes: ['id', 'body', 'createdAt', 'mediaType']
      });
      
      // Para cada passo executado, tentar encontrar a mensagem correspondente
      // Vamos usar uma abordagem mais robusta: buscar mensagens em ordem cronológica
      // e tentar correspondê-las aos passos pela ordem e conteúdo
      const usedMessageIds = new Set();
      
      for (let i = 0; i < currentIndex && i < agendamentoAtivo.floup.steps.length; i++) {
        const step = agendamentoAtivo.floup.steps[i];
        const stepMessage = (step.message || '').trim();
        
        // Procurar mensagem que corresponde ao passo
        // Primeiro, tentar encontrar por correspondência exata ou parcial do texto
        let matchingMessage = messages.find(msg => {
          if (usedMessageIds.has(msg.id)) return false; // Já foi usado para outro passo
          const msgBody = (msg.body || '').trim();
          if (!msgBody && !stepMessage) return true; // Ambos vazios
          if (!msgBody || !stepMessage) return false;
          
          // Verificar correspondência: mensagem contém texto do passo ou vice-versa
          const stepStart = stepMessage.substring(0, Math.min(30, stepMessage.length));
          const msgStart = msgBody.substring(0, Math.min(30, msgBody.length));
          
          return msgBody.includes(stepStart) || 
                 stepMessage.includes(msgStart) ||
                 msgBody === stepMessage ||
                 (stepStart.length > 10 && msgStart.length > 10 && 
                  msgStart.toLowerCase() === stepStart.toLowerCase());
        });
        
        // Se não encontrou por conteúdo, usar a mensagem mais recente não usada
        // que foi enviada após o início do Floup
        if (!matchingMessage && messages.length > 0) {
          const floupStartTime = agendamentoAtivo.createdAt;
          const availableMessages = messages.filter(msg => 
            !usedMessageIds.has(msg.id) && 
            new Date(msg.createdAt) >= new Date(floupStartTime)
          );
          
          if (availableMessages.length > i) {
            // Usar a i-ésima mensagem disponível (assumindo ordem de execução)
            matchingMessage = availableMessages[i];
          }
        }
        
        if (matchingMessage) {
          // Usar o createdAt da mensagem como data de execução exata
          usedMessageIds.add(matchingMessage.id);
          executedSteps[i] = {
            executedAt: matchingMessage.createdAt,
            scheduleId: agendamentoAtivo.id,
            messageId: matchingMessage.id
          };
        } else {
          // Se não encontrou mensagem correspondente, usar fallback
          // Procurar schedule que foi atualizado após a execução deste passo
          const scheduleForNextStep = todosSchedules.find(s => s.currentStepIndex === i + 1);
          if (scheduleForNextStep) {
            executedSteps[i] = {
              executedAt: scheduleForNextStep.updatedAt,
              scheduleId: scheduleForNextStep.id
            };
          } else {
            executedSteps[i] = {
              executedAt: agendamentoAtivo.updatedAt,
              scheduleId: agendamentoAtivo.id
            };
          }
        }
      }
    } else {
      // Fallback: se não tem ticketId, usar updatedAt dos schedules
      const schedulesSorted = [...todosSchedules].sort((a, b) => 
        new Date(a.updatedAt).getTime() - new Date(b.updatedAt).getTime()
      );
      
      for (let i = 0; i < currentIndex; i++) {
        const scheduleAfterExecution = schedulesSorted.find(s => s.currentStepIndex === i + 1);
        if (scheduleAfterExecution) {
          executedSteps[i] = {
            executedAt: scheduleAfterExecution.updatedAt,
            scheduleId: scheduleAfterExecution.id
          };
        } else {
          executedSteps[i] = {
            executedAt: agendamentoAtivo.updatedAt,
            scheduleId: agendamentoAtivo.id
          };
        }
      }
    }
    
    // Se há schedules completados, todos os passos foram executados
    const completedSchedules = todosSchedules.filter(s => s.status === 'COMPLETED');
    if (completedSchedules.length > 0 && agendamentoAtivo.floup.steps) {
      const lastCompleted = completedSchedules[completedSchedules.length - 1];
      for (let i = 0; i < agendamentoAtivo.floup.steps.length; i++) {
        if (!executedSteps[i]) {
          executedSteps[i] = {
            executedAt: lastCompleted.updatedAt,
            scheduleId: lastCompleted.id
          };
        }
      }
    }
    
    logger.info(`[FLOUP] service.obterFloupAtivoDoContato ✓ nextAt=${agendamentoAtivo.nextRunAt?.toISOString?.()}, executedSteps=${Object.keys(executedSteps).length}`);
    return { 
      ...agendamentoAtivo.floup.toJSON(), 
      activeSchedule: {
        id: agendamentoAtivo.id,
        currentStepIndex: agendamentoAtivo.currentStepIndex,
        stepOrder: agendamentoAtivo.stepOrder,
        nextRunAt: agendamentoAtivo.nextRunAt,
        status: agendamentoAtivo.status,
        createdAt: agendamentoAtivo.createdAt,
        updatedAt: agendamentoAtivo.updatedAt
      }, 
      totalPendingSteps: todosAgendamentos.length, 
      nextStepAt: agendamentoAtivo.nextRunAt,
      executedSteps // Informações sobre passos executados
    };
  }
}


