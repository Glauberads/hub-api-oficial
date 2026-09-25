import { Request, Response } from "express";
import { getIO } from "../libs/socket";
import * as TarefaService from "../services/TarefaServices/TarefaService";
import { sendPushToUser } from "../services/PushNotificationService";

const emit = (
  companyId: number,
  action: string,
  tarefa?: unknown,
  tarefaId?: string
) => {
  getIO()
    .of(String(companyId))
    .emit(`company${companyId}-tarefa`, {
      action,
      tarefa,
      tarefaId
    });
};

const isAdmin = (req: Request): boolean =>
  req.user.profile === "admin";

export const index = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const { companyId } = req.user;

  const {
    status,
    prioridade,
    dataFiltro,
    searchParam,
    scope,
    responsibleUserId
  } = req.query as Record<string, string>;

  const tarefas = await TarefaService.list({
    companyId,
    currentUserId: Number(req.user.id),
    isAdmin: isAdmin(req),
    status,
    prioridade,
    dataFiltro,
    searchParam,
    scope,
    responsibleUserId
  });

  return res.json({
    tarefas,
    count: tarefas.length
  });
};

export const resumo = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  const currentUserId = Number(req.user.id);

  const teamScope =
    req.query.scope === "team" &&
    req.user.profile === "admin";

  const resumo = await TarefaService.summary(
    companyId,
    currentUserId,
    teamScope
  );

  return res.json(resumo);
};

export const store = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  const userId = Number(req.user.id);

  const tarefa = await TarefaService.create(
    req.body,
    companyId,
    userId,
    isAdmin(req)
  );

  emit(companyId, "create", tarefa);

  // Se a tarefa foi atribuída para outra pessoa,
  // envia push somente para o responsável.
  if (
    tarefa.responsibleUserId &&
    Number(tarefa.responsibleUserId) !== userId
  ) {
    const prazo = tarefa.dataLimite
      ? String(tarefa.dataLimite)
          .split("-")
          .reverse()
          .join("/")
      : "Sem prazo";

    await sendPushToUser(
      Number(tarefa.responsibleUserId),
      companyId,
      {
        title: "Nova tarefa atribuída",
        body: `${tarefa.nome} • Prazo: ${prazo}`,
        tag: `tarefa-${tarefa.id}`,
        url: "/tarefas"
      }
    );
  }

  return res.status(201).json(tarefa);
};

export const update = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  const userId = Number(req.user.id);

  const tarefa = await TarefaService.update(
    req.params.id,
    req.body,
    companyId,
    userId,
    isAdmin(req)
  );

  emit(companyId, "update", tarefa);

  return res.json(tarefa);
};

export const mover = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  const userId = Number(req.user.id);

  const tarefa = await TarefaService.move(
    req.params.id,
    req.body.status,
    companyId,
    userId,
    isAdmin(req)
  );

  emit(companyId, "update", tarefa);

  return res.json(tarefa);
};

export const duplicar = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  const userId = Number(req.user.id);

  const tarefa = await TarefaService.duplicate(
    req.params.id,
    companyId,
    userId,
    isAdmin(req)
  );

  emit(companyId, "create", tarefa);

  return res.status(201).json(tarefa);
};

export const removeResolved = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);

  const tipo = String(
    req.query.tipo || "all"
  );

  const result =
    await TarefaService.removeResolved(
      companyId,
      isAdmin(req),
      tipo
    );

  // Emite exclusão individual para manter
  // outros usuários conectados sincronizados.
  result.ids.forEach(id => {
    emit(
      companyId,
      "delete",
      undefined,
      String(id)
    );
  });

  return res.json({
    message: "Tarefas resolvidas excluídas",
    count: result.count,
    ids: result.ids
  });
};

export const remove = async (
  req: Request,
  res: Response
): Promise<Response> => {
  const companyId = Number(req.user.companyId);
  const userId = Number(req.user.id);

  await TarefaService.remove(
    req.params.id,
    companyId,
    userId,
    isAdmin(req)
  );

  emit(companyId, "delete", undefined, req.params.id);

  return res.json({
    message: "Tarefa excluída"
  });
};
