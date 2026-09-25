import User from "../../models/User";
import Whatsapp from "../../models/Whatsapp";

const GetWhatsappUserId = async (id: number) => {
  return await User.findOne({
    raw: true,
    nest: true,
    include: [{
      model: Whatsapp,
      as: "whatsapps",
      through: { attributes: [] },
      attributes: ["id", "status", "name", "companyId", "wavoip"],
      required: false
    }],
    where: { id }
  });
};

export default GetWhatsappUserId;
