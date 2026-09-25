import { FlowBuilderModel } from "../../models/FlowBuilder";

interface Request {
  companyId: number;
  flowId: number;
  active: boolean;
}

const UpdateFlowActiveService = async ({
  companyId,
  flowId,
  active
}: Request): Promise<FlowBuilderModel> => {
  try {
    const flow = await FlowBuilderModel.findOne({
      where: {
        id: flowId,
        company_id: companyId
      }
    });

    if (!flow) {
      throw new Error("Fluxo não encontrado");
    }

    await FlowBuilderModel.update(
      { active },
      {
        where: {
          id: flowId,
          company_id: companyId
        }
      }
    );

    await flow.reload();

    return flow;
  } catch (error) {
    console.error("Erro ao atualizar status do fluxo:", error);
    throw error;
  }
};

export default UpdateFlowActiveService;

