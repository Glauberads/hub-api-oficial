import FloupService from "../plugins/floup/service";
import FloupSchedule from "../models/FloupSchedule";
import Floup from "../models/Floup";
import logger from "../utils/logger";
import { getIO } from "../libs/socket";
const CronJob = require("cron").CronJob;

/**
 * Job para processar agendamentos do Floup
 * Executa a cada minuto para verificar e executar passos agendados
 */
export const startFloupJob = () => {
  const floupJob = new CronJob(
    "*/5 * * * *", // A cada 5 minutos (otimizado para reduzir carga de CPU)
    async () => {
      try {
        const now = new Date();
        const { Op } = require('sequelize');
        
        // Buscar agendamentos pendentes que devem ser executados agora
        const schedulesToExecute = await FloupSchedule.findAll({
          where: {
            status: 'PENDING',
            nextRunAt: {
              [Op.lte]: now
            }
          },
          include: [
            {
              model: Floup,
              as: 'floup',
              attributes: ['id', 'name', 'steps', 'companyId']
            }
          ],
          order: [['nextRunAt', 'ASC']],
          limit: 50 // Processar até 50 por vez para não sobrecarregar
        });

        if (schedulesToExecute.length === 0) {
          return; // Nenhum agendamento para processar
        }

        logger.info(`[FLOUP] Job → Processando ${schedulesToExecute.length} agendamentos`);

        for (const schedule of schedulesToExecute) {
          try {
            // Verificar novamente se o schedule ainda está PENDING (pode ter sido cancelado entre a busca e o processamento)
            const scheduleAtualizado = await FloupSchedule.findByPk(schedule.id, {
              attributes: ['id', 'status', 'currentStepIndex', 'ticketId', 'contactId', 'floupId']
            });
            
            if (!scheduleAtualizado || scheduleAtualizado.status !== 'PENDING') {
              const statusMsg = scheduleAtualizado?.status || 'nao encontrado';
              logger.info(`[FLOUP] Job → Schedule ${schedule.id} nao esta mais PENDING (status: ${statusMsg}), pulando`);
              continue;
            }

            const floup = schedule.floup;
            if (!floup || !floup.steps || floup.steps.length === 0) {
              logger.warn(`[FLOUP] Job → Floup ${schedule.floupId} sem passos, cancelando schedule ${schedule.id}`);
              await schedule.update({ status: 'CANCELLED' });
              continue;
            }

            const stepIndex = schedule.currentStepIndex || 0;
            const ticketId = schedule.ticketId;
            const contactId = schedule.contactId;

            if (!ticketId && !contactId) {
              logger.warn(`[FLOUP] Job → Schedule ${schedule.id} sem ticketId nem contactId, cancelando`);
              await schedule.update({ status: 'CANCELLED' });
              continue;
            }

            // Se não tem ticketId mas tem contactId, buscar o ticket mais recente ABERTO do contato
            let finalTicketId = ticketId;
            if (!finalTicketId && contactId) {
              const Ticket = (await import('../models/Ticket')).default;
              // Priorizar tickets abertos ou pendentes
              let lastTicket = await Ticket.findOne({
                where: { contactId, companyId: floup.companyId, status: 'open' },
                order: [['updatedAt', 'DESC']]
              });
              if (!lastTicket) {
                lastTicket = await Ticket.findOne({
                  where: { contactId, companyId: floup.companyId, status: 'pending' },
                  order: [['updatedAt', 'DESC']]
                });
              }
              if (!lastTicket) {
                // Fallback: qualquer ticket
                lastTicket = await Ticket.findOne({
                  where: { contactId, companyId: floup.companyId },
                  order: [['updatedAt', 'DESC']]
                });
              }
              if (lastTicket) {
                finalTicketId = lastTicket.id;
              } else {
                logger.warn(`[FLOUP] Job → Contato ${contactId} sem tickets, cancelando schedule ${schedule.id}`);
                await schedule.update({ status: 'CANCELLED' });
                continue;
              }
            }

            logger.info(`[FLOUP] Job → Executando passo ${stepIndex + 1}/${floup.steps.length} do floup ${floup.id} para ticket ${finalTicketId}`);

            // Executar o passo
            const executed = await FloupService.executarPasso(floup.id, finalTicketId, stepIndex);

            if (!executed) {
              logger.warn(`[FLOUP] Job → Falha ao executar passo ${stepIndex + 1} do floup ${floup.id}, marcando como erro no schedule ${schedule.id}`);
              await schedule.update({ status: 'ERROR' });
              continue;
            }

            // Verificar novamente se o schedule ainda está PENDING antes de atualizar (pode ter sido cancelado durante a execução)
            const scheduleAntesUpdate = await FloupSchedule.findByPk(schedule.id, {
              attributes: ['id', 'status']
            });
            
            if (!scheduleAntesUpdate || scheduleAntesUpdate.status !== 'PENDING') {
              logger.info(`[FLOUP] Job → Schedule ${schedule.id} foi cancelado durante a execucao, nao atualizando`);
              continue;
            }

            // Verificar se há próximo passo
            const nextStepIndex = stepIndex + 1;
            if (nextStepIndex >= floup.steps.length) {
              // Último passo executado, marcar como concluído
              logger.info(`[FLOUP] Job → Floup ${floup.id} concluido para schedule ${schedule.id}`);
              await schedule.update({ status: 'COMPLETED' });
              
              // Emitir evento Socket.IO para atualizar o frontend (Floup concluído)
              try {
                const io = getIO();
                io.of(String(floup.companyId)).emit(`company-${floup.companyId}-floup-step-executed`, {
                  action: 'step-executed',
                  floupId: floup.id,
                  contactId: contactId,
                  scheduleId: schedule.id,
                  stepIndex: stepIndex,
                  nextStepIndex: null, // Não há próximo passo
                  executedAt: new Date().toISOString(),
                  completed: true
                });
                logger.info(`[FLOUP] Job → Evento Socket.IO emitido (Floup concluído): floupId=${floup.id}, contactId=${contactId}, stepIndex=${stepIndex}`);
              } catch (socketError) {
                logger.error(`[FLOUP] Job → Erro ao emitir evento Socket.IO:`, socketError);
              }
            } else {
              // Calcular próximo horário de execução baseado no passo atual executado
              const currentStep = floup.steps[stepIndex];
              const nextStep = floup.steps[nextStepIndex];
              
              // Usar o horário atual de execução como base para calcular o próximo
              const executionTime = new Date();
              const nextRunAt = FloupService.calcularProximoHorario(nextStep, executionTime);

              // Atualizar schedule para o próximo passo (usando update com where para garantir atomicidade)
              const [rowsUpdated] = await FloupSchedule.update({
                currentStepIndex: nextStepIndex,
                nextRunAt,
                stepOrder: nextStep.order || (nextStepIndex + 1),
                stepData: nextStep
              }, {
                where: {
                  id: schedule.id,
                  status: 'PENDING' // Só atualizar se ainda estiver PENDING
                }
              });

              if (rowsUpdated === 0) {
                logger.warn(`[FLOUP] Job → Schedule ${schedule.id} nao foi atualizado (provavelmente foi cancelado)`);
              } else {
                logger.info(`[FLOUP] Job → Proximo passo ${nextStepIndex + 1} agendado para ${nextRunAt.toISOString()}`);
                
                // Emitir evento Socket.IO para atualizar o frontend
                try {
                  const io = getIO();
                  io.of(String(floup.companyId)).emit(`company-${floup.companyId}-floup-step-executed`, {
                    action: 'step-executed',
                    floupId: floup.id,
                    contactId: contactId,
                    scheduleId: schedule.id,
                    stepIndex: stepIndex,
                    nextStepIndex: nextStepIndex,
                    executedAt: new Date().toISOString()
                  });
                  logger.info(`[FLOUP] Job → Evento Socket.IO emitido para atualizar frontend: floupId=${floup.id}, contactId=${contactId}, stepIndex=${stepIndex}`);
                } catch (socketError) {
                  logger.error(`[FLOUP] Job → Erro ao emitir evento Socket.IO:`, socketError);
                }
              }
            }
          } catch (error) {
            logger.error(`[FLOUP] Job → Erro ao processar schedule ${schedule.id}:`, error);
            // Marcar como erro mas não cancelar, pode ser temporário
            try {
              await schedule.update({ status: 'ERROR' });
            } catch (updateError) {
              logger.error(`[FLOUP] Job → Erro ao atualizar status do schedule ${schedule.id}:`, updateError);
            }
          }
        }

        logger.info(`[FLOUP] Job ✓ Processamento concluido`);
      } catch (error) {
        logger.error(`[FLOUP] Job → Erro geral no processamento:`, error);
      }
    },
    null, // onComplete
    true, // start immediately
    "America/Sao_Paulo" // timezone
  );

  logger.info(`[FLOUP] Job inicializado - executando a cada minuto`);

  return floupJob;
};

/**
 * Inicializa o job do Floup
 */
export const initializeFloupJob = () => {
  const floupJob = startFloupJob();

  // Graceful shutdown
  const shutdown = () => {
    logger.info('[FLOUP] Job → Parando job do Floup...');
    floupJob.stop();
  };

  process.on('SIGTERM', shutdown);
  process.on('SIGINT', shutdown);

  return { floupJob };
};
