import { Op, Order, literal } from "sequelize";
import { endOfMonth, endOfWeek, format, startOfMonth, startOfWeek } from "date-fns";
import AppError from "../../errors/AppError";
import Tarefa, { TarefaPrioridade, TarefaStatus } from "../../models/Tarefa";
import User from "../../models/User";
import Company from "../../models/Company";

const PRIORIDADES: TarefaPrioridade[] = ["baixa", "media", "alta", "urgente"];
const STATUS: TarefaStatus[] = ["aguardando", "andamento", "completa", "recusada"];
const hoje = () => format(new Date(), "yyyy-MM-dd");

const ensurePriority = (value: unknown): TarefaPrioridade => {
  if (!PRIORIDADES.includes(value as TarefaPrioridade)) throw new AppError("Prioridade inválida", 400);
  return value as TarefaPrioridade;
};

const ensureStatus = (value: unknown): TarefaStatus => {
  if (!STATUS.includes(value as TarefaStatus)) throw new AppError("Status inválido", 400);
  return value as TarefaStatus;
};

const show = async (id: number | string, companyId: number): Promise<Tarefa> => {
  const tarefa = await Tarefa.findOne({
    where: { id: Number(id), companyId },
    include: [
      { model: User, as: "user", attributes: ["id", "name"] },
      { model: User, as: "responsibleUser", attributes: ["id", "name"] },
      { model: Company, as: "company", attributes: ["id", "name"] }
    ]
  });
  if (!tarefa) throw new AppError("Tarefa não encontrada", 404);
  return tarefa;
};

interface ListParams {
  companyId: number;
  currentUserId: number;
  isAdmin: boolean;
  status?: string;
  prioridade?: string;
  dataFiltro?: string;
  searchParam?: string;
  scope?: string;
  responsibleUserId?: string;
}

const userInclude = [
  { model: User, as: "user", attributes: ["id", "name"] },
  { model: User, as: "responsibleUser", attributes: ["id", "name"] },
  { model: Company, as: "company", attributes: ["id", "name"] }
];

const ensureCompanyUser = async (
  userId: number,
  companyId: number
): Promise<number> => {
  const user = await User.findOne({
    where: { id: userId, companyId },
    attributes: ["id"]
  });

  if (!user) {
    throw new AppError("Usuário responsável inválido", 400);
  }

  return user.id;
};

const ensureTaskAccess = (
  tarefa: Tarefa,
  currentUserId: number,
  isAdmin: boolean
): void => {
  if (isAdmin) return;

  const responsibleId =
    tarefa.responsibleUserId || tarefa.userId;

  if (Number(responsibleId) !== Number(currentUserId)) {
    throw new AppError(
      "Você não possui permissão para acessar esta tarefa",
      403
    );
  }
};

export const list = async ({
  companyId,
  currentUserId,
  isAdmin,
  status,
  prioridade,
  dataFiltro,
  searchParam,
  scope,
  responsibleUserId
}: ListParams) => {
  const where: any = { companyId };

  // Usuário comum sempre vê somente as próprias tarefas.
  // O parâmetro scope enviado pelo frontend/API é ignorado.
  if (!isAdmin) {
    where.responsibleUserId = currentUserId;
  } else if (scope !== "all") {
    // Admin em "Minhas tarefas".
    where.responsibleUserId = currentUserId;
  } else if (responsibleUserId) {
    // Admin visualizando todas e filtrando um responsável.
    where.responsibleUserId = await ensureCompanyUser(
      Number(responsibleUserId),
      companyId
    );
  }

  if (status) where["status"] = ensureStatus(status);
  if (prioridade) where["prioridade"] = ensurePriority(prioridade);

  const now = new Date();
  if (dataFiltro === "hoje") where["dataLimite"] = hoje();
  if (dataFiltro === "semana") {
    where["dataLimite"] = {
      [Op.between]: [
        format(startOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd"),
        format(endOfWeek(now, { weekStartsOn: 1 }), "yyyy-MM-dd")
      ]
    };
  }
  if (dataFiltro === "mes") {
    where["dataLimite"] = {
      [Op.between]: [format(startOfMonth(now), "yyyy-MM-dd"), format(endOfMonth(now), "yyyy-MM-dd")]
    };
  }
  if (dataFiltro === "atrasadas") {
    where["dataLimite"] = {
      [Op.ne]: null,
      [Op.lt]: hoje()
    };

    where["status"] = {
      [Op.notIn]: ["completa", "recusada"]
    };
  }
  if (searchParam && searchParam.trim()) {
    const term = `%${searchParam.trim()}%`;
    where[Op.or] = [
      { nome: { [Op.iLike]: term } },
      { descricao: { [Op.iLike]: term } },
      { comentarios: { [Op.iLike]: term } }
    ];
  }

  const order: Order = [
    [literal(`CASE "prioridade" WHEN 'urgente' THEN 1 WHEN 'alta' THEN 2 WHEN 'media' THEN 3 ELSE 4 END`), "ASC"],
    ["createdAt", "DESC"]
  ];
  return Tarefa.findAll({
    where,
    include: userInclude,
    order
  });
};

export const summary = async (
  companyId: number,
  currentUserId: number,
  allCompany = false
) => {
  const today = hoje();

  const activeWhere: any = {
    companyId,
    status: {
      [Op.notIn]: ["completa", "recusada"]
    }
  };

  // Resumo normal = somente tarefas do usuário.
  // Resumo da equipe = toda a empresa, permitido apenas
  // quando o controller confirmar que é administrador.
  if (!allCompany) {
    activeWhere.responsibleUserId = currentUserId;
  }

  const [
    pending,
    dueToday,
    overdue,
    future,
    withoutDeadline
  ] = await Promise.all([
    Tarefa.count({
      where: activeWhere
    }),

    Tarefa.count({
      where: {
        ...activeWhere,
        dataLimite: today
      }
    }),

    Tarefa.count({
      where: {
        ...activeWhere,
        dataLimite: {
          [Op.lt]: today
        }
      }
    }),

    Tarefa.count({
      where: {
        ...activeWhere,
        dataLimite: {
          [Op.gt]: today
        }
      }
    }),

    Tarefa.count({
      where: {
        ...activeWhere,
        dataLimite: null
      }
    })
  ]);

  return {
    pending,
    today: dueToday,
    overdue,
    future,
    withoutDeadline
  };
};

interface WriteData {
  nome?: string;
  descricao?: string | null;
  dataLimite?: string | null;
  prioridade?: TarefaPrioridade;
  status?: TarefaStatus;
  comentarios?: string | null;
  responsibleUserId?: number | string | null;
}

const sanitize = (data: WriteData, allowStatus = false): WriteData => {
  const result: WriteData = {};
  if (data.nome !== undefined) {
    const nome = String(data.nome).trim();
    if (!nome || nome.length > 255) throw new AppError("Informe um nome válido para a tarefa", 400);
    result.nome = nome;
  }
  if (data.descricao !== undefined) result.descricao = data.descricao ? String(data.descricao).trim() : null;
  if (data.comentarios !== undefined) result.comentarios = data.comentarios ? String(data.comentarios).trim() : null;
  if (data.dataLimite !== undefined) {
    if (data.dataLimite && !/^\d{4}-\d{2}-\d{2}$/.test(data.dataLimite)) throw new AppError("Data limite inválida", 400);
    result.dataLimite = data.dataLimite || null;
  }
  if (data.prioridade !== undefined) result.prioridade = ensurePriority(data.prioridade);
  if (allowStatus && data.status !== undefined) result.status = ensureStatus(data.status);
  return result;
};

export const create = async (
  data: WriteData,
  companyId: number,
  userId: number,
  isAdmin: boolean
) => {
  const clean = sanitize(data);

  if (!clean.nome) {
    throw new AppError("O nome é obrigatório", 400);
  }

  let responsibleUserId = userId;

  // Somente administrador pode atribuir tarefa a outro usuário.
  if (isAdmin && data.responsibleUserId) {
    responsibleUserId = await ensureCompanyUser(
      Number(data.responsibleUserId),
      companyId
    );
  }

  const created = await Tarefa.create({
    ...clean,
    companyId,
    userId,
    responsibleUserId,
    status: "aguardando"
  });

  return show(created.id, companyId);
};

export const update = async (
  id: string,
  data: WriteData,
  companyId: number,
  currentUserId: number,
  isAdmin: boolean
) => {
  const tarefa = await show(id, companyId);

  ensureTaskAccess(
    tarefa,
    currentUserId,
    isAdmin
  );

  // Administrador pode editar qualquer tarefa.
  // Usuário comum só pode editar o conteúdo se ele próprio criou a tarefa.
  // Uma tarefa atribuída por outra pessoa pode ser executada/movida,
  // mas seus dados e prazo não podem ser alterados pelo responsável.
  if (
    !isAdmin &&
    Number(tarefa.userId) !== Number(currentUserId)
  ) {
    throw new AppError(
      "Esta tarefa foi atribuída a você e somente quem a criou ou um administrador pode editar seus dados",
      403
    );
  }

  const clean: any = sanitize(data, true);

  if (
    data.responsibleUserId !== undefined &&
    data.responsibleUserId !== null
  ) {
    if (isAdmin) {
      clean.responsibleUserId =
        await ensureCompanyUser(
          Number(data.responsibleUserId),
          companyId
        );
    } else {
      clean.responsibleUserId = currentUserId;
    }
  }

  await tarefa.update(clean);

  return show(tarefa.id, companyId);
};

export const move = async (
  id: string,
  status: unknown,
  companyId: number,
  currentUserId: number,
  isAdmin: boolean
) => {
  const tarefa = await show(id, companyId);

  ensureTaskAccess(
    tarefa,
    currentUserId,
    isAdmin
  );

  await tarefa.update({
    status: ensureStatus(status)
  });

  return show(tarefa.id, companyId);
};

export const duplicate = async (
  id: string,
  companyId: number,
  userId: number,
  isAdmin: boolean
) => {
  const original = await show(id, companyId);

  ensureTaskAccess(
    original,
    userId,
    isAdmin
  );

  const responsibleUserId = isAdmin
    ? original.responsibleUserId || userId
    : userId;

  const created = await Tarefa.create({
    companyId,
    userId,
    responsibleUserId,
    nome: `${original.nome} (cópia)`.slice(0, 255),
    descricao: original.descricao,
    dataLimite: original.dataLimite,
    prioridade: original.prioridade,
    status: "aguardando",
    comentarios: original.comentarios
  });

  return show(created.id, companyId);
};

export const remove = async (
  id: string,
  companyId: number,
  currentUserId: number,
  isAdmin: boolean
) => {
  const tarefa = await show(id, companyId);

  // Administrador pode excluir qualquer tarefa da empresa.
  // Usuário comum somente tarefas que ele próprio criou.
  if (
    !isAdmin &&
    Number(tarefa.userId) !== Number(currentUserId)
  ) {
    throw new AppError(
      "Você só pode excluir tarefas criadas por você",
      403
    );
  }

  await tarefa.destroy();
};

export const removeResolved = async (
  companyId: number,
  isAdmin: boolean,
  tipo: string
) => {
  if (!isAdmin) {
    throw new AppError(
      "Somente administradores podem excluir tarefas resolvidas em lote",
      403
    );
  }

  const tiposPermitidos = [
    "all",
    "completa",
    "recusada"
  ];

  if (!tiposPermitidos.includes(tipo)) {
    throw new AppError(
      "Tipo de exclusão de tarefas inválido",
      400
    );
  }

  const statusList: TarefaStatus[] =
    tipo === "all"
      ? ["completa", "recusada"]
      : [tipo as TarefaStatus];

  const tarefas = await Tarefa.findAll({
    where: {
      companyId,
      status: {
        [Op.in]: statusList
      }
    },
    attributes: ["id"]
  });

  const ids = tarefas.map(tarefa =>
    Number(tarefa.id)
  );

  if (ids.length === 0) {
    return {
      count: 0,
      ids: []
    };
  }

  await Tarefa.destroy({
    where: {
      companyId,
      id: {
        [Op.in]: ids
      }
    }
  });

  return {
    count: ids.length,
    ids
  };
};
