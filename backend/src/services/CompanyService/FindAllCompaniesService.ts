import Company from "../../models/Company";
import Plan from "../../models/Plan";
import Setting from "../../models/Setting";

const FindAllCompanyService = async (): Promise<Company[]> => {
  const companies = await Company.findAll({
    attributes: [
      "id",
      "name",
      "email",
      "phone",
      "planId",
      "status",
      "dueDate",
      "recurrence",
      "document",
      "paymentMethod",
      "generateInvoice",
      "createdAt",
      "lastLogin"
    ],
    order: [["name", "ASC"]],
    include: [
      { model: Plan, as: "plan", attributes: ["id", "name", "amount", "currency"] },
      { model: Setting, as: "settings" }
    ]
  });
  return companies;
};

export default FindAllCompanyService;
