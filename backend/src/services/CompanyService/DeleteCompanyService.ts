import { Op } from "sequelize";
import sequelize from "../../database";
import Company from "../../models/Company";
import Queue from "../../models/Queue";
import Prompt from "../../models/Prompt";
import Whatsapp from "../../models/Whatsapp";
import AppError from "../../errors/AppError";

const DeleteCompanyService = async (id: string): Promise<void> => {
  const transaction = await sequelize.transaction();

  try {
    const company = await Company.findOne({
      where: { id },
      transaction
    });

    if (!company) {
      throw new AppError("ERR_NO_COMPANY_FOUND", 404);
    }

    const queues = await Queue.findAll({
      where: { companyId: id },
      attributes: ["id"],
      transaction
    });

    const queueIds = queues.map(queue => queue.id);

    // Localiza todos os prompts que serão removidos junto com a empresa.
    const prompts = await Prompt.findAll({
      where:
        queueIds.length > 0
          ? {
              [Op.or]: [
                { companyId: id },
                { queueId: { [Op.in]: queueIds } }
              ]
            }
          : { companyId: id },
      attributes: ["id"],
      transaction
    });

    const promptIds = prompts.map(prompt => prompt.id);

    // Uma conexão pode apontar para um prompt. O vínculo precisa ser
    // removido antes do DELETE para não violar Whatsapps_promptId_fkey.
    if (promptIds.length > 0) {
      await Whatsapp.update(
        { promptId: null } as any,
        {
          where: {
            promptId: {
              [Op.in]: promptIds
            }
          },
          transaction
        }
      );
    }

    if (queueIds.length > 0) {
      await Prompt.destroy({
        where: {
          [Op.or]: [
            { companyId: id },
            { queueId: { [Op.in]: queueIds } }
          ]
        },
        transaction
      });

      await Queue.destroy({
        where: {
          id: {
            [Op.in]: queueIds
          }
        },
        transaction
      });
    } else {
      await Prompt.destroy({
        where: { companyId: id },
        transaction
      });
    }

    await company.destroy({ transaction });

    await transaction.commit();
  } catch (error) {
    await transaction.rollback();
    throw error;
  }
};

export default DeleteCompanyService;