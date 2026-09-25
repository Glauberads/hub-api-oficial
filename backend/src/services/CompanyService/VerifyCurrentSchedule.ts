import { QueryTypes } from "sequelize";
import sequelize from "../../database";
import { scheduleCache } from "../../utils/SimpleObjectCache";

type Result = {
  id: number;
  currentSchedule: [];
  startTimeA: string;
  endTimeA: string;
  startTimeB: string;
  endTimeB: string;
  inActivity: boolean;
};

/**
 * Gera chave de cache baseada no minuto atual (invalida automaticamente a cada minuto).
 * O horário de funcionamento não muda a cada segundo, então 1 min de TTL é suficiente.
 */
const getCacheKey = (companyId: number, queueId: number, whatsappId: number): string => {
  const minuteSlot = Math.floor(Date.now() / 60000); // muda a cada minuto
  return `schedule:${companyId}:${queueId}:${whatsappId}:${minuteSlot}`;
};

const VerifyCurrentSchedule = async (companyId?: number, queueId?: number, whatsappId?: number): Promise<Result> => {
  const cacheKey = getCacheKey(companyId || 0, queueId || 0, whatsappId || 0);

  return scheduleCache.getOrFetch(cacheKey, async () => {
    // @ts-ignore: Unreachable code error
  if (Number(whatsappId) > 0 && Number(queueId === 0)) {
    const sql = `
        select
        s.id,
        s.currentWeekday,
        s.currentSchedule,
          (s.currentSchedule->>'startTimeA') "startTimeA",
          (s.currentSchedule->>'endTimeA') "endTimeA",
          (s.currentSchedule->>'startTimeB') "startTimeB",
          (s.currentSchedule->>'endTimeB') "endTimeB",
          ( (
            case 
            	when s.currentSchedule->>'startTimeA' = '' then now()::time >= '00:00'::time
    			ELSE now()::time >= (s.currentSchedule->>'startTimeA')::time	
            end
 			) and (
            case 
            	when s.currentSchedule->>'endTimeA' = ''then now()::time <= '00:00'::time
    			ELSE now()::time <= (s.currentSchedule->>'endTimeA')::time	
            end ) ) or ( (
            case 
            	when s.currentSchedule->>'startTimeB' = ''then now()::time >= '00:00'::time
    			ELSE now()::time >= (s.currentSchedule->>'startTimeB')::time	
            end
 			) and (
            case 
            	when s.currentSchedule->>'endTimeB' = ''then now()::time <= '00:00'::time
    			ELSE now()::time <= (s.currentSchedule->>'endTimeB')::time	
            end 
          )) "inActivity"
      from (
        SELECT
              c.id,
              to_char(current_date, 'day') currentWeekday,
              (array_to_json(array_agg(s))->>0)::jsonb currentSchedule
        FROM "Whatsapps" c, jsonb_array_elements(c.schedules) s
        WHERE s->>'weekdayEn' like trim(to_char(current_date, 'day')) and c.id = :whatsappId
        and c."companyId" = :companyId
        GROUP BY 1, 2
      ) s      
    `;

    const result: Result = await sequelize.query(sql, {
      replacements: { whatsappId, companyId },
      type: QueryTypes.SELECT,
      plain: true
    });

    return result;
  }
    // @ts-ignore: Unreachable code error
  else if (Number(queueId) === 0 && Number(whatsappId) === 0) {
    const sql = `
        select
        s.id,
        s.currentWeekday,
        s.currentSchedule,
          (s.currentSchedule->>'startTimeA') "startTimeA",
          (s.currentSchedule->>'endTimeA') "endTimeA",
          (s.currentSchedule->>'startTimeB') "startTimeB",
          (s.currentSchedule->>'endTimeB') "endTimeB",
          ( (
            case 
            	when s.currentSchedule->>'startTimeA' = '' then now()::time >= '00:00'::time
    			ELSE now()::time >= (s.currentSchedule->>'startTimeA')::time	
            end
 			) and (
            case 
            	when s.currentSchedule->>'endTimeA' = ''then now()::time <= '00:00'::time
    			ELSE now()::time <= (s.currentSchedule->>'endTimeA')::time	
            end ) ) or ( (
            case 
            	when s.currentSchedule->>'startTimeB' = ''then now()::time >= '00:00'::time
    			ELSE now()::time >= (s.currentSchedule->>'startTimeB')::time	
            end
 			) and (
            case 
            	when s.currentSchedule->>'endTimeB' = ''then now()::time <= '00:00'::time
    			ELSE now()::time <= (s.currentSchedule->>'endTimeB')::time	
            end 
          )) "inActivity"
      from (
        SELECT
              c.id,
              to_char(current_date, 'day') currentWeekday,
              (array_to_json(array_agg(s))->>0)::jsonb currentSchedule
        FROM "Companies" c, jsonb_array_elements(c.schedules) s
        WHERE s->>'weekdayEn' like trim(to_char(current_date, 'day')) and c.id = :companyId
        GROUP BY 1, 2
      ) s      
    `;

    const result: Result = await sequelize.query(sql, {
      replacements: { companyId },
      type: QueryTypes.SELECT,
      plain: true
    });

    return result;
  } else {
    const sql = `
      select
        s.id,
        s.currentWeekday,
        s.currentSchedule,
          (s.currentSchedule->>'startTimeA') "startTimeA",
          (s.currentSchedule->>'endTimeA') "endTimeA",
          (s.currentSchedule->>'startTimeB') "startTimeB",
          (s.currentSchedule->>'endTimeB') "endTimeB",
          COALESCE(( (
            case 
            	when s.currentSchedule->>'startTimeA' = '' then now()::time >= '00:00'::time
    			ELSE now()::time >= (s.currentSchedule->>'startTimeA')::time	
            end
 			) and (
            case 
            	when s.currentSchedule->>'endTimeA' = ''then now()::time <= '00:00'::time
    			ELSE now()::time <= (s.currentSchedule->>'endTimeA')::time	
            end ) ) or ( (
            case 
            	when s.currentSchedule->>'startTimeB' = ''then now()::time >= '00:00'::time
    			ELSE now()::time >= (s.currentSchedule->>'startTimeB')::time	
            end
 			) and (
            case 
            	when s.currentSchedule->>'endTimeB' = ''then now()::time <= '00:00'::time
    			ELSE now()::time <= (s.currentSchedule->>'endTimeB')::time	
            end 
          )),false)  "inActivity"
      from (
        SELECT
              q.id,
              to_char(current_date, 'day') currentWeekday,
              (array_to_json(array_agg(s))->>0)::jsonb currentSchedule
        FROM "Queues" q, jsonb_array_elements(q.schedules) s
        WHERE s->>'weekdayEn' like trim(to_char(current_date, 'day')) and q.id = :queueId
        and q."companyId" = :companyId
        GROUP BY 1, 2
      ) s     
    `;

    const result: Result = await sequelize.query(sql, {
      replacements: { queueId, companyId },
      type: QueryTypes.SELECT,
      plain: true
    });

    return result;
  }
  }, 60); // TTL 60 segundos
};

export default VerifyCurrentSchedule;
