import { QueryTypes } from "sequelize";
import sequelize from "../../database";

interface Request { initialDate: string; finalDate: string; companyId: number; }

const asNumber = (value: any) => Number(value || 0);

const UserPerformanceService = async ({ initialDate, finalDate, companyId }: Request): Promise<any> => {
  const replacements = {
    companyId,
    startAt: `${initialDate} 00:00:00`,
    endAt: `${finalDate} 23:59:59.999`
  };
  const rows: any[] = await sequelize.query(`
    SELECT u.id AS "userId", u.name AS "userName", u.online,
      COUNT(DISTINCT tt.id) AS "totalTickets",
      COUNT(DISTINCT CASE WHEN t.status = 'open' THEN t.id END) AS "openTickets",
      COUNT(DISTINCT CASE WHEN t.status = 'pending' THEN t.id END) AS "pendingTickets",
      COUNT(DISTINCT CASE WHEN t.status = 'closed' THEN t.id END) AS "closedTickets",
      COALESCE(AVG(CASE WHEN COALESCE(tt."closedAt", tt."finishedAt") IS NOT NULL AND tt."startedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (COALESCE(tt."closedAt", tt."finishedAt") - tt."startedAt")) / 60 END), 0) AS "avgSupportTime",
      COALESCE(AVG(CASE WHEN tt."queuedAt" IS NOT NULL AND tt."startedAt" IS NOT NULL THEN EXTRACT(EPOCH FROM (tt."startedAt" - tt."queuedAt")) / 60 END), 0) AS "avgWaitTime",
      COALESCE(AVG(ur.rate), 0) AS "avgRating", COUNT(DISTINCT ur.id) AS "totalRatings"
    FROM "Users" u
    LEFT JOIN "TicketTraking" tt ON tt."userId" = u.id AND tt."companyId" = :companyId AND tt."createdAt" BETWEEN :startAt AND :endAt
    LEFT JOIN "Tickets" t ON t.id = tt."ticketId" AND t."companyId" = :companyId
    LEFT JOIN "UserRatings" ur ON ur."ticketId" = t.id AND ur."userId" = u.id AND ur."companyId" = :companyId
    WHERE u."companyId" = :companyId
    GROUP BY u.id, u.name, u.online ORDER BY "totalTickets" DESC
  `, { replacements, type: QueryTypes.SELECT });

  const data = rows.map(row => ({
    ...row,
    totalTickets: asNumber(row.totalTickets), openTickets: asNumber(row.openTickets),
    pendingTickets: asNumber(row.pendingTickets), closedTickets: asNumber(row.closedTickets),
    avgSupportTime: asNumber(row.avgSupportTime), avgWaitTime: asNumber(row.avgWaitTime),
    avgRating: asNumber(row.avgRating), totalRatings: asNumber(row.totalRatings)
  }));
  const active = data.filter(item => item.totalTickets > 0);
  const weighted = (field: string) => active.length ? active.reduce((sum, item) => sum + item[field], 0) / active.length : 0;
  return {
    data,
    summary: {
      totalTickets: data.reduce((sum, item) => sum + item.totalTickets, 0),
      totalUsers: active.length,
      avgSupportTime: weighted("avgSupportTime"),
      avgWaitTime: weighted("avgWaitTime"),
      avgRating: weighted("avgRating")
    }
  };
};

export default UserPerformanceService;
