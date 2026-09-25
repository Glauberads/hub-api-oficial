import * as Yup from "yup";

import AppError from "../../errors/AppError";
import ScheduledMessages from "../../models/ScheduledMessages";
import Tag from "../../models/Tag";
import Contact from "../../models/Contact";
import User from "../../models/User";
import { zonedTimeToUtc } from "date-fns-tz";

interface Request {
  data_mensagem_programada: string;
  id_conexao: String;
  intervalo: string;
  valor_intervalo: string;
  mensagem: string;
  tipo_dias_envio: string;
  mostrar_usuario_mensagem: boolean;
  criar_ticket: boolean;
  contatos: String[];
  tags: String[];
  companyId: number;
  nome: string;
  mediaPath: string;
  mediaName: string;
  tipo_arquivo: string;
  usuario_envio: string;
  enviar_quantas_vezes: string;
}

const CreateService = async ({
  data_mensagem_programada,
  id_conexao,
  intervalo,
  valor_intervalo,
  mensagem,
  tipo_dias_envio,
  mostrar_usuario_mensagem,
  criar_ticket,
  contatos,
  tags,
  companyId,
  nome,
  mediaPath,
  mediaName,
  tipo_arquivo,
  usuario_envio,
  enviar_quantas_vezes
}: Request): Promise<ScheduledMessages> => {
  const schema = Yup.object().shape({
    data_mensagem_programada: Yup.string().required(),
    nome: Yup.string().required(),
    intervalo: Yup.string().required(),
    valor_intervalo: Yup.string().required(),
    mensagem: Yup.string().required(),
    tipo_dias_envio: Yup.string().required(),
    mostrar_usuario_mensagem: Yup.boolean().required(),
    criar_ticket: Yup.boolean().required(),
    companyId: Yup.number().required(),
    enviar_quantas_vezes: Yup.string().required(),
    mediaPath: Yup.string(),
    mediaName: Yup.string(),
    tipo_arquivo: Yup.string(),
    usuario_envio: Yup.string()
  });

  try {
    await schema.validate({
      data_mensagem_programada,
      id_conexao,
      intervalo,
      valor_intervalo,
      mensagem,
      tipo_dias_envio,
      mostrar_usuario_mensagem,
      criar_ticket,
      contatos,
      tags,
      companyId,
      nome,
      mediaPath,
      mediaName,
      tipo_arquivo,
      usuario_envio,
      enviar_quantas_vezes
    });
  } catch (err: any) {
    throw new AppError(err.message);
  }

  let userTimezone = "America/Sao_Paulo";

  try {
    if (usuario_envio) {
      const maybeId = Number(usuario_envio);

      if (!Number.isNaN(maybeId)) {
        const user = await User.findByPk(maybeId, {
          attributes: ["id", "timezone"]
        });

        if (user?.timezone) {
          userTimezone = user.timezone;
        }
      }
    }
  } catch (error) {
    userTimezone = "America/Sao_Paulo";
  }

  let dataProgramadaUtc: Date;

  try {
    dataProgramadaUtc = zonedTimeToUtc(
      data_mensagem_programada,
      userTimezone
    );
  } catch (error) {
    dataProgramadaUtc = new Date(data_mensagem_programada);
  }

  const schedule = await ScheduledMessages.create({
    data_mensagem_programada: dataProgramadaUtc,
    id_conexao,
    intervalo,
    valor_intervalo,
    mensagem,
    tipo_dias_envio,
    mostrar_usuario_mensagem,
    criar_ticket,
    contatos,
    tags,
    companyId,
    nome,
    mediaPath,
    mediaName,
    tipo_arquivo,
    usuario_envio,
    enviar_quantas_vezes
  });

  await schedule.reload();

  return schedule;
};

export default CreateService;