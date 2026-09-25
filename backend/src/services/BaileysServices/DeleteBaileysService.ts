import Baileys from "../../models/Baileys";

const DeleteBaileysService = async (id: string | number): Promise<void> => {
  await Baileys.destroy({
    where: {
      whatsappId: id
    }
  });
};

export default DeleteBaileysService;
