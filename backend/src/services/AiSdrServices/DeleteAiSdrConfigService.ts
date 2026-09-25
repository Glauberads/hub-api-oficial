import ShowAiSdrConfigService from "./ShowAiSdrConfigService";

interface Request {
  id: number;
  companyId: number;
}

const DeleteAiSdrConfigService = async ({ id, companyId }: Request): Promise<void> => {
  const config = await ShowAiSdrConfigService({ id, companyId });

  await config.destroy();
};

export default DeleteAiSdrConfigService;
