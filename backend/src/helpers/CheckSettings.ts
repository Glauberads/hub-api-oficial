import Setting from "../models/Setting";
import AppError from "../errors/AppError";

//será usado por agora somente para userCreation
const CheckSettings = async (key: string, companyId?: number): Promise<string> => {
  const where: any = { key };
  if (companyId) {
    where.companyId = companyId;
  }

  const setting = await Setting.findOne({ where });

  if (!setting) {
    // Se não encontrou com companyId, tenta buscar sem filtro
    if (companyId) {
      const fallback = await Setting.findOne({ where: { key } });
      if (!fallback) return "disabled"; // padrão seguro
      return fallback.value;
    }
    return "disabled"; // padrão seguro em vez de lançar erro
  }

  return setting.value;
};

export default CheckSettings;

