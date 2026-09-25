import Setting from "../../models/Setting";

export const getCompanySetting = async (
  companyId: number,
  key: string,
  defaultValue = ""
): Promise<string> => {
  const setting = await Setting.findOne({
    where: {
      companyId,
      key
    }
  });

  return setting?.value ?? defaultValue;
};

export const getCompanySettingBool = async (
  companyId: number,
  key: string,
  defaultValue = false
): Promise<boolean> => {
  const value = await getCompanySetting(companyId, key, String(defaultValue));
  return ["true", "1", "yes", "sim", "on"].includes(String(value).toLowerCase());
};

export const getCompanySettingNumber = async (
  companyId: number,
  key: string,
  defaultValue: number,
  min?: number,
  max?: number
): Promise<number> => {
  const value = Number(await getCompanySetting(companyId, key, String(defaultValue)));

  if (Number.isNaN(value)) return defaultValue;
  if (min !== undefined && value < min) return min;
  if (max !== undefined && value > max) return max;

  return value;
};