import moment from "moment";
import { Op } from "sequelize";
import Campaign from "../../models/Campaign";
import AppError from "../../errors/AppError";

interface RecurrenceConfig {
  type: string;
  interval: number;
  daysOfWeek?: number[];
  dayOfMonth?: number;
}

class RecurrenceService {
  static calculateNextExecution(
    lastExecution: Date,
    config: RecurrenceConfig
  ): Date {
    const lastMoment = moment(lastExecution);
    let nextExecution: moment.Moment;

    switch (config.type) {
      case 'minutely':
        nextExecution = lastMoment.clone().add(config.interval, 'minutes');
        break;

      case 'hourly':
        nextExecution = lastMoment.clone().add(config.interval, 'hours');
        break;

      case 'daily':
        nextExecution = lastMoment.clone().add(config.interval, 'days');
        break;

      case 'weekly':
        if (!config.daysOfWeek || config.daysOfWeek.length === 0) {
          nextExecution = lastMoment.clone().add(config.interval, 'weeks');
        } else {
          nextExecution = this.calculateNextWeeklyExecution(lastMoment, config);
        }
        break;

      case 'biweekly':
        nextExecution = lastMoment.clone().add(config.interval * 2, 'weeks');
        break;

      case 'monthly':
        if (config.dayOfMonth) {
          nextExecution = this.calculateNextMonthlyExecution(lastMoment, config);
        } else {
          nextExecution = lastMoment.clone().add(config.interval, 'months');
        }
        break;

      case 'yearly':
        nextExecution = lastMoment.clone().add(config.interval, 'years');
        break;

      default:
        throw new AppError('Tipo de recorrência inválido', 400);
    }

    return nextExecution.toDate();
  }

  private static calculateNextWeeklyExecution(
    lastMoment: moment.Moment,
    config: RecurrenceConfig
  ): moment.Moment {
    const daysOfWeek = config.daysOfWeek!.sort();
    const currentDayOfWeek = lastMoment.day();

    // Encontrar próximo dia da semana
    let nextDay = daysOfWeek.find(day => day > currentDayOfWeek);

    if (nextDay !== undefined) {
      // Próximo dia na mesma semana
      return lastMoment.clone().day(nextDay);
    } else {
      // Primeiro dia da próxima semana do ciclo
      const weeksToAdd = config.interval;
      return lastMoment.clone()
        .add(weeksToAdd, 'weeks')
        .day(daysOfWeek[0]);
    }
  }

  private static calculateNextMonthlyExecution(
    lastMoment: moment.Moment,
    config: RecurrenceConfig
  ): moment.Moment {
    let nextExecution = lastMoment.clone().add(config.interval, 'months');

    // Ajustar para o dia específico do mês
    nextExecution.date(config.dayOfMonth!);

    // Se o dia não existe no mês, usar o último dia do mês
    if (nextExecution.date() !== config.dayOfMonth) {
      nextExecution = nextExecution.endOf('month');
    }

    return nextExecution;
  }

  static shouldContinueRecurrence(campaign: Campaign): boolean {
    const now = new Date();

    // Verificar data limite
    if (campaign.recurrenceEndDate && now > campaign.recurrenceEndDate) {
      return false;
    }

    // Verificar número máximo de execuções
    if (campaign.maxExecutions && campaign.executionCount >= campaign.maxExecutions) {
      return false;
    }

    return true;
  }

  static async scheduleNextExecution(campaignId: number): Promise<void> {
    console.log(`[RDS-RECURRENCE] Iniciando agendamento para campanha ${campaignId}`);

    // Buscar campanha com lock implícito (recarregar do banco)
    const campaign = await Campaign.findByPk(campaignId);

    if (!campaign || !campaign.isRecurring) {
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId} não encontrada ou não é recorrente`);
      return;
    }

    // Verificar se já foi finalizada ou cancelada
    if (campaign.status === 'FINALIZADA' || campaign.status === 'CANCELADA') {
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId} está ${campaign.status}, não agendando próxima execução`);
      return;
    }

    // Verificar se já tem uma próxima execução agendada (evitar duplicação)
    if (campaign.nextScheduledAt && moment(campaign.nextScheduledAt).isAfter(moment())) {
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId} já tem próxima execução agendada para ${campaign.nextScheduledAt}`);
      return;
    }

    console.log(`[RECURRENCE] Campanha ${campaignId}: executionCount=${campaign.executionCount}, maxExecutions=${campaign.maxExecutions}`);

    if (!this.shouldContinueRecurrence(campaign)) {
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId} deve ser finalizada`);
      await Campaign.update(
        {
          status: 'FINALIZADA',
          nextScheduledAt: null
        },
        {
          where: {
            id: campaignId,
            status: { [Op.ne]: 'FINALIZADA' }
          }
        }
      );
      return;
    }

    const config: RecurrenceConfig = {
      type: campaign.recurrenceType,
      interval: campaign.recurrenceInterval,
      daysOfWeek: campaign.recurrenceDaysOfWeek ?
        JSON.parse(campaign.recurrenceDaysOfWeek) : undefined,
      dayOfMonth: campaign.recurrenceDayOfMonth
    };

    // Se é a primeira execução (executionCount === 0 e lastExecutedAt é null)
    // usar scheduledAt diretamente, sem adicionar intervalo
    let nextExecution: Date;
    
    if (campaign.executionCount === 0 && !campaign.lastExecutedAt) {
      // Primeira execução: usar scheduledAt diretamente
      nextExecution = campaign.scheduledAt;
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId}: primeira execução será no horário agendado ${nextExecution}`);
    } else {
      // Execuções subsequentes: calcular a partir da última execução + intervalo
      const lastExecution = campaign.lastExecutedAt || campaign.scheduledAt;
      nextExecution = this.calculateNextExecution(lastExecution, config);
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId}: próxima execução calculada a partir de ${lastExecution} para ${nextExecution}`);
    }

    console.log(`[RDS-RECURRENCE] Campanha ${campaignId}: próxima execução agendada para ${nextExecution}`);

    // Usar UPDATE atômico para evitar duplicação
    const [updatedRows] = await Campaign.update(
      {
        nextScheduledAt: nextExecution,
        status: 'PROGRAMADA'
      },
      {
        where: {
          id: campaignId,
          status: { [Op.ne]: 'FINALIZADA' }, // Apenas atualizar se não foi finalizada
          [Op.or]: [
            { nextScheduledAt: null }, // Não tem próxima execução agendada
            { nextScheduledAt: { [Op.lt]: moment().toDate() } } // Ou a próxima execução já passou
          ]
        }
      }
    );

    if (updatedRows > 0) {
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId}: status atualizado para PROGRAMADA`);
    } else {
      console.log(`[RDS-RECURRENCE] Campanha ${campaignId}: não foi atualizada (pode já ter sido atualizada por outro processo)`);
    }
  }
}

export default RecurrenceService;
