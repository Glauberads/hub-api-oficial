import QuickMessage from "../../models/QuickMessage";
import QuickMessageComponent from "../../models/QuickMessageComponent";
import AppError from "../../errors/AppError";

const DeleteService = async (id: string): Promise<void> => {
  const record = await QuickMessage.findOne({
    where: { id }
  });

  if (!record) {
    throw new AppError("ERR_NO_QUICKMESSAGE_FOUND", 404);
  }

  // Deletar componentes associados antes de deletar o template
  await QuickMessageComponent.destroy({
    where: { quickMessageId: record.id }
  });

  await record.destroy();
};

export default DeleteService;
