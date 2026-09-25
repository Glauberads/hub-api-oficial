import CallHistory from "../../models/CallHistory";

interface DeleteCallRequest {
  id: number;
  companyId: number;
}

const DeleteCallService = async ({
  id,
  companyId
}: DeleteCallRequest): Promise<void> => {
  const call = await CallHistory.findOne({
    where: {
      id,
      company_id: companyId
    } as any
  });

  if (!call) {
    throw new Error("Registro de chamada não encontrado.");
  }

  await call.destroy();
};

export default DeleteCallService;