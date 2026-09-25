import Contact from "../../models/Contact";
import RenewalCustomer from "../../models/RenewalCustomer";
import CreateContactService from "../ContactServices/CreateContactService";

export const ensureRenewalContact = async (
  customer: RenewalCustomer,
  companyId: number
): Promise<Contact> => {
  const number = String(customer.phone || "").replace(/\D/g, "");

  let contact = await Contact.findOne({
    where: {
      number,
      companyId
    }
  });

  if (contact) {
    if (
      customer.name &&
      contact.name !== customer.name
    ) {
      await contact.update({
        name: customer.name
      });
    }

    return contact;
  }

  contact = await CreateContactService({
    name: customer.name,
    number,
    companyId,
    active: true,
    remoteJid: `${number}@s.whatsapp.net`
  });

  return contact;
};
